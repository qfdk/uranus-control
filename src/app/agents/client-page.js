'use client';

// src/app/agents/client-page.js
import {useCallback, useEffect, useState} from 'react';
import {formatDistanceToNow} from 'date-fns';
import Button from '@/components/ui/Button';
import NavLink from '@/components/ui/NavLink';
import {Eye, Plus, RefreshCw, Trash2} from 'lucide-react';
import {useApp} from '@/app/contexts/AppContext';
import {useAuth} from '@/app/contexts/AuthContext';
import {useLoading} from '@/app/contexts/LoadingContext';
import {usePathname} from 'next/navigation';
import {useAsyncLoading} from '@/lib/loading-hooks';

export default function AgentsClientPage({initialAgents}) {
    const [agents, setAgents] = useState(initialAgents || []);
    const [searchTerm, setSearchTerm] = useState('');
    const [statusFilter, setStatusFilter] = useState('all');
    const [deleteLoading, setDeleteLoading] = useState(null);
    const [localLoading, setLocalLoading] = useState(false); // 新增本地加载状态
    const {deleteAgent, autoRefresh, toggleAutoRefresh, agents: contextAgents} = useApp();
    const {logout} = useAuth();
    const pathname = usePathname();
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

    // 刷新代理数据 - 使用useCallback包装
    const refreshAgents = useCallback(async () => {
        try {
            // 使用本地加载状态代替全局加载状态
            setLocalLoading(true);
            console.log('刷新代理数据');
            const response = await fetch('/api/agents');

            if (response.status === 401) {
                // 如果返回401未授权，说明会话过期，需要重新登录
                alert('会话已过期，请重新登录');
                logout();
                return;
            }

            if (!response.ok) {
                throw new Error(`服务器返回错误: ${response.status}`);
            }

            const data = await response.json();
            console.log('获取到新数据:', data.length);
            setAgents(data);
        } catch (error) {
            console.error('Failed to refresh agents:', error);
            if (!autoRefresh) { // 只在手动刷新时显示错误通知
                alert(`刷新代理列表失败: ${error.message}`);
            }
        } finally {
            setLocalLoading(false);
        }
    }, [logout, autoRefresh]);

    // 组件挂载时刷新数据
    useEffect(() => {
        if (isMounted) {
            console.log('组件挂载，立即获取最新数据');
            refreshAgents();
        }
    }, [isMounted, refreshAgents]);

    // 路径变化时刷新数据
    useEffect(() => {
        if (isMounted && pathname === '/agents') {
            console.log('路径变化，刷新数据:', pathname);
            refreshAgents();
        }
    }, [pathname, refreshAgents, isMounted]);

    // 当上下文中的agents变化时，更新本地状态
    useEffect(() => {
        if (isMounted && contextAgents && contextAgents.length > 0) {
            console.log('上下文agents变化，更新本地状态', contextAgents?.length);
            setAgents(contextAgents);
        }
    }, [contextAgents, isMounted]);

    // 添加自动刷新功能的副作用
    useEffect(() => {
        if (!isMounted || !autoRefresh) return;

        console.log('设置自动刷新定时器');
        // 设置定时刷新
        const intervalId = setInterval(() => {
            console.log('自动刷新触发');
            refreshAgents();
        }, 15000); // 每15秒刷新一次

        // 清理函数
        return () => {
            console.log('清除自动刷新定时器');
            clearInterval(intervalId);
        };
    }, [autoRefresh, refreshAgents, isMounted]); // 包含refreshAgents作为依赖

    // 用于客户端过滤的逻辑
    const filteredAgents = agents.filter(agent => {
        // 状态过滤
        if (statusFilter === 'online' && !agent.online) return false;
        if (statusFilter === 'offline' && agent.online) return false;

        // 搜索过滤
        if (searchTerm) {
            const search = searchTerm.toLowerCase();
            return (agent.hostname && agent.hostname.toLowerCase().includes(search)) ||
                (agent.ip && agent.ip.toLowerCase().includes(search));
        }

        return true;
    });

    // 删除代理
    const handleDeleteAgent = async (agentId) => {
        if (!confirm('确定要删除此代理吗？此操作不可撤销。')) {
            return;
        }

        try {
            setDeleteLoading(agentId);
            await withLoading(async () => {
                await deleteAgent(agentId);
                // 更新本地状态，移除已删除的代理
                setAgents(prevAgents => prevAgents.filter(agent => agent._id !== agentId));
            });
        } catch (error) {
            console.error('删除代理失败:', error);

            // 检查是否是认证失败
            if (error.message && error.message.includes('401')) {
                alert('会话已过期，请重新登录');
                logout();
                return;
            }

            alert('删除代理失败，请重试');
        } finally {
            setDeleteLoading(null);
        }
    };

    const handleSearchChange = (e) => {
        setSearchTerm(e.target.value);
    };

    const handleStatusChange = (e) => {
        setStatusFilter(e.target.value);
    };

    // 如果组件还未挂载，返回null依赖全局加载状态
    if (!isMounted) {
        return null;
    }

    return (
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
            <header className="mb-6 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <h1 className="text-2xl font-bold text-gray-800">代理管理</h1>
            </header>

            {/* 代理过滤和搜索 */}
            <div className="mb-6 bg-white p-5 rounded-lg shadow-sm">
                <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
                    {/* 搜索框 */}
                    <div className="md:col-span-4">
                        <label htmlFor="search" className="block text-sm font-medium text-gray-700 mb-1">
                            搜索
                        </label>
                        <input
                            type="text"
                            id="search"
                            value={searchTerm}
                            onChange={handleSearchChange}
                            placeholder="搜索代理名称或IP地址..."
                            className="w-full rounded-md border border-gray-300 shadow-sm px-3 py-2 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                        />
                    </div>

                    {/* 状态选择 - 修改后的下拉框 */}
                    <div className="md:col-span-3">
                        <label htmlFor="status" className="block text-sm font-medium text-gray-700 mb-1">
                            状态
                        </label>
                        <div className="relative">
                            <select
                                id="status"
                                value={statusFilter}
                                onChange={handleStatusChange}
                                className="appearance-none w-full rounded-md border border-gray-300 shadow-sm px-3 py-2 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 bg-white disabled:bg-gray-100 disabled:text-gray-500 pr-8"
                            >
                                <option value="all">全部</option>
                                <option value="online">在线</option>
                                <option value="offline">离线</option>
                            </select>
                            <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-gray-700">
                                <svg className="fill-current h-4 w-4" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20">
                                    <path d="M9.293 12.95l.707.707L15.657 8l-1.414-1.414L10 10.828 5.757 6.586 4.343 8z" />
                                </svg>
                            </div>
                        </div>
                    </div>

                    {/* 按钮组 */}
                    <div className="md:col-span-5 flex justify-end items-end gap-3">
                        <button
                            onClick={toggleAutoRefresh}
                            className={`inline-flex items-center px-3 py-2 text-sm font-medium rounded ${
                                autoRefresh
                                    ? 'bg-green-50 text-green-700 border border-green-300'
                                    : 'bg-gray-50 text-gray-700 border border-gray-300'
                            }`}
                        >
                            <span
                                className={`inline-block w-2 h-2 rounded-full mr-2 ${autoRefresh ? 'bg-green-500 animate-pulse' : 'bg-gray-400'}`}>
                            </span>
                            自动刷新
                        </button>
                        <button
                            onClick={refreshAgents}
                            disabled={localLoading}
                            className="inline-flex items-center px-3 py-2 text-sm font-medium text-gray-700 bg-gray-50 rounded border border-gray-300 hover:bg-gray-100 disabled:opacity-50 transition-colors duration-200 min-w-[90px] justify-center"
                        >
                            {localLoading ? (
                                <>
                                    <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-gray-700"
                                         xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor"
                                                strokeWidth="4"></circle>
                                        <path className="opacity-75" fill="currentColor"
                                              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                    </svg>
                                    加载中
                                </>
                            ) : (
                                <>
                                    <RefreshCw className="w-4 h-4 mr-2"/>
                                    刷新
                                </>
                            )}
                        </button>
                    </div>
                </div>
            </div>

            {/* 代理列表 */}
            <div className="bg-white rounded-lg shadow overflow-hidden">
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
                        {/* 表格加载状态 */}
                        {localLoading && filteredAgents.length === 0 && (
                            <tr>
                                <td colSpan="7" className="px-6 py-12 text-center">
                                    <div className="flex flex-col items-center">
                                        <svg className="animate-spin h-8 w-8 text-blue-500 mb-3" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                        </svg>
                                        <p className="text-gray-500">正在加载代理数据...</p>
                                    </div>
                                </td>
                            </tr>
                        )}
                        {!localLoading && filteredAgents.map(agent => (
                            <tr key={agent._id} className="hover:bg-gray-50">
                                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{agent.hostname || '未命名代理'}</td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{agent.ip}</td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm">
                                    <span
                                        className={`px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full ${
                                            agent.online
                                                ? 'bg-green-100 text-green-800'
                                                : 'bg-red-100 text-red-800'
                                        }`}>
                                        {agent.online ? '在线' : `离线`}
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
                                    <div className="flex justify-end space-x-4">
                                        <NavLink
                                            href={`/agents/${agent._id}`}
                                            className="text-blue-600 hover:text-blue-900 inline-flex items-center"
                                        >
                                            <Eye className="w-4 h-4 mr-2"/>
                                            详情
                                        </NavLink>
                                        <button
                                            onClick={() => handleDeleteAgent(agent._id)}
                                            disabled={deleteLoading === agent._id}
                                            className="text-red-600 hover:text-red-900 inline-flex items-center"
                                        >
                                            {deleteLoading === agent._id ? (
                                                <>
                                                    <svg className="animate-spin h-4 w-4 mr-2 text-red-600"
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
                                    </div>
                                </td>
                            </tr>
                        ))}
                        {!localLoading && filteredAgents.length === 0 && (
                            <tr>
                                <td colSpan="7" className="px-6 py-12 text-center text-sm text-gray-500">
                                    {agents.length === 0 ? (
                                        <div className="flex flex-col items-center">
                                            <p className="mb-2">暂无代理数据</p>
                                            <Button
                                                variant="primary"
                                                size="sm"
                                                onClick={() => {
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
