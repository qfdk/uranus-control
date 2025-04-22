// src/store/mqttStore.js
import {create} from 'zustand';
import mqtt from 'mqtt';
import {v4 as uuidv4} from 'uuid';
import useAgentStore from './agentStore';

// 节流函数
const throttle = (func, limit) => {
    let lastFunc;
    let lastRan;
    return function () {
        const context = this;
        const args = arguments;
        if (!lastRan) {
            func.apply(context, args);
            lastRan = Date.now();
        } else {
            clearTimeout(lastFunc);
            lastFunc = setTimeout(function () {
                if ((Date.now() - lastRan) >= limit) {
                    func.apply(context, args);
                    lastRan = Date.now();
                }
            }, limit - (Date.now() - lastRan));
        }
    };
};

// MQTT 主题
const TOPICS = {
    HEARTBEAT: 'uranus/heartbeat',    // 只读取，不发送
    STATUS: 'uranus/status',          // 只读取，不发送
    COMMAND: 'uranus/command/',       // 发送命令
    RESPONSE: 'uranus/response/'      // 接收响应
};

// 获取MQTT配置
const getMqttConfig = () => {
    if (typeof window === 'undefined') {
        return {
            MQTT_BROKER: 'wss://mqtt.qfdk.me/mqtt',
            CLIENT_PREFIX: 'uranus-frontend',
            RECONNECT_PERIOD: 3000,
            CONNECT_TIMEOUT: 30000,
            KEEPALIVE: 30
        };
    }

    // 尝试从localStorage获取配置
    try {
        const savedConfig = localStorage.getItem('mqttSettings');
        if (savedConfig) {
            const config = JSON.parse(savedConfig);
            return {
                MQTT_BROKER: config.url || 'wss://mqtt.qfdk.me/mqtt',
                CLIENT_PREFIX: 'uranus-frontend',
                RECONNECT_PERIOD: config.reconnectPeriod || 3000,
                CONNECT_TIMEOUT: config.connectTimeout || 30000,
                KEEPALIVE: config.keepalive || 30
            };
        }
    } catch (error) {
        console.error('读取MQTT配置失败:', error);
    }

    // 默认配置
    return {
        MQTT_BROKER: 'wss://mqtt.qfdk.me/mqtt',
        CLIENT_PREFIX: 'uranus-frontend',
        RECONNECT_PERIOD: 3000,
        CONNECT_TIMEOUT: 30000,
        KEEPALIVE: 30
    };
};

const useMqttStore = create((set, get) => {
    // 状态变量
    const clientId = `${getMqttConfig().CLIENT_PREFIX}-${uuidv4()}-${Date.now()}`;
    const pendingCommands = new Map();
    const agentState = {};
    let mqttClient = null;
    let cleanupInterval = null;

    // 节流更新到AgentStore，降低到300ms提高响应速度
    const updateAgentStoreThrottled = throttle((state) => {
        useAgentStore.getState().updateMqttAgentState({...state});
    }, 300);

    return {
        // 状态
        connected: false,
        error: null,
        currentAgent: null,
        reconnectCount: 0,
        isInitialized: false,

        // 初始化MQTT连接
        connect: () => {
            // 防止重复初始化
            if (get().isInitialized && mqttClient) {
                console.log('MQTT已经初始化，不需要重新连接');
                return;
            }

            const config = getMqttConfig();
            set({isInitialized: true});

            try {
                console.log(`正在连接到MQTT服务器(${config.MQTT_BROKER})...`);
                console.log(`使用客户端ID: ${clientId}`);

                // MQTT选项 - 简化配置
                const mqttOptions = {
                    clientId,
                    clean: true,
                    reconnectPeriod: config.RECONNECT_PERIOD,
                    connectTimeout: config.CONNECT_TIMEOUT,
                    keepalive: config.KEEPALIVE
                };

                mqttClient = mqtt.connect(config.MQTT_BROKER, mqttOptions);

                mqttClient.on('connect', () => {
                    console.log('MQTT连接成功');
                    set({connected: true, error: null, reconnectCount: 0});

                    // 通知agent store MQTT已连接
                    useAgentStore.getState().setMqttConnected(true);

                    // 只订阅必要主题 - 仅需监听
                    mqttClient.subscribe(TOPICS.HEARTBEAT, {qos: 0});
                    mqttClient.subscribe(TOPICS.STATUS, {qos: 0});

                    // 如果有当前查看的代理，订阅其响应主题
                    const currentAgentUUID = get().currentAgent;
                    if (currentAgentUUID) {
                        mqttClient.subscribe(`${TOPICS.RESPONSE}${currentAgentUUID}`, {qos: 0});
                    }
                });

                mqttClient.on('error', (err) => {
                    console.error('MQTT连接错误:', err);
                    set({error: err.message});
                });

                mqttClient.on('close', () => {
                    console.log('MQTT连接关闭');
                    set({connected: false});
                    useAgentStore.getState().setMqttConnected(false);
                });

                mqttClient.on('disconnect', (packet) => {
                    console.log('MQTT断开连接，原因:', packet);
                });

                mqttClient.on('reconnect', () => {
                    set(state => ({reconnectCount: state.reconnectCount + 1}));
                    console.log(`MQTT正在重新连接... (尝试: ${get().reconnectCount})`);
                });

                mqttClient.on('message', (topic, message) => {
                    try {
                        const payload = JSON.parse(message.toString());

                        if (topic === TOPICS.HEARTBEAT) {
                            // 处理心跳消息
                            if (payload.uuid) {
                                const uuid = payload.uuid;
                                const timestamp = new Date();

                                // 更新代理状态
                                agentState[uuid] = {
                                    ...agentState[uuid],
                                    ...payload,
                                    online: true,
                                    lastHeartbeat: timestamp,
                                    lastUpdate: timestamp
                                };

                                // 使用节流函数更新agent store中的MQTT状态
                                updateAgentStoreThrottled({...agentState});
                            }
                        } else if (topic.startsWith(TOPICS.RESPONSE)) {
                            console.log(`收到MQTT响应: ${topic}`, payload);
                            // 处理命令响应
                            const requestId = payload.requestId;

                            // 检查是否有对应的待处理命令
                            if (pendingCommands.has(requestId)) {
                                const {resolve, reject, timeoutId} = pendingCommands.get(requestId);

                                // 清除超时
                                if (timeoutId) {
                                    clearTimeout(timeoutId);
                                }

                                // 删除此命令
                                pendingCommands.delete(requestId);

                                // 根据响应结果处理Promise
                                if (payload.success) {
                                    resolve(payload);
                                } else {
                                    reject(new Error(payload.message || '命令执行失败'));
                                }
                            }
                        }
                    } catch (err) {
                        console.error('解析MQTT消息失败:', err, message.toString());
                    }
                });

                // 清理过期的命令
                if (cleanupInterval) clearInterval(cleanupInterval);
                cleanupInterval = setInterval(() => {
                    const now = Date.now();
                    pendingCommands.forEach(({timestamp, timeoutId}, requestId) => {
                        // 清理超过30秒的命令
                        if (now - timestamp > 30000) {
                            if (timeoutId) {
                                clearTimeout(timeoutId);
                            }
                            pendingCommands.delete(requestId);
                        }
                    });
                }, 10000);
            } catch (err) {
                console.error('MQTT连接失败:', err);
                set({error: err.message});
            }
        },

        // 断开MQTT连接
        disconnect: () => {
            if (mqttClient && mqttClient.connected) {
                mqttClient.end();
                set({connected: false, isInitialized: false});
                useAgentStore.getState().setMqttConnected(false);

                // 清理定时器
                if (cleanupInterval) clearInterval(cleanupInterval);

                mqttClient = null;
            }
        },

        // 设置当前查看的代理
        setCurrentAgent: (uuid) => {
            if (!uuid || get().currentAgent === uuid) return;

            if (mqttClient && mqttClient.connected) {
                // 订阅该代理的响应主题
                mqttClient.subscribe(`${TOPICS.RESPONSE}${uuid}`, {qos: 0});
            }
            set({currentAgent: uuid});
        },

        // 发送命令到代理
        sendCommand: (uuid, command, params = {}) => {
            return new Promise((resolve, reject) => {
                if (!mqttClient || !mqttClient.connected) {
                    reject(new Error('MQTT客户端未连接'));
                    return;
                }

                if (!uuid) {
                    reject(new Error('代理UUID是必需的'));
                    return;
                }

                // 确保订阅了代理的响应主题
                const responseTopic = `${TOPICS.RESPONSE}${uuid}`;
                mqttClient.subscribe(responseTopic, {qos: 0}, (err) => {
                    if (err) {
                        reject(new Error(`订阅响应主题失败: ${err.message}`));
                        return;
                    }

                    // 创建请求ID
                    const requestId = uuidv4();

                    // 构建命令消息
                    const commandMessage = {
                        command,
                        params,
                        requestId,
                        timestamp: Date.now(),
                        clientId
                    };

                    // 设置超时
                    const timeoutId = setTimeout(() => {
                        if (pendingCommands.has(requestId)) {
                            console.warn(`命令执行超时: ${command}, requestId: ${requestId}`);
                            pendingCommands.delete(requestId);
                            reject(new Error('命令执行超时'));
                        }
                    }, 20000); // 20秒超时

                    // 保存待处理命令
                    pendingCommands.set(requestId, {
                        resolve,
                        reject,
                        timeoutId,
                        timestamp: Date.now()
                    });

                    // 发布命令消息
                    const commandTopic = `${TOPICS.COMMAND}${uuid}`;
                    console.log(`发送命令到 ${commandTopic}:`, commandMessage);

                    mqttClient.publish(commandTopic, JSON.stringify(commandMessage), {qos: 0}, (err) => {
                        if (err) {
                            clearTimeout(timeoutId);
                            pendingCommands.delete(requestId);
                            reject(new Error(`发送命令失败: ${err.message}`));
                        }
                    });
                });
            });
        },

        // 获取代理状态
        getAgentState: () => ({...agentState}),

        // Nginx相关命令
        reloadNginx: (uuid) => get().sendCommand(uuid, 'reload_nginx'),
        restartNginx: (uuid) => get().sendCommand(uuid, 'restart_nginx'),
        stopNginx: (uuid) => get().sendCommand(uuid, 'stop_nginx'),
        startNginx: (uuid) => get().sendCommand(uuid, 'start_nginx'),
        upgradeAgent: (uuid) => get().sendCommand(uuid, 'upgrade')
    };
});

export default useMqttStore;
