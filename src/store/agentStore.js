// src/store/agentStore.js
import {create} from 'zustand';
import {combineAgentData} from '@/lib/agent-utils';
import useMqttStore from './mqttStore';

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
            return {mqttConnected: connected};
        }
        return {};
    }),

    // 更新MQTT代理状态
    updateMqttAgentState: (agentState) => set({
        mqttAgentState: agentState,
        lastUpdated: new Date()
    }),

    // 获取所有代理
    fetchAgents: async (force = false) => {
        // 如果已经在加载且不是强制刷新，则跳过
        if (get().isLoading && !force) return {success: true, data: get().agents};

        set({isLoading: true, error: null});

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

            return {success: true, data};
        } catch (error) {
            console.error('获取代理数据失败:', error);
            set({
                error: error.message,
                isLoading: false
            });
            return {success: false, error};
        }
    },

    // 删除代理
    deleteAgent: async (agentId) => {
        if (!agentId) return {success: false, error: '无效的代理ID'};

        try {
            // 先查询代理信息，以便获取UUID
            const agentResponse = await fetch(`/api/agents/${agentId}`);
            let agentUuid = null;

            if (agentResponse.ok) {
                const agentData = await agentResponse.json();
                agentUuid = agentData.uuid; // 保存UUID用于后续清理
                console.log(`准备删除代理: ${agentId}, UUID: ${agentUuid}`);
            } else {
                console.error(`获取代理信息失败: ${agentId}`);
                // 尝试从本地状态获取UUID
                const state = get();
                const agent = state.agents.find(a => a._id === agentId);
                if (agent && agent.uuid) {
                    agentUuid = agent.uuid;
                    console.log(`从本地状态获取代理UUID: ${agentUuid}`);
                }
            }

            if (!agentUuid) {
                console.error(`无法获取代理UUID, 仅删除数据库记录: ${agentId}`);
            }

            // 执行删除操作
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

            // 如果有UUID，同时标记为已删除，防止再次自动注册
            if (agentUuid) {
                console.log(`标记代理为已删除: ${agentUuid}`);
                const mqttStore = useMqttStore.getState();

                // 确保MQTT Store已初始化
                if (typeof mqttStore.markAgentDeleted === 'function') {
                    mqttStore.markAgentDeleted(agentUuid);
                } else {
                    console.error('MQTT Store未初始化，无法标记代理为已删除');
                }

                // 双保险：直接移除MQTT状态中的代理数据
                try {
                    const mqttAgentState = {...mqttStore.getAgentState()};
                    if (mqttAgentState[agentUuid]) {
                        console.log(`从MQTT状态中删除代理: ${agentUuid}`);
                        delete mqttAgentState[agentUuid];
                        get().updateMqttAgentState(mqttAgentState);
                    }
                } catch (err) {
                    console.error('清理MQTT状态失败:', err);
                }
            }

            return {success: true};
        } catch (error) {
            console.error('删除代理失败:', error);
            return {success: false, error};
        }
    },

    // 注册新代理
    registerAgent: async (agentData) => {
        if (!agentData || !agentData.uuid) {
            return {success: false, error: 'Invalid agent data'};
        }

        try {
            const response = await fetch('/api/agents', {
                method: 'POST',
                headers: {'Content-Type': 'application/json'},
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

            return {success: true, agent: newAgent};
        } catch (error) {
            console.error('注册代理失败:', error);
            return {success: false, error};
        }
    },

    // 升级代理
    upgradeAgent: async (agentId) => {
        if (!agentId) return {success: false, error: 'Invalid agent ID'};

        try {
            const response = await fetch(`/api/agents/${agentId}/upgrade`, {
                method: 'POST',
                headers: {'Content-Type': 'application/json'}
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || `升级失败: ${response.status}`);
            }

            return await response.json();
        } catch (error) {
            console.error('升级代理失败:', error);
            return {success: false, error};
        }
    },

    // 获取单个代理
    getAgent: async (agentId) => {
        if (!agentId) return {success: false, error: 'Invalid agent ID'};

        try {
            const response = await fetch(`/api/agents/${agentId}`);

            if (!response.ok) {
                throw new Error(`获取失败: ${response.status}`);
            }

            const data = await response.json();
            return {success: true, agent: data};
        } catch (error) {
            console.error('获取代理数据失败:', error);
            return {success: false, error};
        }
    },

    // 将命令发送到代理
    sendCommand: async (agentId, command) => {
        if (!agentId || !command) {
            return {success: false, error: 'Invalid agent ID or command'};
        }

        try {
            const response = await fetch(`/api/agents/${agentId}/command`, {
                method: 'POST',
                headers: {'Content-Type': 'application/json'},
                body: JSON.stringify({command})
            });

            if (!response.ok) {
                throw new Error(`命令执行失败: ${response.status}`);
            }

            return await response.json();
        } catch (error) {
            console.error('发送命令失败:', error);
            return {success: false, error};
        }
    },

    // 获取合并的代理数据 (HTTP + MQTT)
    getCombinedAgents: () => {
        const {agents, mqttAgentState, mqttConnected} = get();
        return combineAgentData(agents, mqttAgentState, mqttConnected);
    },

    // 根据ID获取合并的单个代理数据
    getAgentById: (agentId) => {
        const {agents} = get();
        return agents.find(agent => agent._id === agentId);
    }
}));

export default useAgentStore;
