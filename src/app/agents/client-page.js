'use client';

// src/app/agents/client-page.js
import {useState, useEffect} from 'react';
import {formatDistanceToNow} from 'date-fns';
import Link from 'next/link';
import Button from '@/components/ui/Button';
import {Eye, Plus, RefreshCw, Trash2} from 'lucide-react';
import {useApp} from '@/app/contexts/AppContext';

export default function AgentsClientPage({initialAgents}) {
    const [agents, setAgents] = useState(initialAgents || []);
    const [searchTerm, setSearchTerm] = useState('');
    const [statusFilter, setStatusFilter] = useState('all');
    const [isLoading, setIsLoading] = useState(false);
    const [deleteLoading, setDeleteLoading] = useState(null);
    const {deleteAgent, autoRefresh, toggleAutoRefresh, fetchAgents} = useApp();

    // 添加自动刷新功能的副作用
    useEffect(() => {
        if (!autoRefresh) return;

        console.log('设置自动刷新定时器');
        // 设置定时刷新
        const intervalId = setInterval(refreshAgents, 15000); // 每15秒刷新一次

        // 清理函数
        return () => {
            console.log('清除自动刷新定时器');
            clearInterval(intervalId);
        };
    }, [autoRefresh]); // 只在 autoRefresh 变化时重新设置

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

    // 刷新代理数据
    const refreshAgents = async () => {
        try {
            setIsLoading(true);
            console.log('手动刷新代理数据');
            const response = await fetch('/api/agents');
            if (response.ok) {
                const data = await response.json();
                setAgents(data);
            }
        } catch (error) {
            console.error('Failed to refresh agents:', error);
        } finally {
            setIsLoading(false);
        }
    };

    // 删除代理
    const handleDeleteAgent = async (agentId) => {
        if (!confirm('确定要删除此代理吗？此操作不可撤销。')) {
            return;
        }

        try {
            setDeleteLoading(agentId);
            await deleteAgent(agentId);
            // 更新本地状态，移除已删除的代理
            setAgents(prevAgents => prevAgents.filter(agent => agent._id !== agentId));
        } catch (error) {
            console.error('删除代理失败:', error);
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

    return (
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
            <header className="mb-6 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <h1 className="text-2xl font-bold text-gray-800">代理管理</h1>
                <Button variant="primary">
                    <Plus className="w-4 h-4 mr-1"/>
                    添加新代理
                </Button>
            </header>

            {/* 代理过滤和搜索 */}
            <div className="mb-6 bg-white p-5 rounded-lg shadow-sm">
                <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-end">
                    <div className="md:col-span-5">
                        <div className="mb-4 md:mb-0">
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
                    </div>
                    <div className="md:col-span-3">
                        <div className="mb-4 md:mb-0">
                            <label htmlFor="status" className="block text-sm font-medium text-gray-700 mb-1">
                                状态
                            </label>
                            <select
                                id="status"
                                value={statusFilter}
                                onChange={handleStatusChange}
                                className="w-full rounded-md border border-gray-300 shadow-sm px-3 py-2 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 bg-white disabled:bg-gray-100 disabled:text-gray-500"
                            >
                                <option value="all">全部</option>
                                <option value="online">在线</option>
                                <option value="offline">离线</option>
                            </select>
                        </div>
                    </div>
                    <div className="md:col-span-4 flex flex-row justify-end items-center gap-3">
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
                            disabled={isLoading}
                            className="inline-flex items-center px-3 py-2 text-sm font-medium text-gray-700 bg-gray-50 rounded border border-gray-300 hover:bg-gray-100 disabled:opacity-50"
                        >
                            <RefreshCw className={`w-4 h-4 mr-2 ${isLoading ? 'animate-spin' : ''}`}/>
                            {isLoading ? '加载中...' : '刷新'}
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
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">网站</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">最后心跳</th>
                            <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">操作</th>
                        </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-gray-200">
                        {filteredAgents.map(agent => (
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
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{agent.version || '未知'}</td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{agent.stats?.websites || 0}</td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                    {agent.lastHeartbeat
                                        ? formatDistanceToNow(new Date(agent.lastHeartbeat), {addSuffix: true})
                                        : '未知'}
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-right">
                                    <div className="flex justify-end space-x-4">
                                        <Link
                                            href={`/agents/${agent._id}`}
                                            className="text-blue-600 hover:text-blue-900 inline-flex items-center"
                                        >
                                            <Eye className="w-4 h-4 mr-2"/>
                                            详情
                                        </Link>
                                        <button
                                            onClick={() => handleDeleteAgent(agent._id)}
                                            disabled={deleteLoading === agent._id}
                                            className="text-red-600 hover:text-red-900 inline-flex items-center"
                                        >
                                            <Trash2
                                                className={`w-4 h-4 mr-2 ${deleteLoading === agent._id ? 'animate-spin' : ''}`}/>
                                            {deleteLoading === agent._id ? '删除中...' : '删除'}
                                        </button>
                                    </div>
                                </td>
                            </tr>
                        ))}
                        {filteredAgents.length === 0 && (
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
