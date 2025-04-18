'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import mqtt from 'mqtt';
import { v4 as uuidv4 } from 'uuid';

// MQTT配置
const MQTT_BROKER = 'wss://mqtt.qfdk.me/mqtt'; // WebSocket连接
const MQTT_OPTIONS = {
    clientId: `uranus-control-${uuidv4()}`,
    clean: true,
    reconnectPeriod: 3000, // 减少重连间隔到3秒
    connectTimeout: 30 * 1000, // 30秒连接超时
    keepalive: 30, // 添加keepalive选项，30秒
    will: {  // 遗嘱消息，当客户端异常断开时发送
        topic: 'uranus/clients/status',
        payload: JSON.stringify({ clientId: `uranus-control-${uuidv4()}`, status: 'offline' }),
        qos: 1,
        retain: false
    }
};

// MQTT主题
const TOPICS = {
    HEARTBEAT: 'uranus/heartbeat',
    STATUS: 'uranus/status',
    COMMAND: 'uranus/command/',    // 将附加代理UUID
    RESPONSE: 'uranus/response/',  // 将附加代理UUID
    CLIENT_HEARTBEAT: 'uranus/clients/heartbeat', // 客户端心跳主题
};

/**
 * MQTT客户端Hook
 * @returns {Object} MQTT客户端hook
 */
export function useMqttClient() {
    const [client, setClient] = useState(null);
    const [connected, setConnected] = useState(false);
    const [error, setError] = useState(null);
    const [agentState, setAgentState] = useState({});
    const agentStateRef = useRef({}); // 用于在回调中访问最新状态
    const pendingCommands = useRef(new Map()); // 存储待处理的命令
    const reconnectCountRef = useRef(0); // 记录重连次数
    const clientIdRef = useRef(`uranus-control-${uuidv4()}`); // 固定客户端ID，避免每次重连生成新ID

    // 连接到MQTT服务器
    const connect = useCallback(() => {
        if (client) {
            // 如果已有客户端实例但未连接，尝试重新连接
            if (!client.connected) {
                client.reconnect();
            }
            return;
        }

        try {
            console.log(`正在连接MQTT服务器... (尝试次数: ${reconnectCountRef.current + 1})`);

            // 使用固定的clientId
            const mqttOptions = {
                ...MQTT_OPTIONS,
                clientId: clientIdRef.current,
            };

            const mqttClient = mqtt.connect(MQTT_BROKER, mqttOptions);

            mqttClient.on('connect', () => {
                console.log('MQTT连接成功');
                setConnected(true);
                setError(null);
                reconnectCountRef.current = 0; // 重置重连计数

                // 订阅心跳主题
                mqttClient.subscribe(TOPICS.HEARTBEAT, { qos: 1 });
                mqttClient.subscribe(TOPICS.STATUS, { qos: 1 });

                // 发送上线状态
                mqttClient.publish('uranus/clients/status', JSON.stringify({
                    clientId: clientIdRef.current,
                    status: 'online',
                    timestamp: Date.now()
                }), { qos: 1 });

                // 当收到新的代理状态时，订阅该代理的响应主题
                Object.keys(agentStateRef.current).forEach(uuid => {
                    const responseTopic = `${TOPICS.RESPONSE}${uuid}`;
                    mqttClient.subscribe(responseTopic, { qos: 1 });
                });
            });

            mqttClient.on('error', (err) => {
                console.error('MQTT连接错误:', err);
                setError(err.message);
            });

            mqttClient.on('close', () => {
                console.log('MQTT连接已关闭');
                setConnected(false);
            });

            mqttClient.on('reconnect', () => {
                reconnectCountRef.current += 1;
                console.log(`MQTT正在重新连接... (尝试次数: ${reconnectCountRef.current})`);
            });

            mqttClient.on('offline', () => {
                console.log('MQTT客户端离线');
                setConnected(false);
            });

            mqttClient.on('message', (topic, message) => {
                handleMessage(topic, message);
            });

            setClient(mqttClient);
        } catch (err) {
            console.error('MQTT连接失败:', err);
            setError(err.message);

            // 连接失败后延迟重试
            setTimeout(() => {
                reconnectCountRef.current += 1;
                connect();
            }, 5000);
        }
    }, [client]);

    // 处理收到的消息
    const handleMessage = useCallback((topic, message) => {
        try {
            const payload = JSON.parse(message.toString());

            if (topic === TOPICS.HEARTBEAT) {
                // 处理心跳消息
                if (payload.uuid) {
                    const uuid = payload.uuid;
                    // 更新状态引用，用于其他地方直接访问最新状态
                    agentStateRef.current = {
                        ...agentStateRef.current,
                        [uuid]: {
                            ...agentStateRef.current[uuid],
                            ...payload,
                            online: true,
                            lastHeartbeat: new Date(),
                        }
                    };

                    // 更新React状态，触发重新渲染
                    setAgentState({...agentStateRef.current});

                    console.log(`MQTT: 收到代理 ${uuid} 的心跳消息`);

                    // 确保已订阅此代理的响应主题
                    if (client && client.connected) {
                        const responseTopic = `${TOPICS.RESPONSE}${uuid}`;
                        client.subscribe(responseTopic, { qos: 1 });
                    }
                }
            } else if (topic === TOPICS.STATUS) {
                // 处理状态消息
                if (payload.uuid) {
                    const uuid = payload.uuid;
                    // 更新状态引用
                    agentStateRef.current = {
                        ...agentStateRef.current,
                        [uuid]: {
                            ...agentStateRef.current[uuid],
                            online: payload.status === 'online',
                            lastStatusChange: new Date(),
                        }
                    };

                    // 更新React状态
                    setAgentState({...agentStateRef.current});

                    console.log(`MQTT: 代理 ${uuid} 状态变更为 ${payload.status}`);
                }
            } else if (topic.startsWith(TOPICS.RESPONSE)) {
                // 处理响应消息
                const uuid = topic.substring(TOPICS.RESPONSE.length);
                const requestId = payload.requestId;

                // 检查是否有对应的待处理命令
                if (pendingCommands.current.has(requestId)) {
                    const { resolve, reject } = pendingCommands.current.get(requestId);

                    // 删除此命令
                    pendingCommands.current.delete(requestId);

                    // 根据响应结果解析Promise
                    if (payload.success) {
                        resolve(payload);
                    } else {
                        reject(new Error(payload.message || '命令执行失败'));
                    }
                }
            }
        } catch (err) {
            console.error('处理MQTT消息出错:', err, message.toString());
        }
    }, [client]);

    // 向代理发送命令
    const sendCommand = useCallback((uuid, command, params = {}) => {
        return new Promise((resolve, reject) => {
            if (!client || !client.connected) {
                reject(new Error('MQTT客户端未连接'));
                return;
            }

            if (!uuid) {
                reject(new Error('需要提供代理UUID'));
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
                clientId: clientIdRef.current,
            };

            // 保存待处理命令
            pendingCommands.current.set(requestId, { resolve, reject, timestamp: Date.now() });

            // 设置命令超时
            setTimeout(() => {
                if (pendingCommands.current.has(requestId)) {
                    pendingCommands.current.delete(requestId);
                    reject(new Error('命令执行超时'));
                }
            }, 30000); // 30秒超时

            // 发布命令消息
            const commandTopic = `${TOPICS.COMMAND}${uuid}`;
            client.publish(commandTopic, JSON.stringify(commandMessage), { qos: 1 }, (err) => {
                if (err) {
                    pendingCommands.current.delete(requestId);
                    reject(new Error(`发送命令失败: ${err.message}`));
                }
            });
        });
    }, [client]);

    // 清理过期的命令
    useEffect(() => {
        if (!connected) return;

        const cleanupInterval = setInterval(() => {
            const now = Date.now();
            pendingCommands.current.forEach(({ timestamp }, requestId) => {
                // 清理超过30秒的命令
                if (now - timestamp > 30000) {
                    pendingCommands.current.delete(requestId);
                }
            });
        }, 10000); // 10秒检查一次

        return () => clearInterval(cleanupInterval);
    }, [connected]);

    // 实现客户端心跳机制
    useEffect(() => {
        if (!client || !client.connected) return;

        // 每15秒发送一次客户端心跳
        const heartbeatInterval = setInterval(() => {
            client.publish(TOPICS.CLIENT_HEARTBEAT, JSON.stringify({
                clientId: clientIdRef.current,
                timestamp: Date.now()
            }), { qos: 0 });
        }, 15000);

        return () => clearInterval(heartbeatInterval);
    }, [client, connected]);

    // 监控连接状态并处理断线重连
    useEffect(() => {
        if (!client) return;

        // 监控连接状态
        let reconnectTimer = null;

        const checkConnection = () => {
            if (client && !client.connected && connected) {
                console.log('检测到连接丢失，尝试重新连接...');
                setConnected(false);

                // 延迟重连以避免立即重连可能导致的问题
                reconnectTimer = setTimeout(() => {
                    // 如果客户端仍然存在但未连接，先关闭再重连
                    if (client) {
                        try {
                            client.end(true); // 强制关闭现有连接
                            setClient(null); // 清除客户端引用
                        } catch (e) {
                            console.error('关闭MQTT连接出错:', e);
                        }
                    }
                    connect();
                }, 2000);
            }
        };

        const connectionCheck = setInterval(checkConnection, 10000);

        return () => {
            clearInterval(connectionCheck);
            if (reconnectTimer) clearTimeout(reconnectTimer);
        };
    }, [client, connected, connect]);

    // 当组件加载时自动连接
    useEffect(() => {
        connect();

        // 组件卸载时断开连接
        return () => {
            if (client) {
                console.log('断开MQTT连接');
                try {
                    // 发送离线状态
                    if (client.connected) {
                        client.publish('uranus/clients/status', JSON.stringify({
                            clientId: clientIdRef.current,
                            status: 'offline',
                            timestamp: Date.now()
                        }), { qos: 1 }, () => {
                            client.end();
                        });
                    } else {
                        client.end();
                    }
                } catch (e) {
                    console.error('关闭MQTT连接出错:', e);
                }
                setClient(null);
                setConnected(false);
            }
        };
    }, [connect]);

    // 添加网络状态监听
    useEffect(() => {
        const handleOnline = () => {
            console.log('网络连接恢复');
            if (client && !client.connected) {
                console.log('网络恢复，尝试重新连接MQTT');
                connect();
            }
        };

        const handleOffline = () => {
            console.log('网络连接断开');
            setConnected(false);
        };

        window.addEventListener('online', handleOnline);
        window.addEventListener('offline', handleOffline);

        return () => {
            window.removeEventListener('online', handleOnline);
            window.removeEventListener('offline', handleOffline);
        };
    }, [client, connect]);

    return {
        connected,
        error,
        agentState,  // 暴露当前的代理状态
        sendCommand,
        reconnect: connect,
        // 添加一个手动断开连接的方法
        disconnect: useCallback(() => {
            if (client && client.connected) {
                client.end();
                setClient(null);
                setConnected(false);
            }
        }, [client])
    };
}

// 导出MQTT主题
export { TOPICS };
