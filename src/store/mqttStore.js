// src/store/mqttStore.js
import {create} from 'zustand';
import mqtt from 'mqtt';
import {v4 as uuidv4} from 'uuid';
import useAgentStore from './agentStore';

// MQTT 主题
const TOPICS = {
    HEARTBEAT: 'uranus/heartbeat',    // 心跳主题(全局订阅)
    STATUS: 'uranus/status',          // 状态主题(全局订阅)
    COMMAND: 'uranus/command/',       // 命令主题前缀
    RESPONSE: 'uranus/response/'      // 响应主题前缀
};

// 获取MQTT配置
const getMqttConfig = () => {
    // 尝试从localStorage获取配置
    try {
        const savedConfig = localStorage.getItem('mqttSettings');
        if (savedConfig) {
            const config = JSON.parse(savedConfig);
            return {
                MQTT_BROKER: config.url || 'wss://mqtt.qfdk.me/mqtt',
                CLIENT_PREFIX: config.clientPrefix || 'uranus-web',
                RECONNECT_PERIOD: config.reconnectPeriod || 3000,
                CONNECT_TIMEOUT: config.connectTimeout || 30000,
                KEEPALIVE: config.keepalive || 30
            };
        }
    } catch (error) {
        // Silent error handling
    }

    // 默认配置
    return {
        MQTT_BROKER: 'wss://mqtt.qfdk.me/mqtt',
        CLIENT_PREFIX: 'uranus-web',
        RECONNECT_PERIOD: 3000,
        CONNECT_TIMEOUT: 30000,
        KEEPALIVE: 30
    };
};

// 创建MQTT Store
const useMqttStore = create((set, get) => {
    // 静态变量
    let mqttClient = null;
    let clientId = null;
    let connectingPromise = null;
    let isConnecting = false;

    const pendingCommands = new Map();
    const agentState = {};
    const terminalSessions = {};
    const terminalCallbacks = new Map(); // 存储终端会话回调函数
    let cleanupInterval = null;

    // 存储已删除的代理UUID，防止重新自动注册
    const deletedAgents = new Set();

    // 存储每个代理的响应订阅
    const agentSubscriptions = new Map();

    // 设置连接重试计数
    let reconnectCount = 0;
    const MAX_RECONNECT_ATTEMPTS = 5;

    // 初始化MQTT客户端并处理消息
    const initializeMqttClient = () => {
        // 确保不重复初始化
        if (mqttClient) {
            console.log('MQTT客户端已存在，使用现有客户端');
            return mqttClient;
        }

        // 获取配置
        const config = getMqttConfig();

        // 生成唯一客户端ID (仅首次)
        if (!clientId) {
            // 生成唯一的随机ID
            const randomId = uuidv4();
            
            // 使用uranus-web前缀和随机ID
            clientId = `${config.CLIENT_PREFIX}-${randomId}`;
            console.log(`生成MQTT客户端ID: ${clientId}`);
        }

        // MQTT配置 - 确保设置正确的重连参数
        const mqttOptions = {
            clientId,
            clean: true,
            reconnectPeriod: config.RECONNECT_PERIOD,
            connectTimeout: config.CONNECT_TIMEOUT,
            keepalive: config.KEEPALIVE,
            will: {  // 设置遗嘱消息，确保断开连接时能更新状态
                topic: TOPICS.STATUS,
                payload: JSON.stringify({
                    clientId,
                    status: 'offline',
                    timestamp: Date.now()
                }),
                qos: 1,
                retain: false
            }
        };

        // 创建MQTT客户端
        const client = mqtt.connect(config.MQTT_BROKER, mqttOptions);

        client.on('connect', () => {
            reconnectCount = 0; // 重置重连计数
            isConnecting = false;
            set({connected: true, error: null});

            // 只订阅全局主题
            client.subscribe(TOPICS.HEARTBEAT, {qos: 0});
            client.subscribe(TOPICS.STATUS, {qos: 0});

            // 立即通知agentStore MQTT已连接
            try {
                const agentStoreInstance = useAgentStore.getState();
                if (agentStoreInstance && typeof agentStoreInstance.setMqttConnected === 'function') {
                    agentStoreInstance.setMqttConnected(true);
                }
            } catch (error) {
                console.error('通知agentStore MQTT连接状态失败:', error);
            }

            // 恢复已保存的代理订阅
            agentSubscriptions.forEach((handlers, agentUuid) => {
                if (handlers.size > 0) {
                    const responseTopic = `${TOPICS.RESPONSE}${agentUuid}`;
                    client.subscribe(responseTopic, {qos: 0});
                }
            });

            // 恢复已保存的终端会话
            const sessions = get().terminalSessions;
            Object.entries(sessions).forEach(([sessionId, session]) => {
                if (session && session.agentUuid) {
                    const agentResponseTopic = `${TOPICS.RESPONSE}${session.agentUuid}`;
                    client.subscribe(agentResponseTopic, {qos: 0});
                }
            });

            // 通知agentStore MQTT已连接
            try {
                const agentStoreInstance = useAgentStore.getState();
                if (agentStoreInstance && typeof agentStoreInstance.setMqttConnected === 'function') {
                    agentStoreInstance.setMqttConnected(true);
                }
            } catch (error) {
                console.error('通知agentStore MQTT连接状态失败:', error);
            }
        });

        client.on('error', (err) => {
            console.error('MQTT连接错误:', err);
            set({error: err.message, connected: false});

            // 更新重连计数
            reconnectCount++;
            if (reconnectCount > MAX_RECONNECT_ATTEMPTS) {
                console.error(`MQTT重连次数超过最大限制(${MAX_RECONNECT_ATTEMPTS})，停止重连`);
                client.end(true);
                set({connected: false, error: '重连次数超过限制，请手动重新连接'});
            }

            // 通知agentStore MQTT连接失败
            try {
                const agentStoreInstance = useAgentStore.getState();
                if (agentStoreInstance && typeof agentStoreInstance.setMqttConnected === 'function') {
                    agentStoreInstance.setMqttConnected(false);
                }
            } catch (error) {
                console.error('通知agentStore MQTT连接状态失败:', error);
            }
        });

        client.on('offline', () => {
            console.log('MQTT客户端离线');
            set({connected: false, error: 'MQTT连接断开'});

            // 强制通知agentStore MQTT离线
            setTimeout(() => {
                try {
                    const agentStoreInstance = useAgentStore.getState();
                    if (agentStoreInstance && typeof agentStoreInstance.setMqttConnected === 'function') {
                        console.log('通知agentStore: MQTT连接断开(离线事件)');
                        agentStoreInstance.setMqttConnected(false);
                    }
                } catch (error) {
                    console.error('通知agentStore MQTT连接状态失败:', error);
                }
            }, 0);
        });

        client.on('close', () => {
            console.log('MQTT连接关闭');
            set({connected: false, error: 'MQTT连接关闭'});

            // 强制通知agentStore MQTT连接关闭
            setTimeout(() => {
                try {
                    const agentStoreInstance = useAgentStore.getState();
                    if (agentStoreInstance && typeof agentStoreInstance.setMqttConnected === 'function') {
                        console.log('通知agentStore: MQTT连接关闭(关闭事件)');
                        agentStoreInstance.setMqttConnected(false);
                    }
                } catch (error) {
                    console.error('通知agentStore MQTT连接状态失败:', error);
                }
            }, 0);
        });

        client.on('reconnect', () => {
            console.log(`MQTT正在重新连接...（尝试 #${reconnectCount + 1}）`);
        });

        client.on('message', (topic, message) => {
            try {
                // console.log(`收到MQTT消息，主题: ${topic}, 长度: ${message.length}字节`);
                const payload = JSON.parse(message.toString());

                if (topic === TOPICS.HEARTBEAT) {
                    // 处理心跳消息
                    if (payload.uuid) {
                        const uuid = payload.uuid;
                        const timestamp = new Date();

                        // 即使代理在删除列表中，如果收到心跳也将其重新添加
                        if (deletedAgents.has(uuid)) {
                            console.log(`检测到先前删除的代理心跳: ${uuid}，将重新添加`);
                            deletedAgents.delete(uuid);
                        }

                        // 检查是否是新代理
                        const isNewAgent = !agentState[uuid];

                        // 检查此UUID是否已在HTTP代理列表中
                        // 获取当前HTTP代理列表进行检查
                        const agentStoreInstance = useAgentStore.getState();
                        const httpAgents = agentStoreInstance ? agentStoreInstance.agents : [];
                        const isInHttpList = httpAgents.some(agent => agent.uuid === uuid);

                        // 更新代理状态
                        agentState[uuid] = {
                            ...agentState[uuid],
                            ...payload,
                            online: true,
                            lastHeartbeat: timestamp
                        };

                        // 通知状态变化
                        set(state => ({
                            mqttAgentState: {...agentState}
                        }));

                        // 尝试通知agentStore更新状态
                        try {
                            if (agentStoreInstance && typeof agentStoreInstance.updateMqttAgentState === 'function') {
                                agentStoreInstance.updateMqttAgentState({...agentState});
                            }
                        } catch (error) {
                            console.error('通知agentStore更新状态失败:', error);
                        }

                        // 如果是新代理且不在HTTP列表中，尝试自动注册
                        if (isNewAgent && !isInHttpList) {
                            // 标记为MQTT发现的代理
                            agentState[uuid]._mqttOnly = true;
                            agentState[uuid]._autoRegister = true;

                            // 异步注册
                            Promise.resolve().then(async () => {
                                try {
                                    console.log(`尝试注册新发现的代理: ${uuid} (不在HTTP列表中)`);
                                    agentState[uuid]._registering = true;

                                    set(state => ({
                                        mqttAgentState: {...agentState}
                                    }));

                                    const response = await fetch('/api/agents', {
                                        method: 'POST',
                                        headers: {'Content-Type': 'application/json'},
                                        body: JSON.stringify(payload)
                                    });

                                    if (response.ok) {
                                        const data = await response.json();
                                        console.log(`注册成功，服务器返回:`, data);

                                        // 更新状态
                                        if (agentState[uuid]) {
                                            agentState[uuid]._id = data._id;
                                            agentState[uuid]._autoRegister = false;
                                            agentState[uuid]._mqttOnly = false;
                                            agentState[uuid]._registering = false;

                                            // 通知状态变化
                                            set(state => ({
                                                mqttAgentState: {...agentState}
                                            }));

                                            // 只在这种情况下刷新代理列表 - 因为是新代理且成功注册
                                            try {
                                                if (agentStoreInstance) {
                                                    // 更新MQTT状态
                                                    if (typeof agentStoreInstance.updateMqttAgentState === 'function') {
                                                        agentStoreInstance.updateMqttAgentState({...agentState});
                                                    }

                                                    // 刷新代理列表
                                                    if (typeof agentStoreInstance.fetchAgents === 'function') {
                                                        agentStoreInstance.fetchAgents(true);
                                                    }
                                                }
                                            } catch (error) {
                                                console.error('通知agentStore更新状态失败:', error);
                                            }

                                            // 触发自定义事件通知UI刷新
                                            if (typeof window !== 'undefined') {
                                                const event = new CustomEvent('mqtt-agent-registered', {
                                                    detail: {uuid, agent: data, isNew: true}
                                                });
                                                window.dispatchEvent(event);
                                            }
                                        }
                                    } else {
                                        // 注册失败，清除注册状态
                                        if (agentState[uuid]) {
                                            agentState[uuid]._registering = false;
                                            set(state => ({
                                                mqttAgentState: {...agentState}
                                            }));
                                        }
                                    }
                                } catch (error) {
                                    console.error(`注册代理失败: ${uuid}`, error);
                                    // 清除注册状态
                                    if (agentState[uuid]) {
                                        agentState[uuid]._registering = false;
                                        set(state => ({
                                            mqttAgentState: {...agentState}
                                        }));
                                    }
                                }
                            });
                        }
                    }
                } else if (topic === TOPICS.STATUS) {
                    // 处理状态消息（包括遗嘱消息）
                    if (payload.uuid && payload.status) {
                        const uuid = payload.uuid;

                        // 删除列表中的代理也需要处理状态更新
                        if (deletedAgents.has(uuid)) {
                            console.log(`忽略已删除代理的状态更新: ${uuid}`);
                            return;
                        }

                        // 更新状态
                        if (payload.status === 'offline' && agentState[uuid]) {
                            console.log(`收到代理离线消息: ${uuid}`);
                            agentState[uuid].online = false;

                            // 更新时间戳
                            agentState[uuid].lastStatusUpdate = new Date();

                            // 通知状态变化
                            set(state => ({mqttAgentState: {...agentState}}));

                            // 尝试通知agentStore更新状态
                            try {
                                const agentStoreInstance = useAgentStore.getState();
                                if (agentStoreInstance && typeof agentStoreInstance.updateMqttAgentState === 'function') {
                                    agentStoreInstance.updateMqttAgentState({...agentState});
                                }
                            } catch (error) {
                                console.error('通知agentStore更新状态失败:', error);
                            }
                        }
                    }
                } else if (topic.startsWith(TOPICS.RESPONSE)) {
                    // 提取代理UUID
                    const agentUuid = topic.substring(TOPICS.RESPONSE.length);

                    // 获取该代理的所有订阅处理器
                    const handlers = agentSubscriptions.get(agentUuid);
                    if (handlers && handlers.size > 0) {
                        // 调用所有处理器
                        handlers.forEach(callback => {
                            try {
                                callback(topic, payload);
                            } catch (error) {
                                console.error('响应处理器执行失败:', error);
                            }
                        });
                    }

                    // 处理终端相关消息
                    if (payload.sessionId && (payload.type === 'output' || payload.type === 'created' ||
                        payload.type === 'closed' || payload.type === 'error')) {
                        const sessionId = payload.sessionId;
                        const callback = terminalCallbacks.get(sessionId);

                        if (callback) {
                            try {
                                // 调用会话的回调函数
                                callback(payload);

                                // 如果是会话关闭消息，清除回调
                                if (payload.type === 'closed') {
                                    console.log(`终端会话 ${sessionId} 已关闭，清除回调`);
                                    terminalCallbacks.delete(sessionId);

                                    // 清除会话状态
                                    if (terminalSessions[sessionId]) {
                                        delete terminalSessions[sessionId];
                                        set(state => ({terminalSessions: {...terminalSessions}}));
                                    }
                                }
                            } catch (error) {
                                console.error(`终端会话 ${sessionId} 回调处理器执行失败:`, error);
                            }
                        }
                    }

                    // 处理挂起的命令响应
                    const requestId = payload.requestId;
                    if (requestId && pendingCommands.has(requestId)) {
                        const {resolve, reject, timeoutId} = pendingCommands.get(requestId);

                        // 清除超时
                        if (timeoutId) {
                            clearTimeout(timeoutId);
                        }

                        // 如果是流式输出且不是最终消息，保留命令以便后续流式输出
                        if (payload.streaming && !payload.final) {
                            resolve(payload);
                        } else {
                            // 删除此命令
                            pendingCommands.delete(requestId);

                            // 处理响应
                            if (payload.success !== false) {
                                resolve(payload);
                            } else {
                                reject(new Error(payload.message || '命令执行失败'));
                            }
                        }
                    }
                }
            } catch (err) {
                console.error('解析MQTT消息失败:', err, message.toString());
            }
        });

        // 设置清理定时器，移除超时的命令
        cleanupInterval = setInterval(() => {
            const now = Date.now();
            let expiredCount = 0;

            // 检查挂起的命令是否超时
            pendingCommands.forEach((command, id) => {
                const age = now - command.timestamp;
                // 命令超过2分钟视为过期
                if (age > 120000) {
                    clearTimeout(command.timeoutId);
                    command.reject(new Error('命令执行超时，已被自动清理'));
                    pendingCommands.delete(id);
                    expiredCount++;
                }
            });

            // 静默处理清理，不再输出日志
        }, 30000); // 每30秒检查一次

        return client;
    };

    // 重连方法
    const reconnect = () => {
        if (!mqttClient) {
            console.log('MQTT客户端不存在，无法重连');
            return false;
        }

        if (mqttClient.connected) {
            console.log('MQTT已连接，不需要重连');
            return true;
        }

        try {
            console.log('强制重新连接MQTT...');
            mqttClient.reconnect();
            return true;
        } catch (error) {
            console.error('MQTT重连失败:', error);
            return false;
        }
    };

    return {
        // 状态
        connected: false,
        error: null,
        currentAgent: null,
        mqttAgentState: {...agentState},  // 导出代理状态
        terminalSessions,  // 导出终端会话

        // 订阅特定代理的响应消息
        subscribeToResponses: (agentUuid, callback) => {
            if (!agentUuid || !callback) {
                console.warn('订阅缺少代理UUID或回调函数');
                return () => {
                };
            }

            console.log(`正在订阅代理 ${agentUuid} 的响应`);

            // 确保代理在订阅映射中
            if (!agentSubscriptions.has(agentUuid)) {
                agentSubscriptions.set(agentUuid, new Map());
            }

            // 生成唯一订阅ID
            const subscriptionId = uuidv4();

            // 添加处理器
            agentSubscriptions.get(agentUuid).set(subscriptionId, callback);

            // 当第一个订阅者添加时，订阅MQTT主题
            if (agentSubscriptions.get(agentUuid).size === 1) {
                const topic = `${TOPICS.RESPONSE}${agentUuid}`;

                if (mqttClient && mqttClient.connected) {
                    console.log(`向MQTT订阅主题: ${topic}`);
                    mqttClient.subscribe(topic, {qos: 0});
                } else {
                    console.log(`MQTT未连接，将在连接后订阅: ${topic}`);
                }
            }

            // 返回取消订阅函数
            return () => {
                console.log(`取消订阅代理 ${agentUuid} 的响应`);

                // 获取代理的订阅
                const subscriptions = agentSubscriptions.get(agentUuid);
                if (!subscriptions) return;

                // 移除订阅
                subscriptions.delete(subscriptionId);

                // 如果没有更多订阅，取消MQTT主题订阅
                if (subscriptions.size === 0) {
                    const topic = `${TOPICS.RESPONSE}${agentUuid}`;

                    if (mqttClient && mqttClient.connected) {
                        console.log(`从MQTT取消订阅主题: ${topic}`);
                        mqttClient.unsubscribe(topic);
                    }
                }
            };
        },

        // 获取代理状态
        getAgentState: (uuid) => {
            if (uuid) {
                return agentState[uuid] || null;
            }
            return {...agentState};
        },

        // 初始化MQTT连接
        connect: async () => {
            // 如果已连接，直接返回
            if (get().connected && mqttClient && mqttClient.connected) {
                // 确保透传状态到agentStore
                try {
                    const agentStoreInstance = useAgentStore.getState();
                    if (agentStoreInstance && typeof agentStoreInstance.setMqttConnected === 'function') {
                        agentStoreInstance.setMqttConnected(true);
                    }
                } catch (error) {
                    console.error('通知agentStore MQTT连接状态失败:', error);
                }

                return true;
            }

            // 如果正在连接中，返回等待中的Promise
            if (isConnecting && connectingPromise) {
                console.log('MQTT正在连接中，等待连接完成');
                return connectingPromise;
            }

            // 设置连接状态
            isConnecting = true;
            console.log('开始MQTT连接过程...');

            // 创建连接Promise
            connectingPromise = new Promise((resolve, reject) => {
                try {
                    console.log('初始化MQTT连接...');
                    const config = getMqttConfig();
                    console.log(`连接到MQTT服务器: ${config.MQTT_BROKER}`);

                    // 初始化MQTT客户端
                    mqttClient = initializeMqttClient();

                    // 检查连接状态
                    if (mqttClient.connected) {
                        console.log('MQTT客户端已连接');
                        set({connected: true, error: null});
                        resolve(true);
                        return;
                    }

                    // 等待连接完成
                    const connectTimeout = setTimeout(() => {
                        if (!mqttClient.connected) {
                            const error = new Error('MQTT连接超时');
                            isConnecting = false;
                            set({error: error.message});
                            reject(error);
                        }
                    }, 10000); // 10秒超时

                    mqttClient.once('connect', () => {
                        clearTimeout(connectTimeout);
                        isConnecting = false;
                        set({connected: true, error: null});
                        console.log('MQTT连接成功 - 事件触发');
                        resolve(true);
                    });

                    mqttClient.once('error', (err) => {
                        if (connectingPromise) {
                            clearTimeout(connectTimeout);
                            isConnecting = false;
                            set({error: err.message});
                            console.error('MQTT连接错误:', err);
                            reject(err);
                        }
                    });
                } catch (error) {
                    console.error('MQTT连接初始化失败:', error);
                    set({error: error.message});
                    isConnecting = false;
                    reject(error);
                }
            });

            try {
                console.log('等待MQTT连接完成...');
                await connectingPromise;
                console.log('MQTT连接已完成');
                return true;
            } catch (error) {
                console.error('MQTT连接失败:', error);
                isConnecting = false;
                throw error;
            } finally {
                console.log('MQTT连接过程结束');
                connectingPromise = null;
            }
        },

        // 重连方法
        reconnect,

        // 标记代理为已删除
        markAgentDeleted: (uuid) => {
            if (!uuid) return;

            console.log(`标记代理为已删除: ${uuid}`);
            deletedAgents.add(uuid);

            // 清理该代理在agentState中的数据
            if (agentState[uuid]) {
                delete agentState[uuid];
                set(state => ({mqttAgentState: {...agentState}}));

                // 尝试通知agentStore更新状态
                try {
                    const agentStoreInstance = useAgentStore.getState();
                    if (agentStoreInstance && typeof agentStoreInstance.updateMqttAgentState === 'function') {
                        agentStoreInstance.updateMqttAgentState({...agentState});
                    }
                } catch (error) {
                    console.error('通知agentStore更新状态失败:', error);
                }
            }
        },

        // 执行命令
        executeCommand: async (uuid, command) => {
            if (!uuid || !command) {
                throw new Error('代理UUID和命令内容不能为空');
            }

            return get().sendCommand(uuid, 'execute', {
                command: command
            });
        },

        // 更新sendCommand方法 - 移除不必要的timestamp参数
        sendCommand: async (uuid, commandType, params = {}) => {
            // 检查MQTT连接
            if (!mqttClient || !mqttClient.connected) {
                // 尝试重新连接
                try {
                    console.log('MQTT未连接，尝试连接');
                    await get().connect();
                } catch (error) {
                    console.error('MQTT连接失败:', error);
                    throw new Error(`MQTT未连接: ${error.message}`);
                }
            }

            if (!uuid) {
                throw new Error('代理UUID是必需的');
            }

            return new Promise((resolve, reject) => {
                // 确保订阅了代理的响应主题
                const responseTopic = `${TOPICS.RESPONSE}${uuid}`;

                // 临时订阅响应主题(如果尚未订阅)
                if (!agentSubscriptions.has(uuid) || agentSubscriptions.get(uuid).size === 0) {
                    console.log(`临时订阅响应主题: ${responseTopic}`);
                    mqttClient.subscribe(responseTopic, {qos: 0});
                }

                // 创建请求ID
                const requestId = params.requestId || `cmd-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;

                // 构建命令消息
                let commandMessage;

                // 特殊处理execute命令
                if (commandType === 'execute') {
                    if (!params.command) {
                        return reject(new Error('execute命令必须提供command参数'));
                    }

                    // execute命令特殊格式
                    commandMessage = {
                        command: 'execute',
                        requestId,
                        clientId,
                        params: {
                            command: params.command
                        }
                    };
                } else {
                    // 其他常规命令
                    commandMessage = {
                        command: commandType,
                        requestId,
                        clientId,
                        ...params
                    };
                }

                // 设置超时为30秒，较长的超时以避免快速多次输入时出现错误
                const timeoutId = setTimeout(() => {
                    // 静默处理超时，只清理资源
                    pendingCommands.delete(requestId);
                    reject(new Error('命令请求超时'));
                }, 30000);

                // 保存待处理命令
                pendingCommands.set(requestId, {
                    resolve,
                    reject,
                    timeoutId,
                    timestamp: Date.now() // 只在客户端记录发送时间
                });

                // 发布命令消息
                const commandTopic = `${TOPICS.COMMAND}${uuid}`;

                // 确保序列化成功
                let messageText;
                try {
                    messageText = JSON.stringify(commandMessage);
                } catch (err) {
                    clearTimeout(timeoutId);
                    pendingCommands.delete(requestId);
                    return reject(new Error(`序列化命令失败: ${err.message}`));
                }

                mqttClient.publish(
                    commandTopic,
                    messageText,
                    {qos: 1}, // 增加QoS级别确保消息送达
                    (err) => {
                        if (err) {
                            console.error(`发布命令失败: ${err.message}`);
                            clearTimeout(timeoutId);
                            pendingCommands.delete(requestId);
                            reject(new Error(`发送命令失败: ${err.message}`));
                        }
                    }
                );
            });
        },

        // Nginx相关命令 - 简化版，统一使用基础命令
        reloadNginx: (uuid) => get().sendCommand(uuid, 'reload'),
        restartNginx: (uuid) => get().sendCommand(uuid, 'restart'),
        stopNginx: (uuid) => get().sendCommand(uuid, 'stop'),
        startNginx: (uuid) => get().sendCommand(uuid, 'start'),

        // 终端相关操作
        createTerminalSession: (agentUuid, sessionId) => {
            return get().sendCommand(agentUuid, 'terminal', {
                type: 'create',
                sessionId
            });
        },

        sendTerminalInput: (agentUuid, sessionId, data) => {
            return get().sendCommand(agentUuid, 'terminal', {
                type: 'input',
                sessionId,
                data
            });
        },

        resizeTerminal: (agentUuid, sessionId, cols, rows) => {
            return get().sendCommand(agentUuid, 'terminal', {
                type: 'resize',
                sessionId,
                data: {cols, rows}
            });
        },

        closeTerminalSession: (agentUuid, sessionId) => {
            return get().sendCommand(agentUuid, 'terminal', {
                type: 'close',
                sessionId
            });
        },

        // 设置终端回调
        setTerminalCallback: (sessionId, callback) => {
            if (!sessionId) return;

            console.log(`设置终端会话 ${sessionId} 的回调函数`);
            terminalCallbacks.set(sessionId, callback);

            // 更新会话状态
            if (!terminalSessions[sessionId]) {
                terminalSessions[sessionId] = {
                    id: sessionId,
                    createdAt: new Date(),
                    active: true
                };
                set(state => ({terminalSessions: {...terminalSessions}}));
            }

            return () => {
                console.log(`清除终端会话 ${sessionId} 的回调函数`);
                terminalCallbacks.delete(sessionId);
            };
        },

        // 清除终端回调
        clearTerminalCallback: (sessionId) => {
            if (!sessionId) return;

            console.log(`清除终端会话 ${sessionId} 的回调函数`);
            terminalCallbacks.delete(sessionId);

            // 不要立即清除会话状态，等待关闭消息或者超时清理
        },

        // 获取终端会话列表
        getTerminalSessions: () => {
            return {...terminalSessions};
        }
    };
});

export default useMqttStore;
