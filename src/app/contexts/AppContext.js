'use client';

import {createContext, useCallback, useContext, useEffect, useState} from 'react';
import {useAuth} from './AuthContext';

const REFRESH_INTERVAL = 10000; // 10秒

// Create context
const AppContext = createContext();

// Context provider component
export function AppProvider({children}) {
    const [agents, setAgents] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [autoRefresh, setAutoRefresh] = useState(true);
    const {logout} = useAuth();

    // Function to fetch agents
    const fetchAgents = useCallback(async () => {
        try {
            setLoading(true);
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
        fetchAgents();

        // 设置自动刷新
        let intervalId;
        if (autoRefresh) {
            intervalId = setInterval(fetchAgents, REFRESH_INTERVAL);
        }

        // 清除定时器
        return () => {
            if (intervalId) clearInterval(intervalId);
        };
    }, [autoRefresh, fetchAgents]);

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
    // 切换自动刷新功能
    const toggleAutoRefresh = () => {
        setAutoRefresh(prev => !prev);
    };

    return (
        <AppContext.Provider
            value={{
                agents,
                loading,
                error,
                autoRefresh,
                toggleAutoRefresh,
                fetchAgents,
                updateAgent,
                deleteAgent,
                addAgent,
                sendCommand
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
