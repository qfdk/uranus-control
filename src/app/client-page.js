'use client';

import {useCallback, useEffect, useState, useRef} from 'react';
import {formatDistanceToNow} from 'date-fns';
import {Eye, Plus, RefreshCw, Server, Zap} from 'lucide-react';
import NavLink from '@/components/ui/NavLink';
import StatusCard from '@/components/ui/StatusCard';
import QuickActionButton from '@/components/ui/QuickActionButton';
import TableSpinner from '@/components/ui/TableSpinner';
import Button from '@/components/ui/Button';
import {useClientMount} from '@/hooks/useClientMount';
import useAgentStore from '@/store/agentStore';
import useMqttStore from '@/store/mqttStore';

export default function DashboardClientPage() {
    const [lastMqttUpdate, setLastMqttUpdate] = useState(null);
    const [upgradeStatus, setUpgradeStatus] = useState({
        isUpgrading: false,
        success: 0,
        failed: 0,
        total: 0,
        message: ''
    });

    // 使用自定义Hook处理客户端挂载
    const isMounted = useClientMount();

    // 使用Zustand store
    const {
        agents,
        isLoading,
        fetchAgents,
        upgradeAgent,
        getCombinedAgents,
        mqttConnected
    } = useAgentStore();

    // MQTT store
    const { connect: connectMqtt } = useMqttStore();

    // 本地loading状态
    const [localLoading, setLocalLoading] = useState(false);
    const initialLoadRef = useRef(false);

    // 初始数据加载
    useEffect(() => {
        if (isMounted && !initialLoadRef.current) {
            initialLoadRef.current = true;
            fetchAgents().finally(() => {
                setLocalLoading(false);
            });
        }
    }, [isMounted, fetchAgents]);

    // 组件挂载时连接MQTT
    useEffect(() => {
        if (isMounted) {
            // 设置最后更新时间为当前时间
            setLastMqttUpdate(new Date());

            // 延迟初始化MQTT，避免与数据加载冲突
            const timer = setTimeout(() => {
                connectMqtt();
            }, 1000);

            return () => clearTimeout(timer);
        }
    }, [isMounted, connectMqtt]);

    // 更新MQTT时间戳
    useEffect(() => {
        if (mqttConnected) {
            setLastMqttUpdate(new Date());
        }
    }, [mqttConnected]);

    // 处理手动刷新按钮点击
    const handleManualRefresh = useCallback(async () => {
        setLocalLoading(true);
        try {
            await fetchAgents(true);
        } finally {
            // 短暂延迟后关闭刷新指示器
            setTimeout(() => {
                setLocalLoading(false);
            }, 500);
        }
    }, [fetchAgents]);

    // 获取合并的代理数据 (包含MQTT状态)
    const combinedAgents = getCombinedAgents();

    // 更新所有代理的处理函数
    const handleUpgradeAllAgents = useCallback(async () => {
        // 只选择在线的代理进行升级
        const onlineAgents = combinedAgents.filter(agent => agent.online && agent._id);

        if (onlineAgents.length === 0) {
            setUpgradeStatus({
                isUpgrading: false,
                success: 0,
                failed: 0,
                total: 0,
                message: '没有在线代理可以升级'
            });
            alert('没有在线代理可以升级');
            return;
        }

        if (!confirm(`确定要升级所有${onlineAgents.length}个在线代理吗？这可能会导致服务临时中断。`)) {
            return;
        }

        setUpgradeStatus({
            isUpgrading: true,
            success: 0,
            failed: 0,
            total: onlineAgents.length,
            message: `正在升级${onlineAgents.length}个代理...`
        });

        let successCount = 0;
        let failedCount = 0;

        // 逐个升级代理
        for (const agent of onlineAgents) {
            try {
                const result = await upgradeAgent(agent._id);
                if (result.success) {
                    successCount++;
                } else {
                    failedCount++;
                }

                // 更新状态
                setUpgradeStatus({
                    isUpgrading: true,
                    success: successCount,
                    failed: failedCount,
                    total: onlineAgents.length,
                    message: `正在升级: ${successCount + failedCount}/${onlineAgents.length}`
                });

            } catch (error) {
                console.error(`升级代理 ${agent.hostname || agent.uuid} 失败:`, error);
                failedCount++;

                // 更新状态
                setUpgradeStatus({
                    isUpgrading: true,
                    success: successCount,
                    failed: failedCount,
                    total: onlineAgents.length,
                    message: `正在升级: ${successCount + failedCount}/${onlineAgents.length}`
                });
            }
        }

        // 所有代理升级完成，刷新数据
        await fetchAgents(true);

        // 设置最终状态
        setUpgradeStatus({
            isUpgrading: false,
            success: successCount,
            failed: failedCount,
            total: onlineAgents.length,
            message: `升级完成: ${successCount}成功, ${failedCount}失败`
        });

    }, [combinedAgents, upgradeAgent, fetchAgents]);

    // 如果组件未挂载，返回null并依赖全局加载状态
    if (!isMounted) {
        return null;
    }

    // 计算统计信息
    const totalWebsites = combinedAgents.reduce((sum, agent) => sum + (agent.stats?.websites || 0), 0);
    const totalCertificates = combinedAgents.reduce((sum, agent) => sum + (agent.stats?.certificates || 0), 0);

    // 获取最近的5个代理
    const recentAgents = combinedAgents.slice(0, 5);

    return (
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
            <div className="flex justify-between items-center mb-6">
                <h1 className="text-2xl font-bold text-gray-800 dark:text-white">控制台仪表盘</h1>

                {/* 手动刷新按钮 */}
                <Button
                    variant="secondary"
                    size="sm"
                    onClick={handleManualRefresh}
                    disabled={isLoading || localLoading}
                >
                    <RefreshCw className={`w-4 h-4 mr-1 ${(isLoading || localLoading) ? 'animate-spin' : ''}`}/>
                    {(isLoading || localLoading) ? '刷新中...' : '刷新数据'}
                </Button>
            </div>

            {/* 升级状态提示 */}
            {upgradeStatus.message && (
                <div className={`mb-4 p-3 rounded-md text-sm flex items-center ${
                    upgradeStatus.isUpgrading
                        ? 'bg-blue-50 dark:bg-blue-900/30 border border-blue-100 dark:border-blue-800 text-blue-700 dark:text-blue-300'
                        : (upgradeStatus.failed > 0
                            ? 'bg-yellow-50 dark:bg-yellow-900/30 border border-yellow-100 dark:border-yellow-800 text-yellow-700 dark:text-yellow-300'
                            : 'bg-green-50 dark:bg-green-900/30 border border-green-100 dark:border-green-800 text-green-700 dark:text-green-300')
                }`}>
                    {upgradeStatus.isUpgrading ? (
                        <RefreshCw className="w-4 h-4 mr-2 animate-spin"/>
                    ) : (upgradeStatus.failed > 0 ? (
                        <svg className="w-4 h-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                                  d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"/>
                        </svg>
                    ) : (
                        <svg className="w-4 h-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7"/>
                        </svg>
                    ))}
                    <span>{upgradeStatus.message}</span>
                </div>
            )}

            {/* MQTT状态指示器 (已连接时) */}
            {mqttConnected && lastMqttUpdate && (
                <div
                    className="mb-4 p-2 bg-blue-50 dark:bg-blue-900/30 border border-blue-100 dark:border-blue-800 rounded-md text-sm text-blue-700 dark:text-blue-300 flex items-center">
                    <Zap className="w-4 h-4 mr-2 text-blue-500 dark:text-blue-400"/>
                    <span>MQTT实时监控已连接 - 最后更新: {formatDistanceToNow(lastMqttUpdate, {addSuffix: true})}</span>
                </div>
            )}

            {/* 状态卡片 */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
                <StatusCard
                    title="代理节点"
                    value={`${combinedAgents.filter(agent => agent.online).length}/${agents.length}`}
                    description={mqttConnected ? 'MQTT实时监控' : '通过HTTP监控'}
                    icon={<Server className="w-8 h-8 text-blue-500 dark:text-blue-400"/>}
                    color="blue"
                />
                <StatusCard
                    title="网站"
                    value={totalWebsites}
                    description="托管网站总数"
                    icon={<svg className="w-8 h-8 text-green-500 dark:text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9"/>
                    </svg>}
                    color="green"
                />
                <StatusCard
                    title="SSL证书"
                    value={totalCertificates}
                    description="有效证书数量"
                    icon={<svg className="w-8 h-8 text-purple-500 dark:text-purple-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"/>
                    </svg>}
                    color="purple"
                />
            </div>

            {/* 最近活动的代理 */}
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow mb-8">
                <div
                    className="px-4 py-3 border-b border-gray-200 dark:border-gray-700 flex justify-between items-center">
                    <h2 className="text-lg font-medium text-gray-800 dark:text-white">最近活动的代理</h2>
                    {mqttConnected && (
                        <span
                            className="px-2 py-1 bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 text-xs font-medium rounded-full">
              MQTT实时
            </span>
                    )}
                </div>
                <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                        <thead className="bg-gray-50 dark:bg-gray-700">
                        <tr>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">名称</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">IP地址</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">状态</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">版本</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Hash</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">最后心跳</th>
                            <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">操作</th>
                        </tr>
                        </thead>
                        <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                        {/* 加载状态 */}
                        {(isLoading || localLoading) && <TableSpinner message="加载代理数据中..."/>}

                        {/* 代理数据 - 仅在不加载且数据存在时显示 */}
                        {!isLoading && !localLoading && recentAgents.length > 0 && recentAgents.map(agent => (
                            <tr key={agent._id || agent.uuid}
                                className="hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors">
                                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 dark:text-white">
                                    {agent.hostname || '未命名代理'}
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">{agent.ip}</td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm">
                  <span
                      className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                          agent.online
                              ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400'
                              : 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400'
                      }`}>
                    {agent.online ? '在线' : '离线'}
                      {/* 如果来自MQTT则显示实时指示器 */}
                      {agent._fromMqtt && (
                          <span className="ml-1 opacity-75">(实时)</span>
                      )}
                  </span>
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">{agent.buildVersion || '未知'}</td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">{agent.commitId ? agent.commitId.substring(0, 8) : '未知'}</td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                                    {agent.lastHeartbeat
                                        ? formatDistanceToNow(new Date(agent.lastHeartbeat), {addSuffix: true})
                                        : '未知'}
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-right">
                                    <NavLink
                                        href={`/agents/${agent._id}`}
                                        className="text-blue-600 hover:text-blue-900 dark:text-blue-400 dark:hover:text-blue-300 inline-flex items-center"
                                    >
                                        <Eye className="w-4 h-4 mr-2"/>
                                        详情
                                    </NavLink>
                                </td>
                            </tr>
                        ))}

                        {/* 无数据状态 */}
                        {!isLoading && !localLoading && recentAgents.length === 0 && (
                            <tr>
                                <td colSpan="7" className="px-6 py-4 text-center text-gray-500">
                                    暂无代理数据
                                </td>
                            </tr>
                        )}
                        </tbody>
                    </table>
                </div>
                <div
                    className="px-4 py-3 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-700 text-right">
                    <NavLink
                        href="/agents"
                        className="text-sm font-medium text-blue-600 hover:text-blue-900 dark:text-blue-400 dark:hover:text-blue-300"
                    >
                        查看所有代理 →
                    </NavLink>
                </div>
            </div>

            {/* 系统信息和快速操作 */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="bg-white dark:bg-gray-800 rounded-lg shadow">
                    <div className="px-4 py-3 border-b border-gray-200 dark:border-gray-700">
                        <h2 className="text-lg font-medium text-gray-800 dark:text-white">系统信息</h2>
                    </div>
                    <div className="p-4">
                        <div className="space-y-3">
                            <div className="flex justify-between">
                                <span className="text-sm text-gray-500 dark:text-gray-400">控制台版本</span>
                                <span className="text-sm font-medium dark:text-gray-300">v1.0.0</span>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-sm text-gray-500 dark:text-gray-400">最后更新</span>
                                <span
                                    className="text-sm font-medium dark:text-gray-300">{new Date().toLocaleDateString()}</span>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-sm text-gray-500 dark:text-gray-400">数据库状态</span>
                                <span className="text-sm font-medium text-green-600 dark:text-green-400">正常</span>
                            </div>
                            {/* MQTT连接状态 */}
                            <div className="flex justify-between">
                                <span className="text-sm text-gray-500 dark:text-gray-400">MQTT状态</span>
                                <span
                                    className={`text-sm font-medium ${mqttConnected ? 'text-green-600 dark:text-green-400' : 'text-gray-500 dark:text-gray-400'}`}>
                  {mqttConnected ? '已连接' : '未连接'}
                </span>
                            </div>
                        </div>
                    </div>
                </div>

                <div className="bg-white dark:bg-gray-800 rounded-lg shadow">
                    <div className="px-4 py-3 border-b border-gray-200 dark:border-gray-700">
                        <h2 className="text-lg font-medium text-gray-800 dark:text-white">快速操作</h2>
                    </div>
                    <div className="p-4">
                        <div className="grid grid-cols-2 gap-3">
                            <QuickActionButton
                                text={upgradeStatus.isUpgrading ? `升级中(${upgradeStatus.success + upgradeStatus.failed}/${upgradeStatus.total})` : '更新所有代理'}
                                color="blue"
                                onClick={handleUpgradeAllAgents}
                                disabled={upgradeStatus.isUpgrading}
                                loading={upgradeStatus.isUpgrading}
                            />
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
