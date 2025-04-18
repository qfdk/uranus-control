// src/app/agents/[id]/client-component.js 更新片段
'use client';

import {useEffect, useState} from 'react';
import {formatDistanceToNow} from 'date-fns';
import Link from 'next/link';
import {
    ArrowLeft,
    Cpu,
    Database,
    FileCheck,
    Globe,
    MemoryStick,
    Play,
    RefreshCw,
    RotateCw,
    Server,
    Square,
    Upload,
    XCircle,
    Zap
} from 'lucide-react';
import Button from '@/components/ui/Button';
import {useApp} from '@/app/contexts/AppContext';
import {useMqttClient} from '@/lib/mqtt';
import {useRouter} from 'next/navigation';
import {useLoading} from '@/app/contexts/LoadingContext';
import {useAsyncLoading} from '@/lib/loading-hooks';

export default function AgentDetail({agent: initialAgent}) {
    const router = useRouter();
    const {deleteAgent} = useApp();
    const {stopLoading} = useLoading();
    const {withLoading} = useAsyncLoading();
    const {
        connected: mqttConnected,
        reloadNginx,
        restartNginx,
        stopNginx,
        startNginx,
        upgradeAgent,
        agentState
    } = useMqttClient();

    const [activeTab, setActiveTab] = useState('info');
    const [renderKey, setRenderKey] = useState(0); // 强制重新渲染的辅助状态
    const [isDeleting, setIsDeleting] = useState(false);
    const [isUpgrading, setIsUpgrading] = useState(false);
    const [isCommandExecuting, setIsCommandExecuting] = useState(false);
    const [upgradeMessage, setUpgradeMessage] = useState('');
    const [upgradeError, setUpgradeError] = useState('');
    const [commandResult, setCommandResult] = useState('');
    const [agent, setAgent] = useState(initialAgent);

    // Merge MongoDB agent with MQTT data if available
    useEffect(() => {
        if (mqttConnected && agent && agent.uuid && agentState[agent.uuid]) {
            // 获取MQTT代理数据
            const mqttAgentData = agentState[agent.uuid];

            // 创建合并的代理数据
            const updatedAgent = {
                ...agent, // 保留MongoDB基础数据
                // 更新实时数据
                online: mqttAgentData.online !== undefined ? mqttAgentData.online : agent.online,
                lastHeartbeat: mqttAgentData.lastHeartbeat || agent.lastHeartbeat,
                // 更新系统数据（如果MQTT有提供）
                hostname: agent.hostname || mqttAgentData.hostname,
                ip: agent.ip || mqttAgentData.ip,
                buildVersion: mqttAgentData.buildVersion || agent.buildVersion,
                buildTime: mqttAgentData.buildTime || agent.buildTime,
                commitId: mqttAgentData.commitId || agent.commitId,
                os: mqttAgentData.os || agent.os,
                memory: mqttAgentData.memory || agent.memory,
                _fromMqtt: true // 标记为有MQTT数据
            };

            // 更新代理状态
            setAgent(updatedAgent);
            console.log('代理数据已用MQTT信息更新');
        }
    }, [mqttConnected, agent?.uuid, agentState]);

    // 检查组件挂载和状态变化
    useEffect(() => {
        console.log('AgentDetail组件挂载或状态更新, 当前活动标签:', activeTab);

        // 确保组件完全挂载后停止加载状态
        const timer = setTimeout(() => {
            stopLoading();
        }, 300);

        return () => clearTimeout(timer);
    }, [activeTab, stopLoading]);

    // 切换标签时添加调试和强制重新渲染
    const handleTabChange = (tab) => {
        console.log('切换标签到:', tab, '当前标签:', activeTab);
        setActiveTab(tab);
        // 强制重新渲染以确保状态变化后UI正确更新
        setRenderKey(prev => prev + 1);
    };

    // 删除代理处理函数
    const handleDeleteAgent = async () => {
        if (!confirm('确定要删除此代理吗？此操作不可撤销。')) {
            return;
        }

        try {
            setIsDeleting(true);
            await withLoading(async () => {
                await deleteAgent(agent._id);
                // 删除成功后返回代理列表页
                router.push('/agents');
            });
        } catch (error) {
            console.error('删除代理失败:', error);
            alert('删除代理失败，请重试');
            setIsDeleting(false);
        }
    };

    // 升级代理处理函数
    const handleUpgradeAgent = async () => {
        if (!confirm('确定要升级此代理吗？在升级过程中，代理可能会重启。')) {
            return;
        }

        setUpgradeMessage('');
        setUpgradeError('');

        try {
            setIsUpgrading(true);

            // 如果MQTT已连接，优先使用MQTT发送升级命令
            if (mqttConnected && agent.uuid) {
                await withLoading(async () => {
                    try {
                        const response = await upgradeAgent(agent.uuid);
                        setUpgradeMessage(response.message || '升级请求已发送');
                    } catch (mqttError) {
                        console.error('MQTT升级失败，降级到HTTP升级:', mqttError);
                        // 如果MQTT失败，降级使用HTTP API
                        await fallbackHttpUpgrade();
                    }
                });
            } else {
                // 未连接MQTT，使用HTTP API
                await withLoading(fallbackHttpUpgrade);
            }

            // 升级可能需要一些时间，设置延迟刷新
            setTimeout(async () => {
                try {
                    const refreshResponse = await fetch(`/api/agents/${agent._id}`);
                    if (refreshResponse.ok) {
                        const updatedAgent = await refreshResponse.json();
                        setAgent(updatedAgent);
                    }
                } catch (error) {
                    console.error('刷新代理状态失败:', error);
                }
                setIsUpgrading(false);
            }, 15000); // 15秒后刷新
        } catch (error) {
            console.error('升级代理失败:', error);
            setUpgradeError(error.message || '升级代理失败，请重试');
            setIsUpgrading(false);
        }
    };

    // HTTP升级降级方案
    const fallbackHttpUpgrade = async () => {
        const response = await fetch(`/api/agents/${agent._id}/upgrade`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            }
        });

        if (!response.ok) {
            const data = await response.json();
            throw new Error(data.error || '升级失败');
        }

        const data = await response.json();
        setUpgradeMessage(data.message || '升级请求已发送');
    };

    // 执行Nginx命令
    const executeNginxCommand = async (commandFunction, commandName) => {
        if (isCommandExecuting) return;

        // 重置之前的命令结果
        setCommandResult('');

        try {
            setIsCommandExecuting(true);

            // 如果MQTT已连接，使用MQTT发送命令
            if (mqttConnected && agent.uuid) {
                const response = await commandFunction(agent.uuid);
                setCommandResult(`${commandName}命令执行成功: ${response.message}`);
            } else {
                // 如果MQTT未连接，使用HTTP API
                const response = await fetch(`/api/agents/${agent._id}/command`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({command: commandName.toLowerCase()})
                });

                const data = await response.json();
                setCommandResult(`${commandName}命令执行成功: ${data.message || 'OK'}`);
            }

            // 成功后刷新代理状态
            setTimeout(async () => {
                const refreshResponse = await fetch(`/api/agents/${agent._id}`);
                if (refreshResponse.ok) {
                    const updatedAgent = await refreshResponse.json();
                    setAgent(updatedAgent);
                }
                setIsCommandExecuting(false);
            }, 3000);
        } catch (error) {
            console.error(`${commandName}命令执行失败:`, error);
            setCommandResult(`${commandName}命令执行失败: ${error.message}`);
            setIsCommandExecuting(false);
        }
    };

    if (!agent) {
        return (
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 text-center">
                <h2 className="text-xl font-medium text-gray-900">未找到代理信息</h2>
                <p className="mt-2 text-gray-500">
                    该代理可能不存在或已被删除
                </p>
                <div className="mt-6">
                    <Link href="/agents">
                        <Button variant="secondary">
                            返回代理列表
                        </Button>
                    </Link>
                </div>
            </div>
        );
    }

    return (
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6" key={renderKey}>
            <div className="mb-6">
                <Link href="/agents" className="flex items-center text-blue-600 hover:text-blue-800">
                    <ArrowLeft className="w-4 h-4 mr-1"/>
                    返回代理列表
                </Link>
            </div>

            <header className="mb-6 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-gray-800">{agent.hostname || agent.uuid}</h1>
                    <p className="text-gray-500">UUID: {agent.uuid}</p>
                    <div className="mt-1">
                        <span className={`inline-flex items-center px-2 py-1 text-xs font-medium rounded-full ${
                            agent.online ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                        }`}>
                            <span
                                className={`inline-block w-2 h-2 rounded-full mr-1 ${agent.online ? 'bg-green-500' : 'bg-red-500'}`}></span>
                            {agent.online ? '在线' : '离线'}
                            {agent._fromMqtt && <span className="ml-1">(MQTT实时)</span>}
                        </span>
                    </div>
                </div>
                <div className="flex gap-2">
                    <Button
                        variant="primary"
                        onClick={handleUpgradeAgent}
                        disabled={isUpgrading || !agent.online}
                    >
                        <Upload className={`w-4 h-4 mr-1 ${isUpgrading ? 'animate-spin' : ''}`}/>
                        {isUpgrading ? '升级中...' : '升级代理'}
                    </Button>
                    <Button
                        variant="danger"
                        onClick={handleDeleteAgent}
                        disabled={isDeleting}
                    >
                        <XCircle className={`w-4 h-4 mr-1 ${isDeleting ? 'animate-spin' : ''}`}/>
                        {isDeleting ? '删除中...' : '删除代理'}
                    </Button>
                </div>
            </header>

            {/* Nginx 控制按钮 */}
            {agent.online && (
                <div className="mb-6 bg-white rounded-lg shadow p-4">
                    <h3 className="text-lg font-medium mb-3">Nginx 控制</h3>
                    <div className="flex flex-wrap gap-2">
                        <Button
                            variant="secondary"
                            onClick={() => executeNginxCommand(reloadNginx, '重载')}
                            disabled={isCommandExecuting}
                        >
                            <RotateCw className="w-4 h-4 mr-1"/>
                            重载配置
                        </Button>
                        <Button
                            variant="secondary"
                            onClick={() => executeNginxCommand(restartNginx, '重启')}
                            disabled={isCommandExecuting}
                        >
                            <RefreshCw className="w-4 h-4 mr-1"/>
                            重启服务
                        </Button>
                        <Button
                            variant="secondary"
                            onClick={() => executeNginxCommand(stopNginx, '停止')}
                            disabled={isCommandExecuting}
                        >
                            <Square className="w-4 h-4 mr-1"/>
                            停止服务
                        </Button>
                        <Button
                            variant="secondary"
                            onClick={() => executeNginxCommand(startNginx, '启动')}
                            disabled={isCommandExecuting}
                        >
                            <Play className="w-4 h-4 mr-1"/>
                            启动服务
                        </Button>
                    </div>

                    {/* 命令执行结果 */}
                    {commandResult && (
                        <div className="mt-3 p-3 bg-gray-50 rounded-md text-sm">
                            {commandResult}
                        </div>
                    )}
                </div>
            )}

            {/* 升级消息显示 */}
            {upgradeMessage && (
                <div className="mb-6 bg-green-50 border-l-4 border-green-500 p-4">
                    <div className="flex">
                        <div className="flex-shrink-0">
                            <svg className="h-5 w-5 text-green-400" xmlns="http://www.w3.org/2000/svg"
                                 viewBox="0 0 20 20" fill="currentColor">
                                <path fillRule="evenodd"
                                      d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                                      clipRule="evenodd"/>
                            </svg>
                        </div>
                        <div className="ml-3">
                            <p className="text-sm text-green-700">{upgradeMessage}</p>
                        </div>
                    </div>
                </div>
            )}

            {/* 升级错误显示 */}
            {upgradeError && (
                <div className="mb-6 bg-red-50 border-l-4 border-red-500 p-4">
                    <div className="flex">
                        <div className="flex-shrink-0">
                            <svg className="h-5 w-5 text-red-400" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20"
                                 fill="currentColor">
                                <path fillRule="evenodd"
                                      d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
                                      clipRule="evenodd"/>
                            </svg>
                        </div>
                        <div className="ml-3">
                            <p className="text-sm text-red-700">{upgradeError}</p>
                        </div>
                    </div>
                </div>
            )}

            {/* 状态卡片 */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
                <div
                    className="bg-white rounded-lg border border-gray-200 shadow-sm p-4 transition-shadow hover:shadow">
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-sm text-gray-500 mb-1">状态</p>
                            <p className="text-xl font-bold flex items-center">
                                <span
                                    className={`inline-block w-3 h-3 rounded-full mr-2 ${agent.online ? 'bg-green-500' : 'bg-red-500'}`}></span>
                                {agent.online ? '在线' : '离线'}
                            </p>
                            <p className="text-xs text-gray-500 mt-1">
                                最后心跳: {agent.lastHeartbeat
                                ? formatDistanceToNow(new Date(agent.lastHeartbeat), {addSuffix: true})
                                : '未知'}
                            </p>
                        </div>
                        <div className="bg-blue-50 p-3 rounded-full">
                            <Server className="w-6 h-6 text-blue-500"/>
                        </div>
                    </div>
                </div>

                <div
                    className="bg-white rounded-lg border border-gray-200 shadow-sm p-4 transition-shadow hover:shadow">
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-sm text-gray-500 mb-1">网站</p>
                            <p className="text-xl font-bold">{agent.stats?.websites || 0}</p>
                            <p className="text-xs text-gray-500 mt-1">托管站点数量</p>
                        </div>
                        <div className="bg-green-50 p-3 rounded-full">
                            <Globe className="w-6 h-6 text-green-500"/>
                        </div>
                    </div>
                </div>

                <div
                    className="bg-white rounded-lg border border-gray-200 shadow-sm p-4 transition-shadow hover:shadow">
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-sm text-gray-500 mb-1">SSL证书</p>
                            <p className="text-xl font-bold">{agent.stats?.certificates || 0}</p>
                            <p className="text-xs text-gray-500 mt-1">有效证书数量</p>
                        </div>
                        <div className="bg-purple-50 p-3 rounded-full">
                            <FileCheck className="w-6 h-6 text-purple-500"/>
                        </div>
                    </div>
                </div>
            </div>

            {/* 信息标签页导航 */}
            <div className="mb-4 border-b border-gray-200">
                <nav className="flex -mb-px space-x-8 overflow-x-auto" aria-label="Tabs">
                    <button
                        type="button"
                        onClick={() => handleTabChange('info')}
                        className={`py-4 px-1 border-b-2 font-medium text-sm ${
                            activeTab === 'info'
                                ? 'border-blue-500 text-blue-600'
                                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                        }`}
                    >
                        系统信息
                    </button>
                </nav>
            </div>

            <div className="grid grid-cols-1 gap-6">
                {/* 系统信息面板 */}
                {activeTab === 'info' && (
                    <div className="bg-white rounded-lg shadow">
                        <div className="p-4 space-y-4">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div className="flex items-start">
                                    <div className="bg-gray-100 p-2 rounded-md mr-3">
                                        <Cpu className="w-5 h-5 text-gray-500"/>
                                    </div>
                                    <div>
                                        <p className="text-sm text-gray-500">操作系统</p>
                                        <p className="text-sm font-medium">{agent.os || '未知'}</p>
                                    </div>
                                </div>

                                <div className="flex items-start">
                                    <div className="bg-gray-100 p-2 rounded-md mr-3">
                                        <MemoryStick className="w-5 h-5 text-gray-500"/>
                                    </div>
                                    <div>
                                        <p className="text-sm text-gray-500">内存</p>
                                        <p className="text-sm font-medium">{agent.memory || '未知'}</p>
                                    </div>
                                </div>

                                <div className="flex items-start">
                                    <div className="bg-gray-100 p-2 rounded-md mr-3">
                                        <Database className="w-5 h-5 text-gray-500"/>
                                    </div>
                                    <div>
                                        <p className="text-sm text-gray-500">IP地址</p>
                                        <p className="text-sm font-medium">{agent.ip || '未知'}</p>
                                    </div>
                                </div>

                                <div className="flex items-start">
                                    <div className="bg-gray-100 p-2 rounded-md mr-3">
                                        <Zap className="w-5 h-5 text-gray-500"/>
                                    </div>
                                    <div>
                                        <p className="text-sm text-gray-500">版本</p>
                                        <p className="text-sm font-medium">{agent.buildVersion || '未知'}</p>
                                    </div>
                                </div>
                            </div>

                            <div className="pt-2 border-t border-gray-100">
                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <p className="text-sm text-gray-500">构建时间</p>
                                        <p className="text-sm font-medium">{agent.buildTime || '未知'}</p>
                                    </div>
                                    <div>
                                        <p className="text-sm text-gray-500">提交ID</p>
                                        <p className="text-sm font-medium">{agent.commitId ? agent.commitId.substring(0, 8) : '未知'}</p>
                                    </div>
                                </div>
                            </div>

                            {/* MQTT连接状态显示 */}
                            <div className="pt-2 border-t border-gray-100">
                                <div>
                                    <p className="text-sm text-gray-500">MQTT连接状态</p>
                                    <p className="text-sm font-medium flex items-center">
                                        <span
                                            className={`inline-block w-2 h-2 rounded-full mr-2 ${mqttConnected ? 'bg-green-500' : 'bg-gray-400'}`}></span>
                                        {mqttConnected ? 'MQTT已连接' : 'MQTT未连接 (使用HTTP API)'}
                                    </p>
                                </div>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
