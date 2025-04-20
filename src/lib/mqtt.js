'use client';

import {useCallback, useEffect, useRef, useState} from 'react';
import mqtt from 'mqtt';
import {v4 as uuidv4} from 'uuid';

// MQTT configuration
const MQTT_BROKER = 'wss://mqtt.qfdk.me/mqtt'; // WebSocket connection
const MQTT_OPTIONS = {
    clientId: `uranus-control-${uuidv4()}`,
    clean: true,
    reconnectPeriod: 3000, // Reduced reconnect interval to 3 seconds
    connectTimeout: 30 * 1000, // 30 second connection timeout
    keepalive: 30, // Add keepalive option, 30 seconds
    will: {  // Last will message, sent when client disconnects unexpectedly
        topic: 'uranus/clients/status',
        payload: JSON.stringify({clientId: `uranus-control-${uuidv4()}`, status: 'offline'}),
        qos: 1,
        retain: false
    }
};

// MQTT topics
const TOPICS = {
    HEARTBEAT: 'uranus/heartbeat',
    STATUS: 'uranus/status',
    COMMAND: 'uranus/command/',    // Will append agent UUID
    RESPONSE: 'uranus/response/',  // Will append agent UUID
    CLIENT_HEARTBEAT: 'uranus/clients/heartbeat' // Client heartbeat topic
};

/**
 * MQTT client Hook
 * @returns {Object} MQTT client hook
 */
export function useMqttClient() {
    const [client, setClient] = useState(null);
    const [connected, setConnected] = useState(false);
    const [error, setError] = useState(null);
    const [agentState, setAgentState] = useState({});
    const agentStateRef = useRef({}); // For accessing latest state in callbacks
    const pendingCommands = useRef(new Map()); // Store pending commands
    const reconnectCountRef = useRef(0); // Track reconnection attempts
    const clientIdRef = useRef(`uranus-control-${uuidv4()}`); // Fixed client ID to avoid generating new ID on each reconnect
    const isInitializedRef = useRef(false);
    const connectionCheckTimerRef = useRef(null);
    const lastUpdateTimestampRef = useRef(Date.now());
    // Handle received messages
    const handleMessage = useCallback((topic, message) => {
        try {
            const payload = JSON.parse(message.toString());

            // Throttle logging to avoid console spam
            const now = Date.now();
            if (now - lastUpdateTimestampRef.current > 1000) {
                // console.log(`MQTT message received on topic ${topic}`, payload);
                lastUpdateTimestampRef.current = now;
            }

            if (topic === TOPICS.HEARTBEAT) {
                // Handle heartbeat message
                if (payload.uuid) {
                    const uuid = payload.uuid;
                    const timestamp = new Date();

                    // Update state reference for direct access elsewhere
                    const newAgentState = {
                        ...agentStateRef.current,
                        [uuid]: {
                            ...agentStateRef.current[uuid],
                            ...payload,
                            online: true,
                            lastHeartbeat: timestamp,
                            lastUpdate: timestamp
                        }
                    };

                    agentStateRef.current = newAgentState;

                    // Update React state to trigger re-render
                    setAgentState(prevState => {
                        // Only update if there are actual changes to avoid unnecessary renders
                        if (JSON.stringify(prevState[uuid]) !== JSON.stringify(newAgentState[uuid])) {
                            return {...newAgentState};
                        }
                        return prevState;
                    });

                    // Ensure subscribed to this agent's response topic
                    if (client && client.connected) {
                        const responseTopic = `${TOPICS.RESPONSE}${uuid}`;
                        client.subscribe(responseTopic, {qos: 1});
                    }
                }
            } else if (topic.startsWith(TOPICS.RESPONSE)) {
                // Handle response message
                const uuid = topic.substring(TOPICS.RESPONSE.length);
                const requestId = payload.requestId;

                // Check if there's a corresponding pending command
                if (pendingCommands.current.has(requestId)) {
                    const {resolve, reject} = pendingCommands.current.get(requestId);

                    // Delete this command
                    pendingCommands.current.delete(requestId);

                    // Resolve or reject the promise based on response
                    if (payload.success) {
                        console.log(`Command ${requestId} executed successfully on agent ${uuid}`);
                        resolve(payload);
                    } else {
                        console.error(`Command ${requestId} failed on agent ${uuid}:`, payload.message);
                        reject(new Error(payload.message || 'Command execution failed'));
                    }
                }
            }
        } catch (err) {
            console.error('Error parsing MQTT message:', err, message.toString());
        }
    }, [client]);

    // Connect to MQTT server
    const connect = useCallback(() => {
        if (client) {
            // If client instance exists but not connected, try to reconnect
            if (!client.connected) {
                console.log('Reconnecting existing client...');
                try {
                    client.reconnect();
                } catch (err) {
                    console.error('Error reconnecting:', err);
                    // Clean up the client if reconnection fails
                    setClient(null);
                    // And retry after a delay
                    setTimeout(connect, 2000);
                }
            }
            return;
        }

        try {
            console.log(`Connecting to MQTT server... (Attempt: ${reconnectCountRef.current + 1})`);

            // Use fixed clientId
            const mqttOptions = {
                ...MQTT_OPTIONS,
                clientId: clientIdRef.current
            };

            const mqttClient = mqtt.connect(MQTT_BROKER, mqttOptions);

            mqttClient.on('connect', () => {
                console.log('MQTT connection successful');
                setConnected(true);
                setError(null);
                reconnectCountRef.current = 0; // Reset reconnect counter

                // Subscribe to heartbeat topic
                mqttClient.subscribe(TOPICS.HEARTBEAT, {qos: 1});
                mqttClient.subscribe(TOPICS.STATUS, {qos: 1});

                // Send online status
                mqttClient.publish('uranus/clients/status', JSON.stringify({
                    clientId: clientIdRef.current,
                    status: 'online',
                    timestamp: Date.now()
                }), {qos: 1});

                // When receiving new agent state, subscribe to that agent's response topic
                Object.keys(agentStateRef.current).forEach(uuid => {
                    const responseTopic = `${TOPICS.RESPONSE}${uuid}`;
                    mqttClient.subscribe(responseTopic, {qos: 1});
                    console.log(`Subscribed to response topic for agent ${uuid}`);
                });

                // Request status update from all agents
                mqttClient.publish('uranus/request_status', JSON.stringify({
                    clientId: clientIdRef.current,
                    timestamp: Date.now()
                }), {qos: 1});
            });

            mqttClient.on('error', (err) => {
                console.error('MQTT connection error:', err);
                setError(err.message);
            });

            mqttClient.on('close', () => {
                console.log('MQTT connection closed');
                setConnected(false);
            });

            mqttClient.on('reconnect', () => {
                reconnectCountRef.current += 1;
                console.log(`MQTT reconnecting... (Attempt: ${reconnectCountRef.current})`);
            });

            mqttClient.on('offline', () => {
                console.log('MQTT client offline');
                setConnected(false);
            });

            mqttClient.on('message', (topic, message) => {
                try {
                    handleMessage(topic, message);
                } catch (err) {
                    console.error('Error handling MQTT message:', err);
                }
            });

            setClient(mqttClient);
        } catch (err) {
            console.error('MQTT connection failed:', err);
            setError(err.message);

            // Retry after delay on connection failure
            setTimeout(() => {
                reconnectCountRef.current += 1;
                connect();
            }, 5000);
        }
    }, [client, handleMessage]);


    // Send command to agent
    const sendCommand = useCallback((uuid, command, params = {}) => {
        return new Promise((resolve, reject) => {
            if (!client || !client.connected) {
                reject(new Error('MQTT client not connected'));
                return;
            }

            if (!uuid) {
                reject(new Error('Agent UUID is required'));
                return;
            }

            // Create request ID
            const requestId = uuidv4();

            // Build command message
            const commandMessage = {
                command,
                params,
                requestId,
                timestamp: Date.now(),
                clientId: clientIdRef.current
            };

            // Save pending command
            pendingCommands.current.set(requestId, {resolve, reject, timestamp: Date.now()});

            // Set command timeout
            setTimeout(() => {
                if (pendingCommands.current.has(requestId)) {
                    pendingCommands.current.delete(requestId);
                    reject(new Error('Command execution timeout'));
                }
            }, 30000); // 30 second timeout

            // Publish command message
            const commandTopic = `${TOPICS.COMMAND}${uuid}`;
            console.log(`Sending command to ${commandTopic}:`, commandMessage);

            client.publish(commandTopic, JSON.stringify(commandMessage), {qos: 1}, (err) => {
                if (err) {
                    pendingCommands.current.delete(requestId);
                    reject(new Error(`Failed to send command: ${err.message}`));
                }
            });
        });
    }, [client]);

    // Clean up expired commands
    useEffect(() => {
        if (!connected) return;

        const cleanupInterval = setInterval(() => {
            const now = Date.now();
            let expiredCount = 0;

            pendingCommands.current.forEach(({timestamp}, requestId) => {
                // Clean up commands older than 30 seconds
                if (now - timestamp > 30000) {
                    pendingCommands.current.delete(requestId);
                    expiredCount++;
                }
            });

            if (expiredCount > 0) {
                console.log(`Cleaned up ${expiredCount} expired commands`);
            }
        }, 10000); // Check every 10 seconds

        return () => clearInterval(cleanupInterval);
    }, [connected]);

    // Implement client heartbeat mechanism
    useEffect(() => {
        if (!client || !client.connected) return;

        // Send client heartbeat every 15 seconds
        const heartbeatInterval = setInterval(() => {
            client.publish(TOPICS.CLIENT_HEARTBEAT, JSON.stringify({
                clientId: clientIdRef.current,
                timestamp: Date.now()
            }), {qos: 0});
        }, 15000);

        return () => clearInterval(heartbeatInterval);
    }, [client, connected]);

    // Monitor connection status and handle reconnection
    useEffect(() => {
        if (!client) return;

        // Monitor connection status
        if (connectionCheckTimerRef.current) {
            clearInterval(connectionCheckTimerRef.current);
        }

        connectionCheckTimerRef.current = setInterval(() => {
            if (client && !client.connected && connected) {
                console.log('Connection loss detected, attempting to reconnect...');
                setConnected(false);

                // Delay reconnect to avoid immediate reconnection issues
                setTimeout(() => {
                    // If client still exists but not connected, end it and reconnect
                    if (client) {
                        try {
                            client.end(true); // Force close existing connection
                            setClient(null); // Clear client reference
                        } catch (e) {
                            console.error('Error closing MQTT connection:', e);
                        }
                    }
                    connect();
                }, 2000);
            }
        }, 10000);

        return () => {
            if (connectionCheckTimerRef.current) {
                clearInterval(connectionCheckTimerRef.current);
                connectionCheckTimerRef.current = null;
            }
        };
    }, [client, connected, connect]);

    // Connect when component mounts
    useEffect(() => {
        if (!isInitializedRef.current) {
            isInitializedRef.current = true;
            connect();
        }

        // Disconnect when component unmounts
        return () => {
            if (client) {
                console.log('Disconnecting MQTT');
                try {
                    // Send offline status
                    if (client.connected) {
                        client.publish('uranus/clients/status', JSON.stringify({
                            clientId: clientIdRef.current,
                            status: 'offline',
                            timestamp: Date.now()
                        }), {qos: 1}, () => {
                            client.end();
                        });
                    } else {
                        client.end();
                    }
                } catch (e) {
                    console.error('Error closing MQTT connection:', e);
                }
                setClient(null);
                setConnected(false);
            }

            // Clear all timers
            if (connectionCheckTimerRef.current) {
                clearInterval(connectionCheckTimerRef.current);
                connectionCheckTimerRef.current = null;
            }
        };
    }, [client, connect]);

    // Add network status listener
    useEffect(() => {
        const handleOnline = () => {
            console.log('Network connection restored');
            if (client && !client.connected) {
                console.log('Network restored, attempting to reconnect MQTT');
                connect();
            }
        };

        const handleOffline = () => {
            console.log('Network connection lost');
            setConnected(false);
        };

        window.addEventListener('online', handleOnline);
        window.addEventListener('offline', handleOffline);

        return () => {
            window.removeEventListener('online', handleOnline);
            window.removeEventListener('offline', handleOffline);
        };
    }, [client, connect]);


    // 修改useMqttClient钩子，在return语句之前添加Nginx命令函数

// 添加Nginx命令函数
    const reloadNginx = useCallback((uuid) => {
        return sendCommand(uuid, 'reload_nginx');
    }, [sendCommand]);

    const restartNginx = useCallback((uuid) => {
        return sendCommand(uuid, 'restart_nginx');
    }, [sendCommand]);

    const stopNginx = useCallback((uuid) => {
        return sendCommand(uuid, 'stop_nginx');
    }, [sendCommand]);

    const startNginx = useCallback((uuid) => {
        return sendCommand(uuid, 'start_nginx');
    }, [sendCommand]);

    const upgradeAgent = useCallback((uuid) => {
        return sendCommand(uuid, 'upgrade');
    }, [sendCommand]);

    return {
        connected,
        error,
        agentState,
        sendCommand,
        reconnect: connect,
        disconnect: useCallback(() => {
            if (client && client.connected) {
                client.end();
                setClient(null);
                setConnected(false);
            }
        }, [client]),
        // 添加Nginx命令函数
        reloadNginx,
        restartNginx,
        stopNginx,
        startNginx,
        upgradeAgent
    };
}

// Export MQTT topics
export {TOPICS};
