// src/lib/mqtt-client.js
'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import mqtt from 'mqtt';
import { v4 as uuidv4 } from 'uuid';

// MQTT配置
const MQTT_BROKER = 'wss://mqtt.qfdk.me/mqtt'; // WebSocket连接
const MQTT_OPTIONS = {
    clientId: `uranus-control-${uuidv4()}`,
    clean: true,
    reconnectPeriod: 5000, // 5秒重连
    connectTimeout: 30 * 1000, // 30秒连接超时
};

// MQTT主题
const TOPICS = {
    HEARTBEAT: 'uranus/heartbeat',
    STATUS: 'uranus/status',
    COMMAND: 'uranus/command/',    // 将附加代理UUID
    RESPONSE: 'uranus/response/',  // 将附加代理UUID
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

    // 连接到MQTT服务器
    const connect = useCallback(() => {
        if (client) return;

        try {
            console.log('正在连接MQTT服务器...');
            const mqttClient = mqtt.connect(MQTT_BROKER, MQTT_OPTIONS);

            mqttClient.on('connect', () => {
                console.log('MQTT连接成功');
                setConnected(true);
                setError(null);

                // 订阅心跳主题
                mqttClient.subscribe(TOPICS.HEARTBEAT, { qos: 1 });
                mqttClient.subscribe(TOPICS.STATUS, { qos: 1 });

                // 当收到新的代理状态时，订阅该代理的响应主题
                Object.keys(agentState).forEach(uuid => {
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
                console.log('MQTT正在重新连接...');
            });

            mqttClient.on('message', (topic, message) => {
                handleMessage(topic, message);
            });

            setClient(mqttClient);

            // 组件卸载时断开连接
            return () => {
                if (mqttClient) {
                    console.log('断开MQTT连接');
                    mqttClient.end();
                    setClient(null);
                    setConnected(false);
                }
            };
        } catch (err) {
            console.error('MQTT连接失败:', err);
            setError(err.message);
        }
    }, [client, agentState]);

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
                    setAgentState(agentStateRef.current);

                    console.log(`MQTT: 收到代理 ${uuid} 的心跳消息`);

                    // 确保已订阅此代理的响应主题
                    if (client) {
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
                    setAgentState(agentStateRef.current);

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
            if (!client || !connected) {
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
    }, [client, connected]);

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

    // 当组件加载时自动连接
    useEffect(() => {
        connect();
    }, [connect]);

    return {
        connected,
        error,
        agentState,  // 暴露当前的代理状态
        sendCommand,
        reconnect: connect,
    };
}

// 导出MQTT主题
export { TOPICS };
