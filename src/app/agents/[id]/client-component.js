'use client';

import {useEffect, useRef, useState} from 'react';
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
    Terminal,
    Upload,
    XCircle,
    Zap
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

    const [renderKey, setRenderKey] = useState(0);
    const [isDeleting, setIsDeleting] = useState(false);
    const [isUpgrading, setIsUpgrading] = useState(false);
    const [upgradeStatus, setUpgradeStatus] = useState({
        type: '',
        message: '',
        show: false
    });
    const [agent, setAgent] = useState(initialAgent);
    const [showTerminal, setShowTerminal] = useState(false);
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
            // 移除finally块，因为已在上面处理了setIsDeleting(false)
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

    // 切换终端显示
    const toggleTerminal = () => {
        const newState = !showTerminal;
        setShowTerminal(newState);

        // 仅在显示终端时订阅响应主题
        if (newState && agent && agent.uuid) {
            console.log('终端已打开，设置当前代理:', agent.uuid);
            setCurrentAgent(agent.uuid);
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
                    <Button
                        variant={showTerminal ? 'secondary' : 'primary'}
                        onClick={toggleTerminal}
                    >
                        <Terminal className="w-4 h-4 mr-1"/>
                        {showTerminal ? '隐藏终端' : '终端'}
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

            {/* 终端组件 */}
            {showTerminal && (
                <div className="mb-6">
                    <TerminalComponent
                        agentId={agent._id}
                        agentUuid={agent.uuid}
                        isOnline={agent.online}
                    />
                </div>
            )}

            {/* 命令执行状态 */}
            {agent.online && <StatusMessage
                type={commandMessage.type}
                message={commandMessage.content}
                show={commandMessage.show}
                onClose={clearMessage}
                className="mt-3"
            />}

            {/* Nginx 控制按钮 */}
            {agent.online && (
                <div className="mb-6 bg-white rounded-lg shadow p-4 dark:bg-gray-800">
                    <h3 className="text-lg font-medium mb-3 dark:text-white">Nginx 控制</h3>
                    <div className="flex flex-wrap gap-2">
                        <Button
                            variant="primary"
                            onClick={reloadNginx}
                            disabled={isExecuting}
                        >
                            <RotateCw className={`w-4 h-4 mr-1 ${isExecuting ? 'animate-spin' : ''}`}/>
                            重载配置
                        </Button>
                        <Button
                            variant="success"
                            onClick={restartNginx}
                            disabled={isExecuting}
                        >
                            <RefreshCw className={`w-4 h-4 mr-1 ${isExecuting ? 'animate-spin' : ''}`}/>
                            重启服务
                        </Button>
                        <Button
                            variant="danger"
                            onClick={stopNginx}
                            disabled={isExecuting}
                        >
                            <Square className="w-4 h-4 mr-1"/>
                            停止服务
                        </Button>
                        <Button
                            variant="warning"
                            onClick={startNginx}
                            disabled={isExecuting}
                        >
                            <Play className="w-4 h-4 mr-1"/>
                            启动服务
                        </Button>
                    </div>
                </div>
            )}

            {/* 状态卡片 */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
                <div
                    className="bg-white rounded-lg border border-gray-200 shadow-sm p-4 transition-shadow hover:shadow dark:bg-gray-800 dark:border-gray-700">
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-sm text-gray-500 mb-1 dark:text-gray-400">状态</p>
                            <p className="text-xl font-bold flex items-center dark:text-white">
                                <span
                                    className={`inline-block w-3 h-3 rounded-full mr-2 ${agent.online ? 'bg-green-500' : 'bg-red-500'}`}></span>
                                {agent.online ? '在线' : '离线'}
                            </p>
                            <p className="text-xs text-gray-500 mt-1 dark:text-gray-400">
                                最后心跳: {agent.lastHeartbeat
                                ? formatDistanceToNow(new Date(agent.lastHeartbeat), {addSuffix: true})
                                : '未知'}
                            </p>
                        </div>
                        <div className="bg-blue-50 p-3 rounded-full dark:bg-blue-900/30">
                            <Server className="w-6 h-6 text-blue-500 dark:text-blue-400"/>
                        </div>
                    </div>
                </div>

                <div
                    className="bg-white rounded-lg border border-gray-200 shadow-sm p-4 transition-shadow hover:shadow dark:bg-gray-800 dark:border-gray-700">
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-sm text-gray-500 mb-1 dark:text-gray-400">网站</p>
                            <p className="text-xl font-bold dark:text-white">{agent.stats?.websites || 0}</p>
                            <p className="text-xs text-gray-500 mt-1 dark:text-gray-400">托管站点数量</p>
                        </div>
                        <div className="bg-green-50 p-3 rounded-full dark:bg-green-900/30">
                            <Globe className="w-6 h-6 text-green-500 dark:text-green-400"/>
                        </div>
                    </div>
                </div>

                <div
                    className="bg-white rounded-lg border border-gray-200 shadow-sm p-4 transition-shadow hover:shadow dark:bg-gray-800 dark:border-gray-700">
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-sm text-gray-500 mb-1 dark:text-gray-400">SSL证书</p>
                            <p className="text-xl font-bold dark:text-white">{agent.stats?.certificates || 0}</p>
                            <p className="text-xs text-gray-500 mt-1 dark:text-gray-400">有效证书数量</p>
                        </div>
                        <div className="bg-purple-50 p-3 rounded-full dark:bg-purple-900/30">
                            <FileCheck className="w-6 h-6 text-purple-500 dark:text-purple-400"/>
                        </div>
                    </div>
                </div>
            </div>

            {/* 系统信息面板 */}
            <div className="bg-white rounded-lg shadow dark:bg-gray-800">
                <div className="p-4 space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="flex items-start">
                            <div className="bg-gray-100 p-2 rounded-md mr-3 dark:bg-gray-700">
                                <Cpu className="w-5 h-5 text-gray-500 dark:text-gray-400"/>
                            </div>
                            <div>
                                <p className="text-sm text-gray-500 dark:text-gray-400">操作系统</p>
                                <p className="text-sm font-medium dark:text-white">{agent.os || '未知'}</p>
                            </div>
                        </div>

                        <div className="flex items-start">
                            <div className="bg-gray-100 p-2 rounded-md mr-3 dark:bg-gray-700">
                                <MemoryStick className="w-5 h-5 text-gray-500 dark:text-gray-400"/>
                            </div>
                            <div>
                                <p className="text-sm text-gray-500 dark:text-gray-400">内存</p>
                                <p className="text-sm font-medium dark:text-white">{agent.memory || '未知'}</p>
                            </div>
                        </div>

                        <div className="flex items-start">
                            <div className="bg-gray-100 p-2 rounded-md mr-3 dark:bg-gray-700">
                                <Database className="w-5 h-5 text-gray-500 dark:text-gray-400"/>
                            </div>
                            <div>
                                <p className="text-sm text-gray-500 dark:text-gray-400">IP地址</p>
                                <p className="text-sm font-medium dark:text-white">{agent.ip || '未知'}</p>
                            </div>
                        </div>

                        <div className="flex items-start">
                            <div className="bg-gray-100 p-2 rounded-md mr-3 dark:bg-gray-700">
                                <Zap className="w-5 h-5 text-gray-500 dark:text-gray-400"/>
                            </div>
                            <div>
                                <p className="text-sm text-gray-500 dark:text-gray-400">版本</p>
                                <p className="text-sm font-medium dark:text-white">{agent.buildVersion || '未知'}</p>
                            </div>
                        </div>
                    </div>

                    <div className="pt-2 border-t border-gray-100 dark:border-gray-700">
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <p className="text-sm text-gray-500 dark:text-gray-400">构建时间</p>
                                <p className="text-sm font-medium dark:text-white">{agent.buildTime || '未知'}</p>
                            </div>
                            <div>
                                <p className="text-sm text-gray-500 dark:text-gray-400">提交ID</p>
                                <p className="text-sm font-medium dark:text-white">{agent.commitId ? agent.commitId.substring(0, 8) : '未知'}</p>
                            </div>
                        </div>
                    </div>

                    {/* MQTT连接状态显示 */}
                    <div className="pt-2 border-t border-gray-100 dark:border-gray-700">
                        <div>
                            <p className="text-sm text-gray-500 dark:text-gray-400">MQTT连接状态</p>
                            <p className="text-sm font-medium flex items-center dark:text-white">
                                <span
                                    className={`inline-block w-2 h-2 rounded-full mr-2 ${mqttConnected ? 'bg-green-500' : 'bg-gray-400'}`}></span>
                                {mqttConnected ? 'MQTT已连接' : 'MQTT未连接 (使用HTTP API)'}
                            </p>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
