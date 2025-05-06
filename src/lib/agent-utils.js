// src/lib/agent-utils.js
// 代理数据处理工具函数

/**
 * 合并HTTP/MongoDB代理数据与MQTT实时数据
 * MongoDB提供基础代理列表，MQTT提供实时状态
 * @param {Array} httpAgents - 从MongoDB获取的代理数据
 * @param {Object} mqttAgentState - MQTT代理状态数据
 * @param {boolean} mqttConnected - MQTT连接状态
 * @returns {Array} 合并后的代理数据列表
 */
export function combineAgentData(httpAgents, mqttAgentState, mqttConnected) {
    // 克隆HTTP代理列表作为基础结果
    const resultAgents = httpAgents ? [...httpAgents].map(agent => ({...agent})) : [];

    // 只有当MQTT已连接时才处理MQTT状态
    if (mqttConnected && mqttAgentState) {
        // 更新现有代理的MQTT状态
        resultAgents.forEach(agent => {
            if (agent.uuid && mqttAgentState[agent.uuid]) {
                const mqttData = mqttAgentState[agent.uuid];

                // 明确设置在线状态，优先使用MQTT状态
                agent.online = mqttData.online !== undefined ? mqttData.online : agent.online;

                // 最后心跳时间，优先使用最新的
                if (mqttData.lastHeartbeat) {
                    const mqttDate = new Date(mqttData.lastHeartbeat);
                    const agentDate = agent.lastHeartbeat ? new Date(agent.lastHeartbeat) : null;

                    if (!agentDate || mqttDate > agentDate) {
                        agent.lastHeartbeat = mqttData.lastHeartbeat;
                    }
                }

                // 其他字段的更新策略
                agent.ip = agent.ip || mqttData.ip;
                agent.hostname = agent.hostname || mqttData.hostname;
                agent.buildVersion = agent.buildVersion || mqttData.buildVersion;
                agent.buildTime = agent.buildTime || mqttData.buildTime;
                agent.commitId = agent.commitId || mqttData.commitId;
                agent.os = agent.os || mqttData.os;
                agent.memory = agent.memory || mqttData.memory;
                agent._fromMqtt = true;

                // 复制MQTT代理的注册状态
                if (mqttData._registering) {
                    agent._registering = true;
                }
            } else {
                agent._fromMqtt = false;
            }
        });

        // 添加只存在于MQTT中的新代理
        const httpAgentUuids = new Set(resultAgents.map(a => a.uuid));

        Object.entries(mqttAgentState).forEach(([uuid, mqttAgent]) => {
            if (!httpAgentUuids.has(uuid)) {
                // 确保有基本的默认值
                resultAgents.push({
                    uuid,
                    hostname: mqttAgent.hostname || uuid.substring(0, 8),
                    ip: mqttAgent.ip || 'Unknown',
                    online: mqttAgent.online !== undefined ? mqttAgent.online : true,
                    lastHeartbeat: mqttAgent.lastHeartbeat || new Date(),
                    buildVersion: mqttAgent.buildVersion || 'Unknown',
                    buildTime: mqttAgent.buildTime || 'Unknown',
                    commitId: mqttAgent.commitId || 'Unknown',
                    os: mqttAgent.os || 'Unknown',
                    memory: mqttAgent.memory || 'Unknown',
                    _mqttOnly: true,  // 标记为仅MQTT发现的代理
                    _fromMqtt: true,
                    _registering: mqttAgent._registering || false // 复制注册状态
                });
            }
        });
    }

    // 排序结果 - 在线代理优先，然后按主机名
    return resultAgents.sort((a, b) => {
        // 先按在线状态排序
        if (a.online !== b.online) {
            return a.online ? -1 : 1;
        }

        // MQTT标记的代理排在前面（表示更新的数据）
        if (a._fromMqtt !== b._fromMqtt) {
            return a._fromMqtt ? -1 : 1;
        }

        // 新发现的代理排在前面
        if (a._mqttOnly !== b._mqttOnly) {
            return a._mqttOnly ? -1 : 1;
        }

        // 最后按主机名排序
        return (a.hostname || '').localeCompare(b.hostname || '');
    });
}

/**
 * 合并单个代理的HTTP数据与MQTT实时数据
 * @param {Object} httpAgent - 从MongoDB获取的单个代理数据
 * @param {Object} mqttAgentState - MQTT代理状态数据（所有代理）
 * @param {boolean} mqttConnected - MQTT连接状态
 * @returns {Object} 合并后的代理数据
 */
export function combineSingleAgent(httpAgent, mqttAgentState, mqttConnected) {
    // 如果没有代理数据或UUID，直接返回原始数据
    if (!httpAgent || !httpAgent.uuid) {
        return httpAgent;
    }

    // 克隆代理数据
    const resultAgent = { ...httpAgent };

    // 只有当MQTT已连接并且存在代理MQTT状态时才进行合并
    if (mqttConnected && mqttAgentState && mqttAgentState[httpAgent.uuid]) {
        const mqttData = mqttAgentState[httpAgent.uuid];

        // 明确设置在线状态，优先使用MQTT状态
        resultAgent.online = mqttData.online !== undefined ? mqttData.online : resultAgent.online;

        // 最后心跳时间，优先使用最新的
        if (mqttData.lastHeartbeat) {
            const mqttDate = new Date(mqttData.lastHeartbeat);
            const agentDate = resultAgent.lastHeartbeat ? new Date(resultAgent.lastHeartbeat) : null;

            if (!agentDate || mqttDate > agentDate) {
                resultAgent.lastHeartbeat = mqttData.lastHeartbeat;
            }
        }

        // 其他字段的更新策略
        resultAgent.ip = resultAgent.ip || mqttData.ip;
        resultAgent.hostname = resultAgent.hostname || mqttData.hostname;
        resultAgent.buildVersion = resultAgent.buildVersion || mqttData.buildVersion;
        resultAgent.buildTime = resultAgent.buildTime || mqttData.buildTime;
        resultAgent.commitId = resultAgent.commitId || mqttData.commitId;
        resultAgent.os = resultAgent.os || mqttData.os;
        resultAgent.memory = resultAgent.memory || mqttData.memory;
        resultAgent._fromMqtt = true;

        // 复制MQTT代理的注册状态
        if (mqttData._registering) {
            resultAgent._registering = true;
        }
    } else {
        resultAgent._fromMqtt = false;
    }

    return resultAgent;
}
