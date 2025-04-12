'use client';

import { createContext, useContext, useState, useEffect } from 'react';

const REFRESH_INTERVAL = 15000; // 15秒

// Create context
const AppContext = createContext();

// Context provider component
export function AppProvider({ children }) {
    const [agents, setAgents] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [autoRefresh, setAutoRefresh] = useState(true);

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
    }, [autoRefresh]);

    // Function to fetch agents
    const fetchAgents = async () => {
        try {
            setLoading(true);
            const response = await fetch('/api/agents');
            if (!response.ok) {
                throw new Error('Failed to fetch agents');
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
    };

    // Update an agent
    const updateAgent = async (agentId, updateData) => {
        try {
            const response = await fetch(`/api/agents/${agentId}`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(updateData),
            });

            if (!response.ok) {
                throw new Error('Failed to update agent');
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
                method: 'DELETE',
            });

            if (!response.ok) {
                throw new Error('Failed to delete agent');
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
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(agentData),
            });

            if (!response.ok) {
                throw new Error('Failed to add agent');
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
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ command }),
            });

            if (!response.ok) {
                throw new Error('Failed to send command to agent');
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
                sendCommand,
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
