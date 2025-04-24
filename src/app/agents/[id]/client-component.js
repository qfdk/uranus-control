'use client';

import React from 'react';
import {useCallback, useEffect, useRef, useState} from 'react';
import {formatDistanceToNow} from 'date-fns';
import Link from 'next/link';
import {
    ArrowLeft,
    Clock,
    Cpu,
    HardDrive,
    Info,
    Play,
    RefreshCw,
    RotateCw,
    Server,
    Square,
    TerminalSquare,
    Upload,
    XCircle
} from 'lucide-react';
import Button from '@/components/ui/Button';
import StatusMessage from '@/components/ui/StatusMessage';
import {useRouter} from 'next/navigation';
import {useAsyncLoading} from '@/lib/loading-hooks';
import {useClientMount} from '@/hooks/useClientMount';
import TerminalComponent from '@/components/ui/Terminal';
import useAgentStore from '@/store/agentStore';
import useMqttStore from '@/store/mqttStore';

// 错误边界组件
class ErrorBoundary extends React.Component {
    constructor(props) {
        super(props);
        this.state = { hasError: false };
    }

    static getDerivedStateFromError(error) {
        return { hasError: true };
    }

    componentDidCatch(error, errorInfo) {
        console.error("终端组件错误:", error, errorInfo);
    }

    render() {
        if (this.state.hasError) {
            return this.props.fallback;
        }

        return this.props.children;
    }
}

export default function AgentDetail({agent: initialAgent}) {
    const router = useRouter();
    const {withLoading} = useAsyncLoading();
    const {connected: mqttConnected, setCurrentAgent} = useMqttStore();
    const {deleteAgent, upgradeAgent} = useAgentStore();

    const [activeTab, setActiveTab] = useState('info');
    const [renderKey, setRenderKey] = useState(0);
    const [isDeleting, setIsDeleting] = useState(false);
    const [isUpgrading, setIsUpgrading] = useState(false);
    const [upgradeStatus, setUpgradeStatus] = useState({
        type: '',
        message: '',
        show: false
    });
    const [agent, setAgent] = useState(initialAgent);
    const [commandMessage, setCommandMessage] = useState({
        type: '',
        content: '',
        show: false
    });
    const [isExecuting, setIsExecuting] = useState(false);
    const statusTimeoutRef = useRef(null);

    // 使用自定义Hook处理客户端挂载
    const isMounted = useClientMount();

    // 合并MQTT代理数据
    useEffect(() => {
        if (agent && agent.uuid) {
            setCurrentAgent(agent.uuid);
        }
    }, [agent?.uuid, setCurrentAgent]);

    // 监听MQTT实时状态更新
    useEffect(() => {
        if (!agent?.uuid || !mqttConnected) return;

        // 从MQTT状态获取最新信息
        const agentState = useMqttStore.getState().getAgentState();
        if (agentState && agentState[agent.uuid]) {
            const mqttAgentData = agentState[agent.uuid];

            // 更新关键状态
            setAgent(prev => ({
                ...prev,
                online: mqttAgentData.online,
                lastHeartbeat: mqttAgentData.lastHeartbeat || prev.lastHeartbeat,
                _fromMqtt: true
            }));
        }
    }, [agent?.uuid, mqttConnected]);

    // 自动清除状态消息
    useEffect(() => {
        return () => {
            if (statusTimeoutRef.current) {
                clearTimeout(statusTimeoutRef.current);
            }
        };
    }, []);

    // 当切换到终端标签时设置当前代理
    useEffect(() => {
        if (activeTab === 'terminal' && agent?.uuid) {
            console.log('终端标签已激活，设置当前代理:', agent.uuid);
            setCurrentAgent(agent.uuid);
        }
    }, [activeTab, agent?.uuid, setCurrentAgent]);

    // 刷新代理数据
    const refreshAgentData = useCallback(async () => {
        if (!agent?._id) return;

        console.log(`正在刷新代理数据: ${agent._id}`);

        try {
            const refreshResponse = await fetch(`/api/agents/${agent._id}`);

            if (!refreshResponse.ok) {
                throw new Error(`获取代理数据失败: HTTP ${refreshResponse.status}`);
            }

            const updatedAgent = await refreshResponse.json();
            console.log('获取到更新的代理数据:', updatedAgent);

            // 更新代理数据，保留MQTT标记
            setAgent(prev => ({
                ...updatedAgent,
                _fromMqtt: prev?._fromMqtt || false
            }));

            return updatedAgent;
        } catch (error) {
            console.error('刷新代理状态失败:', error);
            throw error;
        }
    }, [agent?._id]);

    // 处理标签切换
    const handleTabChange = (tab) => {
        if (tab === 'terminal' && agent?.uuid) {
            setCurrentAgent(agent.uuid);
        }
        setActiveTab(tab);

        // 切换到信息标签时刷新代理数据
        if (tab === 'info') {
            refreshAgentData();
        }

        // 清除命令状态消息
        if (tab !== 'nginx') {
            clearMessage();
        }
    };

    // 处理删除代理
    const handleDeleteAgent = async () => {
        if (!confirm('确定要删除此代理吗？此操作不可撤销。')) {
            return;
        }

        try {
            setIsDeleting(true);
            setUpgradeStatus({
                type: 'loading',
                message: '正在删除代理...',
                show: true
            });

            const result = await deleteAgent(agent._id);

            // 收到响应后立即关闭loading状态
            setIsDeleting(false);

            if (result.success) {
                setUpgradeStatus({
                    type: 'success',
                    message: '代理已成功删除',
                    show: true
                });

                // 延迟跳转，让用户看到成功消息
                statusTimeoutRef.current = setTimeout(() => {
                    router.push('/agents');
                }, 1500);
            } else if (result.canceled) {
                setUpgradeStatus({
                    type: '',
                    message: '',
                    show: false
                });
            } else {
                setUpgradeStatus({
                    type: 'error',
                    message: result.error?.message || '删除代理失败，请重试',
                    show: true
                });
            }
        } catch (error) {
            console.error('删除代理失败:', error);
            setUpgradeStatus({
                type: 'error',
                message: '删除代理失败: ' + error.message,
                show: true
            });
        }
    };

    // 处理升级代理
    const handleUpgradeAgent = () => {
        // 不阻塞主线程，将confirm放在setTimeout中
        setTimeout(() => {
            if (!confirm('确定要升级此代理吗？在升级过程中，代理可能会重启。')) {
                return;
            }

            // 立即更新UI状态，提高响应性
            setIsUpgrading(true);
            setUpgradeStatus({
                type: 'loading',
                content: '正在发送升级请求...',
                show: true
            });

            // 异步处理升级操作
            setTimeout(async () => {
                try {
                    const result = await upgradeAgent(agent._id);

                    console.log('升级响应:', result);

                    // 检查响应是成功的
                    if (result.success || result.message) {
                        // 获取正确的消息内容
                        const statusMessage = result.message ||
                            (result.result?.message) ||
                            '升级请求已发送，等待代理重启...';

                        setUpgradeStatus({
                            type: 'success',
                            message: statusMessage,
                            show: true
                        });

                        // 清除之前的定时器
                        if (statusTimeoutRef.current) {
                            clearTimeout(statusTimeoutRef.current);
                        }

                        // 延迟刷新数据
                        statusTimeoutRef.current = setTimeout(async () => {
                            try {
                                setUpgradeStatus({
                                    type: 'info',
                                    message: '正在刷新代理状态...',
                                    show: true
                                });

                                // 强制刷新代理数据
                                await refreshAgentData();

                                setUpgradeStatus({
                                    type: 'success',
                                    message: '代理升级完成，数据已更新',
                                    show: true
                                });

                                // 再次延迟刷新，确保获取最新数据
                                setTimeout(async () => {
                                    await refreshAgentData();
                                    setRenderKey(prev => prev + 1); // 强制重新渲染
                                }, 5000);
                            } catch (error) {
                                console.error('刷新代理数据失败:', error);
                                setUpgradeStatus({
                                    type: 'warning',
                                    message: '代理可能已升级，但无法获取最新状态',
                                    show: true
                                });
                            } finally {
                                setIsUpgrading(false);
                            }
                        }, 20000); // 给代理足够时间完成升级
                    } else {
                        setUpgradeStatus({
                            type: 'error',
                            message: result.error?.message || '升级失败',
                            show: true
                        });
                        setIsUpgrading(false);
                    }
                } catch (error) {
                    console.error('升级代理失败:', error);
                    setUpgradeStatus({
                        type: 'error',
                        message: error.message || '升级代理失败，请重试',
                        show: true
                    });
                    setIsUpgrading(false);
                }
            }, 0);
        }, 0);
    };

    // 清除升级状态消息
    const clearUpgradeStatus = () => {
        setUpgradeStatus({
            type: '',
            message: '',
            show: false
        });
    };

    // 清除命令消息
    const clearMessage = () => {
        setCommandMessage({
            type: '',
            content: '',
            show: false
        });
    };

    // Nginx命令
    const executeCommand = async (command) => {
        if (isExecuting || !agent?.online || !mqttConnected) return;

        clearMessage();
        setIsExecuting(true);

        // 命令名称映射
        const commandNames = {
            'reload': '重载配置',
            'restart': '重启服务',
            'stop': '停止服务',
            'start': '启动服务'
        };

        try {
            setCommandMessage({
                type: 'loading',
                content: `正在${commandNames[command] || command}...`,
                show: true
            });

            // 使用MQTT发送命令
            const mqttCommand = {
                'reload': () => useMqttStore.getState().reloadNginx(agent.uuid),
                'restart': () => useMqttStore.getState().restartNginx(agent.uuid),
                'stop': () => useMqttStore.getState().stopNginx(agent.uuid),
                'start': () => useMqttStore.getState().startNginx(agent.uuid)
            };

            if (mqttCommand[command]) {
                const result = await mqttCommand[command]();
                setCommandMessage({
                    type: 'success',
                    content: `${commandNames[command] || command}成功: ${result.message || '操作已完成'}`,
                    show: true
                });
            } else {
                throw new Error('不支持的命令');
            }
        } catch (error) {
            console.error(`${command}命令执行失败:`, error);
            setCommandMessage({
                type: 'error',
                content: `${commandNames[command] || command}失败: ${error.message}`,
                show: true
            });
        } finally {
            setIsExecuting(false);
        }
    };

    const reloadNginx = () => executeCommand('reload');
    const restartNginx = () => executeCommand('restart');
    const stopNginx = () => executeCommand('stop');
    const startNginx = () => executeCommand('start');

    if (!isMounted) {
        return null;
    }

    if (!agent) {
        return (
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 text-center">
                <h2 className="text-xl font-medium text-gray-900">未找到代理信息</h2>
                <p className="mt-2 text-gray-500">该代理可能不存在或已被删除</p>
                <div className="mt-6">
                    <Link href="/agents">
                        <Button variant="secondary">返回代理列表</Button>
                    </Link>
                </div>
            </div>
        );
    }

    return (
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6" key={renderKey}>
            <div className="mb-4">
                <Link href="/agents" className="flex items-center text-blue-600 hover:text-blue-800">
                    <ArrowLeft className="w-4 h-4 mr-1"/>
                    返回代理列表
                </Link>
            </div>

            <header className="mb-6 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-gray-800 dark:text-white">{agent.hostname || agent.uuid}</h1>
                    <p className="text-gray-500 dark:text-gray-400">UUID: {agent.uuid}</p>
                    <div className="mt-1">
                        <span className={`inline-flex items-center px-2 py-1 text-xs font-medium rounded-full ${
                            agent.online ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400' : 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400'
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

            {/* 状态消息组件 */}
            <StatusMessage
                type={upgradeStatus.type}
                message={upgradeStatus.message}
                show={upgradeStatus.show}
                onClose={clearUpgradeStatus}
            />

            {/* 选项卡导航 */}
            <div className="flex border-b border-gray-200 dark:border-gray-700 mb-6">
                <button
                    onClick={() => handleTabChange('info')}
                    className={`py-3 px-6 text-sm font-medium border-b-2 -mb-px flex items-center ${
                        activeTab === 'info'
                            ? 'border-blue-500 text-blue-600 dark:text-blue-400 dark:border-blue-400'
                            : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 dark:text-gray-400 dark:hover:text-gray-300'
                    }`}
                >
                    <Info className="w-4 h-4 mr-2"/>
                    信息详情
                </button>

                <button
                    onClick={() => handleTabChange('nginx')}
                    className={`py-3 px-6 text-sm font-medium border-b-2 -mb-px flex items-center ${
                        activeTab === 'nginx'
                            ? 'border-blue-500 text-blue-600 dark:text-blue-400 dark:border-blue-400'
                            : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 dark:text-gray-400 dark:hover:text-gray-300'
                    }`}
                    disabled={!agent.online || !mqttConnected}
                >
                    <Server className="w-4 h-4 mr-2"/>
                    Nginx控制
                    {(!agent.online || !mqttConnected) && <span
                        className="ml-2 text-xs bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400 px-1.5 py-0.5 rounded-full">
                        {!agent.online ? '离线' : 'MQTT未连接'}
                    </span>}
                </button>

                <button
                    onClick={() => handleTabChange('terminal')}
                    className={`py-3 px-6 text-sm font-medium border-b-2 -mb-px flex items-center ${
                        activeTab === 'terminal'
                            ? 'border-blue-500 text-blue-600 dark:text-blue-400 dark:border-blue-400'
                            : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 dark:text-gray-400 dark:hover:text-gray-300'
                    }`}
                    disabled={!agent.online}
                >
                    <TerminalSquare className="w-4 h-4 mr-2"/>
                    终端
                    {!agent.online && <span
                        className="ml-2 text-xs bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400 px-1.5 py-0.5 rounded-full">离线</span>}
                </button>
            </div>

            {/* 信息详情选项卡 */}
            {activeTab === 'info' && (
                <div className="space-y-6">
                    {/* 基本状态信息 */}
                    <div className="bg-white rounded-lg shadow dark:bg-gray-800 overflow-hidden">
                        <div className="p-5 border-b border-gray-200 dark:border-gray-700">
                            <h2 className="text-lg font-medium text-gray-800 dark:text-white mb-4">基本状态</h2>
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                                <div className="flex items-center">
                                    <div className="p-2 rounded-md bg-blue-50 dark:bg-blue-900/30 mr-3">
                                        <Clock className="w-5 h-5 text-blue-500 dark:text-blue-400"/>
                                    </div>
                                    <div>
                                        <p className="text-xs font-medium text-gray-500 dark:text-gray-400">最后心跳</p>
                                        <p className="text-sm font-medium dark:text-white">
                                            {agent.lastHeartbeat
                                                ? formatDistanceToNow(new Date(agent.lastHeartbeat), {addSuffix: true})
                                                : '未知'}
                                        </p>
                                    </div>
                                </div>

                                <div className="flex items-center">
                                    <div className="p-2 rounded-md bg-green-50 dark:bg-green-900/30 mr-3">
                                        <Cpu className="w-5 h-5 text-green-500 dark:text-green-400"/>
                                    </div>
                                    <div>
                                        <p className="text-xs font-medium text-gray-500 dark:text-gray-400">操作系统</p>
                                        <p className="text-sm font-medium dark:text-white">{agent.os || '未知'}</p>
                                    </div>
                                </div>

                                <div className="flex items-center">
                                    <div className="p-2 rounded-md bg-purple-50 dark:bg-purple-900/30 mr-3">
                                        <HardDrive className="w-5 h-5 text-purple-500 dark:text-purple-400"/>
                                    </div>
                                    <div>
                                        <p className="text-xs font-medium text-gray-500 dark:text-gray-400">内存</p>
                                        <p className="text-sm font-medium dark:text-white">{agent.memory || '未知'}</p>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* 详细信息 */}
                        <div className="p-5">
                            <h2 className="text-lg font-medium text-gray-800 dark:text-white mb-4">详细信息</h2>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div>
                                    <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400">IP地址</h3>
                                    <p className="text-sm font-medium dark:text-white mt-1">{agent.ip || '未知'}</p>
                                </div>
                                {/* URL字段 */}
                                <div>
                                    <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400">管理页面</h3>
                                    <p className="text-sm font-medium dark:text-white mt-1">
                                        {agent.url ? (
                                            <a
                                                href={agent.url}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className="text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300 flex items-center"
                                            >
                                                <span>{agent.url}</span>
                                                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 ml-1"
                                                     fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                                                          d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"/>
                                                </svg>
                                            </a>
                                        ) : '未设置'}
                                    </p>
                                </div>


                                <div>
                                    <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400">构建时间</h3>
                                    <p className="text-sm font-medium dark:text-white mt-1">{agent.buildTime || '未知'}</p>
                                </div>

                                <div>
                                    <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400">Hash</h3>
                                    <p className="text-sm font-medium dark:text-white mt-1">
                                        {agent.commitId ? agent.commitId.substring(0, 8) : '未知'}
                                    </p>
                                </div>

                                <div>
                                    <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400">版本</h3>
                                    <p className="text-sm font-medium dark:text-white mt-1">{agent.buildVersion || '未知'}</p>
                                </div>

                                <div>
                                    <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400">MQTT连接状态</h3>
                                    <p className="text-sm font-medium flex items-center dark:text-white mt-1">
                <span
                    className={`inline-block w-2 h-2 rounded-full mr-2 ${mqttConnected ? 'bg-green-500' : 'bg-gray-400'}`}></span>
                                        {mqttConnected ? '已连接' : '未连接 (使用HTTP API)'}
                                    </p>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Nginx控制选项卡 */}
            {activeTab === 'nginx' && (
                <div className="space-y-6">
                    {/* 命令执行状态 */}
                    <StatusMessage
                        type={commandMessage.type}
                        message={commandMessage.content}
                        show={commandMessage.show}
                        onClose={clearMessage}
                        className="mt-3 mb-4"
                    />

                    {/* Nginx控制面板 */}
                    {agent.online && mqttConnected ? (
                        <div className="bg-white rounded-lg shadow dark:bg-gray-800">
                            <div className="p-5">
                                <div className="flex items-center mb-6">
                                    <Server className="w-6 h-6 text-blue-500 dark:text-blue-400 mr-2"/>
                                    <h2 className="text-xl font-medium text-gray-800 dark:text-white">Nginx服务控制</h2>
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                    <div
                                        className="bg-blue-50 dark:bg-blue-900/20 p-5 rounded-lg border border-blue-100 dark:border-blue-800">
                                        <div className="flex items-center mb-3">
                                            <RotateCw className="w-5 h-5 text-blue-500 dark:text-blue-400 mr-2"/>
                                            <h3 className="text-lg font-medium text-gray-800 dark:text-white">重载配置</h3>
                                        </div>
                                        <p className="text-sm text-gray-600 dark:text-gray-300 mb-4">
                                            重新加载Nginx配置文件，不中断正在处理的连接。
                                        </p>
                                        <button
                                            onClick={reloadNginx}
                                            disabled={isExecuting}
                                            className={`flex items-center px-3 py-1.5 rounded text-white bg-blue-500 hover:bg-blue-600 dark:bg-blue-600 dark:hover:bg-blue-700 transition-colors ${isExecuting ? 'opacity-70 cursor-not-allowed' : ''}`}
                                            title="重载Nginx配置"
                                        >
                                            <RotateCw className={`w-4 h-4 ${isExecuting ? 'animate-spin' : ''}`}/>
                                            <span className="ml-2 text-sm">重载配置</span>
                                        </button>
                                    </div>

                                    <div
                                        className="bg-green-50 dark:bg-green-900/20 p-5 rounded-lg border border-green-100 dark:border-green-800">
                                        <div className="flex items-center mb-3">
                                            <RefreshCw className="w-5 h-5 text-green-500 dark:text-green-400 mr-2"/>
                                            <h3 className="text-lg font-medium text-gray-800 dark:text-white">重启服务</h3>
                                        </div>
                                        <p className="text-sm text-gray-600 dark:text-gray-300 mb-4">
                                            完全停止并重新启动Nginx服务，会暂时中断所有连接。
                                        </p>
                                        <button
                                            onClick={restartNginx}
                                            disabled={isExecuting}
                                            className={`flex items-center px-3 py-1.5 rounded text-white bg-green-500 hover:bg-green-600 dark:bg-green-600 dark:hover:bg-green-700 transition-colors ${isExecuting ? 'opacity-70 cursor-not-allowed' : ''}`}
                                            title="重启Nginx服务"
                                        >
                                            <RefreshCw className={`w-4 h-4 ${isExecuting ? 'animate-spin' : ''}`}/>
                                            <span className="ml-2 text-sm">重启服务</span>
                                        </button>
                                    </div>

                                    <div
                                        className="bg-red-50 dark:bg-red-900/20 p-5 rounded-lg border border-red-100 dark:border-red-800">
                                        <div className="flex items-center mb-3">
                                            <Square className="w-5 h-5 text-red-500 dark:text-red-400 mr-2"/>
                                            <h3 className="text-lg font-medium text-gray-800 dark:text-white">停止服务</h3>
                                        </div>
                                        <p className="text-sm text-gray-600 dark:text-gray-300 mb-4">
                                            停止Nginx服务，所有网站将无法访问。
                                        </p>
                                        <button
                                            onClick={stopNginx}
                                            disabled={isExecuting}
                                            className={`flex items-center px-3 py-1.5 rounded text-white bg-red-500 hover:bg-red-600 dark:bg-red-600 dark:hover:bg-red-700 transition-colors ${isExecuting ? 'opacity-70 cursor-not-allowed' : ''}`}
                                            title="停止Nginx服务"
                                        >
                                            <Square className="w-4 h-4"/>
                                            <span className="ml-2 text-sm">停止服务</span>
                                        </button>
                                    </div>

                                    <div
                                        className="bg-purple-50 dark:bg-purple-900/20 p-5 rounded-lg border border-purple-100 dark:border-purple-800">
                                        <div className="flex items-center mb-3">
                                            <Play className="w-5 h-5 text-purple-500 dark:text-purple-400 mr-2"/>
                                            <h3 className="text-lg font-medium text-gray-800 dark:text-white">启动服务</h3>
                                        </div>
                                        <p className="text-sm text-gray-600 dark:text-gray-300 mb-4">
                                            启动已停止的Nginx服务，恢复网站访问。
                                        </p>
                                        <button
                                            onClick={startNginx}
                                            disabled={isExecuting}
                                            className={`flex items-center px-3 py-1.5 rounded text-white bg-purple-500 hover:bg-purple-600 dark:bg-purple-600 dark:hover:bg-purple-700 transition-colors ${isExecuting ? 'opacity-70 cursor-not-allowed' : ''}`}
                                            title="启动Nginx服务"
                                        >
                                            <Play className="w-4 h-4"/>
                                            <span className="ml-2 text-sm">启动服务</span>
                                        </button>
                                    </div>
                                </div>
                            </div>
                        </div>
                    ) : (
                        <div className="bg-white rounded-lg shadow dark:bg-gray-800 p-5 text-center">
                            <div className="py-10">
                                <div
                                    className="inline-flex items-center justify-center p-3 bg-red-100 dark:bg-red-900/30 rounded-full mb-4">
                                    <XCircle className="w-8 h-8 text-red-500 dark:text-red-400"/>
                                </div>
                                <h3 className="text-lg font-medium text-gray-800 dark:text-white mb-2">
                                    {!agent.online ? '代理当前离线' : 'MQTT未连接'}
                                </h3>
                                <p className="text-gray-500 dark:text-gray-400 mb-4">
                                    {!agent.online
                                        ? '无法控制Nginx服务，请等待代理重新上线后再试'
                                        : 'MQTT连接失败，无法发送实时命令，请检查MQTT设置'}
                                </p>
                                <Button
                                    variant="primary"
                                    onClick={() => handleTabChange('info')}
                                >
                                    返回信息页面
                                </Button>
                            </div>
                        </div>
                    )}
                </div>
            )}

            {/* 终端选项卡 */}
            {activeTab === 'terminal' && (
                <div>
                    {agent.online ? (
                        <ErrorBoundary fallback={
                            <div className="bg-white rounded-lg shadow dark:bg-gray-800 p-5 text-center">
                                <div className="py-10">
                                    <div
                                        className="inline-flex items-center justify-center p-3 bg-red-100 dark:bg-red-900/30 rounded-full mb-4">
                                        <XCircle className="w-8 h-8 text-red-500 dark:text-red-400"/>
                                    </div>
                                    <h3 className="text-lg font-medium text-gray-800 dark:text-white mb-2">终端组件错误</h3>
                                    <p className="text-gray-500 dark:text-gray-400 mb-4">
                                        加载终端组件时出现问题，请刷新页面重试
                                    </p>
                                    <Button
                                        variant="primary"
                                        onClick={() => handleTabChange('info')}
                                    >
                                        返回信息页面
                                    </Button>
                                </div>
                            </div>
                        }>
                            <TerminalComponent
                                agentId={agent._id}
                                agentUuid={agent.uuid}
                                isOnline={agent.online}
                                key={`terminal-${agent.uuid}-${renderKey}`}
                            />
                        </ErrorBoundary>
                    ) : (
                        <div className="bg-white rounded-lg shadow dark:bg-gray-800 p-5 text-center">
                            <div className="py-10">
                                <div
                                    className="inline-flex items-center justify-center p-3 bg-red-100 dark:bg-red-900/30 rounded-full mb-4">
                                    <XCircle className="w-8 h-8 text-red-500 dark:text-red-400"/>
                                </div>
                                <h3 className="text-lg font-medium text-gray-800 dark:text-white mb-2">代理当前离线</h3>
                                <p className="text-gray-500 dark:text-gray-400 mb-4">
                                    无法访问终端，请等待代理重新上线后再试
                                </p>
                                <Button
                                    variant="primary"
                                    onClick={() => handleTabChange('info')}
                                >
                                    返回信息页面
                                </Button>
                            </div>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}
