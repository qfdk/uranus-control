// src/hooks/useNginxCommands.js
'use client';

import {useCallback, useState} from 'react';
import {useMqttClient} from '@/lib/mqtt';
import {useAsyncLoading} from '@/lib/loading-hooks';

/**
 * Nginx命令执行钩子
 * 提供执行Nginx命令的功能并管理状态
 * @param {Object} agent - 代理对象
 * @returns {Object} Nginx命令函数和状态
 */
export function useNginxCommands(agent) {
    // 状态
    const [isExecuting, setIsExecuting] = useState(false);
    const [commandMessage, setCommandMessage] = useState({
        type: '', // success, error, loading
        content: '',
        show: false
    });

    // MQTT客户端及加载状态Hook
    const {connected: mqttConnected, reloadNginx, restartNginx, stopNginx, startNginx} = useMqttClient();
    const {withLoading} = useAsyncLoading();

    /**
     * 清除命令消息
     */
    const clearMessage = useCallback(() => {
        setCommandMessage({
            type: '',
            content: '',
            show: false
        });
    }, []);

    /**
     * 执行Nginx命令
     * @param {string} commandType - 命令类型: reload, restart, stop, start
     * @returns {Promise<Object>} 执行结果
     */
    const executeCommand = useCallback(async (commandType) => {
        if (isExecuting || !agent) return {success: false};

        // 清除之前的消息
        clearMessage();

        // 命令名称映射
        const commandNames = {
            reload: '重载配置',
            restart: '重启服务',
            stop: '停止服务',
            start: '启动服务'
        };

        // 命令函数映射
        const commands = {
            reload: {mqtt: reloadNginx, name: commandNames.reload},
            restart: {mqtt: restartNginx, name: commandNames.restart},
            stop: {mqtt: stopNginx, name: commandNames.stop},
            start: {mqtt: startNginx, name: commandNames.start}
        };

        const command = commands[commandType];

        if (!command) {
            setCommandMessage({
                type: 'error',
                content: `未知命令: ${commandType}`,
                show: true
            });
            return {success: false};
        }

        try {
            setIsExecuting(true);

            // 显示加载状态
            setCommandMessage({
                type: 'loading',
                content: `正在${command.name}...`,
                show: true
            });

            return await withLoading(async () => {
                try {
                    if (mqttConnected && agent.uuid) {
                        // 使用MQTT发送命令
                        const response = await command.mqtt(agent.uuid);

                        // 收到响应后立即更新状态
                        setIsExecuting(false);

                        setCommandMessage({
                            type: 'success',
                            content: `${command.name}成功: ${response.message || '操作已完成'}`,
                            show: true
                        });

                        return {success: true, response};
                    } else {
                        // 使用HTTP API发送命令
                        const response = await fetch(`/api/agents/${agent._id}/command`, {
                            method: 'POST',
                            headers: {'Content-Type': 'application/json'},
                            body: JSON.stringify({command: commandType})
                        });

                        const data = await response.json();

                        // 收到响应后立即更新状态
                        setIsExecuting(false);

                        if (!response.ok) {
                            throw new Error(data.error || `HTTP错误: ${response.status}`);
                        }

                        setCommandMessage({
                            type: 'success',
                            content: `${command.name}成功: ${data.message || '操作已完成'}`,
                            show: true
                        });

                        return {success: true, response: data};
                    }
                } catch (error) {
                    // 发生错误时也更新状态
                    setIsExecuting(false);
                    throw error;
                }
            }, false); // false表示不使用全局加载状态
        } catch (error) {
            console.error(`${commandType}命令执行失败:`, error);

            setCommandMessage({
                type: 'error',
                content: `${command.name}失败: ${error.message}`,
                show: true
            });

            return {success: false, error};
        } finally {
            // 延迟后关闭执行状态，以便刷新代理状态
            setTimeout(async () => {
                try {
                    // 尝试刷新代理状态
                    if (agent && agent._id) {
                        const refreshResponse = await fetch(`/api/agents/${agent._id}`);
                        if (refreshResponse.ok) {
                            const updatedAgent = await refreshResponse.json();
                            // 这里不直接设置agent，因为那应该由父组件控制
                            return updatedAgent;
                        }
                    }
                } catch (error) {
                    console.error('刷新代理状态失败:', error);
                } finally {
                    setIsExecuting(false);
                }
            }, 3000);
        }
    }, [agent, isExecuting, mqttConnected, reloadNginx, restartNginx, stopNginx, startNginx, withLoading, clearMessage]);

    return {
        executeCommand,
        isExecuting,
        commandMessage,
        clearMessage,
        reloadNginx: () => executeCommand('reload'),
        restartNginx: () => executeCommand('restart'),
        stopNginx: () => executeCommand('stop'),
        startNginx: () => executeCommand('start')
    };
}
