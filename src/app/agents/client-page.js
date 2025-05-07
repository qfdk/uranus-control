// src/app/agents/client-page.js
'use client';

import {useCallback, useEffect, useRef, useState} from 'react';
import {formatDistanceToNow} from 'date-fns';
import {Cpu, Eye, RefreshCw, Server, Settings, Trash2} from 'lucide-react';
import Button from '@/components/ui/Button';
import NavLink from '@/components/ui/NavLink';
import {usePathname} from 'next/navigation';
import TableSpinner from '@/components/ui/TableSpinner';
import {useClientMount} from '@/hooks/useClientMount';
import useAgentStore from '@/store/agentStore';
import useMqttStore from '@/store/mqttStore';

export default function AgentsClientPage() {
    const [searchTerm, setSearchTerm] = useState('');
    const [statusFilter, setStatusFilter] = useState('all');
    const [deleteLoading, setDeleteLoading] = useState(null);
    const [refreshLoading, setRefreshLoading] = useState(false);
    const [upgradeStatus, setUpgradeStatus] = useState({
        isUpgrading: false,
        success: 0,
        failed: 0,
        total: 0,
        message: ''
    });
    const pathname = usePathname();
    const mqttInitializedRef = useRef(false);

    // 使用全局状态
    const {
        agents,
        isLoading,
        fetchAgents,
        deleteAgent,
        upgradeAgent,
        getCombinedAgents,
        initialLoaded,
        setMqttConnected
    } = useAgentStore();

    // MQTT状态 - 直接从Store获取connect方法
    const {connected: mqttConnected, connect: connectMqtt} = useMqttStore();

    // 使用自定义Hook处理客户端挂载
    const isMounted = useClientMount();

    // 更新所有代理的处理函数
    const handleUpgradeAllAgents = useCallback(async () => {
        // 获取实时组合数据
        const combinedAgentsData = getCombinedAgents();
        // 只选择在线的代理进行升级
        const onlineAgentsToUpgrade = combinedAgentsData.filter(agent => agent.online && agent._id);

        if (onlineAgentsToUpgrade.length === 0) {
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

        if (!confirm(`确定要升级所有${onlineAgentsToUpgrade.length}个在线代理吗？这可能会导致服务临时中断。`)) {
            return;
        }

        setUpgradeStatus({
            isUpgrading: true,
            success: 0,
            failed: 0,
            total: onlineAgentsToUpgrade.length,
            message: `正在升级${onlineAgentsToUpgrade.length}个代理...`
        });

        let successCount = 0;
        let failedCount = 0;

        // 逐个升级代理
        for (const agent of onlineAgentsToUpgrade) {
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
                    total: onlineAgentsToUpgrade.length,
                    message: `正在升级: ${successCount + failedCount}/${onlineAgentsToUpgrade.length}`
                });
            } catch (error) {
                console.error(`升级代理 ${agent.hostname || agent.uuid} 失败:`, error);
                failedCount++;

                // 更新状态
                setUpgradeStatus({
                    isUpgrading: true,
                    success: successCount,
                    failed: failedCount,
                    total: onlineAgentsToUpgrade.length,
                    message: `正在升级: ${successCount + failedCount}/${onlineAgentsToUpgrade.length}`
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
            total: onlineAgentsToUpgrade.length,
            message: `升级完成: ${successCount}成功, ${failedCount}失败`
        });
    }, [upgradeAgent, fetchAgents, getCombinedAgents]);

    // 强制初始化MQTT连接
    const initializeMqtt = useCallback(async () => {
        if (!mqttInitializedRef.current && isMounted) {
            console.log('代理页面：手动初始化MQTT连接');
            mqttInitializedRef.current = true;

            try {
                await connectMqtt();
                console.log('MQTT连接成功');
                setMqttConnected(true);
            } catch (error) {
                console.error('MQTT连接失败:', error);
                setMqttConnected(false);
            }
        }
    }, [connectMqtt, isMounted, setMqttConnected]);

    // 初始数据加载 - 仅在首次渲染或强制刷新时执行
    useEffect(() => {
        if (isMounted && pathname === '/agents') {
            // 只在首次加载或者没有缓存数据时执行API请求
            if (!initialLoaded || agents.length === 0) {
                console.log('代理页面：首次加载数据');
                fetchAgents();
            } else {
                console.log('代理页面：使用缓存数据');
            }

            // 强制初始化MQTT
            if (!mqttConnected) {
                // 使用setTimeout确保不会阻塞渲染
                setTimeout(() => {
                    initializeMqtt();
                }, 100);
            }
        }
    }, [isMounted, pathname, fetchAgents, initialLoaded, agents.length, mqttConnected, initializeMqtt]);

    // 监听MQTT连接状态变化
    useEffect(() => {
        if (mqttConnected) {
            console.log('MQTT已连接，使用实时数据更新');
        } else if (isMounted && !mqttInitializedRef.current) {
            console.log('MQTT未连接，尝试连接');
            initializeMqtt();
        }
    }, [mqttConnected, isMounted, initializeMqtt]);

    // 获取合并后的代理数据（HTTP+MQTT）
    const combinedAgents = getCombinedAgents();

    // 过滤代理
    const filteredAgents = combinedAgents.filter(agent => {
        // 状态过滤
        if (statusFilter === 'online' && !agent.online) return false;
        if (statusFilter === 'offline' && agent.online) return false;

        // 搜索过滤
        if (searchTerm) {
            const search = searchTerm.toLowerCase();
            return (agent.hostname && agent.hostname.toLowerCase().includes(search)) ||
                (agent.ip && agent.ip.toLowerCase().includes(search)) ||
                (agent.uuid && agent.uuid.toLowerCase().includes(search));
        }

        return true;
    });

    // 处理代理删除
    const handleDeleteAgent = async (agentId) => {
        if (!agentId) return {success: false, canceled: true};

        try {
            // 设置加载状态
            setDeleteLoading(agentId);

            // 执行删除操作
            const result = await deleteAgent(agentId);

            // 删除完成
            setDeleteLoading(null);

            if (result.success) {
                return result;
            } else {
                if (!result.canceled) {
                    alert('删除代理失败，请重试');
                }
                return result;
            }
        } catch (err) {
            console.error('删除操作出错:', err);
            setDeleteLoading(null);
            return {success: false, error: err};
        }
    };

    // 强制刷新所有代理
    const handleRefreshAgents = useCallback(async () => {
        try {
            setRefreshLoading(true);
            await fetchAgents(true);  // 传入true表示强制刷新
            console.log('代理列表已强制刷新');

            // 尝试确保MQTT连接
            if (!mqttConnected) {
                initializeMqtt();
            }
        } catch (error) {
            console.error('刷新代理数据失败:', error);
        } finally {
            setTimeout(() => {
                setRefreshLoading(false);
            }, 500);
        }
    }, [fetchAgents, mqttConnected, initializeMqtt]);

    // 监听代理注册事件
    useEffect(() => {
        // 监听新代理注册事件
        const handleAgentRegistered = (event) => {
            const uuid = event.detail?.uuid;
            const agent = event.detail?.agent;
            const isNew = event.detail?.isNew;

            if (!uuid || !agent) return;

            console.log('检测到代理注册事件，UUID:', uuid, '是否新代理:', isNew);

            // 仅当明确是新代理时才刷新列表
            if (isNew) {
                // 检查是否已在当前列表中
                const isInCurrentList = combinedAgents.some(a => a.uuid === uuid);

                if (!isInCurrentList) {
                    console.log('新代理不在当前列表中，刷新列表');
                    fetchAgents(true);
                } else {
                    console.log('代理已在列表中，无需刷新');
                }
            }
        };

        // 添加事件监听
        window.addEventListener('mqtt-agent-registered', handleAgentRegistered);

        // 清理函数
        return () => {
            window.removeEventListener('mqtt-agent-registered', handleAgentRegistered);
        };
    }, [fetchAgents, combinedAgents]);

    // 处理搜索和状态过滤
    const handleSearchChange = (e) => {
        setSearchTerm(e.target.value);
    };

    const handleStatusChange = (e) => {
        setStatusFilter(e.target.value);
    };

    // 如果组件未挂载，依赖全局加载状态
    if (!isMounted) {
        return null;
    }

    // 计算统计信息
    const totalAgents = combinedAgents.length;
    const onlineAgents = combinedAgents.filter(agent => agent.online).length;

    return (
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
            <div className="flex justify-between items-center mb-6">
                <h1 className="text-2xl font-bold text-gray-800 dark:text-white">控制台仪表盘</h1>
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

            {/* 状态卡片、系统信息和快速操作放在同一行 */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                {/* 代理节点卡片 - 优化样式 */}
                <div
                    className="bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-800 shadow-sm overflow-hidden">
                    <div className="flex items-stretch p-3">
                        <div className="flex items-center justify-center rounded-full bg-blue-100 dark:bg-blue-900/40 p-3 mr-4 w-16 h-16">
                            <Server className="w-8 h-8 text-blue-500 dark:text-blue-400"/>
                        </div>
                        <div className="flex flex-col justify-center flex-1">
                            <div className="flex items-center justify-between mb-1">
                                <p className="text-sm font-medium text-blue-600 dark:text-blue-400">代理节点</p>
                                <div
                                    className="text-sm px-2 py-0.5 rounded-full bg-blue-100 dark:bg-blue-900/60 text-blue-600 dark:text-blue-300">
                                    {mqttConnected ? 'MQTT实时' : 'HTTP模式'}
                                </div>
                            </div>
                            <p className="text-2xl font-bold text-gray-800 dark:text-gray-100">{onlineAgents}/{totalAgents}</p>
                            <div className="mt-2 w-full bg-gray-100 dark:bg-gray-800 rounded-full">
                                <div className="h-2 bg-gradient-to-r from-blue-400 to-blue-500 dark:from-blue-500 dark:to-blue-600 rounded-full transition-all duration-500 ease-in-out"
                                    style={{width: `${(onlineAgents / Math.max(totalAgents, 1)) * 100}%`}}></div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* 系统信息卡片 - 优化样式 */}
                <div
                    className="bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-800 shadow-sm">
                    <div className="flex items-stretch p-3">
                        <div className="flex items-center justify-center rounded-full bg-indigo-100 dark:bg-indigo-900/40 p-3 mr-4 w-16 h-16">
                            <Cpu className="w-8 h-8 text-indigo-500 dark:text-indigo-400"/>
                        </div>
                        <div className="flex flex-col justify-center flex-1">
                            <p className="text-sm font-medium text-indigo-600 dark:text-indigo-400 mb-2">系统信息</p>
                            <div className="flex justify-between items-center mt-1">
                                <span className="text-sm text-gray-600 dark:text-gray-400">控制台版本:</span>
                                <span className="text-sm font-medium text-gray-900 dark:text-gray-200">v1.0.0</span>
                            </div>
                            <div className="flex justify-between items-center mt-1">
                                <span className="text-sm text-gray-600 dark:text-gray-400">MQTT状态:</span>
                                <span className={`text-sm font-medium rounded-full px-2 py-0.5 ${
                                    mqttConnected
                                        ? 'bg-green-100 dark:bg-green-900/50 text-green-600 dark:text-green-300'
                                        : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400'
                                }`}>
                                    {mqttConnected ? '已连接' : '未连接'}
                                </span>
                            </div>
                        </div>
                    </div>
                </div>

                {/* 快速操作卡片 - 优化样式 */}
                <div
                    className="bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-800 shadow-sm">
                    <div className="flex items-stretch p-3">
                        <div className="flex items-center justify-center rounded-full bg-gray-100 dark:bg-gray-800 p-3 mr-4 w-16 h-16">
                            <Settings className="w-8 h-8 text-gray-500 dark:text-gray-400"/>
                        </div>
                        <div className="flex flex-col justify-center flex-1">
                            <p className="text-sm font-medium text-gray-600 dark:text-gray-300 mb-2">快速操作</p>
                            <div className="flex space-x-2">
                                <button
                                    onClick={handleUpgradeAllAgents}
                                    disabled={upgradeStatus.isUpgrading || onlineAgents === 0}
                                    className={`flex-1 text-sm px-3 py-2 rounded ${
                                        upgradeStatus.isUpgrading || onlineAgents === 0
                                            ? 'bg-blue-400 dark:bg-blue-500 cursor-not-allowed opacity-70 text-white'
                                            : 'bg-blue-500 dark:bg-blue-600 hover:bg-blue-600 dark:hover:bg-blue-700 text-white'
                                    } transition-colors flex items-center justify-center`}
                                >
                                    {upgradeStatus.isUpgrading && (
                                        <RefreshCw className="w-4 h-4 mr-1.5 animate-spin"/>
                                    )}
                                    {upgradeStatus.isUpgrading ? `升级中` : '更新代理'}
                                </button>
                                <button
                                    onClick={handleRefreshAgents}
                                    disabled={refreshLoading || isLoading}
                                    className={`flex-1 text-sm px-3 py-2 rounded ${
                                        refreshLoading || isLoading
                                            ? 'bg-gray-400 dark:bg-gray-600 cursor-not-allowed opacity-70 text-white'
                                            : 'bg-gray-500 dark:bg-gray-700 hover:bg-gray-600 dark:hover:bg-gray-600 text-white'
                                    } transition-colors flex items-center justify-center`}
                                >
                                    {refreshLoading && (
                                        <RefreshCw className="w-4 h-4 mr-1.5 animate-spin"/>
                                    )}
                                    {refreshLoading ? '刷新中' : '刷新数据'}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* 搜索和过滤 */}
            <div className="mb-6 bg-white dark:bg-gray-800 p-5 rounded-lg shadow-sm">
                <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
                    {/* 搜索字段 */}
                    <div className="md:col-span-4">
                        <label htmlFor="search"
                               className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                            搜索
                        </label>
                        <input
                            type="text"
                            id="search"
                            value={searchTerm}
                            onChange={handleSearchChange}
                            placeholder="搜索代理名称或IP地址..."
                            className="w-full rounded-md border border-gray-300 dark:border-gray-600 shadow-sm px-3 py-2 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
                        />
                    </div>

                    {/* 状态下拉菜单 */}
                    <div className="md:col-span-3">
                        <label htmlFor="status"
                               className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                            状态
                        </label>
                        <div className="relative">
                            <select
                                id="status"
                                value={statusFilter}
                                onChange={handleStatusChange}
                                className="appearance-none w-full rounded-md border border-gray-300 dark:border-gray-600 shadow-sm px-3 py-2 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 bg-white dark:bg-gray-700 dark:text-white disabled:bg-gray-100 disabled:text-gray-500 pr-8"
                            >
                                <option value="all">全部</option>
                                <option value="online">在线</option>
                                <option value="offline">离线</option>
                            </select>
                            <div
                                className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-gray-700 dark:text-gray-300">
                                <svg className="fill-current h-4 w-4" xmlns="http://www.w3.org/2000/svg"
                                     viewBox="0 0 20 20">
                                    <path
                                        d="M9.293 12.95l.707.707L15.657 8l-1.414-1.414L10 10.828 5.757 6.586 4.343 8z"/>
                                </svg>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* 代理列表 */}
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow overflow-hidden">
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
                        {isLoading && <TableSpinner message="加载代理数据中..."/>}

                        {/* 代理数据 - 仅在不加载且数据存在时显示 */}
                        {!isLoading && filteredAgents.length > 0 && filteredAgents.map(agent => (
                            <tr key={agent._id || agent.uuid}
                                className={`hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors ${agent._mqttOnly ? 'bg-blue-50 dark:bg-blue-900/20' : ''}`}>
                                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 dark:text-white">
                                    {agent.hostname || '未命名代理'}
                                    {agent._mqttOnly && agent._registering && (
                                        <span
                                            className="ml-2 px-2 py-0.5 text-xs rounded-full bg-blue-100 text-blue-700 dark:bg-blue-900/50 dark:text-blue-300">
                                            同步中...
                                        </span>
                                    )}
                                    {agent._mqttOnly && !agent._registering && !agent._id && (
                                        <span
                                            className="ml-2 px-2 py-0.5 text-xs rounded-full bg-blue-100 text-blue-700 dark:bg-blue-900/50 dark:text-blue-300">
                                            新发现
                                        </span>
                                    )}
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
                                        {/* Show real-time indicator if from MQTT */}
                                        {agent._fromMqtt && (
                                            <span className="ml-1 opacity-75">(实时)</span>
                                        )}
                                    </span>
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                                    {agent.buildVersion || '未知'}
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                                    {agent.commitId ? agent.commitId.substring(0, 8) : '未知'}
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                                    {agent.lastHeartbeat
                                        ? formatDistanceToNow(new Date(agent.lastHeartbeat), {addSuffix: true})
                                        : '未知'}
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-right">
                                    <div className="flex justify-end space-x-4">
                                        {agent._id ? (
                                            // 对于已注册的代理，显示详情和删除按钮
                                            <>
                                                <NavLink
                                                    href={`/agents/${agent._id}`}
                                                    className="text-blue-600 hover:text-blue-900 dark:text-blue-400 dark:hover:text-blue-300 inline-flex items-center"
                                                >
                                                    <Eye className="w-4 h-4 mr-2"/>
                                                    详情
                                                </NavLink>
                                                <button
                                                    onClick={() => handleDeleteAgent(agent._id)}
                                                    disabled={deleteLoading === agent._id}
                                                    className="text-red-600 hover:text-red-900 dark:text-red-400 dark:hover:text-red-300 inline-flex items-center"
                                                >
                                                    {deleteLoading === agent._id ? (
                                                        <>
                                                            <svg
                                                                className="animate-spin h-4 w-4 mr-2 text-red-600 dark:text-red-400"
                                                                xmlns="http://www.w3.org/2000/svg" fill="none"
                                                                viewBox="0 0 24 24">
                                                                <circle className="opacity-25" cx="12" cy="12" r="10"
                                                                        stroke="currentColor" strokeWidth="4"></circle>
                                                                <path className="opacity-75" fill="currentColor"
                                                                      d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                                            </svg>
                                                            删除中...
                                                        </>
                                                    ) : (
                                                        <>
                                                            <Trash2 className="w-4 h-4 mr-2"/>
                                                            删除
                                                        </>
                                                    )}
                                                </button>
                                            </>
                                        ) : (
                                            // 对于正在注册中或新发现的代理
                                            <span className="text-gray-500 dark:text-gray-400 inline-flex items-center">
                                                {agent._registering ? (
                                                    <>
                                                        <RefreshCw className="w-4 h-4 mr-2 animate-spin"/>
                                                        同步中...
                                                    </>
                                                ) : (
                                                    <>
                                                        <RefreshCw className="w-4 h-4 mr-2"/>
                                                        自动注册中...
                                                    </>
                                                )}
                                            </span>
                                        )}
                                    </div>
                                </td>
                            </tr>
                        ))}
                        </tbody>
                    </table>
                </div>

                {/* 无数据状态 */}
                {!isLoading && filteredAgents.length === 0 && (
                    <div className="p-6 text-center text-gray-500 dark:text-gray-400">
                        {agents.length === 0 ? (
                            <div className="flex flex-col items-center">
                                <p className="mb-2">暂无代理数据</p>
                                <p className="text-sm text-gray-500 dark:text-gray-400">
                                    代理将在上线时自动注册
                                </p>
                            </div>
                        ) : (
                            <div className="flex flex-col items-center">
                                <p className="mb-2">未找到符合条件的代理</p>
                                <Button
                                    variant="secondary"
                                    size="sm"
                                    onClick={() => {
                                        setSearchTerm('');
                                        setStatusFilter('all');
                                    }}
                                >
                                    清除筛选条件
                                </Button>
                            </div>
                        )}
                    </div>
                )}
            </div>

        </div>
    );
}
