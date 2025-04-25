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
                CLIENT_PREFIX: config.clientPrefix || 'uranus-frontend',
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
    let cleanupInterval = null;

    // 存储已删除的代理UUID，防止重新自动注册
    const deletedAgents = new Set();

    // 存储每个代理的响应订阅
    // 结构: { agentUuid: Map<subscriptionId, callback> }
    const agentSubscriptions = new Map();

    // 设置连接重试计数
    let reconnectCount = 0;
    const MAX_RECONNECT_ATTEMPTS = 5;

    // 中断命令功能
    const interruptCommand = (sessionId) => {
        // 获取会话
        const session = get().terminalSessions[sessionId];
        if (!session || !session.agentUuid) return false;

        const agentUuid = session.agentUuid;
        const requestId = session.activeCommand?.requestId;

        // 已经尝试中断
        if (session.interrupting) return true;

        // 标记正在尝试中断
        set(state => {
            const currentSessions = {...state.terminalSessions};
            const currentSession = currentSessions[sessionId] ? {...currentSessions[sessionId]} : null;

            if (!currentSession) return state;

            currentSessions[sessionId] = {
                ...currentSession,
                interrupting: true
            };

            return {terminalSessions: currentSessions};
        });

        console.log(`尝试中断会话 ${sessionId} 的命令`);

        // 发送中断命令
        if (mqttClient && mqttClient.connected) {
            // 1. 发送Ctrl+C多次 (增加送达成功率)
            for (let i = 0; i < 3; i++) {
                setTimeout(() => {
                    mqttClient.publish(
                        `${TOPICS.COMMAND}${agentUuid}`,
                        JSON.stringify({
                            command: 'terminal_input',
                            sessionId,
                            input: '\u0003', // Ctrl+C
                            requestId: uuidv4(),
                            timestamp: Date.now()
                        }),
                        {qos: 1}
                    );
                }, i * 100); // 间隔100ms发送
            }

            // 2. 如果有请求ID，发送interrupt命令
            if (requestId) {
                mqttClient.publish(
                    `${TOPICS.COMMAND}${agentUuid}`,
                    JSON.stringify({
                        command: 'interrupt',
                        sessionId,
                        requestId: uuidv4(),
                        targetRequestId: requestId,
                        timestamp: Date.now()
                    }),
                    {qos: 1}
                );
            }

            // 3. 最后发送force_interrupt命令作为后备
            setTimeout(() => {
                mqttClient.publish(
                    `${TOPICS.COMMAND}${agentUuid}`,
                    JSON.stringify({
                        command: 'force_interrupt',
                        sessionId,
                        requestId: uuidv4(),
                        timestamp: Date.now()
                    }),
                    {qos: 1}
                );
            }, 300);

            // 重置会话状态
            setTimeout(() => {
                set(state => {
                    const currentSessions = {...state.terminalSessions};
                    const currentSession = currentSessions[sessionId] ? {...currentSessions[sessionId]} : null;

                    if (!currentSession) return state;

                    currentSessions[sessionId] = {
                        ...currentSession,
                        interrupting: false,
                        interactiveMode: false,
                        activeCommand: null
                    };

                    return {terminalSessions: currentSessions};
                });
            }, 800);

            return true;
        }

        return false;
    };

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
            clientId = `${config.CLIENT_PREFIX}-${uuidv4()}-${Date.now()}`;
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

        console.log('正在连接MQTT:', config.MQTT_BROKER, mqttOptions);

        // 创建MQTT客户端
        const client = mqtt.connect(config.MQTT_BROKER, mqttOptions);

        // 添加连接日志
        console.log('MQTT客户端已创建，等待连接事件...');

        client.on('connect', () => {
            console.log('MQTT连接成功');
            reconnectCount = 0; // 重置重连计数
            isConnecting = false;
            set({connected: true, error: null});

            // 只订阅全局主题
            client.subscribe(TOPICS.HEARTBEAT, {qos: 0});
            client.subscribe(TOPICS.STATUS, {qos: 0});
            console.log('已订阅全局主题: 心跳和状态');

            // 恢复已保存的代理订阅
            agentSubscriptions.forEach((handlers, agentUuid) => {
                if (handlers.size > 0) {
                    const responseTopic = `${TOPICS.RESPONSE}${agentUuid}`;
                    console.log(`恢复代理订阅: ${responseTopic}`);
                    client.subscribe(responseTopic, {qos: 0});
                }
            });

            // 恢复已保存的终端会话
            const sessions = get().terminalSessions;
            Object.entries(sessions).forEach(([sessionId, session]) => {
                if (session && session.agentUuid) {
                    const agentResponseTopic = `${TOPICS.RESPONSE}${session.agentUuid}`;
                    console.log(`为会话 ${sessionId} 订阅代理响应主题: ${agentResponseTopic}`);
                    client.subscribe(agentResponseTopic, {qos: 0});
                }
            });

            // 添加连接建立消息
            console.log('MQTT连接和订阅完成');

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
            set({error: err.message});

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
            set({connected: false});

            // 通知agentStore MQTT离线
            try {
                const agentStoreInstance = useAgentStore.getState();
                if (agentStoreInstance && typeof agentStoreInstance.setMqttConnected === 'function') {
                    agentStoreInstance.setMqttConnected(false);
                }
            } catch (error) {
                console.error('通知agentStore MQTT连接状态失败:', error);
            }
        });

        client.on('close', () => {
            console.log('MQTT连接关闭');
            set({connected: false});

            // 通知agentStore MQTT连接关闭
            try {
                const agentStoreInstance = useAgentStore.getState();
                if (agentStoreInstance && typeof agentStoreInstance.setMqttConnected === 'function') {
                    agentStoreInstance.setMqttConnected(false);
                }
            } catch (error) {
                console.error('通知agentStore MQTT连接状态失败:', error);
            }
        });

        client.on('reconnect', () => {
            console.log(`MQTT正在重新连接...（尝试 #${reconnectCount + 1}）`);
        });

        client.on('message', (topic, message) => {
            try {
                console.log(`收到MQTT消息，主题: ${topic}, 长度: ${message.length}字节`);
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
                        } else if (!isNewAgent && isInHttpList) {
                            // 已知代理在列表中，只更新状态，无需刷新列表
                            console.log(`更新已知代理状态: ${uuid}`);
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
                    console.log(`收到代理 ${agentUuid} 的响应`);

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

            if (expiredCount > 0) {
                console.log(`已清理 ${expiredCount} 个超时命令`);
            }
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

        // 设置当前查看的代理
        setCurrentAgent: (uuid) => {
            if (!uuid || get().currentAgent === uuid) return;

            console.log(`设置当前代理: ${uuid}`);
            set({currentAgent: uuid});
        },

        // 初始化MQTT连接
        connect: async () => {
            // 如果已连接，直接返回
            if (get().connected && mqttClient && mqttClient.connected) {
                console.log('MQTT已连接，不需要重新连接');
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

        // 断开MQTT连接
        disconnect: () => {
            if (mqttClient && mqttClient.connected) {
                mqttClient.end();
                set({connected: false});

                // 清理定时器
                if (cleanupInterval) clearInterval(cleanupInterval);
                cleanupInterval = null;
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

        // 终端会话管理
        startTerminalSession: (agentUuid) => {
            if (!agentUuid) {
                throw new Error('代理UUID不能为空');
            }

            console.log(`为代理 ${agentUuid} 创建新的终端会话`);
            const sessionId = uuidv4();

            set(state => ({
                terminalSessions: {
                    ...state.terminalSessions,
                    [sessionId]: {
                        agentUuid,
                        startTime: new Date(),
                        history: [],
                        commandHistory: [],
                        activeCommand: null
                    }
                }
            }));

            // 确保订阅此代理的响应主题
            if (mqttClient && mqttClient.connected) {
                const responseTopic = `${TOPICS.RESPONSE}${agentUuid}`;
                console.log(`为新会话订阅响应主题: ${responseTopic}`);
                mqttClient.subscribe(responseTopic, {qos: 0});
            }

            return sessionId;
        },

        endTerminalSession: (sessionId) => {
            // 获取会话信息
            const session = get().terminalSessions[sessionId];

            // 如果会话有活动的命令，尝试中断
            if (session && session.activeCommand) {
                try {
                    interruptCommand(sessionId);
                } catch (e) {
                    console.error('中断会话命令失败:', e);
                }
            }

            // 移除会话
            set(state => {
                const newSessions = {...state.terminalSessions};
                delete newSessions[sessionId];
                return {terminalSessions: newSessions};
            });
        },

        updateTerminalSession: (sessionId, updates) => {
            set(state => {
                try {
                    // 检查会话是否存在
                    const currentSessions = {...state.terminalSessions};
                    const currentSession = currentSessions[sessionId];

                    if (!currentSession) return state;

                    // 创建新的会话对象
                    const newSession = {...currentSession};

                    // 处理历史记录
                    if (updates.history) {
                        const historyLimit = 200;
                        newSession.history = updates.history.slice(-historyLimit);
                    }

                    // 处理命令历史
                    if (updates.commandHistory) {
                        const commandLimit = 50;
                        newSession.commandHistory = updates.commandHistory.slice(-commandLimit);
                    }

                    // 处理其他字段，忽略lastUpdated
                    Object.keys(updates).forEach(key => {
                        if (key !== 'history' && key !== 'commandHistory' && key !== 'lastUpdated') {
                            if (updates[key] === null ||
                                updates[key] === undefined ||
                                typeof updates[key] !== 'object') {
                                newSession[key] = updates[key];
                            } else {
                                newSession[key] = Array.isArray(updates[key])
                                    ? [...updates[key]]
                                    : {...updates[key]};
                            }
                        }
                    });

                    // 确保删除现有的lastUpdated字段
                    if (newSession.lastUpdated) {
                        delete newSession.lastUpdated;
                    }

                    return {
                        terminalSessions: {
                            ...currentSessions,
                            [sessionId]: newSession
                        }
                    };
                } catch (error) {
                    console.error('更新终端会话状态失败:', error);
                    return state;
                }
            });
        },

        // 中断命令
        interruptCommand,
        
// handleTerminalInput 函数 - 使用更可靠的错误处理
        handleTerminalInput: (agentUuid, sessionId, input) => {
            if (!agentUuid || !sessionId) {
                console.error('无法发送终端输入: 参数不完整');
                return Promise.reject(new Error('参数不完整'));
            }

            if (!mqttClient || !mqttClient.connected) {
                console.error('无法发送终端输入: MQTT未连接');
                return Promise.reject(new Error('MQTT未连接'));
            }

            return new Promise((resolve, reject) => {
                try {
                    const requestId = `term-input-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
                    const commandTopic = `${TOPICS.COMMAND}${agentUuid}`;
                    const message = {
                        command: 'terminal_input',
                        sessionId: sessionId,
                        input: input,
                        requestId: requestId,
                        timestamp: Date.now()
                    };

                    console.log(`向代理 ${agentUuid} 发送终端输入命令, sessionId: ${sessionId}`);

                    mqttClient.publish(
                        commandTopic,
                        JSON.stringify(message),
                        {qos: 1},
                        (err) => {
                            if (err) {
                                console.error(`发布终端输入失败: ${err.message}`);
                                reject(new Error(`发送终端输入失败: ${err.message}`));
                                return;
                            }
                            resolve(true);
                        }
                    );
                } catch (err) {
                    console.error('准备终端输入消息时出错:', err);
                    reject(new Error(`准备终端输入消息失败: ${err.message}`));
                }
            });
        },

// 添加终端大小调整函数 - 用于支持调整终端大小
        resizeTerminal: (agentUuid, sessionId, cols, rows) => {
            if (!agentUuid || !sessionId) {
                console.error('无法调整终端大小: 参数不完整');
                return Promise.reject(new Error('参数不完整'));
            }

            if (!mqttClient || !mqttClient.connected) {
                console.error('无法调整终端大小: MQTT未连接');
                return Promise.reject(new Error('MQTT未连接'));
            }

            // 使用兼容方式调整终端大小 - 使用execute命令发送stty命令
            return get().sendCommand(agentUuid, 'execute', {
                command: `stty rows ${rows} cols ${cols}`,
                sessionId: sessionId,
                requestId: `resize-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
                silent: true
            });
        },

// 发送终端信号函数 - 用于处理Ctrl+C等控制信号
        sendTerminalSignal: (agentUuid, sessionId, signal) => {
            if (!agentUuid || !sessionId) {
                console.error('无法发送终端信号: 参数不完整');
                return Promise.reject(new Error('参数不完整'));
            }

            if (!mqttClient || !mqttClient.connected) {
                console.error('无法发送终端信号: MQTT未连接');
                return Promise.reject(new Error('MQTT未连接'));
            }

            // 区分不同的信号类型，使用兼容的方式发送
            switch (signal) {
                case 'CTRL_C':
                case 'SIGINT':
                    // 首先尝试使用terminal_input发送Ctrl+C字符
                    return get().sendCommand(agentUuid, 'terminal_input', {
                        sessionId: sessionId,
                        input: '\u0003', // Ctrl+C
                        requestId: `signal-input-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`
                    })
                        .then(() => {
                            // 接着使用execute命令发送kill命令作为备份方法
                            return get().sendCommand(agentUuid, 'execute', {
                                command: 'kill -INT -$$',  // 向当前进程组发送SIGINT
                                sessionId: sessionId,
                                requestId: `signal-exec-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
                                silent: true
                            });
                        })
                        .catch(err => {
                            console.error('发送SIGINT信号失败:', err);
                            // 尝试另一种兼容方法
                            return get().sendCommand(agentUuid, 'execute', {
                                command: 'pkill -INT -g $$',  // 尝试使用pkill
                                sessionId: sessionId,
                                requestId: `signal-pkill-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
                                silent: true
                            });
                        });

                case 'CTRL_D':
                case 'EOF':
                    // EOF信号只需要发送字符即可
                    return get().sendCommand(agentUuid, 'terminal_input', {
                        sessionId: sessionId,
                        input: '\u0004', // Ctrl+D
                        requestId: `signal-eof-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`
                    });

                case 'SIGTERM':
                    // 使用execute命令发送SIGTERM
                    return get().sendCommand(agentUuid, 'execute', {
                        command: 'kill -TERM -$$',  // 向当前进程组发送SIGTERM
                        sessionId: sessionId,
                        requestId: `signal-term-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
                        silent: true
                    });

                default:
                    return Promise.reject(new Error(`不支持的信号类型: ${signal}`));
            }
        },
        // Nginx相关命令 - 简化版，统一使用基础命令
        reloadNginx: (uuid) => get().sendCommand(uuid, 'reload'),
        restartNginx: (uuid) => get().sendCommand(uuid, 'restart'),
        stopNginx: (uuid) => get().sendCommand(uuid, 'stop'),
        startNginx: (uuid) => get().sendCommand(uuid, 'start')
    };
});

export default useMqttStore;
