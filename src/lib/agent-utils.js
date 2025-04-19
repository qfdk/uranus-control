// src/lib/agent-utils.js
// 代理数据处理工具函数

/**
 * 合并HTTP/MongoDB代理数据与MQTT实时数据
 * @param {Array} httpAgents - 从MongoDB获取的代理数据
 * @param {Object} mqttAgentState - MQTT代理状态数据
 * @param {boolean} mqttConnected - MQTT连接状态
 * @returns {Array} 合并后的代理数据列表
 */
export function combineAgentData(httpAgents, mqttAgentState, mqttConnected) {
    // 如果MQTT未连接或无代理状态，返回HTTP数据
    if (!mqttConnected || Object.keys(mqttAgentState).length === 0) {
        return httpAgents;
    }

    // 创建基于UUID的代理查找映射
    const agentsByUuid = new Map();
    httpAgents.forEach(agent => {
        if (agent.uuid) {
            agentsByUuid.set(agent.uuid, agent);
        }
    });

    // 合并结果数组
    const mergedResults = [];

    // 先添加所有MongoDB代理，如果有MQTT数据则增强
    httpAgents.forEach(agent => {
        if (agent.uuid && mqttAgentState[agent.uuid]) {
            // 代理同时存在于MongoDB和MQTT中 - 合并数据
            const mqttData = mqttAgentState[agent.uuid];
            mergedResults.push({
                ...agent, // 保留MongoDB数据作为基础 (包括 _id)
                // 选择性应用MQTT更新
                online: mqttData.online !== undefined ? mqttData.online : agent.online,
                lastHeartbeat: mqttData.lastHeartbeat || agent.lastHeartbeat,
                // 如果MQTT有更新/更好的数据，则使用MQTT数据
                hostname: agent.hostname || mqttData.hostname,
                ip: agent.ip || mqttData.ip,
                buildVersion: mqttData.buildVersion || agent.buildVersion,
                buildTime: mqttData.buildTime || agent.buildTime,
                commitId: mqttData.commitId || agent.commitId,
                os: mqttData.os || agent.os,
                memory: mqttData.memory || agent.memory,
                // 使用MongoDB中的统计数据（对于持久数据更可靠）
                stats: agent.stats || {websites: 0, certificates: 0},
                _fromMqtt: true // 标记为有MQTT数据
            });
        }
    });

    // 排序结果 - 在线代理优先，然后按主机名
    return mergedResults.sort((a, b) => {
        // 先按在线状态排序
        if (a.online !== b.online) {
            return a.online ? -1 : 1;
        }
        // 然后按主机名排序
        return (a.hostname || '').localeCompare(b.hostname || '');
    });
}
