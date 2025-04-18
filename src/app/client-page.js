'use client';

import {useCallback, useEffect, useMemo, useState} from 'react';
import {formatDistanceToNow} from 'date-fns';
import {Eye, FileCheck, Globe, RefreshCw, Server, Zap} from 'lucide-react';
import NavLink from '@/components/ui/NavLink';
import StatusCard from '@/components/ui/StatusCard';
import QuickActionButton from '@/components/ui/QuickActionButton';
import {useApp} from './contexts/AppContext';
import {useMqttClient} from '../lib/Mqtt';
import {useLoading} from './contexts/LoadingContext';
import TableSpinner from '@/components/ui/TableSpinner';
import Button from '@/components/ui/Button';

export default function DashboardClientPage({initialAgents}) {
    const [httpAgents, setHttpAgents] = useState(initialAgents || []);
    const [isLoading, setIsLoading] = useState(false);
    const [isRefreshing, setIsRefreshing] = useState(false);
    const {agents: contextAgents, triggerRefresh} = useApp();
    const {connected: mqttConnected, agentState, reconnect} = useMqttClient(); // Get MQTT status and agent data
    const {stopLoading} = useLoading();
    const [isMounted, setIsMounted] = useState(false);
    const [lastMqttUpdate, setLastMqttUpdate] = useState(null);

    // Set client rendering complete flag on mount
    useEffect(() => {
        setIsMounted(true);
        // Ensure component is fully mounted before stopping loading state
        const timer = setTimeout(() => {
            stopLoading();
        }, 300);

        return () => clearTimeout(timer);
    }, [stopLoading]);

    // Refresh agent data (HTTP)
    const refreshDashboardData = useCallback(async () => {
        try {
            setIsLoading(true);
            console.log('Dashboard: Refreshing dashboard data');
            const response = await fetch('/api/agents');

            if (!response.ok) {
                throw new Error(`Server returned error: ${response.status}`);
            }

            const data = await response.json();
            console.log('Dashboard: Got new HTTP data:', data.length);
            setHttpAgents(data);
        } catch (error) {
            console.error('Dashboard: Data refresh failed:', error);
        } finally {
            setIsLoading(false);
        }
    }, []);

    // Refresh on mount
    useEffect(() => {
        if (isMounted) {
            console.log('Dashboard: Component mounted, fetching latest data');
            refreshDashboardData();
        }
    }, [refreshDashboardData, isMounted]);

    // Update when context agents change
    useEffect(() => {
        if (isMounted && contextAgents && contextAgents.length > 0) {
            console.log('Dashboard: Context agents changed, updating local state', contextAgents?.length);
            setHttpAgents(contextAgents);
        }
    }, [contextAgents, isMounted]);

    // Monitor MQTT agent state changes
    useEffect(() => {
        if (mqttConnected && Object.keys(agentState).length > 0) {
            setLastMqttUpdate(new Date());
            console.log('Dashboard: MQTT agent state updated:', Object.keys(agentState).length, 'agents');
        }
    }, [mqttConnected, agentState]);

    // Handle manual refresh button click
    const handleManualRefresh = useCallback(async () => {
        setIsRefreshing(true);
        try {
            await triggerRefresh();
            // If MQTT is connected, try to reconnect
            if (mqttConnected) {
                reconnect();
            }
        } finally {
            // Short delay before turning off refresh indicator
            setTimeout(() => {
                setIsRefreshing(false);
            }, 500);
        }
    }, [triggerRefresh, mqttConnected, reconnect]);

    // Merge HTTP agent data and MQTT agent state
    const agents = useMemo(() => {
        if (!isMounted) return [];

        // If MQTT not connected or agent state is empty, use HTTP data
        if (!mqttConnected || Object.keys(agentState).length === 0) {
            return httpAgents;
        }

        console.log('Dashboard: Merging MQTT and HTTP agent data');
        console.log('- HTTP agents:', httpAgents.length);
        console.log('- MQTT agents:', Object.keys(agentState).length);

        // Create agent map (UUID -> agent)
        const agentMap = new Map();

        // First add HTTP agent data
        httpAgents.forEach(agent => {
            if (agent.uuid) {
                agentMap.set(agent.uuid, {...agent});
            } else if (agent._id) {
                // If no UUID but has _id, try using _id as key
                agentMap.set(agent._id, {...agent});
            }
        });

        // Then update or add agents with MQTT data
        Object.entries(agentState).forEach(([uuid, mqttAgent]) => {
            if (agentMap.has(uuid)) {
                // Update existing agent with MQTT properties
                const agent = agentMap.get(uuid);
                agentMap.set(uuid, {
                    ...agent,
                    online: mqttAgent.online,
                    lastHeartbeat: mqttAgent.lastHeartbeat || agent.lastHeartbeat,
                    hostname: agent.hostname || mqttAgent.hostname,
                    ip: agent.ip || mqttAgent.ip,
                    _fromMqtt: true, // Mark as updated by MQTT
                    _mqttTimestamp: mqttAgent.lastUpdate || new Date()
                });
            } else {
                // Add new MQTT agent
                agentMap.set(uuid, {
                    _id: uuid,
                    uuid: uuid,
                    hostname: mqttAgent.hostname || 'Unknown Host',
                    ip: mqttAgent.ip || '',
                    online: mqttAgent.online || false,
                    buildVersion: mqttAgent.buildVersion || '',
                    buildTime: mqttAgent.buildTime || '',
                    commitId: mqttAgent.commitId || '',
                    lastHeartbeat: mqttAgent.lastHeartbeat || new Date(),
                    stats: {websites: 0, certificates: 0},
                    _fromMqtt: true, // Mark as MQTT-only agent
                    _mqttTimestamp: mqttAgent.lastUpdate || new Date()
                });
            }
        });

        // Convert back to array and sort (prioritize online agents, then by heartbeat time)
        return Array.from(agentMap.values())
            .sort((a, b) => {
                // First sort by online status
                if (a.online !== b.online) {
                    return a.online ? -1 : 1;
                }
                // Then sort by last heartbeat time
                if (a.lastHeartbeat && b.lastHeartbeat) {
                    return new Date(b.lastHeartbeat) - new Date(a.lastHeartbeat);
                }
                return 0;
            });
    }, [httpAgents, mqttConnected, agentState, isMounted]);

    // If component not mounted, return null and rely on global loading state
    if (!isMounted) {
        return null;
    }

    // Calculate statistics
    const onlineAgents = agents.filter(agent => agent.online);
    const totalWebsites = agents.reduce((sum, agent) => sum + (agent.stats?.websites || 0), 0);
    const totalCertificates = agents.reduce((sum, agent) => sum + (agent.stats?.certificates || 0), 0);

    // Get most recent 5 agents
    const recentAgents = agents.slice(0, 5);

    return (
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
            <div className="flex justify-between items-center mb-6">
                <h1 className="text-2xl font-bold text-gray-800">控制台仪表盘</h1>

                {/* Manual refresh button */}
                <Button
                    variant="secondary"
                    size="sm"
                    onClick={handleManualRefresh}
                    disabled={isRefreshing}
                >
                    <RefreshCw className={`w-4 h-4 mr-1 ${isRefreshing ? 'animate-spin' : ''}`}/>
                    {isRefreshing ? '刷新中...' : '刷新数据'}
                </Button>
            </div>

            {/* MQTT status indicator (when connected) */}
            {mqttConnected && lastMqttUpdate && (
                <div
                    className="mb-4 p-2 bg-blue-50 border border-blue-100 rounded-md text-sm text-blue-700 flex items-center">
                    <Zap className="w-4 h-4 mr-2 text-blue-500"/>
                    <span>MQTT实时监控已连接 - 最后更新: {formatDistanceToNow(lastMqttUpdate, {addSuffix: true})}</span>
                </div>
            )}

            {/* Status cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
                <StatusCard
                    title="代理节点"
                    value={`${onlineAgents.length}/${agents.length}`}
                    description={mqttConnected ? 'MQTT实时监控' : '通过HTTP监控'}
                    icon={<Server className="w-8 h-8 text-blue-500"/>}
                    color="blue"
                />
                <StatusCard
                    title="网站"
                    value={totalWebsites}
                    description="托管网站总数"
                    icon={<Globe className="w-8 h-8 text-green-500"/>}
                    color="green"
                />
                <StatusCard
                    title="SSL证书"
                    value={totalCertificates}
                    description="有效证书数量"
                    icon={<FileCheck className="w-8 h-8 text-purple-500"/>}
                    color="purple"
                />
            </div>

            {/* Recently active agents */}
            <div className="bg-white rounded-lg shadow mb-8">
                <div className="px-4 py-3 border-b border-gray-200 flex justify-between items-center">
                    <h2 className="text-lg font-medium text-gray-800">最近活动的代理</h2>
                    {mqttConnected && (
                        <span className="px-2 py-1 bg-blue-50 text-blue-700 text-xs font-medium rounded-full">
                            MQTT实时 ({Object.keys(agentState).length})
                        </span>
                    )}
                </div>
                <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-200">
                        <thead className="bg-gray-50">
                        <tr>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">名称</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">IP地址</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">状态</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">版本</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Hash</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">最后心跳</th>
                            <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">操作</th>
                        </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-gray-200">
                        {/* Loading state */}
                        {isLoading && <TableSpinner/>}

                        {/* Agent data - only show when not loading and data exists */}
                        {!isLoading && recentAgents.length > 0 && recentAgents.map(agent => (
                            <tr key={agent._id || agent.uuid} className="hover:bg-gray-50">
                                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{agent.hostname || '未命名代理'}</td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{agent.ip}</td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm">
                                    <span
                                        className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                                            agent.online
                                                ? 'bg-green-100 text-green-800'
                                                : 'bg-red-100 text-red-800'
                                        }`}>
                                      {agent.online ? '在线' : '离线'}
                                        {/* Show real-time indicator if from MQTT */}
                                        {agent._fromMqtt && (
                                            <span className="ml-1 opacity-75">(实时)</span>
                                        )}
                                    </span>
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{agent.buildVersion || '未知'}</td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{agent.commitId ? agent.commitId.substring(0, 8) : '未知'}</td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                    {agent.lastHeartbeat
                                        ? formatDistanceToNow(new Date(agent.lastHeartbeat), {addSuffix: true})
                                        : '未知'}
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-right">
                                    <NavLink
                                        href={`/agents/${agent._id || agent.uuid}`}
                                        className="text-blue-600 hover:text-blue-900 inline-flex items-center"
                                    >
                                        <Eye className="w-4 h-4 mr-2"/>
                                        详情
                                    </NavLink>
                                </td>
                            </tr>
                        ))}

                        {/* No data state - only show when not loading and no data */}
                        {!isLoading && agents.length === 0 && (
                            <tr>
                                <td colSpan="7" className="px-6 py-4 text-center text-sm text-gray-500">
                                    暂无代理数据
                                </td>
                            </tr>
                        )}
                        </tbody>
                    </table>
                </div>
                <div className="px-4 py-3 border-t border-gray-200 bg-gray-50 text-right">
                    <NavLink
                        href="/agents"
                        className="text-sm font-medium text-blue-600 hover:text-blue-900"
                    >
                        查看所有代理 →
                    </NavLink>
                </div>
            </div>

            {/* System info and quick actions */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="bg-white rounded-lg shadow">
                    <div className="px-4 py-3 border-b border-gray-200">
                        <h2 className="text-lg font-medium text-gray-800">系统信息</h2>
                    </div>
                    <div className="p-4">
                        <div className="space-y-3">
                            <div className="flex justify-between">
                                <span className="text-sm text-gray-500">控制台版本</span>
                                <span className="text-sm font-medium">v1.0.0</span>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-sm text-gray-500">最后更新</span>
                                <span className="text-sm font-medium">{new Date().toLocaleDateString()}</span>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-sm text-gray-500">数据库状态</span>
                                <span className="text-sm font-medium text-green-600">正常</span>
                            </div>
                            {/* MQTT connection status */}
                            <div className="flex justify-between">
                                <span className="text-sm text-gray-500">MQTT状态</span>
                                <span
                                    className={`text-sm font-medium ${mqttConnected ? 'text-green-600' : 'text-gray-500'}`}>
                                    {mqttConnected ? '已连接' : '未连接'}
                                </span>
                            </div>
                            {/* Real-time agent count */}
                            {mqttConnected && (
                                <div className="flex justify-between">
                                    <span className="text-sm text-gray-500">实时监控代理</span>
                                    <span className="text-sm font-medium text-blue-600">
                                        {Object.keys(agentState).length}
                                    </span>
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                <div className="bg-white rounded-lg shadow">
                    <div className="px-4 py-3 border-b border-gray-200">
                        <h2 className="text-lg font-medium text-gray-800">快速操作</h2>
                    </div>
                    <div className="p-4">
                        <div className="grid grid-cols-2 gap-3">
                            <QuickActionButton text="更新所有代理" color="blue"/>
                            <QuickActionButton text="检查SSL证书" color="green"/>
                            <QuickActionButton text="同步网站配置" color="purple"/>
                            <QuickActionButton text="系统备份" color="amber"/>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
