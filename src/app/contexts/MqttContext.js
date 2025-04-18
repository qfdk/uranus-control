// src/app/contexts/MqttContext.js
'use client';

import { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { useMqttClient } from '@/lib/mqtt-client';
import { useAuth } from './AuthContext';
import { useApp } from './AppContext';

// 创建MQTT上下文
const MqttContext = createContext();

// MQTT提供者组件
export function MqttProvider({ children }) {
    const { isAuthenticated } = useAuth();
    const { fetchAgents } = useApp();
    const [isMqttEnabled, setIsMqttEnabled] = useState(true);

    // 使用MQTT客户端hook
    const { connected, error, agentState, sendCommand, reconnect } = useMqttClient();

    // 当代理状态更新时，同步到App上下文
    useEffect(() => {
        if (!isAuthenticated || !connected) return;

        // 转换MQTT代理状态为控制台所需格式
        const agents = Object.values(agentState).map(agent => ({
            _id: agent.uuid, // 使用UUID作为ID
            uuid: agent.uuid,
            hostname: agent.hostname || 'Unknown Host',
            ip: agent.ip || '',
            online: agent.online || false,
            buildVersion: agent.buildVersion || '',
            buildTime: agent.buildTime || '',
            commitId: agent.commitId || '',
            goVersion: agent.goVersion || '',
            os: agent.os || '',
            memory: agent.memory || '',
            url: agent.url || '',
            token: agent.token || '',
            lastHeartbeat: agent.lastHeartbeat || new Date(),
            stats: {
                websites: 0, // 这些数据目前MQTT心跳不包含，后续可扩展
                certificates: 0
            }
        }));

        // 如果有代理数据变更，触发更新
        if (agents.length > 0) {
            console.log('MQTT: 发现', agents.length, '个代理通过MQTT心跳');
            // 触发应用重新获取代理列表，包含完整信息
            fetchAgents();
        }
    }, [agentState, isAuthenticated, connected, fetchAgents]);

    // 向代理发送命令的封装函数
    const executeCommand = useCallback(async (agentId, command, params = {}) => {
        if (!connected) {
            throw new Error('MQTT未连接，无法发送命令');
        }

        console.log(`MQTT: 向代理 ${agentId} 发送命令: ${command}`);

        try {
            const response = await sendCommand(agentId, command, params);
            console.log(`MQTT: 命令执行成功:`, response);
            return response;
        } catch (err) {
            console.error(`MQTT: 命令执行失败:`, err);
            throw err;
        }
    }, [connected, sendCommand]);

    // 特定命令函数
    const reloadNginx = useCallback((agentId) => {
        return executeCommand(agentId, 'reload');
    }, [executeCommand]);

    const restartNginx = useCallback((agentId) => {
        return executeCommand(agentId, 'restart');
    }, [executeCommand]);

    const stopNginx = useCallback((agentId) => {
        return executeCommand(agentId, 'stop');
    }, [executeCommand]);

    const startNginx = useCallback((agentId) => {
        return executeCommand(agentId, 'start');
    }, [executeCommand]);

    const upgradeAgent = useCallback((agentId, url = '') => {
        const params = url ? { url } : {};
        return executeCommand(agentId, 'update', params);
    }, [executeCommand]);

    // 提供MqttContext值
    const contextValue = {
        connected,
        error,
        isMqttEnabled,
        setIsMqttEnabled,
        reconnect,
        // 暴露代理状态数据
        agentState,
        // 命令函数
        executeCommand,
        reloadNginx,
        restartNginx,
        stopNginx,
        startNginx,
        upgradeAgent,
    };

    return (
        <MqttContext.Provider value={contextValue}>
            {children}
        </MqttContext.Provider>
    );
}

// 使用MQTT上下文的钩子
export function useMqtt() {
    const context = useContext(MqttContext);
    if (context === undefined) {
        throw new Error('useMqtt必须在MqttProvider内部使用');
    }
    return context;
}
