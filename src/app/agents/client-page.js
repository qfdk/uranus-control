'use client';

import {useCallback, useEffect, useMemo, useRef, useState} from 'react';
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

    // MQTT集成
    const {connected: mqttConnected, agentState} = useMqttClient();

    // 跟踪上一次的MQTT代理数量
    const prevMqttAgentCount = useRef(0);

    // 组件挂载处理
    useEffect(() => {
        setIsMounted(true);
        // 停止全局加载当组件挂载时
        const timer = setTimeout(() => {
            stopLoading();
        }, 300);

        return () => clearTimeout(timer);
    }, [stopLoading]);

    // 合并代理数据（HTTP和MQTT）
    const combinedAgents = useMemo(() => {
        if (!isMounted) return [];

        console.log('合并代理数据：',
            `HTTP代理：${agents.length}个`,
            `MQTT状态：${mqttConnected ? Object.keys(agentState).length + '个' : '未连接'}`
        );

        // 调用工具函数处理代理数据
        return combineAgentData(agents, agentState, mqttConnected);
    }, [agents, mqttConnected, agentState, isMounted]);

    // 刷新代理数据
    const refreshAgents = useCallback(async () => {
        try {
            setIsLoading(true);
            console.log('刷新代理数据');
            const response = await fetch('/api/agents');

            if (response.status === 401) {
                // 处理未授权响应
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

    // 初始数据加载
    useEffect(() => {
        if (isMounted) {
            // 初始加载
            refreshAgents();
        }
    }, [isMounted, refreshAgents]);

    // 监控MQTT代理状态变化
    useEffect(() => {
        if (mqttConnected && agentState && isMounted) {
            const mqttAgentCount = Object.keys(agentState).length;
            const httpAgentCount = agents.length;

            console.log(`MQTT状态更新: MQTT代理=${mqttAgentCount}个, HTTP代理=${httpAgentCount}个`);

            // 只有当MQTT代理数量大于HTTP代理数量时才刷新（表示有新代理）
            if (mqttAgentCount > httpAgentCount && prevMqttAgentCount.current !== mqttAgentCount) {
                console.log(`发现新代理: MQTT=${mqttAgentCount}, HTTP=${httpAgentCount}, 执行刷新`);
                refreshAgents();
            }

            // 无论如何都更新上一次的计数
            prevMqttAgentCount.current = mqttAgentCount;
        }
    }, [mqttConnected, agentState, refreshAgents, isMounted, agents.length]);

    // 路径变化处理
    useEffect(() => {
        if (isMounted && pathname === '/agents') {
            console.log('路径变化，刷新数据:', pathname);
            refreshAgents();
        }
    }, [pathname, refreshAgents, isMounted]);

    // 上下文代理更新处理
    useEffect(() => {
        if (isMounted && contextAgents && contextAgents.length > 0) {
            console.log('上下文agents变化，更新本地状态', contextAgents?.length);
            setAgents(contextAgents);
        }
    }, [contextAgents, isMounted]);

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
            return;
        }

        try {
            setDeleteLoading(agentId);
            await withLoading(async () => {
                await deleteAgent(agentId);
                // 更新本地状态删除代理
                setAgents(prevAgents => prevAgents.filter(agent => agent._id !== agentId));
            });
        } catch (error) {
            console.error('删除代理失败:', error);

            // 检查是否认证失败
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

    // 添加一个函数处理注册MQTT代理
    const handleRegisterAgent = async (agent) => {
        try {
            setRegistrationLoading(agent.uuid);

            // 准备代理数据注册
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
                // 使用AppContext中的addAgent函数
                await addAgent(agentData);

                // 刷新代理列表显示新注册的代理
                await refreshAgents();
            });

        } catch (error) {
            console.error('注册代理失败:', error);

            // 检查是否认证失败
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
                        {isLoading && <TableSpinner/>}

                        {!isLoading && filteredAgents.length > 0 && filteredAgents.map(agent => (
                            <tr key={agent._id || agent.uuid}
                                className={`hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors ${agent._mqttOnly ? 'bg-blue-50 dark:bg-blue-900/20' : ''}`}>
                                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 dark:text-white">
                                    {agent.hostname || '未命名代理'}
                                    {agent._mqttOnly && (
                                        <span
                                            className="ml-2 px-2 py-0.5 text-xs rounded-full bg-blue-100 text-blue-700 dark:bg-blue-900/50 dark:text-blue-300">
                                            仅MQTT
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
                                        {agent._needsRegistration ? (
                                            // 对于仅MQTT的代理，显示注册按钮
                                            <button
                                                onClick={() => handleRegisterAgent(agent)}
                                                disabled={registrationLoading === agent.uuid}
                                                className="text-green-600 hover:text-green-900 dark:text-green-400 dark:hover:text-green-300 inline-flex items-center"
                                            >
                                                {registrationLoading === agent.uuid ? (
                                                    <>
                                                        <svg
                                                            className="animate-spin h-4 w-4 mr-2 text-green-600 dark:text-green-400"
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
                                            // 对于普通代理，显示常规操作
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
                                        )}
                                    </div>
                                </td>
                            </tr>
                        ))}

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
