'use client';

import { useState, useCallback } from 'react';
import { useAuth } from '@/app/contexts/AuthContext';
import { useAsyncLoading } from '@/lib/loading-hooks';

export function useAgentRefresh(initialAgents = []) {
    const [agents, setAgents] = useState(initialAgents);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState(null);
    const { logout } = useAuth();
    const { withLoading } = useAsyncLoading();

    // 刷新代理数据
    const refreshAgents = useCallback(async (showGlobalLoading = false) => {
        try {
            setIsLoading(true);
            setError(null);

            return await withLoading(async () => {
                console.log('刷新代理数据');
                const response = await fetch('/api/agents');

                if (response.status === 401) {
                    // 处理未授权响应
                    console.log('会话已过期，请重新登录');
                    logout();
                    return { success: false, authError: true };
                }

                if (!response.ok) {
                    throw new Error(`服务器返回错误: ${response.status}`);
                }

                const data = await response.json();
                console.log('获取到新数据:', data.length);
                setAgents(data);
                return { success: true, data };
            }, showGlobalLoading);
        } catch (error) {
            console.error('刷新代理数据失败:', error);
            setError(error.message);
            return { success: false, error };
        } finally {
            setIsLoading(false);
        }
    }, [logout, withLoading]);

    // 删除代理
    const deleteAgent = useCallback(async (agentId) => {
        if (!confirm('确定要删除此代理吗？此操作不可撤销。')) {
            return { success: false, canceled: true };
        }

        try {
            return await withLoading(async () => {
                const response = await fetch(`/api/agents/${agentId}`, {
                    method: 'DELETE'
                });

                if (response.status === 401) {
                    logout();
                    throw new Error('会话已过期，请重新登录');
                }

                if (!response.ok) {
                    throw new Error(`服务器返回错误: ${response.status}`);
                }

                // 更新本地状态删除代理
                setAgents(prevAgents => prevAgents.filter(agent => agent._id !== agentId));
                return { success: true };
            });
        } catch (error) {
            console.error('删除代理失败:', error);
            return { success: false, error };
        }
    }, [logout, withLoading]);

    // 注册新代理
    const registerAgent = useCallback(async (agentData) => {
        try {
            return await withLoading(async () => {
                const response = await fetch('/api/agents', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(agentData)
                });

                if (response.status === 401) {
                    logout();
                    throw new Error('会话已过期，请重新登录');
                }

                if (!response.ok) {
                    throw new Error(`服务器返回错误: ${response.status}`);
                }

                const newAgent = await response.json();
                setAgents(prevAgents => [...prevAgents, newAgent]);
                return { success: true, agent: newAgent };
            });
        } catch (error) {
            console.error('注册代理失败:', error);
            return { success: false, error };
        }
    }, [logout, withLoading]);

    // 升级代理
    const upgradeAgent = useCallback(async (agentId) => {
        try {
            return await withLoading(async () => {
                const response = await fetch(`/api/agents/${agentId}/upgrade`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' }
                });

                if (response.status === 401) {
                    logout();
                    throw new Error('会话已过期，请重新登录');
                }

                if (!response.ok) {
                    const errorData = await response.json();
                    throw new Error(errorData.error || `服务器返回错误: ${response.status}`);
                }

                return await response.json();
            });
        } catch (error) {
            console.error('升级代理失败:', error);
            return { success: false, error };
        }
    }, [logout, withLoading]);

    // 获取单个代理
    const getAgent = useCallback(async (agentId) => {
        try {
            setIsLoading(true);

            const response = await fetch(`/api/agents/${agentId}`);

            if (response.status === 401) {
                logout();
                return { success: false, authError: true };
            }

            if (!response.ok) {
                throw new Error(`服务器返回错误: ${response.status}`);
            }

            const data = await response.json();
            return { success: true, agent: data };
        } catch (error) {
            console.error('获取代理数据失败:', error);
            return { success: false, error };
        } finally {
            setIsLoading(false);
        }
    }, [logout]);

    return {
        agents,
        setAgents,
        isLoading,
        setIsLoading,
        error,
        refreshAgents,
        deleteAgent,
        registerAgent,
        upgradeAgent,
        getAgent
    };
}
