// src/store/agentStore.js
import {create} from 'zustand';
import {combineAgentData, combineSingleAgent} from '@/lib/agent-utils';
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
    pendingRequests: {}, // 用于追踪请求状态
    initialLoaded: false, // 新增标志，标记是否已完成初始加载

    // 设置MQTT状态
    setMqttConnected: (connected) => {
        // 只有状态变化时才更新，避免重复设置
        set((state) => {
            if (state.mqttConnected !== connected) {
                return {mqttConnected: connected};
            }
            return state;
        });

        // 如果MQTT连接已建立，但agentStore中还没有同步状态
        if (connected) {
            try {
                // 获取MQTT代理状态并同步
                const mqttStore = useMqttStore.getState();
                if (mqttStore) {
                    const mqttAgentState = mqttStore.getAgentState();
                    if (mqttAgentState && Object.keys(mqttAgentState).length > 0) {
                        set({mqttAgentState: {...mqttAgentState}});
                    }
                }
            } catch (error) {
                console.error('同步MQTT状态失败:', error);
            }
        }
    },
    // 更新MQTT代理状态
    updateMqttAgentState: (agentState) => set({
        mqttAgentState: agentState,
        lastUpdated: new Date()
    }),

    // 获取所有代理
    fetchAgents: async (force = false) => {
        // 检查是否已经完成初始加载且不是强制刷新
        if (get().initialLoaded && !force) {
            return {success: true, data: get().agents};
        }

        // 如果已经在加载且不是强制刷新，则跳过
        if (get().isLoading && !force) {
            return {success: true, data: get().agents};
        }

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
                lastUpdated: new Date(),
                initialLoaded: true // 标记已完成初始加载
            });

            return {success: true, data};
        } catch (error) {
            set({
                error: error.message,
                isLoading: false
            });
            return {success: false, error};
        }
    },

    // 删除代理
    deleteAgent: async (agentId) => {
        if (!agentId) return {success: false, error: {message: '无效的代理ID'}};

        try {
            // 先查询代理信息，以便获取UUID
            const agentResponse = await fetch(`/api/agents/${agentId}`);
            let agentUuid = null;

            if (agentResponse.ok) {
                const agentData = await agentResponse.json();
                agentUuid = agentData.uuid; // 保存UUID用于后续清理
            } else {
                // 尝试从本地状态获取UUID
                const state = get();
                const agent = state.agents.find(a => a._id === agentId);
                if (agent && agent.uuid) {
                    agentUuid = agent.uuid;
                }
            }

            if (!agentUuid) {
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
                const mqttStore = useMqttStore.getState();

                // 确保MQTT Store已初始化
                if (typeof mqttStore.markAgentDeleted === 'function') {
                    mqttStore.markAgentDeleted(agentUuid);
                } else {
                }

                // 双保险：直接移除MQTT状态中的代理数据
                try {
                    const mqttAgentState = {...mqttStore.getAgentState()};
                    if (mqttAgentState[agentUuid]) {
                        delete mqttAgentState[agentUuid];
                        get().updateMqttAgentState(mqttAgentState);
                    }
                } catch (err) {
                }
            }

            return {success: true};
        } catch (error) {
            return {success: false, error};
        }
    },

    // 注册新代理
    registerAgent: async (agentData) => {
        if (!agentData || !agentData.uuid) {
            return {success: false, error: {message: 'Invalid agent data'}};
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
        if (!agentId) return {success: false, error: {message: '无效的代理ID'}};

        // 防止重复请求的简单缓存
        if (get().pendingRequests && get().pendingRequests[agentId]) {
            return get().pendingRequests[agentId];
        }

        // 创建请求Promise
        const requestPromise = (async () => {
            try {

                const response = await fetch(`/api/agents/${agentId}/upgrade`, {
                    method: 'POST',
                    headers: {'Content-Type': 'application/json'}
                });

                // 检查HTTP状态码
                if (!response.ok) {
                    let errorMessage = `HTTP错误: ${response.status}`;
                    try {
                        const errorData = await response.json();
                        errorMessage = errorData.error || errorMessage;
                    } catch (e) {
                        // 忽略JSON解析错误
                    }
                    throw new Error(errorMessage);
                }

                // 解析响应数据
                const responseData = await response.json();

                // 格式化响应数据，确保结构一致
                const result = {
                    ...responseData,
                    success: true, // 添加成功标志
                    message: responseData.message || (responseData.result?.message) || '升级请求已成功发送'
                };

                // 在后台安排一个延迟任务来刷新代理信息
                setTimeout(async () => {
                    try {
                        await get().fetchAgents(true);
                    } catch (err) {
                        console.error('升级后刷新代理数据失败:', err);
                    }
                }, 25000); // 给代理足够的升级时间

                return result;
            } catch (error) {
                console.error('升级代理失败:', error);
                return {success: false, error: {message: error.message}};
            } finally {
                // 清除请求缓存
                setTimeout(() => {
                    set(state => {
                        const newPendingRequests = {...state.pendingRequests};
                        delete newPendingRequests[agentId];
                        return {pendingRequests: newPendingRequests};
                    });
                }, 1000);
            }
        })();

        // 保存请求Promise到状态
        set(state => ({
            pendingRequests: {
                ...state.pendingRequests,
                [agentId]: requestPromise
            }
        }));

        return requestPromise;
    },

    // 获取单个代理
    getAgent: async (agentId) => {
        if (!agentId) return {success: false, error: {message: 'Invalid agent ID'}};

        try {
            const response = await fetch(`/api/agents/${agentId}`);

            if (!response.ok) {
                throw new Error(`获取失败: ${response.status}`);
            }

            const data = await response.json();
            
            // 更新本地状态中对应的代理数据
            set(state => {
                // 查找代理在数组中的索引
                const agentIndex = state.agents.findIndex(a => a._id === agentId);
                
                if (agentIndex !== -1) {
                    // 更新已存在的代理
                    const updatedAgents = [...state.agents];
                    updatedAgents[agentIndex] = data;
                    return { agents: updatedAgents };
                }
                
                // 如果找不到，追加到数组
                return { agents: [...state.agents, data] };
            });
            
            // 返回合并后的数据，而不仅仅是HTTP数据
            const combinedAgent = get().getCombinedAgent(agentId);
            return {success: true, agent: combinedAgent || data};
        } catch (error) {
            console.error('获取代理数据失败:', error);
            return {success: false, error};
        }
    },

    // 将命令发送到代理
    sendCommand: async (agentId, command) => {
        if (!agentId || !command) {
            return {success: false, error: {message: 'Invalid agent ID or command'}};
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
    },
    
    // 获取单个代理的合并数据 (HTTP + MQTT)
    getCombinedAgent: (agentId) => {
        const {agents, mqttAgentState, mqttConnected} = get();
        const httpAgent = agents.find(agent => agent._id === agentId);
        if (!httpAgent) return null;
        
        return combineSingleAgent(httpAgent, mqttAgentState, mqttConnected);
    },

    // 重置加载状态（用于初始化以及测试）
    resetLoadingState: () => set({
        initialLoaded: false,
        isLoading: false
    }),

    // 强制刷新单个代理数据
    refreshAgent: async (agentId) => {
        if (!agentId) return {success: false, error: {message: 'Invalid agent ID'}};

        try {
            // 先获取最新数据
            const result = await get().getAgent(agentId);
            if (!result.success) {
                throw new Error('获取代理数据失败');
            }

            // 如果MQTT已连接，强制同步MQTT状态
            if (useMqttStore.getState().connected) {
                const agent = get().getAgentById(agentId);
                if (agent?.uuid) {
                    // 获取最新的MQTT状态
                    const mqttAgentState = useMqttStore.getState().getAgentState();
                    if (mqttAgentState && Object.keys(mqttAgentState).length > 0) {
                        // 更新MQTT状态
                        get().updateMqttAgentState({...mqttAgentState});
                    }
                }
            }

            return result;
        } catch (error) {
            return {success: false, error};
        }
    }
}));

export default useAgentStore;
