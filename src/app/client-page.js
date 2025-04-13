'use client';

import {useCallback, useEffect, useState} from 'react';
import {formatDistanceToNow} from 'date-fns';
import {Eye, FileCheck, Globe, Server} from 'lucide-react';
import NavLink from '@/components/ui/NavLink';
import StatusCard from '@/components/ui/StatusCard';
import QuickActionButton from '@/components/ui/QuickActionButton';
import {useApp} from './contexts/AppContext';
import {useLoading} from './contexts/LoadingContext';
import {useAsyncLoading} from '@/lib/loading-hooks';

export default function DashboardClientPage({initialAgents}) {
    const [agents, setAgents] = useState(initialAgents || []);
    const [loading, setLoading] = useState(false);
    const {autoRefresh, agents: contextAgents} = useApp();
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

    // 刷新代理数据
    const refreshDashboardData = useCallback(async () => {
        try {
            setLoading(true);
            console.log('Dashboard: 刷新仪表盘数据');
            const response = await fetch('/api/agents');

            if (!response.ok) {
                throw new Error(`服务器返回错误: ${response.status}`);
            }

            const data = await response.json();
            console.log('Dashboard: 获取到新数据:', data.length);
            setAgents(data);
        } catch (error) {
            console.error('Dashboard: 刷新数据失败:', error);
        } finally {
            setLoading(false);
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
            setAgents(contextAgents);
        }
    }, [contextAgents, isMounted]);

    // 添加自动刷新功能
    useEffect(() => {
        if (!isMounted || !autoRefresh) return;

        console.log('Dashboard: 设置自动刷新定时器');
        // 设置定时刷新
        const intervalId = setInterval(() => {
            console.log('Dashboard: 自动刷新触发');
            refreshDashboardData();
        }, 15000); // 每15秒刷新一次

        // 清理函数
        return () => {
            console.log('Dashboard: 清除自动刷新定时器');
            clearInterval(intervalId);
        };
    }, [autoRefresh, refreshDashboardData, isMounted]);

    // 如果组件还未挂载，返回null依赖全局加载状态
    if (!isMounted) {
        return null;
    }

    // 计算统计信息
    const onlineAgents = agents.filter(agent => agent.online);
    const totalWebsites = agents.reduce((sum, agent) => sum + (agent.stats?.websites || 0), 0);
    const totalCertificates = agents.reduce((sum, agent) => sum + (agent.stats?.certificates || 0), 0);

    // 获取最近的5个代理
    const recentAgents = [...agents]
        .sort((a, b) => new Date(b.lastHeartbeat) - new Date(a.lastHeartbeat))
        .slice(0, 5);

    return (
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
            <h1 className="text-2xl font-bold text-gray-800 mb-6">控制台仪表盘</h1>

            {/* 刷新按钮 */}
            <div className="mb-4 flex justify-end">
                <button
                    onClick={() => withLoading(refreshDashboardData)}
                    disabled={loading}
                    className="inline-flex items-center px-3 py-2 text-sm font-medium text-gray-700 bg-gray-50 rounded border border-gray-300 hover:bg-gray-100 disabled:opacity-50"
                >
                    {loading ? (
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
                    description="在线/总数"
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
                <div className="px-4 py-3 border-b border-gray-200">
                    <h2 className="text-lg font-medium text-gray-800">最近活动的代理</h2>
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
                        {recentAgents.map(agent => (
                            <tr key={agent._id} className="hover:bg-gray-50">
                                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{agent.hostname || '未命名代理'}</td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{agent.ip}</td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm">
                                    <span
                                        className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${agent.online ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                                      {agent.online ? '在线' : '离线'}
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
                                        href={`/agents/${agent._id}`}
                                        className="text-blue-600 hover:text-blue-900 inline-flex items-center"
                                    >
                                        <Eye className="w-4 h-4 mr-2"/>
                                        详情
                                    </NavLink>
                                </td>
                            </tr>
                        ))}
                        {agents.length === 0 && (
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
