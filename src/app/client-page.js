// src/app/client-page.js 更新
'use client';

import {useCallback, useEffect, useState, useMemo} from 'react';
import {formatDistanceToNow} from 'date-fns';
import {Eye, FileCheck, Globe, Server} from 'lucide-react';
import NavLink from '@/components/ui/NavLink';
import StatusCard from '@/components/ui/StatusCard';
import QuickActionButton from '@/components/ui/QuickActionButton';
import {useApp} from './contexts/AppContext';
import {useMqtt} from './contexts/MqttContext'; // 添加MQTT上下文
import {useLoading} from './contexts/LoadingContext';
import {useAsyncLoading} from '@/lib/loading-hooks';
import TableSpinner from '@/components/ui/TableSpinner';

export default function DashboardClientPage({initialAgents}) {
    const [httpAgents, setHttpAgents] = useState(initialAgents || []);
    const [isLoading, setIsLoading] = useState(false);
    const {autoRefresh, agents: contextAgents} = useApp();
    const {connected: mqttConnected, agentState} = useMqtt(); // 获取MQTT状态和代理数据
    const {stopLoading} = useLoading();
    const {withLoading} = useAsyncLoading();
    const [isMounted, setIsMounted] = useState(false);

    // 组件挂载时标记客户端渲染完成
    useEffect(() => {
        setIsMounted(true);
        // 确保组件完全挂载后停止加载状态
        const timer = setTimeout(() => {
            stopLoading();
        }, 300);

        return () => clearTimeout(timer);
    }, [stopLoading]);

    // 刷新代理数据 (HTTP)
    const refreshDashboardData = useCallback(async () => {
        try {
            setIsLoading(true);
            console.log('Dashboard: 刷新仪表盘数据');
            const response = await fetch('/api/agents');

            if (!response.ok) {
                throw new Error(`服务器返回错误: ${response.status}`);
            }

            const data = await response.json();
            console.log('Dashboard: 获取到新HTTP数据:', data.length);
            setHttpAgents(data);
        } catch (error) {
            console.error('Dashboard: 刷新数据失败:', error);
        } finally {
            setIsLoading(false);
        }
    }, []);

    // 组件挂载时刷新数据
    useEffect(() => {
        if (isMounted) {
            console.log('Dashboard: 组件挂载，立即获取最新数据');
            refreshDashboardData();
        }
    }, [refreshDashboardData, isMounted]);

    // 当上下文中的agents变化时，更新本地状态
    useEffect(() => {
        if (isMounted && contextAgents && contextAgents.length > 0) {
            console.log('Dashboard: 上下文agents变化，更新本地状态', contextAgents?.length);
            setHttpAgents(contextAgents);
        }
    }, [contextAgents, isMounted]);

    // 合并HTTP代理数据和MQTT代理状态
    const agents = useMemo(() => {
        if (!isMounted) return [];

        // 如果MQTT未连接或代理状态为空，直接使用HTTP数据
        if (!mqttConnected || Object.keys(agentState).length === 0) {
            return httpAgents;
        }

        console.log('Dashboard: 合并MQTT和HTTP代理数据');
        console.log('- HTTP代理:', httpAgents.length);
        console.log('- MQTT代理:', Object.keys(agentState).length);

        // 创建代理映射 (UUID -> 代理)
        const agentMap = new Map();

        // 首先添加HTTP代理数据
        httpAgents.forEach(agent => {
            if (agent.uuid) {
                agentMap.set(agent.uuid, {...agent});
            } else if (agent._id) {
                // 如果没有UUID但有_id，尝试用_id作为键
                agentMap.set(agent._id, {...agent});
            }
        });

        // 然后用MQTT数据更新或添加代理
        Object.entries(agentState).forEach(([uuid, mqttAgent]) => {
            if (agentMap.has(uuid)) {
                // 更新现有代理的MQTT相关属性
                const agent = agentMap.get(uuid);
                agentMap.set(uuid, {
                    ...agent,
                    online: mqttAgent.online,
                    lastHeartbeat: mqttAgent.lastHeartbeat || agent.lastHeartbeat,
                    hostname: agent.hostname || mqttAgent.hostname,
                    ip: agent.ip || mqttAgent.ip,
                    _fromMqtt: true // 标记这个代理数据有MQTT更新
                });
            } else {
                // 添加新的MQTT代理
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
                    stats: { websites: 0, certificates: 0 },
                    _fromMqtt: true // 标记这是纯MQTT代理
                });
            }
        });

        // 转换回数组并排序 (优先显示在线代理，然后按心跳时间排序)
        return Array.from(agentMap.values())
            .sort((a, b) => {
                // 首先按在线状态排序
                if (a.online !== b.online) {
                    return a.online ? -1 : 1;
                }
                // 然后按最后心跳时间排序
                if (a.lastHeartbeat && b.lastHeartbeat) {
                    return new Date(b.lastHeartbeat) - new Date(a.lastHeartbeat);
                }
                return 0;
            });
    }, [httpAgents, mqttConnected, agentState, isMounted]);

    // 添加自动刷新功能
    useEffect(() => {
        if (!isMounted || !autoRefresh) return;

        console.log('Dashboard: 设置自动刷新定时器');
        // 设置定时刷新
        const intervalId = setInterval(() => {
            // 如果MQTT已连接且有活跃代理，可以减少HTTP刷新频率
            if (mqttConnected && Object.keys(agentState).length > 0) {
                console.log('Dashboard: MQTT活跃中，跳过HTTP刷新');
                return;
            }

            console.log('Dashboard: 自动刷新触发');
            refreshDashboardData();
        }, 15000); // 每15秒刷新一次

        // 清理函数
        return () => {
            console.log('Dashboard: 清除自动刷新定时器');
            clearInterval(intervalId);
        };
    }, [autoRefresh, refreshDashboardData, isMounted, mqttConnected, agentState]);

    // 如果组件还未挂载，返回null依赖全局加载状态
    if (!isMounted) {
        return null;
    }

    // 计算统计信息
    const onlineAgents = agents.filter(agent => agent.online);
    const totalWebsites = agents.reduce((sum, agent) => sum + (agent.stats?.websites || 0), 0);
    const totalCertificates = agents.reduce((sum, agent) => sum + (agent.stats?.certificates || 0), 0);

    // 获取最近的5个代理
    const recentAgents = agents.slice(0, 5);

    return (
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
            <h1 className="text-2xl font-bold text-gray-800 mb-6">控制台仪表盘</h1>

            {/* 刷新按钮 */}
            <div className="mb-4 flex justify-end">
                <button
                    onClick={() => withLoading(refreshDashboardData)}
                    disabled={isLoading}
                    className="inline-flex items-center px-3 py-2 text-sm font-medium text-gray-700 bg-gray-50 rounded border border-gray-300 hover:bg-gray-100 disabled:opacity-50"
                >
                    {isLoading ? (
                        <>
                            <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-gray-700"
                                 xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor"
                                        strokeWidth="4"></circle>
                                <path className="opacity-75" fill="currentColor"
                                      d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                            </svg>
                            刷新中...
                        </>
                    ) : '刷新仪表盘'}
                </button>
            </div>

            {/* 状态卡片 */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
                <StatusCard
                    title="代理节点"
                    value={`${onlineAgents.length}/${agents.length}`}
                    description={mqttConnected ? "MQTT已连接" : "通过HTTP监控"}
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

            {/* 最近活动的代理 */}
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
                        {/* 加载状态 */}
                        {isLoading && <TableSpinner/>}

                        {/* 代理数据 - 只在没有加载状态且有数据时显示 */}
                        {!isLoading && recentAgents.length > 0 && recentAgents.map(agent => (
                            <tr key={agent._id || agent.uuid} className="hover:bg-gray-50">
                                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{agent.hostname || '未命名代理'}</td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{agent.ip}</td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm">
                                    <span
                                        className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${agent.online ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                                      {agent.online ? '在线' : '离线'}
                                        {/* 如果是MQTT更新的代理，显示实时标记 */}
                                        {agent._fromMqtt && <span className="opacity-75">(实时)</span>}
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

                        {/* 没有数据状态 - 只在没有加载且没有数据时显示 */}
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

            {/* 系统信息和快速操作 */}
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
                            {/* MQTT连接状态 */}
                            <div className="flex justify-between">
                                <span className="text-sm text-gray-500">MQTT状态</span>
                                <span className={`text-sm font-medium ${mqttConnected ? 'text-green-600' : 'text-gray-500'}`}>
                                    {mqttConnected ? '已连接' : '未连接'}
                                </span>
                            </div>
                            {/* 实时代理数 */}
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
