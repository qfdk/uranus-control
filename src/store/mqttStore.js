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
    // 管理代理状态的集合
    const tempBlockedAgents = new Set(); // 存储收到遗嘱后临时禁止注册的代理UUID
    const deletedAgents = new Set();     // 存储已删除的代理UUID
    const terminalSessions = {};         // 终端会话存储

    let mqttClient = null;
    let cleanupInterval = null;

    // 节流更新到AgentStore，降低到300ms提高响应速度
    const updateAgentStoreThrottled = throttle((state) => {
        useAgentStore.getState().updateMqttAgentState({...state});
    }, 300);

    // 检查代理是否已在MongoDB中注册
    const isAgentRegistered = (uuid) => {
        const httpAgents = useAgentStore.getState().agents;
        return httpAgents.some(agent => agent.uuid === uuid);
    };

    // 清理未注册的代理状态
    const cleanupUnregisteredAgents = () => {
        const httpAgents = useAgentStore.getState().agents;
        const registeredUuids = new Set(httpAgents.map(agent => agent.uuid));

        // 从agentState中移除未注册的代理
        Object.keys(agentState).forEach(uuid => {
            // 保留正在注册中的代理
            if (!registeredUuids.has(uuid) && !agentState[uuid]._registering) {
                console.log(`清理未注册的代理状态: ${uuid}`);
                delete agentState[uuid];
            }
        });

        // 更新agent store
        updateAgentStoreThrottled({...agentState});
    };

    // 添加标记代理已删除的方法
    const markAgentDeleted = (uuid) => {
        if (uuid) {
            console.log(`标记代理已删除: ${uuid}`);

            // 添加到已删除集合
            deletedAgents.add(uuid);

            // 从临时禁止集合中移除，允许下次重新注册
            tempBlockedAgents.delete(uuid);

            // 清理状态
            if (agentState[uuid]) {
                delete agentState[uuid];
                updateAgentStoreThrottled({...agentState});
            }
        }
    };

    return {
        // 状态
        connected: false,
        error: null,
        currentAgent: null,
        reconnectCount: 0,
        isInitialized: false,
        terminalSessions,  // 导出终端会话，允许组件访问

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

                    // 连接成功后清理未注册代理
                    setTimeout(cleanupUnregisteredAgents, 2000);
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

                        if (topic === TOPICS.STATUS) {
                            // 处理状态消息（包括遗嘱消息）
                            if (payload.uuid && payload.status) {
                                console.log(`收到代理状态更新: ${payload.uuid}, 状态: ${payload.status}`);

                                // 收到离线遗嘱消息，临时禁止该代理注册
                                if (payload.status === 'offline') {
                                    console.log(`代理发送遗嘱，临时禁止注册: ${payload.uuid}`);
                                    tempBlockedAgents.add(payload.uuid);

                                    // 如果存在于agentState中，标记为离线
                                    if (agentState[payload.uuid]) {
                                        agentState[payload.uuid].online = false;
                                        agentState[payload.uuid].lastUpdate = new Date();
                                        useAgentStore.getState().updateMqttAgentState({...agentState});
                                    }
                                }
                            }
                        } else if (topic === TOPICS.HEARTBEAT) {
                            // 处理心跳消息
                            if (payload.uuid) {
                                const uuid = payload.uuid;
                                const timestamp = new Date();

                                // 检查代理是否已在MongoDB中注册
                                const isRegistered = isAgentRegistered(uuid);
                                const isBeingRegistered = agentState[uuid]?._registering;

                                // 已注册代理，正常处理
                                if (isRegistered) {
                                    // 更新状态
                                    agentState[uuid] = {
                                        ...agentState[uuid],
                                        ...payload,
                                        online: true,
                                        lastHeartbeat: timestamp,
                                        lastUpdate: timestamp
                                    };
                                    updateAgentStoreThrottled({...agentState});

                                    // 收到心跳，移除临时禁止
                                    if (tempBlockedAgents.has(uuid)) {
                                        console.log(`代理恢复活动，移除临时禁止: ${uuid}`);
                                        tempBlockedAgents.delete(uuid);
                                    }
                                    return;
                                }

                                // 如果是被临时禁止的代理且未删除过，不自动注册
                                if (tempBlockedAgents.has(uuid) && !deletedAgents.has(uuid)) {
                                    console.log(`代理处于临时禁止状态，不自动注册: ${uuid}`);
                                    // 但仍然更新其状态，让用户可以看到它
                                    agentState[uuid] = {
                                        ...agentState[uuid],
                                        ...payload,
                                        online: true,
                                        lastHeartbeat: timestamp,
                                        lastUpdate: timestamp,
                                        _tempBlocked: true
                                    };
                                    updateAgentStoreThrottled({...agentState});
                                    return;
                                }

                                // 如果已删除过，允许重新注册
                                if (deletedAgents.has(uuid)) {
                                    console.log(`删除后的代理重新上线，允许注册: ${uuid}`);
                                    deletedAgents.delete(uuid);
                                    tempBlockedAgents.delete(uuid); // 同时清除临时禁止
                                }

                                // 更新状态
                                agentState[uuid] = {
                                    ...agentState[uuid],
                                    ...payload,
                                    online: true,
                                    lastHeartbeat: timestamp,
                                    lastUpdate: timestamp
                                };
                                updateAgentStoreThrottled({...agentState});

                                // 自动注册逻辑
                                if (!isBeingRegistered && !isRegistered) {
                                    // 标记为正在注册中
                                    agentState[uuid]._registering = true;
                                    console.log(`自动注册代理: ${uuid}`);

                                    // 注册新代理
                                    useAgentStore.getState().registerAgent({
                                        uuid,
                                        hostname: payload.hostname || uuid.substring(0, 8),
                                        ip: payload.ip || '',
                                        buildVersion: payload.buildVersion,
                                        buildTime: payload.buildTime,
                                        commitId: payload.commitId,
                                        os: payload.os,
                                        memory: payload.memory
                                    }).then(result => {
                                        if (result.success) {
                                            console.log(`代理注册成功: ${uuid}`);
                                            delete agentState[uuid]._registering;
                                            useAgentStore.getState().fetchAgents(true);
                                        } else {
                                            console.error(`代理注册失败: ${uuid}`, result.error);
                                            delete agentState[uuid]._registering;
                                            delete agentState[uuid];
                                            updateAgentStoreThrottled({...agentState});
                                        }
                                    });
                                }
                            }
                        } else if (topic.startsWith(TOPICS.RESPONSE)) {
                            console.log(`收到MQTT响应: ${topic}`, payload);
                            // 处理命令响应
                            const requestId = payload.requestId;

                            // 检查是否与终端会话相关
                            if (payload.sessionId) {
                                const sessionId = payload.sessionId;
                                const session = get().terminalSessions[sessionId];

                                if (session) {
                                    // 更新终端会话状态
                                    const updatedSession = {
                                        ...session,
                                        lastResponse: new Date()
                                    };

                                    // 判断是流式输出还是最终输出
                                    if (payload.streaming) {
                                        // 流式输出 - 追加到现有输出
                                        if (!updatedSession.activeCommand) {
                                            updatedSession.activeCommand = {
                                                requestId,
                                                output: '',
                                                startTime: new Date()
                                            };
                                        }

                                        // 追加输出
                                        const output = payload.output || payload.message || '';
                                        updatedSession.activeCommand.output += output;

                                        // 更新历史记录
                                        if (!updatedSession.history) {
                                            updatedSession.history = [];
                                        }

                                        // 查找或创建响应项
                                        const responseIndex = updatedSession.history.findIndex(
                                            item => item.type === 'response' && item.requestId === requestId
                                        );

                                        if (responseIndex >= 0) {
                                            // 更新现有响应
                                            updatedSession.history[responseIndex].text += output;
                                        } else {
                                            // 创建新的响应项
                                            updatedSession.history.push({
                                                type: 'response',
                                                requestId,
                                                text: output,
                                                success: payload.success !== false
                                            });
                                        }

                                        // 如果是结束消息，标记命令完成
                                        if (payload.final) {
                                            updatedSession.activeCommand = null;
                                        }
                                    } else {
                                        // 一次性完整输出
                                        updatedSession.activeCommand = null; // 命令已完成

                                        // 添加到历史记录
                                        if (!updatedSession.history) {
                                            updatedSession.history = [];
                                        }

                                        updatedSession.history.push({
                                            type: 'response',
                                            requestId,
                                            text: payload.output || payload.message || '命令执行成功，无输出',
                                            success: payload.success !== false
                                        });
                                    }

                                    // 更新会话
                                    set(state => ({
                                        terminalSessions: {
                                            ...state.terminalSessions,
                                            [sessionId]: updatedSession
                                        }
                                    }));
                                }
                            }

                            // 检查是否有对应的待处理命令
                            if (pendingCommands.has(requestId)) {
                                const {resolve, reject, timeoutId} = pendingCommands.get(requestId);

                                // 清除超时
                                if (timeoutId) {
                                    clearTimeout(timeoutId);
                                }

                                // 如果是流式输出且不是最终消息，保留命令以便后续流式输出
                                if (payload.streaming && !payload.final) {
                                    // 不删除命令，只resolve当前响应
                                    resolve(payload);
                                } else {
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
                        }
                    } catch (err) {
                        console.error('解析MQTT消息失败:', err, message.toString());
                    }
                });

                // 清理过期的命令
                if (cleanupInterval) clearInterval(cleanupInterval);
                cleanupInterval = setInterval(() => {
                    const now = Date.now();

                    // 清理过期命令
                    pendingCommands.forEach(({timestamp, timeoutId}, requestId) => {
                        // 清理超过30秒的命令
                        if (now - timestamp > 30000) {
                            if (timeoutId) {
                                clearTimeout(timeoutId);
                            }
                            pendingCommands.delete(requestId);
                        }
                    });

                    // 定期同步代理状态与MongoDB
                    cleanupUnregisteredAgents();
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

        // 终端会话管理
        startTerminalSession: (agentUuid) => {
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
                mqttClient.subscribe(`${TOPICS.RESPONSE}${agentUuid}`, {qos: 0});
            }

            return sessionId;
        },

        endTerminalSession: (sessionId) => {
            // 获取会话
            const session = get().terminalSessions[sessionId];
            if (!session) return;

            // 如果有活动命令，尝试中断
            if (session.activeCommand) {
                get().interruptCommand(sessionId);
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
                const session = state.terminalSessions[sessionId];
                if (!session) return state;

                return {
                    terminalSessions: {
                        ...state.terminalSessions,
                        [sessionId]: {
                            ...session,
                            ...updates
                        }
                    }
                };
            });
        },
// 发送终端输入
        sendTerminalInput: (agentUuid, sessionId, input) => {
            return new Promise((resolve, reject) => {
                if (!mqttClient || !mqttClient.connected) {
                    reject(new Error('MQTT客户端未连接'));
                    return;
                }

                if (!agentUuid || !sessionId || input === undefined) {
                    reject(new Error('缺少必要参数'));
                    return;
                }

                // 创建请求ID
                const requestId = uuidv4();

                // 构建命令消息
                const commandMessage = {
                    command: 'terminal_input',
                    requestId,
                    sessionId,
                    input,
                    timestamp: Date.now(),
                    clientId
                };

                // 设置超时
                const timeoutId = setTimeout(() => {
                    pendingCommands.delete(requestId);
                    reject(new Error('发送输入超时'));
                }, 5000); // 5秒超时

                // 保存待处理命令
                pendingCommands.set(requestId, {
                    resolve,
                    reject,
                    timeoutId,
                    timestamp: Date.now()
                });

                // 发布命令消息
                const commandTopic = `${TOPICS.COMMAND}${agentUuid}`;

                // 日志输出，不显示实际输入内容，以免刷屏
                if (input === '\u0003') {
                    console.log(`发送Ctrl+C到 ${commandTopic}:`, {sessionId});
                } else {
                    console.log(`发送终端输入到 ${commandTopic}:`, {sessionId, inputLength: input.length});
                }

                mqttClient.publish(commandTopic, JSON.stringify(commandMessage), {qos: 0}, (err) => {
                    if (err) {
                        clearTimeout(timeoutId);
                        pendingCommands.delete(requestId);
                        reject(new Error(`发送终端输入失败: ${err.message}`));
                    }
                });
            });
        },
        interruptCommand: (sessionId) => {
            // 获取会话
            const session = get().terminalSessions[sessionId];
            if (!session || !session.activeCommand) return;

            // 发送中断命令
            if (mqttClient && mqttClient.connected) {
                mqttClient.publish(
                    `${TOPICS.COMMAND}${session.agentUuid}`,
                    JSON.stringify({
                        command: 'interrupt',
                        sessionId,
                        requestId: uuidv4(),
                        targetRequestId: session.activeCommand.requestId,
                        timestamp: Date.now()
                    }),
                    {qos: 0}
                );
            }

            // 标记会话中的命令为已中断
            set(state => {
                const updatedSession = {
                    ...session,
                    activeCommand: null,
                    lastInterrupt: new Date()
                };

                return {
                    terminalSessions: {
                        ...state.terminalSessions,
                        [sessionId]: updatedSession
                    }
                };
            });
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

                            // 如果有会话ID，更新会话状态
                            const sessionId = params.sessionId;
                            if (sessionId) {
                                const session = get().terminalSessions[sessionId];
                                if (session) {
                                    set(state => ({
                                        terminalSessions: {
                                            ...state.terminalSessions,
                                            [sessionId]: {
                                                ...session,
                                                activeCommand: null,
                                                history: [...(session.history || []), {
                                                    type: 'error',
                                                    text: '命令执行超时'
                                                }]
                                            }
                                        }
                                    }));
                                }
                            }
                        }
                    }, 30000); // 30秒超时

                    // 保存待处理命令
                    pendingCommands.set(requestId, {
                        resolve,
                        reject,
                        timeoutId,
                        timestamp: Date.now()
                    });

                    // 如果是会话命令，添加会话ID
                    if (params.sessionId) {
                        commandMessage.sessionId = params.sessionId;
                    }

                    // 如果是流式命令，添加标记
                    if (params.streaming) {
                        commandMessage.streaming = true;
                    }

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

        // 标记代理已删除，避免重新自动注册
        markAgentDeleted,

        // 清除已删除代理记录（用于测试）
        clearDeletedAgents: () => {
            deletedAgents.clear();
        },

        // Nginx相关命令
        reloadNginx: (uuid) => get().sendCommand(uuid, 'reload_nginx'),
        restartNginx: (uuid) => get().sendCommand(uuid, 'restart_nginx'),
        stopNginx: (uuid) => get().sendCommand(uuid, 'stop_nginx'),
        startNginx: (uuid) => get().sendCommand(uuid, 'start_nginx'),
        upgradeAgent: (uuid) => get().sendCommand(uuid, 'upgrade')
    };
});

export default useMqttStore;
