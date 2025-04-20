'use client';

import {useEffect, useRef, useState} from 'react';
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
import {useMqttClient} from '@/lib/mqtt';
import {useAsyncLoading} from '@/lib/loading-hooks';
import {useClientMount} from '@/hooks/useClientMount';
import {useNginxCommands} from '@/hooks/useNginxCommands';
import {useAgentRefresh} from '@/hooks/useAgentRefresh';
import {combineSingleAgentData} from '@/lib/agent-utils';
import TerminalComponent from '@/components/ui/Terminal';

export default function AgentDetail({agent: initialAgent}) {
    const router = useRouter();
    const {withLoading} = useAsyncLoading();
    const {deleteAgent, upgradeAgent} = useAgentRefresh([]);
    const {
        connected: mqttConnected,
        agentState,
        setCurrentAgent
    } = useMqttClient();

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
    const statusTimeoutRef = useRef(null);

    // 使用自定义Hook处理客户端挂载
    const isMounted = useClientMount();

    // 使用改进的Nginx命令Hook
    const {
        commandMessage,
        isExecuting,
        clearMessage,
        reloadNginx,
        restartNginx,
        stopNginx,
        startNginx
    } = useNginxCommands(agent);

    // 合并MQTT代理数据
    useEffect(() => {
        if (mqttConnected && agent && agent.uuid && agentState[agent.uuid]) {
            const updatedAgent = combineSingleAgentData(agent, agentState, mqttConnected);
            setAgent(updatedAgent);
            console.log('代理数据已用MQTT信息更新');
        }
    }, [mqttConnected, agent?.uuid, agentState]);

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
    const handleUpgradeAgent = async () => {
        if (!confirm('确定要升级此代理吗？在升级过程中，代理可能会重启。')) {
            return;
        }

        try {
            setIsUpgrading(true);
            setUpgradeStatus({
                type: 'loading',
                message: '正在发送升级请求...',
                show: true
            });

            const result = await upgradeAgent(agent._id);

            if (result.success) {
                setUpgradeStatus({
                    type: 'success',
                    message: result.message || '升级请求已发送',
                    show: true
                });
            } else {
                setUpgradeStatus({
                    type: 'error',
                    message: result.error?.message || '升级失败',
                    show: true
                });
            }

            // 升级可能需要一些时间，设置延迟刷新
            statusTimeoutRef.current = setTimeout(async () => {
                try {
                    const refreshResponse = await fetch(`/api/agents/${agent._id}`);
                    if (refreshResponse.ok) {
                        const updatedAgent = await refreshResponse.json();
                        setAgent(updatedAgent);
                    }
                } catch (error) {
                    console.error('刷新代理状态失败:', error);
                } finally {
                    setIsUpgrading(false);
                }
            }, 15000); // 15秒后刷新
        } catch (error) {
            console.error('升级代理失败:', error);
            setUpgradeStatus({
                type: 'error',
                message: error.message || '升级代理失败，请重试',
                show: true
            });
            setIsUpgrading(false);
        }
    };

    // 清除升级状态消息
    const clearUpgradeStatus = () => {
        setUpgradeStatus({
            type: '',
            message: '',
            show: false
        });
    };

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

            {/* 命令执行状态 */}
            {agent.online && activeTab === 'info' && <StatusMessage
                type={commandMessage.type}
                message={commandMessage.content}
                show={commandMessage.show}
                onClose={clearMessage}
                className="mt-3 mb-4"
            />}

            {/* 选项卡导航 */}
            <div className="flex border-b border-gray-200 dark:border-gray-700 mb-6">
                <button
                    onClick={() => setActiveTab('info')}
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
                    onClick={() => setActiveTab('terminal')}
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

                                <div>
                                    <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400">版本</h3>
                                    <p className="text-sm font-medium dark:text-white mt-1">{agent.buildVersion || '未知'}</p>
                                </div>

                                <div>
                                    <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400">构建时间</h3>
                                    <p className="text-sm font-medium dark:text-white mt-1">{agent.buildTime || '未知'}</p>
                                </div>

                                <div>
                                    <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400">提交ID</h3>
                                    <p className="text-sm font-medium dark:text-white mt-1">
                                        {agent.commitId ? agent.commitId.substring(0, 8) : '未知'}
                                        {agent.commitId &&
                                            <span className="text-xs text-gray-400 ml-2">{agent.commitId}</span>}
                                    </p>
                                </div>

                                <div>
                                    <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400">MQTT连接状态</h3>
                                    <p className="text-sm font-medium flex items-center dark:text-white mt-1">
                                        <span
                                            className={`inline-block w-2 h-2 rounded-full mr-2 ${mqttConnected ? 'bg-green-500' : 'bg-gray-400'}`}></span>
                                        {mqttConnected ? 'MQTT已连接' : 'MQTT未连接 (使用HTTP API)'}
                                    </p>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Nginx控制面板 */}
                    {agent.online && (
                        <div className="bg-white rounded-lg shadow dark:bg-gray-800">
                            <div className="p-5">
                                <div className="flex items-center mb-4">
                                    <Server className="w-5 h-5 text-blue-500 dark:text-blue-400 mr-2"/>
                                    <h2 className="text-lg font-medium text-gray-800 dark:text-white">Nginx服务控制</h2>
                                </div>

                                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                                    <div className="flex flex-col">
                                        <Button
                                            variant="primary"
                                            onClick={reloadNginx}
                                            disabled={isExecuting}
                                            className="flex justify-center items-center h-full"
                                        >
                                            <RotateCw
                                                className={`w-4 h-4 mr-1.5 ${isExecuting ? 'animate-spin' : ''}`}/>
                                            重载配置
                                        </Button>
                                    </div>

                                    <div className="flex flex-col">
                                        <Button
                                            variant="success"
                                            onClick={restartNginx}
                                            disabled={isExecuting}
                                            className="flex justify-center items-center h-full"
                                        >
                                            <RefreshCw
                                                className={`w-4 h-4 mr-1.5 ${isExecuting ? 'animate-spin' : ''}`}/>
                                            重启服务
                                        </Button>
                                    </div>

                                    <div className="flex flex-col">
                                        <Button
                                            variant="danger"
                                            onClick={stopNginx}
                                            disabled={isExecuting}
                                            className="flex justify-center items-center h-full"
                                        >
                                            <Square className="w-4 h-4 mr-1.5"/>
                                            停止服务
                                        </Button>
                                    </div>

                                    <div className="flex flex-col">
                                        <Button
                                            variant="warning"
                                            onClick={startNginx}
                                            disabled={isExecuting}
                                            className="flex justify-center items-center h-full"
                                        >
                                            <Play className="w-4 h-4 mr-1.5"/>
                                            启动服务
                                        </Button>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            )}

            {/* 终端选项卡 */}
            {activeTab === 'terminal' && (
                <div>
                    {agent.online ? (
                        <TerminalComponent
                            agentId={agent._id}
                            agentUuid={agent.uuid}
                            isOnline={agent.online}
                        />
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
                                    onClick={() => setActiveTab('info')}
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
