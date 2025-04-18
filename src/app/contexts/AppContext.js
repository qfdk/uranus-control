'use client';

import {createContext, useCallback, useContext, useEffect, useState} from 'react';
import {useAuth} from './AuthContext';
import {useLoading} from './LoadingContext';
import {usePathname} from 'next/navigation';

// Create context
const AppContext = createContext();

// Context provider component
export function AppProvider({children}) {
    const [agents, setAgents] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const {logout} = useAuth();
    const {startLoading} = useLoading();
    const pathname = usePathname();

    useEffect(() => {
        if (pathname && pathname.startsWith('/agents/')) {
            // 当进入代理详情页面时启动加载状态
            console.log('路径变化到代理详情页:', pathname);
            startLoading();
        }
    }, [pathname, startLoading]);

    const fetchAgents = useCallback(async () => {
        try {
            setLoading(true);
            console.log('AppContext: 开始获取代理数据');
            const response = await fetch('/api/agents');

            // 处理认证错误
            if (response.status === 401) {
                // 静默失败，不显示错误消息，只在控制台记录
                console.log('认证过期，需要重新登录');
                logout();
                return;
            }

            if (!response.ok) {
                throw new Error(`服务器返回错误: ${response.status}`);
            }

            const data = await response.json();
            console.log('AppContext: 获取到代理数据', data.length);
            setAgents(data);
            setError(null);
        } catch (err) {
            console.error('Error fetching agents:', err);
            setError(err.message);
        } finally {
            setLoading(false);
        }
    }, [logout]);


    // Fetch agents on mount
    useEffect(() => {
        console.log('AppContext: 组件挂载，首次获取数据');
        fetchAgents();

    }, [fetchAgents]); // 添加fetchAgents作为依赖

    // Update an agent
    const updateAgent = async (agentId, updateData) => {
        try {
            const response = await fetch(`/api/agents/${agentId}`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(updateData)
            });

            // 处理认证错误
            if (response.status === 401) {
                logout();
                throw new Error('会话已过期，请重新登录');
            }

            if (!response.ok) {
                throw new Error(`服务器返回错误: ${response.status}`);
            }

            const updatedAgent = await response.json();

            setAgents(prev =>
                prev.map(agent =>
                    agent._id === agentId ? updatedAgent : agent
                )
            );

            return updatedAgent;
        } catch (err) {
            console.error('Error updating agent:', err);
            throw err;
        }
    };

    // Delete an agent
    const deleteAgent = async (agentId) => {
        try {
            const response = await fetch(`/api/agents/${agentId}`, {
                method: 'DELETE'
            });

            // 处理认证错误
            if (response.status === 401) {
                logout();
                throw new Error('会话已过期，请重新登录');
            }

            if (!response.ok) {
                throw new Error(`服务器返回错误: ${response.status}`);
            }

            setAgents(prev => prev.filter(agent => agent._id !== agentId));
            return true;
        } catch (err) {
            console.error('Error deleting agent:', err);
            throw err;
        }
    };

    // Add a new agent
    const addAgent = async (agentData) => {
        try {
            const response = await fetch('/api/agents', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(agentData)
            });

            // 处理认证错误
            if (response.status === 401) {
                logout();
                throw new Error('会话已过期，请重新登录');
            }

            if (!response.ok) {
                throw new Error(`服务器返回错误: ${response.status}`);
            }

            const newAgent = await response.json();
            setAgents(prev => [...prev, newAgent]);
            return newAgent;
        } catch (err) {
            console.error('Error adding agent:', err);
            throw err;
        }
    };

    // Send command to an agent
    const sendCommand = async (agentId, command) => {
        try {
            const response = await fetch(`/api/agents/${agentId}/command`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({command})
            });

            // 处理认证错误
            if (response.status === 401) {
                logout();
                throw new Error('会话已过期，请重新登录');
            }

            if (!response.ok) {
                throw new Error(`服务器返回错误: ${response.status}`);
            }

            return await response.json();
        } catch (err) {
            console.error('Error sending command to agent:', err);
            throw err;
        }
    };

    // Upgrade an agent
    const upgradeAgent = async (agentId) => {
        try {
            const response = await fetch(`/api/agents/${agentId}/upgrade`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                }
            });

            // 处理认证错误
            if (response.status === 401) {
                logout();
                throw new Error('会话已过期，请重新登录');
            }

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || `服务器返回错误: ${response.status}`);
            }

            return await response.json();
        } catch (err) {
            console.error('Error upgrading agent:', err);
            throw err;
        }
    };

    // 手动触发刷新 - 方便在任何组件中调用
    const triggerRefresh = () => {
        console.log('手动触发全局刷新');
        fetchAgents();
    };

    return (
        <AppContext.Provider
            value={{
                agents,
                loading,
                error,
                fetchAgents,
                updateAgent,
                deleteAgent,
                addAgent,
                sendCommand,
                upgradeAgent,
                triggerRefresh
            }}
        >
            {children}
        </AppContext.Provider>
    );
}

// Custom hook to use the AppContext
export function useApp() {
    const context = useContext(AppContext);
    if (context === undefined) {
        throw new Error('useApp must be used within an AppProvider');
    }
    return context;
}
