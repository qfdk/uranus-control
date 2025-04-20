'use client';

import { useState, useCallback } from 'react';
import { useMqttClient } from '@/lib/mqtt';
import { useAsyncLoading } from '@/lib/loading-hooks';

export function useNginxCommands(agent) {
    const [isExecuting, setIsExecuting] = useState(false);
    const [commandResult, setCommandResult] = useState('');
    const { connected: mqttConnected, reloadNginx, restartNginx, stopNginx, startNginx } = useMqttClient();
    const { withLoading } = useAsyncLoading();

    const executeCommand = useCallback(async (commandType) => {
        if (isExecuting || !agent) return { success: false };

        setCommandResult('');

        try {
            setIsExecuting(true);

            const commands = {
                reload: { mqtt: reloadNginx, name: '重载' },
                restart: { mqtt: restartNginx, name: '重启' },
                stop: { mqtt: stopNginx, name: '停止' },
                start: { mqtt: startNginx, name: '启动' }
            };

            const command = commands[commandType];

            if (!command) {
                throw new Error(`未知命令: ${commandType}`);
            }

            return await withLoading(async () => {
                if (mqttConnected && agent.uuid) {
                    // 使用MQTT发送命令
                    const response = await command.mqtt(agent.uuid);
                    setCommandResult(`${command.name}命令执行成功: ${response.message}`);
                    return { success: true, response };
                } else {
                    // 使用HTTP API发送命令
                    const response = await fetch(`/api/agents/${agent._id}/command`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ command: commandType })
                    });

                    const data = await response.json();
                    setCommandResult(`${command.name}命令执行成功: ${data.message || 'OK'}`);
                    return { success: true, response: data };
                }
            }, false); // false表示不使用全局加载状态
        } catch (error) {
            console.error(`${commandType}命令执行失败:`, error);
            setCommandResult(`命令执行失败: ${error.message}`);
            return { success: false, error };
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
                            // 而是返回更新后的代理信息
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
    }, [agent, isExecuting, mqttConnected, reloadNginx, restartNginx, stopNginx, startNginx, withLoading]);

    return {
        executeCommand,
        isExecuting,
        commandResult,
        reloadNginx: () => executeCommand('reload'),
        restartNginx: () => executeCommand('restart'),
        stopNginx: () => executeCommand('stop'),
        startNginx: () => executeCommand('start')
    };
}
