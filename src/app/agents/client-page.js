// src/app/agents/client-page.js
'use client';

import { useCallback, useEffect, useState } from 'react';
import { formatDistanceToNow } from 'date-fns';
import { Eye, Plus, RefreshCw, Trash2 } from 'lucide-react';
import Button from '@/components/ui/Button';
import NavLink from '@/components/ui/NavLink';
import { usePathname } from 'next/navigation';
import TableSpinner from '@/components/ui/TableSpinner';
import { useClientMount } from '@/hooks/useClientMount';
import useAgentStore from '@/store/agentStore';
import useMqttStore from '@/store/mqttStore';

export default function AgentsClientPage() {
    const [searchTerm, setSearchTerm] = useState('');
    const [statusFilter, setStatusFilter] = useState('all');
    const [deleteLoading, setDeleteLoading] = useState(null);
    const [refreshLoading, setRefreshLoading] = useState(false);
    const pathname = usePathname();

    // 使用全局状态
    const {
        agents,
        isLoading,
        fetchAgents,
        deleteAgent,
        getCombinedAgents
    } = useAgentStore();

    // MQTT状态
    const {
        connected: mqttConnected,
        getAgentState
    } = useMqttStore();

    // 使用自定义Hook处理客户端挂载
    const isMounted = useClientMount();

    // 初始数据加载
    useEffect(() => {
        if (isMounted && pathname === '/agents') {
            console.log('代理页面：加载数据');
            fetchAgents();
        }
    }, [isMounted, pathname, fetchAgents]);

    // 定期刷新代理状态 - 即使有MQTT也确保HTTP数据同步
    useEffect(() => {
        if (!isMounted) return;

        // 每60秒刷新一次HTTP数据
        const intervalId = setInterval(() => {
            console.log('定期刷新代理数据');
            fetchAgents(true);
        }, 60000);

        return () => clearInterval(intervalId);
    }, [isMounted, fetchAgents]);

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

    // 删除代理处理
    const handleDeleteAgent = async (agentId) => {
        if (!confirm('确定要删除此代理吗？此操作不可撤销。')) {
            return { success: false, canceled: true };
        }

        try {
            setDeleteLoading(agentId);
            const result = await deleteAgent(agentId);

            if (!result.success && !result.canceled) {
                alert('删除代理失败，请重试');
            }

            return result;
        } catch (error) {
            console.error('删除代理失败:', error);
            alert('删除代理失败，请重试');
            return { success: false, error };
        } finally {
            setDeleteLoading(null);
        }
    };

    // 强制刷新所有代理
    const handleRefreshAgents = async () => {
        try {
            setRefreshLoading(true);
            await fetchAgents(true);
        } catch (error) {
            console.error('刷新代理数据失败:', error);
        } finally {
            setRefreshLoading(false);
        }
    };

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

    return (
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
            <header className="mb-6 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <h1 className="text-2xl font-bold text-gray-800 dark:text-white">
                    代理管理
                    {mqttConnected && (
                        <span className="ml-2 text-xs text-blue-500 dark:text-blue-400">(MQTT实时)</span>
                    )}
                </h1>
                <Button
                    variant="secondary"
                    size="sm"
                    onClick={handleRefreshAgents}
                    disabled={refreshLoading}
                >
                    <RefreshCw className={`w-4 h-4 mr-1 ${refreshLoading ? 'animate-spin' : ''}`}/>
                    {refreshLoading ? '刷新中...' : '刷新列表'}
                </Button>
            </header>

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
                                    {agent._mqttOnly && (
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
                                            // 对于MQTT发现但尚未获取到_id的代理，显示刷新按钮
                                            <span className="text-gray-500 dark:text-gray-400 inline-flex items-center">
                                                <RefreshCw className="w-4 h-4 mr-2"/>
                                                处理中...
                                            </span>
                                        )}
                                    </div>
                                </td>
                            </tr>
                        ))}

                        {/* 无数据状态 */}
                        {!isLoading && filteredAgents.length === 0 && (
                            <tr>
                                <td colSpan="7"
                                    className="px-6 py-12 text-center text-sm text-gray-500 dark:text-gray-400">
                                    {agents.length === 0 ? (
                                        <div className="flex flex-col items-center">
                                            <p className="mb-2">暂无代理数据</p>
                                            <Button
                                                variant="primary"
                                                size="sm"
                                                onClick={() => {
                                                    // 可以在这里添加添加代理的逻辑
                                                }}
                                            >
                                                <Plus className="w-4 h-4 mr-1"/>
                                                添加第一个代理
                                            </Button>
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
                                </td>
                            </tr>
                        )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
}
