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
                agent.online = mqttAgentState[agent.uuid].online;
                agent.lastHeartbeat = mqttAgentState[agent.uuid].lastHeartbeat || agent.lastHeartbeat;
                agent.ip = agent.ip || mqttAgentState[agent.uuid].ip;
                agent.hostname = agent.hostname || mqttAgentState[agent.uuid].hostname;
                agent.buildVersion = agent.buildVersion || mqttAgentState[agent.uuid].buildVersion;
                agent.buildTime = agent.buildTime || mqttAgentState[agent.uuid].buildTime;
                agent.commitId = agent.commitId || mqttAgentState[agent.uuid].commitId;
                agent.os = agent.os || mqttAgentState[agent.uuid].os;
                agent.memory = agent.memory || mqttAgentState[agent.uuid].memory;
                agent._fromMqtt = true;
            } else {
                agent._fromMqtt = false;
            }
        });

        // 添加只存在于MQTT中的新代理
        const httpAgentUuids = new Set(resultAgents.map(a => a.uuid));

        Object.entries(mqttAgentState).forEach(([uuid, mqttAgent]) => {
            if (!httpAgentUuids.has(uuid)) {
                resultAgents.push({
                    uuid,
                    hostname: mqttAgent.hostname || uuid.substring(0, 8),
                    ip: mqttAgent.ip || '',
                    online: mqttAgent.online || false,
                    lastHeartbeat: mqttAgent.lastHeartbeat,
                    buildVersion: mqttAgent.buildVersion,
                    buildTime: mqttAgent.buildTime,
                    commitId: mqttAgent.commitId,
                    os: mqttAgent.os,
                    memory: mqttAgent.memory,
                    _mqttOnly: true,  // 标记为仅MQTT发现的代理
                    _fromMqtt: true
                    // 移除 _needsRegistration 标记，因为服务器端会自动注册
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
        // 然后按主机名排序
        return (a.hostname || '').localeCompare(b.hostname || '');
    });
}

/**
 * 合并单个代理的HTTP/MongoDB数据与MQTT实时数据
 * @param {Object} agent - 从MongoDB获取的单个代理数据
 * @param {Object} mqttAgentState - MQTT代理状态数据
 * @param {boolean} mqttConnected - MQTT连接状态
 * @returns {Object} 合并后的代理数据
 */
export function combineSingleAgentData(agent, mqttAgentState, mqttConnected) {
    if (!agent || !agent.uuid) return agent;

    const resultAgent = {...agent};

    if (mqttConnected && mqttAgentState && mqttAgentState[agent.uuid]) {
        const mqttData = mqttAgentState[agent.uuid];

        resultAgent.online = mqttData.online !== undefined ? mqttData.online : agent.online;
        resultAgent.lastHeartbeat = mqttData.lastHeartbeat || agent.lastHeartbeat;
        resultAgent.hostname = agent.hostname || mqttData.hostname;
        resultAgent.ip = agent.ip || mqttData.ip;
        resultAgent.buildVersion = mqttData.buildVersion || agent.buildVersion;
        resultAgent.buildTime = mqttData.buildTime || agent.buildTime;
        resultAgent.commitId = mqttData.commitId || agent.commitId;
        resultAgent.os = mqttData.os || agent.os;
        resultAgent.memory = mqttData.memory || agent.memory;
        resultAgent._fromMqtt = true;
    }

    return resultAgent;
}
