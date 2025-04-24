// src/store/mqttStore.js
import { create } from 'zustand';
import mqtt from 'mqtt';
import { v4 as uuidv4 } from 'uuid';

// MQTT 主题
const TOPICS = {
    HEARTBEAT: 'uranus/heartbeat',    // 心跳主题
    STATUS: 'uranus/status',          // 状态主题
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

// 安全地克隆对象，避免循环引用
const safeClone = (obj) => {
    if (!obj) return obj;
    if (typeof obj !== 'object') return obj;
    
    try {
        // 尝试通过JSON序列化来深度克隆
        return JSON.parse(JSON.stringify(obj));
    } catch (e) {
        // 如果有循环引用，则回退到浅克隆
        console.warn('无法深度克隆对象，可能存在循环引用，回退到浅克隆', e);
        return Array.isArray(obj) ? [...obj] : {...obj};
    }
};

// 创建MQTT Store
const useMqttStore = create((set, get) => {
    // 状态变量
    const clientId = `${getMqttConfig().CLIENT_PREFIX}-${uuidv4()}-${Date.now()}`;
    const pendingCommands = new Map();
    const agentState = {};
    const terminalSessions = {};

    let mqttClient = null;
    let cleanupInterval = null;

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
            
            return { terminalSessions: currentSessions };
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
                        { qos: 1 }
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
                    { qos: 1 }
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
                    { qos: 1 }
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
                    
                    return { terminalSessions: currentSessions };
                });
            }, 800);

            return true;
        }

        return false;
    };

    return {
        // 状态
        connected: false,
        error: null,
        currentAgent: null,
        terminalSessions,  // 导出终端会话，允许组件访问

        // 初始化MQTT连接
        connect: () => {
            // 防止重复初始化
            if (get().connected && mqttClient) {
                console.log('MQTT已连接，不需要重新连接');
                return;
            }

            const config = getMqttConfig();

            try {
                console.log(`正在连接到MQTT服务器(${config.MQTT_BROKER})...`);

                // MQTT配置
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
                    set({ connected: true, error: null });

                    // 订阅必要主题
                    mqttClient.subscribe(TOPICS.HEARTBEAT, { qos: 0 });
                    mqttClient.subscribe(TOPICS.STATUS, { qos: 0 });

                    // 如果有当前查看的代理，订阅其响应主题
                    const currentAgentUUID = get().currentAgent;
                    if (currentAgentUUID) {
                        mqttClient.subscribe(`${TOPICS.RESPONSE}${currentAgentUUID}`, { qos: 0 });
                    }
                });

                mqttClient.on('error', (err) => {
                    console.error('MQTT连接错误:', err);
                    set({ error: err.message });
                });

                mqttClient.on('close', () => {
                    console.log('MQTT连接关闭');
                    set({ connected: false });
                });

                mqttClient.on('reconnect', () => {
                    console.log('MQTT正在重新连接...');
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
                                    lastHeartbeat: timestamp
                                };
                            }
                        }
                        else if (topic === TOPICS.STATUS) {
                            // 处理状态消息（包括遗嘱消息）
                            if (payload.uuid && payload.status) {
                                const uuid = payload.uuid;

                                if (payload.status === 'offline' && agentState[uuid]) {
                                    agentState[uuid].online = false;
                                }
                            }
                        }
                        else if (topic.startsWith(TOPICS.RESPONSE)) {
                            // 处理命令响应
                            const requestId = payload.requestId;

                            // 检查是否与终端会话相关
                            if (payload.sessionId) {
                                const sessionId = payload.sessionId;
                                const currentSessions = get().terminalSessions;
                                const session = currentSessions[sessionId] ? {...currentSessions[sessionId]} : null;

                                if (session) {
                                    // 使用安全的状态更新方式
                                    set(state => {
                                        // 创建新的会话对象和会话集合，避免修改原始状态
                                        const newSessions = {...state.terminalSessions};
                                        const newSession = {...newSessions[sessionId]};
                                        
                                        // 更新会话属性
                                        newSession.lastResponse = new Date();
                                        
                                        // 判断是流式输出还是最终输出
                                        if (payload.streaming) {
                                            // 流式输出 - 追加到现有输出
                                            let newActiveCommand = null;
                                            
                                            if (!newSession.activeCommand) {
                                                newActiveCommand = {
                                                    requestId,
                                                    output: '',
                                                    startTime: new Date()
                                                };
                                            } else {
                                                newActiveCommand = {...newSession.activeCommand};
                                            }
                                            
                                            // 追加输出
                                            const output = payload.output || payload.message || '';
                                            newActiveCommand.output = (newActiveCommand.output || '') + output;
                                            newSession.activeCommand = newActiveCommand;
                                            
                                            // 更新历史记录
                                            let newHistory = newSession.history ? [...newSession.history] : [];
                                            
                                            // 查找或创建响应项
                                            const responseIndex = newHistory.findIndex(
                                                item => item.type === 'response' && item.requestId === requestId
                                            );
                                            
                                            if (responseIndex >= 0) {
                                                // 更新现有响应
                                                const updatedItem = {
                                                    ...newHistory[responseIndex],
                                                    text: (newHistory[responseIndex].text || '') + output
                                                };
                                                newHistory = [
                                                    ...newHistory.slice(0, responseIndex),
                                                    updatedItem,
                                                    ...newHistory.slice(responseIndex + 1)
                                                ];
                                            } else {
                                                // 创建新的响应项
                                                newHistory.push({
                                                    type: 'response',
                                                    requestId,
                                                    text: output,
                                                    success: payload.success !== false
                                                });
                                            }
                                            
                                            newSession.history = newHistory;
                                            
                                            // 如果是结束消息，标记命令完成
                                            if (payload.final) {
                                                newSession.activeCommand = null;
                                                newSession.interactiveMode = false;
                                            }
                                        } else {
                                            // 一次性完整输出
                                            newSession.activeCommand = null;
                                            newSession.interactiveMode = false;
                                            
                                            // 添加到历史记录
                                            const newHistory = newSession.history ? [...newSession.history] : [];
                                            newHistory.push({
                                                type: 'response',
                                                requestId,
                                                text: payload.output || payload.message || '命令执行成功，无输出',
                                                success: payload.success !== false
                                            });
                                            newSession.history = newHistory;
                                        }
                                        
                                        // 更新会话
                                        newSessions[sessionId] = newSession;
                                        
                                        return { terminalSessions: newSessions };
                                    });
                                }
                            }

                            // 处理挂起的命令响应
                            if (pendingCommands.has(requestId)) {
                                const { resolve, reject, timeoutId } = pendingCommands.get(requestId);

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

                // 定期清理过期的命令
                if (cleanupInterval) clearInterval(cleanupInterval);
                cleanupInterval = setInterval(() => {
                    const now = Date.now();
                    pendingCommands.forEach(({ timestamp, timeoutId }, requestId) => {
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
                set({ error: err.message });
            }
        },

        // 断开MQTT连接
        disconnect: () => {
            if (mqttClient && mqttClient.connected) {
                mqttClient.end();
                set({ connected: false });

                // 清理定时器
                if (cleanupInterval) clearInterval(cleanupInterval);
                cleanupInterval = null;
                mqttClient = null;
            }
        },

        // 设置当前查看的代理
        setCurrentAgent: (uuid) => {
            if (!uuid || get().currentAgent === uuid) return;

            set({ currentAgent: uuid });

            if (mqttClient && mqttClient.connected) {
                // 订阅该代理的响应主题
                mqttClient.subscribe(`${TOPICS.RESPONSE}${uuid}`, { qos: 0 });
            }
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
                mqttClient.subscribe(`${TOPICS.RESPONSE}${agentUuid}`, { qos: 0 });
            }

            return sessionId;
        },

        endTerminalSession: (sessionId) => {
            // 移除会话
            set(state => {
                const newSessions = { ...state.terminalSessions };
                delete newSessions[sessionId];
                return { terminalSessions: newSessions };
            });
        },

        // 修复：安全地更新终端会话，避免直接修改嵌套对象
        updateTerminalSession: (sessionId, updates) => {
            set(state => {
                // 检查会话是否存在
                const currentSessions = {...state.terminalSessions};
                const currentSession = currentSessions[sessionId];
                
                if (!currentSession) return state;
                
                // 创建新的会话对象
                const newSession = {...currentSession};
                
                // 安全地处理嵌套对象
                if (updates.history) {
                    // 仅限最近200条记录，避免过多历史造成性能问题
                    const safeHistory = (updates.history || []).slice(-200);
                    newSession.history = safeHistory;
                }
                
                if (updates.commandHistory) {
                    // 命令历史也应限制数量
                    const safeCommandHistory = (updates.commandHistory || []).slice(-50);
                    newSession.commandHistory = safeCommandHistory;
                }
                
                // 处理其他更新字段，避免循环引用
                Object.keys(updates).forEach(key => {
                    if (key !== 'history' && key !== 'commandHistory') {
                        if (typeof updates[key] === 'object' && updates[key] !== null) {
                            newSession[key] = safeClone(updates[key]);
                        } else {
                            newSession[key] = updates[key];
                        }
                    }
                });
                
                // 返回新的状态对象
                return {
                    terminalSessions: {
                        ...currentSessions,
                        [sessionId]: newSession
                    }
                };
            });
        },

        // 中断命令
        interruptCommand,

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
                mqttClient.subscribe(responseTopic, { qos: 0 }, (err) => {
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
                                set(state => {
                                    const currentSessions = {...state.terminalSessions};
                                    const session = currentSessions[sessionId];
                                    
                                    if (!session) return state;
                                    
                                    const newSession = {...session};
                                    newSession.activeCommand = null;
                                    newSession.interactiveMode = false;
                                    
                                    // 创建新的历史记录数组
                                    const newHistory = newSession.history ? [...newSession.history] : [];
                                    newHistory.push({
                                        type: 'error',
                                        text: '命令执行超时'
                                    });
                                    newSession.history = newHistory;
                                    
                                    currentSessions[sessionId] = newSession;
                                    
                                    return { terminalSessions: currentSessions };
                                });
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

                    // 针对终端输入命令，如果是Ctrl+C，优先使用中断命令
                    if (command === 'terminal_input' && params.input === '\u0003' && params.sessionId) {
                        interruptCommand(params.sessionId);
                    }

                    // 发布命令消息
                    const commandTopic = `${TOPICS.COMMAND}${uuid}`;
                    console.log(`发送命令到 ${commandTopic}:`, command);

                    // 对于关键命令使用QoS 1
                    const qos = command === 'terminal_input' || command === 'interrupt' || command === 'force_interrupt' ? 1 : 0;

                    mqttClient.publish(commandTopic, JSON.stringify(commandMessage), { qos }, (err) => {
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
        getAgentState: () => ({ ...agentState }),

        // Nginx相关命令 - 简化版，统一使用基础命令
        reloadNginx: (uuid) => get().sendCommand(uuid, 'reload'),
        restartNginx: (uuid) => get().sendCommand(uuid, 'restart'),
        stopNginx: (uuid) => get().sendCommand(uuid, 'stop'),
        startNginx: (uuid) => get().sendCommand(uuid, 'start')
    };
});

export default useMqttStore;
