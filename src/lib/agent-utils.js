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
    // 如果没有HTTP代理数据，返回空数组
    if (!httpAgents || httpAgents.length === 0) {
        return [];
    }

    // 处理结果数组
    const resultAgents = httpAgents.map(agent => {
        // 基础是MongoDB的代理数据
        const resultAgent = { ...agent };

        // 如果MQTT已连接且该代理在MQTT状态中存在
        if (mqttConnected && agent.uuid && mqttAgentState && mqttAgentState[agent.uuid]) {
            // 从MQTT获取最新的在线状态
            resultAgent.online = mqttAgentState[agent.uuid].online;
            resultAgent.lastHeartbeat = mqttAgentState[agent.uuid].lastHeartbeat || agent.lastHeartbeat;
            resultAgent._fromMqtt = true; // 标记数据来源包含MQTT
        } else {
            // 如果MQTT状态中没有此代理，则认为代理离线
            // 保留MongoDB中的online状态
            resultAgent._fromMqtt = false;
        }

        return resultAgent;
    });

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
