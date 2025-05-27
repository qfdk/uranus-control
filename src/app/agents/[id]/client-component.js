'use client';

import React, {useCallback, useEffect, useRef, useState, useMemo} from 'react';
import {formatDistanceToNow} from 'date-fns';
import zhCN from 'date-fns/locale/zh-CN';
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
import {useClientMount} from '@/hooks/useClientMount';
import useAgentStore from '@/store/agentStore';
import useMqttStore from '@/store/mqttStore';
import CommandExecutor from '@/components/ui/CommandExecutor.jsx';
import toast from 'react-hot-toast';

export default function AgentDetail({agent: initialAgent}) {
    const router = useRouter();
    const {connected: mqttConnected, subscribeToResponses, getAgentState} = useMqttStore();
    
    // 分别订阅各个状态，避免无限循环
    const deleteAgent = useAgentStore(state => state.deleteAgent);
    const upgradeAgent = useAgentStore(state => state.upgradeAgent);
    const getCombinedAgent = useAgentStore(state => state.getCombinedAgent);
    const refreshAgent = useAgentStore(state => state.refreshAgent);
    const mqttAgentState = useAgentStore(state => state.mqttAgentState);

    const [renderKey, setRenderKey] = useState(0);
    const [isDeleting, setIsDeleting] = useState(false);
    const [isUpgrading, setIsUpgrading] = useState(false);
    const [upgradeStatus, setUpgradeStatus] = useState({
        type: '',
        message: '',
        show: false
    });
    const [agent, setAgent] = useState(initialAgent);

    // 防止频繁重新订阅的引用
    const subscriptionRef = useRef(null);
    const statusTimeoutRef = useRef(null);
    
    // 存储当前代理的UUID，用于mqttAgentState监听
    const agentUuidRef = useRef(initialAgent?.uuid);

    // 使用自定义Hook处理客户端挂载
    const isMounted = useClientMount();

    // 状态变量
    const [activeTab, setActiveTab] = useState('info');
    const [commandMessage, setCommandMessage] = useState({
        type: '',
        content: '',
        show: false
    });
    const [isExecuting, setIsExecuting] = useState(false);

    // 初始化MQTT连接
    useEffect(() => {
        if (isMounted && !mqttConnected) {
            useMqttStore.getState().connect().catch(err => {
            });
        }
    }, [isMounted, mqttConnected]);

    // 处理函数 - 处理代理状态更新
    const handleAgentUpdate = useCallback((topic, message) => {
        // 检查MQTT连接状态
        if (!mqttConnected) {
            // 强制更新MQTT状态
            useMqttStore.getState().connect().catch(console.error);
        }

        // 使用getCombinedAgent获取合并后的数据
        if (!agent?._id) return;

        const combinedAgent = getCombinedAgent(agent._id);
        if (combinedAgent) {
            // 只在实际有变化时更新，避免循环渲染
            if (JSON.stringify(combinedAgent) !== JSON.stringify(agent)) {
                setAgent(combinedAgent);
            }
        }
    }, [agent, mqttConnected, getCombinedAgent]);

    // 监听MQTT实时状态更新
    useEffect(() => {
        if (!agent?._id || !agent?.uuid) return;

        let unsubscribe = () => {};

        // 如果MQTT已连接，直接订阅（避免重复订阅）
        if (mqttConnected && !subscriptionRef.current) {
            subscriptionRef.current = subscribeToResponses(agent.uuid, handleAgentUpdate);
            unsubscribe = subscriptionRef.current;

            // 立即使用getCombinedAgent获取最新状态（仅当有实际变化时）
            const combinedAgent = getCombinedAgent(agent._id);
            if (combinedAgent && JSON.stringify(combinedAgent) !== JSON.stringify(agent)) {
                setAgent(combinedAgent);
            }
        } else if (!mqttConnected) {
            // 如果MQTT未连接，尝试连接
            useMqttStore.getState().connect()
                .then(() => {
                    unsubscribe = subscribeToResponses(agent.uuid, handleAgentUpdate);
                    
                    // 连接成功后立即更新状态
                    const combinedAgent = getCombinedAgent(agent._id);
                    if (combinedAgent) {
                        setAgent(combinedAgent);
                    }
                })
                .catch(err => console.error('MQTT连接失败:', err));
        }

        // 组件卸载时取消订阅
        return () => {
            unsubscribe();
            subscriptionRef.current = null;
        };
    }, [agent?._id, agent?.uuid, mqttConnected, subscribeToResponses, getCombinedAgent]);

    // 自动清除状态消息
    useEffect(() => {
        return () => {
            if (statusTimeoutRef.current) {
                clearTimeout(statusTimeoutRef.current);
            }
        };
    }, []);
    
    // 添加周期性刷新机制，确保即使没有MQTT消息也能更新状态
    useEffect(() => {
        if (!agent?._id || !isMounted) return;
        
        // 首次加载时，立即使用getCombinedAgent获取最新状态
        const currentAgent = getCombinedAgent(agent._id);
        if (currentAgent) {
            setAgent(currentAgent);
        }
        
        // 每5秒刷新一次代理状态，确保始终显示最新状态
        const refreshInterval = setInterval(() => {
            try {
                // 从store中直接获取最新的合并状态
                const newAgent = getCombinedAgent(agent._id);
                if (newAgent) {
                    // 检查在线状态是否变化
                    const statusChanged = newAgent.online !== agent.online;
                    
                    // 更新代理状态
                    setAgent(newAgent);
                    
                    // 如果状态发生变化，记录日志
                    if (statusChanged) {
                                }
                }
            } catch (error) {
            }
        }, 3000); // 3秒刷新一次，增加频率确保快速响应
        
        return () => {
            clearInterval(refreshInterval);
        };
    }, [agent?._id, agent?.online, getCombinedAgent, isMounted]);
    
    // 监听mqttAgentState变化，确保立即更新代理状态
    useEffect(() => {
        if (!agent?._id || !agent?.uuid || !isMounted) return;
        
        // 更新ref值，保存当前agent的UUID
        agentUuidRef.current = agent.uuid;
        
        // 检查MQTT状态中是否有当前代理的数据
        const mqttData = mqttAgentState?.[agent.uuid];
        if (!mqttData) return;
        
        // 检查在线状态是否变化
        if (mqttData.online !== agent.online) {
            
            // 使用getCombinedAgent获取完整的合并状态
            const currentAgent = getCombinedAgent(agent._id);
            if (currentAgent) {
                setAgent(currentAgent);
            }
        }
    }, [agent?._id, agent?.uuid, agent?.online, mqttAgentState, getCombinedAgent, isMounted]);

    // 刷新代理数据
    const refreshAgentData = useCallback(async () => {
        if (!agent?._id) return;

        try {
            // 使用新的refreshAgent函数强制刷新数据
            const result = await refreshAgent(agent._id);

            if (result.success && result.agent) {
                // 更新本地状态
                setAgent(result.agent);
                return result.agent;
            } else {
                // 如果刷新失败，尝试使用现有数据
                const combinedAgent = getCombinedAgent(agent._id);
                if (combinedAgent) {
                    setAgent(combinedAgent);
                    return combinedAgent;
                }
                return null;
            }
        } catch (error) {
            throw error;
        }
    }, [agent?._id, refreshAgent, getCombinedAgent]);

    // 处理删除代理
    const handleDeleteAgent = async () => {
        if (!confirm('确定要删除此代理吗？此操作不可撤销。')) {
            return;
        }

        try {
            setIsDeleting(true);
            toast.loading('正在删除代理...');

            const result = await deleteAgent(agent._id);

            // 收到响应后立即关闭loading状态
            setIsDeleting(false);

            if (result.success) {
                toast.success('代理已成功删除');

                // 延迟跳转
                setTimeout(() => {
                    router.push('/agents');
                }, 1500);
            } else if (result.canceled) {
                toast.dismiss();
            } else {
                toast.error(result.error?.message || '删除代理失败，请重试');
            }
        } catch (error) {
            toast.error('删除代理失败: ' + error.message);
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
                message: '正在发送升级请求...',
                show: true
            });

            // 异步处理升级操作
            setTimeout(async () => {
                try {
                    const result = await upgradeAgent(agent._id);


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

    // 处理标签切换
    const handleTabChange = (tab) => {
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

            <header className="mb-6 px-4 py-5 bg-white dark:bg-gray-800 rounded-lg shadow-sm">
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                    <div className="flex-1 min-w-0">  {/* min-w-0 allows truncate to work properly */}
                        <h1 className="text-2xl font-bold text-gray-800 dark:text-white truncate">
                            {agent.hostname || agent.uuid}
                        </h1>
                        
                        <div className="mt-2 flex flex-wrap items-center gap-3">
                            {/* Status Badge */}
                            <span className={`inline-flex items-center px-2.5 py-1 text-xs font-medium rounded-full ${
                                agent.online
                                    ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400'
                                    : 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400'
                            }`}>
                                <span className={`inline-block w-2 h-2 rounded-full mr-1.5 ${
                                    agent.online
                                        ? 'bg-green-500 animate-pulse'
                                        : 'bg-red-500'
                                }`}></span>
                                {agent.online ? '在线' : '离线'}
                            </span>
                            
                            {/* Data Source Badge */}
                            {mqttConnected ? (
                                <span className="inline-flex items-center px-2.5 py-1 text-xs font-medium rounded-full bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400">
                                    <svg 
                                        className="w-4 h-4 animate-pulse" 
                                        viewBox="0 0 24 24" 
                                        fill="currentColor"
                                    >
                                        <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/>
                                    </svg>
                                </span>
                            ) : (
                                <span className="inline-flex items-center px-2.5 py-1 text-xs font-medium rounded-full bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300">
                                    数据库
                                </span>
                            )}
                            
                            {/* UUID Badge */}
                            <span className="inline-flex items-center px-2.5 py-1 text-xs font-medium rounded-full bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300">
                                <span className="font-normal mr-1">UUID:</span>
                                <span className="font-medium">{agent.uuid}</span>
                            </span>
                        </div>
                    </div>
                    
                    <div className="flex gap-2 self-end sm:self-auto">
                        <Button
                            variant="primary"
                            onClick={handleUpgradeAgent}
                            disabled={isUpgrading || !agent.online}
                            className="shadow-sm"
                        >
                            <Upload className={`w-4 h-4 mr-1.5 ${isUpgrading ? 'animate-spin' : ''}`}/>
                            {isUpgrading ? '升级中...' : '升级代理'}
                        </Button>
                        <Button
                            variant="danger"
                            onClick={handleDeleteAgent}
                            disabled={isDeleting}
                            className="shadow-sm"
                        >
                            <XCircle className={`w-4 h-4 mr-1.5 ${isDeleting ? 'animate-spin' : ''}`}/>
                            {isDeleting ? '删除中...' : '删除代理'}
                        </Button>
                    </div>
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
            <div className="flex border-b border-gray-200 dark:border-gray-700 mb-6 overflow-x-auto">
                <button
                    onClick={() => handleTabChange('info')}
                    className={`py-3 px-3 sm:px-6 text-xs sm:text-sm font-medium border-b-2 -mb-px flex items-center whitespace-nowrap ${
                        activeTab === 'info'
                            ? 'border-blue-500 text-blue-600 dark:text-blue-400 dark:border-blue-400'
                            : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 dark:text-gray-400 dark:hover:text-gray-300'
                    }`}
                >
                    <Info className="w-4 h-4 mr-1 sm:mr-2"/>
                    信息详情
                </button>

                <button
                    onClick={() => handleTabChange('nginx')}
                    className={`py-3 px-3 sm:px-6 text-xs sm:text-sm font-medium border-b-2 -mb-px flex items-center whitespace-nowrap ${
                        activeTab === 'nginx'
                            ? 'border-blue-500 text-blue-600 dark:text-blue-400 dark:border-blue-400'
                            : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 dark:text-gray-400 dark:hover:text-gray-300'
                    }`}
                    disabled={(!agent.online && !(agent.lastHeartbeat && new Date() - new Date(agent.lastHeartbeat) < 20000)) || !mqttConnected}
                >
                    <Server className="w-4 h-4 mr-1 sm:mr-2"/>
                    Nginx控制
                    {(!agent.online || !mqttConnected) && <span
                        className="ml-1 sm:ml-2 text-xs bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400 px-1 sm:px-1.5 py-0.5 rounded-full">
                        {!agent.online ? '离线' : 'MQTT未连接'}
                    </span>}
                </button>

                <button
                    onClick={() => handleTabChange('terminal')}
                    className={`py-3 px-3 sm:px-6 text-xs sm:text-sm font-medium border-b-2 -mb-px flex items-center whitespace-nowrap ${
                        activeTab === 'terminal'
                            ? 'border-blue-500 text-blue-600 dark:text-blue-400 dark:border-blue-400'
                            : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 dark:text-gray-400 dark:hover:text-gray-300'
                    }`}
                    disabled={!agent.online && !(agent.lastHeartbeat && new Date() - new Date(agent.lastHeartbeat) < 20000)}
                >
                    <TerminalSquare className="w-4 h-4 mr-1 sm:mr-2"/>
                    终端
                    {!agent.online && <span
                        className="ml-1 sm:ml-2 text-xs bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400 px-1 sm:px-1.5 py-0.5 rounded-full">离线</span>}
                </button>
            </div>

            {/* 信息详情选项卡 */}
            {activeTab === 'info' && (
                <div className="space-y-6">
                    {/* 基本状态信息 */}
                    <div className="bg-white rounded-lg shadow dark:bg-gray-800 overflow-hidden">
                        <div className="p-5 border-b border-gray-200 dark:border-gray-700">
                            <h2 className="text-lg font-medium text-gray-800 dark:text-white mb-4">基本状态</h2>
                            
                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                                {/* 最后心跳卡片 */}
                                <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-4 flex items-center">
                                    <div className="p-2 rounded-full bg-blue-100 dark:bg-blue-800/60 mr-3 flex-shrink-0">
                                        <Clock className="w-5 h-5 text-blue-500 dark:text-blue-400"/>
                                    </div>
                                    <div className="overflow-hidden">
                                        <p className="text-xs font-medium text-gray-500 dark:text-gray-400">最后心跳</p>
                                        <p className="text-sm font-medium dark:text-white truncate">
                                            {agent.lastHeartbeat
                                                ? formatDistanceToNow(new Date(agent.lastHeartbeat), {addSuffix: true, locale: zhCN})
                                                : '未知'}
                                        </p>
                                    </div>
                                </div>

                                {/* 操作系统卡片 */}
                                <div className="bg-green-50 dark:bg-green-900/20 rounded-lg p-4 flex items-center">
                                    <div className="p-2 rounded-full bg-green-100 dark:bg-green-800/60 mr-3 flex-shrink-0">
                                        <Cpu className="w-5 h-5 text-green-500 dark:text-green-400"/>
                                    </div>
                                    <div className="overflow-hidden">
                                        <p className="text-xs font-medium text-gray-500 dark:text-gray-400">操作系统</p>
                                        <p className="text-sm font-medium dark:text-white truncate" title={agent.os || '未知'}>
                                            {agent.os || '未知'}
                                        </p>
                                    </div>
                                </div>

                                {/* 内存卡片 */}
                                <div className="bg-purple-50 dark:bg-purple-900/20 rounded-lg p-4 flex items-center">
                                    <div className="p-2 rounded-full bg-purple-100 dark:bg-purple-800/60 mr-3 flex-shrink-0">
                                        <HardDrive className="w-5 h-5 text-purple-500 dark:text-purple-400"/>
                                    </div>
                                    <div className="overflow-hidden">
                                        <p className="text-xs font-medium text-gray-500 dark:text-gray-400">内存</p>
                                        <p className="text-sm font-medium dark:text-white truncate" title={agent.memory || '未知'}>
                                            {agent.memory || '未知'}
                                        </p>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* 详细信息 */}
                        <div className="p-5">
                            <h2 className="text-lg font-medium text-gray-800 dark:text-white mb-4">详细信息</h2>
                            
                            {/* 主要详细信息卡片风格 */}
                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
                                {/* IP 地址卡片 */}
                                <div className="bg-gray-50 dark:bg-gray-700/30 rounded-lg p-4 flex flex-col">
                                    <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-2">IP地址</h3>
                                    <div className="flex items-center">
                                        <p className="text-sm font-medium dark:text-white truncate flex-grow" title={agent.ip || '未知'}>
                                            {agent.ip || '未知'}
                                        </p>
                                        {agent.ip && (
                                            <button 
                                                onClick={() => {
                                                    navigator.clipboard.writeText(agent.ip);
                                                    toast.success('IP地址已复制到剪贴板');
                                                }}
                                                className="ml-2 p-1 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500 rounded-md"
                                                title="复制IP地址"
                                            >
                                                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                                                </svg>
                                            </button>
                                        )}
                                    </div>
                                </div>
                                
                                {/* URL 卡片 */}
                                <div className="bg-gray-50 dark:bg-gray-700/30 rounded-lg p-4 flex flex-col">
                                    <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-2">管理页面</h3>
                                    <div className="text-sm font-medium dark:text-white">
                                        {agent.url ? (
                                            <a
                                                href={agent.url}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className="text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300 flex items-center truncate"
                                                title={agent.url}
                                            >
                                                <span className="truncate">{agent.url}</span>
                                                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 ml-1 flex-shrink-0"
                                                     fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                                                          d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"/>
                                                </svg>
                                            </a>
                                        ) : '未设置'}
                                    </div>
                                </div>
                                
                                {/* 版本卡片 */}
                                <div className="bg-gray-50 dark:bg-gray-700/30 rounded-lg p-4 flex flex-col">
                                    <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-2">版本</h3>
                                    <p className="text-sm font-medium dark:text-white truncate" title={agent.buildVersion || '未知'}>
                                        {agent.buildVersion || '未知'}
                                    </p>
                                </div>
                            </div>
                            
                            {/* 次要详细信息 */}
                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                                {/* 构建时间 */}
                                <div className="border-l-2 border-blue-500 dark:border-blue-600 pl-3 py-1">
                                    <h3 className="text-xs font-medium text-gray-500 dark:text-gray-400">构建时间</h3>
                                    <p className="text-sm font-medium dark:text-white mt-1 truncate" title={agent.buildTime || '未知'}>
                                        {agent.buildTime || '未知'}
                                    </p>
                                </div>

                                {/* Hash */}
                                <div className="border-l-2 border-purple-500 dark:border-purple-600 pl-3 py-1">
                                    <h3 className="text-xs font-medium text-gray-500 dark:text-gray-400">Commit Hash</h3>
                                    <div className="flex items-center mt-1">
                                        <p className="text-sm font-medium dark:text-white flex-grow">
                                            {agent.commitId ? (
                                                <span title={agent.commitId}>
                                                    {agent.commitId.substring(0, 8)}
                                                </span>
                                            ) : '未知'}
                                        </p>
                                        {agent.commitId && (
                                            <button 
                                                onClick={() => {
                                                    navigator.clipboard.writeText(agent.commitId);
                                                    toast.success('Commit Hash已复制到剪贴板');
                                                }}
                                                className="ml-2 p-1 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 focus:outline-none focus:ring-2 focus:ring-purple-500 rounded-md"
                                                title="复制完整Hash值"
                                            >
                                                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                                                </svg>
                                            </button>
                                        )}
                                    </div>
                                </div>
                                
                                {/* 其他标识符 */}
                                <div className="border-l-2 border-green-500 dark:border-green-600 pl-3 py-1">
                                    <h3 className="text-xs font-medium text-gray-500 dark:text-gray-400">标识符</h3>
                                    <p className="text-sm font-medium dark:text-white mt-1 truncate" title={agent._id || '未知'}>
                                        {agent._id || '未知'}
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
                    {(agent.online || (agent.lastHeartbeat && new Date() - new Date(agent.lastHeartbeat) < 20000)) && mqttConnected ? (
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

            {activeTab === 'terminal' && (
                <div>
                    {agent.online || (agent.lastHeartbeat && new Date() - new Date(agent.lastHeartbeat) < 20000) ? (
                        <CommandExecutor agentUuid={agent.uuid} isActive={activeTab === 'terminal'}/>
                    ) : (
                        <div className="bg-white rounded-lg shadow dark:bg-gray-800 p-5 text-center">
                            <div className="py-10">
                                <div
                                    className="inline-flex items-center justify-center p-3 bg-red-100 dark:bg-red-900/30 rounded-full mb-4">
                                    <XCircle className="w-8 h-8 text-red-500 dark:text-red-400"/>
                                </div>
                                <h3 className="text-lg font-medium text-gray-800 dark:text-white mb-2">代理当前离线</h3>
                                <p className="text-gray-500 dark:text-gray-400 mb-4">
                                    无法执行命令，请等待代理重新上线后再试
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
