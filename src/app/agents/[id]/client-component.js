'use client';

import React, {useCallback, useEffect, useRef, useState} from 'react';
import {formatDistanceToNow} from 'date-fns';
import {zhCN} from 'date-fns/locale';
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
    Settings,
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
import AgentConfigForm from '@/components/ui/AgentConfigForm.jsx';
import toast from 'react-hot-toast';

export default function AgentDetail({agentId}) {
    const router = useRouter();
    const {connected: mqttConnected, subscribeToResponses} = useMqttStore();
    
    // 分别订阅各个状态，避免无限循环
    const deleteAgent = useAgentStore(state => state.deleteAgent);
    const upgradeAgent = useAgentStore(state => state.upgradeAgent);
    const getCombinedAgent = useAgentStore(state => state.getCombinedAgent);
    const refreshAgent = useAgentStore(state => state.refreshAgent);
    const getAgentById = useAgentStore(state => state.getAgentById);
    const fetchAgents = useAgentStore(state => state.fetchAgents);
    const mqttAgentState = useAgentStore(state => state.mqttAgentState);

    const [renderKey, setRenderKey] = useState(0);
    const [isDeleting, setIsDeleting] = useState(false);
    const [isUpgrading, setIsUpgrading] = useState(false);
    const [upgradeStatus, setUpgradeStatus] = useState({
        type: '',
        message: '',
        show: false
    });
    const [agent, setAgent] = useState(null);
    const [isLoading, setIsLoading] = useState(false);

    // 防止频繁重新订阅的引用
    const subscriptionRef = useRef(null);
    const statusTimeoutRef = useRef(null);
    
    // 存储当前代理的UUID，用于mqttAgentState监听
    const agentUuidRef = useRef(null);

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
    
    // 配置管理状态
    const [isSavingConfig, setIsSavingConfig] = useState(false);
    const [isRefreshingIP, setIsRefreshingIP] = useState(false);

    // 初始化代理数据 - 优先使用现有状态
    useEffect(() => {
        if (!isMounted || !agentId) {
            return;
        }

        // 首先尝试从store中获取代理数据
        const existingAgent = getAgentById(agentId);
        if (existingAgent) {
            // 如果存在，优先使用合并后的数据
            const combinedAgent = getCombinedAgent(agentId);
            setAgent(combinedAgent || existingAgent);
            setIsLoading(false);
        } else {
            // 如果store中没有数据，则需要加载
            setIsLoading(true);
            let retryCount = 0;
            const maxRetries = 3;
            
            const loadAgentData = async () => {
                try {
                    // 确保agent store已初始化
                    const fetchResult = await fetchAgents();
                    
                    // 只有在 fetchAgents 成功且返回数据时才继续
                    if (fetchResult.success && fetchResult.data && fetchResult.data.length > 0) {
                        // 再次尝试获取代理数据
                        const agent = getAgentById(agentId);
                        if (agent) {
                            const combinedAgent = getCombinedAgent(agentId);
                            setAgent(combinedAgent || agent);
                            setIsLoading(false);
                        } else {
                            // 如果仍然没有找到，可能代理不存在
                            setAgent(null);
                            setIsLoading(false);
                        }
                    } else {
                        // 如果 fetchAgents 返回空数据，等待下次自动重试
                        retryCount++;
                        
                        if (retryCount < maxRetries) {
                            // 稍后重试
                            setTimeout(() => {
                                void loadAgentData();
                            }, 1000);
                        } else {
                            // 超过最大重试次数，设置为代理不存在
                            setAgent(null);
                            setIsLoading(false);
                        }
                    }
                } catch (error) {
                    console.error('加载代理数据失败:', error);
                    setAgent(null);
                    setIsLoading(false);
                }
            };
            
            void loadAgentData();
        }
    }, [isMounted, agentId, getAgentById, getCombinedAgent, fetchAgents]);

    // 初始化MQTT连接
    useEffect(() => {
        if (isMounted && !mqttConnected) {
            useMqttStore.getState().connect().catch(() => {
                // Silently handle connection errors
            });
        }
    }, [isMounted, mqttConnected]);

    // 处理函数 - 处理代理状态更新
    const handleAgentUpdate = useCallback(() => {
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

    // 监听MQTT实时状态更新 - 优化订阅逻辑
    useEffect(() => {
        if (!agent?.uuid) return;

        // 如果已经有订阅且是同一个代理，不重复订阅
        if (subscriptionRef.current && agentUuidRef.current === agent.uuid) {
            return;
        }

        // 清理之前的订阅
        if (subscriptionRef.current) {
            subscriptionRef.current();
            subscriptionRef.current = null;
        }

        // 更新当前代理UUID
        agentUuidRef.current = agent.uuid;

        // 如果MQTT已连接，立即订阅
        if (mqttConnected) {
            subscriptionRef.current = subscribeToResponses(agent.uuid, handleAgentUpdate);
            
            // 立即获取最新状态
            const combinedAgent = getCombinedAgent(agent._id);
            if (combinedAgent && JSON.stringify(combinedAgent) !== JSON.stringify(agent)) {
                setAgent(combinedAgent);
            }
        }

        // 组件卸载时取消订阅
        return () => {
            if (subscriptionRef.current) {
                subscriptionRef.current();
                subscriptionRef.current = null;
            }
        };
    }, [agent?.uuid, agent?._id, agent, mqttConnected, subscribeToResponses, handleAgentUpdate, getCombinedAgent]); // 添加缺失的依赖

    // 单独处理MQTT连接状态变化
    useEffect(() => {
        if (mqttConnected && agent?.uuid && !subscriptionRef.current) {
            // MQTT连接成功且没有订阅时，建立订阅
            subscriptionRef.current = subscribeToResponses(agent.uuid, handleAgentUpdate);
        }
    }, [mqttConnected, agent?.uuid, subscribeToResponses, handleAgentUpdate]);

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
        
        // 每10秒刷新一次代理状态（降低频率，减少性能开销）
        const refreshInterval = setInterval(() => {
            try {
                const newAgent = getCombinedAgent(agent._id);
                if (newAgent) {
                    // 只在关键字段变化时更新状态，减少不必要的重渲染
                    const hasSignificantChange = 
                        newAgent.online !== agent.online ||
                        newAgent.lastHeartbeat !== agent.lastHeartbeat ||
                        newAgent.buildVersion !== agent.buildVersion;
                    
                    if (hasSignificantChange) {
                        setAgent(newAgent);
                    }
                }
            } catch (error) {
                // 静默处理错误
            }
        }, 10000); // 改为10秒刷新一次
        
        return () => {
            clearInterval(refreshInterval);
        };
    }, [agent?._id, agent?.lastHeartbeat, agent?.online, agent?.buildVersion, getCombinedAgent, isMounted]); // 添加缺失的依赖
    
    // 监听mqttAgentState变化，确保立即更新代理状态
    useEffect(() => {
        if (!agent?._id || !agent?.uuid || !isMounted) return;
        
        // 检查MQTT状态中是否有当前代理的数据
        const mqttData = mqttAgentState?.[agent.uuid];
        if (!mqttData) return;
        
        // 检查关键状态是否变化（减少不必要的更新）
        const hasStateChange = 
            mqttData.online !== agent.online ||
            mqttData.lastHeartbeat !== agent.lastHeartbeat;
        
        if (hasStateChange) {
            // 使用getCombinedAgent获取完整的合并状态
            const currentAgent = getCombinedAgent(agent._id);
            if (currentAgent) {
                setAgent(currentAgent);
            }
        }
    }, [agent?.uuid, agent?._id, agent?.lastHeartbeat, agent?.online, mqttAgentState, getCombinedAgent, isMounted]); // 添加缺失的依赖

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

        let loadingToastId;
        try {
            setIsDeleting(true);
            loadingToastId = toast.loading('正在删除代理...');

            const result = await deleteAgent(agent._id);

            // 收到响应后立即关闭loading状态
            setIsDeleting(false);
            toast.dismiss(loadingToastId);

            if (result.success) {
                toast.success('代理已成功删除');

                // 延迟跳转
                setTimeout(() => {
                    router.push('/agents');
                }, 1500);
            } else if (result.canceled) {
                // loading toast 已经被关闭了，不需要再dismiss
            } else {
                toast.error(result.error?.message || '删除代理失败，请重试');
            }
        } catch (error) {
            setIsDeleting(false);
            if (loadingToastId) {
                toast.dismiss(loadingToastId);
            }
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
            void refreshAgentData();
        }


        // 清除命令状态消息
        if (tab !== 'nginx') {
            clearMessage();
        }
        
    };


    // 保存Agent配置
    const saveAgentConfig = async (config) => {
        if (isSavingConfig || !agent?.uuid) return;
        
        setIsSavingConfig(true);
        
        try {
            // 使用 mqttStore 发送配置更新命令
            const result = await useMqttStore.getState().updateConfig(agent.uuid, config);
            
            toast.success(`配置更新已发送到Agent: ${result.message || '配置已更新，Agent将在3秒后重启'}`);
            
        } catch (error) {
            toast.error('配置更新失败: ' + error.message);
        } finally {
            setIsSavingConfig(false);
        }
    };

    // 刷新IP地址
    const handleRefreshIP = async () => {
        if (isRefreshingIP || !agent?.online || !mqttConnected) return;

        try {
            setIsRefreshingIP(true);
            const loadingToastId = toast.loading('正在刷新IP地址...');

            await useMqttStore.getState().refreshIP(agent.uuid);
            
            toast.dismiss(loadingToastId);
            toast.success('IP地址刷新命令已发送，Agent将更新IP地址');
            
        } catch (error) {
            setIsRefreshingIP(false);
            toast.error('刷新IP地址失败: ' + error.message);
        } finally {
            setIsRefreshingIP(false);
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

    // 加载状态
    if (isLoading) {
        return (
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 text-center">
                <div className="flex flex-col items-center">
                    <svg className="animate-spin h-8 w-8 text-blue-500 dark:text-blue-400 mb-4" xmlns="http://www.w3.org/2000/svg"
                        fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor"
                            strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor"
                            d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    <p className="text-gray-500 dark:text-gray-400">正在加载代理信息...</p>
                </div>
            </div>
        );
    }

    // 未找到代理
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
                <Link href="/agents" className="flex items-center text-blue-400 hover:text-blue-800">
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
                            variant="ghost"
                            onClick={handleDeleteAgent}
                            disabled={isDeleting}
                            className="text-red-600 hover:text-red-700 hover:bg-red-50 dark:text-red-400 dark:hover:text-red-300 dark:hover:bg-red-900/30"
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
                            ? 'border-blue-400 text-blue-400 dark:text-blue-400 dark:border-blue-400'
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
                            ? 'border-blue-400 text-blue-400 dark:text-blue-400 dark:border-blue-400'
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
                            ? 'border-blue-400 text-blue-400 dark:text-blue-400 dark:border-blue-400'
                            : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 dark:text-gray-400 dark:hover:text-gray-300'
                    }`}
                    disabled={!agent.online && !(agent.lastHeartbeat && new Date() - new Date(agent.lastHeartbeat) < 20000)}
                >
                    <TerminalSquare className="w-4 h-4 mr-1 sm:mr-2"/>
                    终端
                    {!agent.online && <span
                        className="ml-1 sm:ml-2 text-xs bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400 px-1 sm:px-1.5 py-0.5 rounded-full">离线</span>}
                </button>

                <button
                    onClick={() => handleTabChange('config')}
                    className={`py-3 px-3 sm:px-6 text-xs sm:text-sm font-medium border-b-2 -mb-px flex items-center whitespace-nowrap ${
                        activeTab === 'config'
                            ? 'border-blue-400 text-blue-400 dark:text-blue-400 dark:border-blue-400'
                            : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 dark:text-gray-400 dark:hover:text-gray-300'
                    }`}
                    disabled={(!agent.online && !(agent.lastHeartbeat && new Date() - new Date(agent.lastHeartbeat) < 20000)) || !mqttConnected}
                >
                    <Settings className="w-4 h-4 mr-1 sm:mr-2"/>
                    配置管理
                    {(!agent.online || !mqttConnected) && <span
                        className="ml-1 sm:ml-2 text-xs bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400 px-1 sm:px-1.5 py-0.5 rounded-full">
                        {!agent.online ? '离线' : 'MQTT未连接'}
                    </span>}
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
                                        <div className="flex gap-1">
                                            {agent.ip && (
                                                <Button 
                                                    onClick={async () => {
                                                        try {
                                                            await navigator.clipboard.writeText(agent.ip);
                                                            toast.success('IP地址已复制到剪贴板');
                                                        } catch (error) {
                                                            toast.error('复制失败');
                                                        }
                                                    }}
                                                    variant="ghost"
                                                    size="icon"
                                                    title="复制IP地址"
                                                >
                                                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                                                    </svg>
                                                </Button>
                                            )}
                                            {(agent.online || (agent.lastHeartbeat && new Date() - new Date(agent.lastHeartbeat) < 20000)) && mqttConnected && (
                                                <Button 
                                                    onClick={handleRefreshIP}
                                                    variant="ghost"
                                                    size="icon"
                                                    disabled={isRefreshingIP}
                                                    title="刷新IP地址"
                                                >
                                                    <RefreshCw className={`h-4 w-4 ${isRefreshingIP ? 'animate-spin' : ''}`} />
                                                </Button>
                                            )}
                                        </div>
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
                                                className="text-blue-400 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300 flex items-center truncate"
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
                                <div className="border-l-2 border-blue-400 dark:border-blue-600 pl-3 py-1">
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
                                            <Button 
                                                onClick={async () => {
                                                    try {
                                                        await navigator.clipboard.writeText(agent.commitId);
                                                        toast.success('Commit Hash已复制到剪贴板');
                                                    } catch (error) {
                                                        toast.error('复制失败');
                                                    }
                                                }}
                                                variant="ghost"
                                                size="icon"
                                                title="复制完整Hash值"
                                            >
                                                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                                                </svg>
                                            </Button>
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
                                        <Button
                                            onClick={reloadNginx}
                                            disabled={isExecuting}
                                            variant="default"
                                            size="sm"
                                            title="重载Nginx配置"
                                        >
                                            <RotateCw className={`w-4 h-4 mr-2 ${isExecuting ? 'animate-spin' : ''}`}/>
                                            重载配置
                                        </Button>
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
                                        <Button
                                            onClick={restartNginx}
                                            disabled={isExecuting}
                                            variant="default"
                                            size="sm"
                                            title="重启Nginx服务"
                                            className="bg-green-500 hover:bg-green-600 dark:bg-green-600 dark:hover:bg-green-700"
                                        >
                                            <RefreshCw className={`w-4 h-4 mr-2 ${isExecuting ? 'animate-spin' : ''}`}/>
                                            重启服务
                                        </Button>
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
                                        <Button
                                            onClick={stopNginx}
                                            disabled={isExecuting}
                                            variant="destructive"
                                            size="sm"
                                            title="停止Nginx服务"
                                        >
                                            <Square className="w-4 h-4 mr-2"/>
                                            停止服务
                                        </Button>
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
                                        <Button
                                            onClick={startNginx}
                                            disabled={isExecuting}
                                            variant="default"
                                            size="sm"
                                            title="启动Nginx服务"
                                            className="bg-purple-500 hover:bg-purple-600 dark:bg-purple-600 dark:hover:bg-purple-700"
                                        >
                                            <Play className="w-4 h-4 mr-2"/>
                                            启动服务
                                        </Button>
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

            {/* 配置管理选项卡 */}
            {activeTab === 'config' && (
                <div>
                    
                    {(agent.online || (agent.lastHeartbeat && new Date() - new Date(agent.lastHeartbeat) < 20000)) && mqttConnected ? (
                        <AgentConfigForm
                            onSave={saveAgentConfig}
                            isSaving={isSavingConfig}
                            agent={agent}
                        />
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
                                        ? '无法管理配置，请等待代理重新上线后再试'
                                        : 'MQTT连接失败，无法发送配置命令，请检查MQTT设置'}
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
