'use client';

import {useCallback, useEffect, useMemo, useState} from 'react';
import {formatDistanceToNow} from 'date-fns';
import {Eye, Plus, PlusCircle, Trash2} from 'lucide-react';
import Button from '@/components/ui/Button';
import NavLink from '@/components/ui/NavLink';
import {useApp} from '@/app/contexts/AppContext';
import {useAuth} from '@/app/contexts/AuthContext';
import {useLoading} from '@/app/contexts/LoadingContext';
import {usePathname} from 'next/navigation';
import {useAsyncLoading} from '@/lib/loading-hooks';
import {useMqttClient} from '@/lib/mqtt';
import TableSpinner from '@/components/ui/TableSpinner';
import {combineAgentData} from '@/lib/agent-utils.js';

export default function AgentsClientPage() {
    const [agents, setAgents] = useState([]);
    const [searchTerm, setSearchTerm] = useState('');
    const [statusFilter, setStatusFilter] = useState('all');
    const [deleteLoading, setDeleteLoading] = useState(null);
    const [registrationLoading, setRegistrationLoading] = useState(null);
    const [isLoading, setIsLoading] = useState(false);
    const {deleteAgent, agents: contextAgents, addAgent} = useApp();
    const {logout} = useAuth();
    const pathname = usePathname();
    const {stopLoading} = useLoading();
    const {withLoading} = useAsyncLoading();
    const [isMounted, setIsMounted] = useState(false);

    // MQTT integration
    const {connected: mqttConnected, agentState} = useMqttClient();

    // Component mount handler
    useEffect(() => {
        setIsMounted(true);
        // Stop global loading when component is mounted
        const timer = setTimeout(() => {
            stopLoading();
        }, 300);

        return () => clearTimeout(timer);
    }, [stopLoading]);

    // Agents data that combines HTTP and MQTT data
    const combinedAgents = useMemo(() => {
        if (!isMounted) return [];

        // 调用共用函数处理代理数据
        return combineAgentData(agents, agentState, mqttConnected);
    }, [agents, mqttConnected, agentState, isMounted]);

    // Refresh agents data
    const refreshAgents = useCallback(async () => {
        try {
            setIsLoading(true);
            console.log('刷新代理数据');
            const response = await fetch('/api/agents');

            if (response.status === 401) {
                // Handle unauthorized response
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
            console.error('刷新代理数据失败:', error);
        } finally {
            setIsLoading(false);
        }
    }, [logout]);

    // Initial data loading
    useEffect(() => {
        if (isMounted) {
            // 初始加载
            refreshAgents();

            // 设置定期刷新
            const pollingInterval = setInterval(() => {
                console.log('定时轮询刷新代理列表');
                refreshAgents();
            }, 5000); // 每5秒刷新一次

            return () => clearInterval(pollingInterval);
        }
    }, [isMounted, refreshAgents]);

    // Path change handler
    useEffect(() => {
        if (isMounted && pathname === '/agents') {
            console.log('路径变化，刷新数据:', pathname);
            refreshAgents();
        }
    }, [pathname, refreshAgents, isMounted]);

    // Context agents update handler
    useEffect(() => {
        if (isMounted && contextAgents && contextAgents.length > 0) {
            console.log('上下文agents变化，更新本地状态', contextAgents?.length);
            setAgents(contextAgents);
        }
    }, [contextAgents, isMounted]);

    // Filter agents
    const filteredAgents = combinedAgents.filter(agent => {
        // Status filter
        if (statusFilter === 'online' && !agent.online) return false;
        if (statusFilter === 'offline' && agent.online) return false;

        // Search filter
        if (searchTerm) {
            const search = searchTerm.toLowerCase();
            return (agent.hostname && agent.hostname.toLowerCase().includes(search)) ||
                (agent.ip && agent.ip.toLowerCase().includes(search));
        }

        return true;
    });

    // Delete agent handler
    const handleDeleteAgent = async (agentId) => {
        if (!confirm('确定要删除此代理吗？此操作不可撤销。')) {
            return;
        }

        try {
            setDeleteLoading(agentId);
            await withLoading(async () => {
                await deleteAgent(agentId);
                // Update local state to remove deleted agent
                setAgents(prevAgents => prevAgents.filter(agent => agent._id !== agentId));
            });
        } catch (error) {
            console.error('删除代理失败:', error);

            // Check if authentication failed
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

    // Add this function to handle registering MQTT-only agents
    const handleRegisterAgent = async (agent) => {
        try {
            setRegistrationLoading(agent.uuid);

            // Prepare the agent data for registration
            const agentData = {
                uuid: agent.uuid,
                hostname: agent.hostname || 'New Agent',
                ip: agent.ip || '',
                online: agent.online || false,
                buildVersion: agent.buildVersion || '',
                buildTime: agent.buildTime || '',
                commitId: agent.commitId || '',
                os: agent.os || '',
                memory: agent.memory || '',
                lastHeartbeat: agent.lastHeartbeat || new Date()
            };

            await withLoading(async () => {
                // Use the addAgent function from AppContext
                await addAgent(agentData);

                // Refresh the agents list to show the new registered agent
                await refreshAgents();
            });

        } catch (error) {
            console.error('注册代理失败:', error);

            // Check if authentication failed
            if (error.message && error.message.includes('401')) {
                alert('会话已过期，请重新登录');
                logout();
                return;
            }

            alert('注册代理失败，请重试');
        } finally {
            setRegistrationLoading(null);
        }
    };

    const handleSearchChange = (e) => {
        setSearchTerm(e.target.value);
    };

    const handleStatusChange = (e) => {
        setStatusFilter(e.target.value);
    };

    // If component is not mounted yet, rely on global loading state
    if (!isMounted) {
        return null;
    }

    return (
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
            <header className="mb-6 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <h1 className="text-2xl font-bold text-gray-800">
                    代理管理
                    {mqttConnected && (
                        <span className="ml-2 text-xs text-blue-500">(MQTT实时)</span>
                    )}
                </h1>
            </header>

            {/* Search and filtering */}
            <div className="mb-6 bg-white p-5 rounded-lg shadow-sm">
                <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
                    {/* Search field */}
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

                    {/* Status dropdown */}
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
                            <div
                                className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-gray-700">
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

            {/* Agents list */}
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
                        {isLoading && <TableSpinner/>}

                        {!isLoading && filteredAgents.length > 0 && filteredAgents.map(agent => (
                            <tr key={agent._id || agent.uuid}
                                className={`hover:bg-gray-50 ${agent._mqttOnly ? 'bg-blue-50' : ''}`}>
                                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                                    {agent.hostname || '未命名代理'}
                                    {agent._mqttOnly && (
                                        <span
                                            className="ml-2 px-2 py-0.5 text-xs rounded-full bg-blue-100 text-blue-700">
                                            仅MQTT
                                        </span>
                                    )}
                                </td>
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
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                    {agent.buildVersion || '未知'}
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                    {agent.commitId ? agent.commitId.substring(0, 8) : '未知'}
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                    {agent.lastHeartbeat
                                        ? formatDistanceToNow(new Date(agent.lastHeartbeat), {addSuffix: true})
                                        : '未知'}
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-right">
                                    <div className="flex justify-end space-x-4">
                                        {agent._needsRegistration ? (
                                            // For MQTT-only agents, show register button
                                            <button
                                                onClick={() => handleRegisterAgent(agent)}
                                                disabled={registrationLoading === agent.uuid}
                                                className="text-green-600 hover:text-green-900 inline-flex items-center"
                                            >
                                                {registrationLoading === agent.uuid ? (
                                                    <>
                                                        <svg className="animate-spin h-4 w-4 mr-2 text-green-600"
                                                             xmlns="http://www.w3.org/2000/svg" fill="none"
                                                             viewBox="0 0 24 24">
                                                            <circle className="opacity-25" cx="12" cy="12" r="10"
                                                                    stroke="currentColor" strokeWidth="4"></circle>
                                                            <path className="opacity-75" fill="currentColor"
                                                                  d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                                        </svg>
                                                        注册中...
                                                    </>
                                                ) : (
                                                    <>
                                                        <PlusCircle className="w-4 h-4 mr-2"/>
                                                        注册代理
                                                    </>
                                                )}
                                            </button>
                                        ) : (
                                            // For regular agents, show normal actions
                                            <>
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
                                            </>
                                        )}
                                    </div>
                                </td>
                            </tr>
                        ))}

                        {!isLoading && filteredAgents.length === 0 && (
                            <tr>
                                <td colSpan="7" className="px-6 py-12 text-center text-sm text-gray-500">
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
