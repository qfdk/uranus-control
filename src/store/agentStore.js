// src/store/agentStore.js
import { create } from 'zustand';
import { combineAgentData } from '@/lib/agent-utils';

// 创建agent全局状态管理
const useAgentStore = create((set, get) => ({
    // 状态
    agents: [],
    isLoading: false,
    error: null,
    lastUpdated: null,
    mqttAgentState: {},
    mqttConnected: false,

    // 设置MQTT状态
    setMqttConnected: (connected) => set((state) => {
        // 只有当状态实际变化时才更新
        if (state.mqttConnected !== connected) {
            return { mqttConnected: connected };
        }
        return {};
    }),

    // 更新MQTT代理状态
    updateMqttAgentState: (agentState) => set({
        mqttAgentState: agentState,
        lastUpdated: new Date()
    }),

    // 获取所有代理
    fetchAgents: async () => {
        set({ isLoading: true, error: null });

        try {
            const response = await fetch('/api/agents');

            if (response.status === 401) {
                throw new Error('认证失败');
            }

            if (!response.ok) {
                throw new Error(`服务器返回错误: ${response.status}`);
            }

            const data = await response.json();
            set({
                agents: data,
                isLoading: false,
                lastUpdated: new Date()
            });

            return { success: true, data };
        } catch (error) {
            console.error('获取代理数据失败:', error);
            set({
                error: error.message,
                isLoading: false
            });
            return { success: false, error };
        }
    },

    // 删除代理
    deleteAgent: async (agentId) => {
        if (!agentId) return { success: false, error: 'Invalid agent ID' };

        try {
            const response = await fetch(`/api/agents/${agentId}`, {
                method: 'DELETE'
            });

            if (!response.ok) {
                throw new Error(`删除失败: ${response.status}`);
            }

            // 更新本地状态
            set(state => ({
                agents: state.agents.filter(agent => agent._id !== agentId)
            }));

            return { success: true };
        } catch (error) {
            console.error('删除代理失败:', error);
            return { success: false, error };
        }
    },

    // 注册新代理
    registerAgent: async (agentData) => {
        if (!agentData || !agentData.uuid) {
            return { success: false, error: 'Invalid agent data' };
        }

        try {
            const response = await fetch('/api/agents', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(agentData)
            });

            if (!response.ok) {
                throw new Error(`注册失败: ${response.status}`);
            }

            const newAgent = await response.json();

            // 更新本地状态
            set(state => ({
                agents: [...state.agents, newAgent]
            }));

            return { success: true, agent: newAgent };
        } catch (error) {
            console.error('注册代理失败:', error);
            return { success: false, error };
        }
    },

    // 升级代理
    upgradeAgent: async (agentId) => {
        if (!agentId) return { success: false, error: 'Invalid agent ID' };

        try {
            const response = await fetch(`/api/agents/${agentId}/upgrade`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' }
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || `升级失败: ${response.status}`);
            }

            return await response.json();
        } catch (error) {
            console.error('升级代理失败:', error);
            return { success: false, error };
        }
    },

    // 获取单个代理
    getAgent: async (agentId) => {
        if (!agentId) return { success: false, error: 'Invalid agent ID' };

        try {
            const response = await fetch(`/api/agents/${agentId}`);

            if (!response.ok) {
                throw new Error(`获取失败: ${response.status}`);
            }

            const data = await response.json();
            return { success: true, agent: data };
        } catch (error) {
            console.error('获取代理数据失败:', error);
            return { success: false, error };
        }
    },

    // 将命令发送到代理
    sendCommand: async (agentId, command) => {
        if (!agentId || !command) {
            return { success: false, error: 'Invalid agent ID or command' };
        }

        try {
            const response = await fetch(`/api/agents/${agentId}/command`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ command })
            });

            if (!response.ok) {
                throw new Error(`命令执行失败: ${response.status}`);
            }

            return await response.json();
        } catch (error) {
            console.error('发送命令失败:', error);
            return { success: false, error };
        }
    },

    // 获取合并的代理数据 (HTTP + MQTT)
    getCombinedAgents: () => {
        const { agents, mqttAgentState, mqttConnected } = get();
        return combineAgentData(agents, mqttAgentState, mqttConnected);
    },

    // 根据ID获取合并的单个代理数据
    getAgentById: (agentId) => {
        const { agents } = get();
        return agents.find(agent => agent._id === agentId);
    }
}));

export default useAgentStore;
