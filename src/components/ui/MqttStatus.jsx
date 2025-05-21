'use client';

import {useEffect, useRef, useState} from 'react';
import {Info, Loader2, RefreshCw, Settings, Wifi, WifiOff} from 'lucide-react';
import Switch from '@/components/ui/Switch.jsx';
import useMqttStore from '@/store/mqttStore';

export default function MqttStatus() {
    const { connected, error, connect: reconnect } = useMqttStore();
    const [isMqttEnabled, setIsMqttEnabled] = useState(true);
    const [isClient, setIsClient] = useState(false);
    const [showSettings, setShowSettings] = useState(false);
    const [localMqttEnabled, setLocalMqttEnabled] = useState(false);
    const [isToggling, setIsToggling] = useState(false);
    const [isReconnecting, setIsReconnecting] = useState(false);
    const [tooltipVisible, setTooltipVisible] = useState(false);
    const [isMobile, setIsMobile] = useState(false);
    const [reconnectAttempt, setReconnectAttempt] = useState(0);
    const settingsRef = useRef(null);
    const tooltipRef = useRef(null);
    const lastActionRef = useRef(null);
    const reconnectTimerRef = useRef(null);

    // 检查设备类型
    useEffect(() => {
        const checkIsMobile = () => {
            setIsMobile(window.innerWidth < 768);
            if (window.innerWidth < 768 && showSettings) {
                setShowSettings(false);
            }
        };

        // 初始检查
        checkIsMobile();

        // 添加窗口大小变化监听
        window.addEventListener('resize', checkIsMobile);

        return () => window.removeEventListener('resize', checkIsMobile);
    }, [showSettings]);

    // 确保组件只在客户端渲染
    useEffect(() => {
        setIsClient(true);
        if (typeof isMqttEnabled !== 'undefined') {
            setLocalMqttEnabled(isMqttEnabled);
        }
        
        // 清理计时器
        return () => {
            if (reconnectTimerRef.current) {
                clearTimeout(reconnectTimerRef.current);
            }
        };
    }, []);

    // 同步本地状态与上下文状态
    useEffect(() => {
        if (typeof isMqttEnabled !== 'undefined' && !isToggling) {
            setLocalMqttEnabled(isMqttEnabled);
        }
    }, [isMqttEnabled, isToggling]);

    // 监听MQTT连接状态变化
    useEffect(() => {
        // 如果连接断开，但本地显示已启用，可能需要触发重连
        if (!connected && localMqttEnabled && !isReconnecting && isClient) {
            // 尝试自动重连
            if (reconnectTimerRef.current) {
                clearTimeout(reconnectTimerRef.current);
            }
            
            reconnectTimerRef.current = setTimeout(() => {
                console.log('自动尝试重连MQTT...');
                handleReconnect();
            }, 3000); // 3秒后自动尝试重连
        }
    }, [connected, localMqttEnabled, isReconnecting, isClient]);

    // 点击外部区域关闭菜单
    useEffect(() => {
        function handleClickOutside(event) {
            if (settingsRef.current && !settingsRef.current.contains(event.target)) {
                setShowSettings(false);
            }

            if (tooltipRef.current && !tooltipRef.current.contains(event.target)) {
                setTooltipVisible(false);
            }
        }

        document.addEventListener('mousedown', handleClickOutside);
        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, []);

    // 如果未客户端渲染，返回null
    if (!isClient) {
        return null;
    }

    // 切换MQTT状态
    const toggleMqtt = () => {
        if (isToggling) return;
        setIsToggling(true);
        const newState = !localMqttEnabled;
        setLocalMqttEnabled(newState);
        setIsMqttEnabled(newState);
        lastActionRef.current = `已${newState ? '启用' : '禁用'} MQTT (${new Date().toLocaleTimeString()})`;

        setTimeout(() => {
            setIsToggling(false);
        }, 1000);

        if (newState) {
            setTimeout(() => {
                handleReconnect();
            }, 100);
        }
    };

    // 手动重连
    const handleReconnect = async () => {
        if (!localMqttEnabled) return;

        // 防止频繁点击重连按钮
        if (isReconnecting) return;
        
        // 记录重连时间
        const attemptNumber = reconnectAttempt + 1;
        setReconnectAttempt(attemptNumber);
        lastActionRef.current = `尝试重新连接 (#${attemptNumber}, ${new Date().toLocaleTimeString()})`;
        setIsReconnecting(true);
        
        try {
            // 调用重连
            await reconnect();
            
            // 等待短暂停，确保状态更新
            setTimeout(() => {
                // 检查连接状态
                const currentConnected = useMqttStore.getState().connected;
                
                if (currentConnected) {
                    lastActionRef.current = `连接成功 (#${attemptNumber}, ${new Date().toLocaleTimeString()})`;
                    console.log('MQTT重连成功，当前状态:', currentConnected ? '已连接' : '未连接');
                } else {
                    lastActionRef.current = `连接失败 (#${attemptNumber}, ${new Date().toLocaleTimeString()})`;
                    console.log('MQTT重连失败，当前状态仍然是:', currentConnected ? '已连接' : '未连接');
                    
                    // 如果连接失败，设置自动重试
                    if (reconnectTimerRef.current) {
                        clearTimeout(reconnectTimerRef.current);
                    }
                    
                    reconnectTimerRef.current = setTimeout(() => {
                        if (localMqttEnabled && !currentConnected) {
                            console.log('触发自动重连...');
                            handleReconnect();
                        }
                    }, 10000); // 10秒后自动重试
                }
            }, 1000); // 等待1秒确保状态更新
        } catch (error) {
            console.error('MQTT重连失败:', error);
            lastActionRef.current = `连接失败: ${error.message} (#${attemptNumber}, ${new Date().toLocaleTimeString()})`;
            
            // 如果连接失败，设置自动重试
            if (reconnectTimerRef.current) {
                clearTimeout(reconnectTimerRef.current);
            }
            
            reconnectTimerRef.current = setTimeout(() => {
                if (localMqttEnabled && !connected) {
                    console.log('触发自动重连...');
                    handleReconnect();
                }
            }, 10000); // 10秒后自动重试
        } finally {
            // 重置重连状态
            setTimeout(() => {
                setIsReconnecting(false);
            }, 2000);
        }
    };

    // 获取状态颜色
    const getStatusColor = () => {
        if (connected) return 'bg-green-500';
        if (error) return 'bg-red-500';
        return 'bg-gray-400';
    };

    // 获取按钮样式
    const getButtonStyle = () => {
        if (connected) return 'text-green-700 bg-green-50 hover:bg-green-100 border-green-200 dark:text-green-400 dark:bg-green-900/30 dark:hover:bg-green-800/40 dark:border-green-800';
        if (error) return 'text-red-700 bg-red-50 hover:bg-red-100 border-red-200 dark:text-red-400 dark:bg-red-900/30 dark:hover:bg-red-800/40 dark:border-red-800';
        return 'text-gray-600 bg-gray-50 hover:bg-gray-100 border-gray-200 dark:text-gray-400 dark:bg-gray-800 dark:hover:bg-gray-700 dark:border-gray-700';
    };

    return (
        <div className="relative" ref={settingsRef}>
            {/* 信息提示 */}
            {tooltipVisible && (
                <div
                    ref={tooltipRef}
                    className="absolute right-0 top-0 mt-10 p-3 bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 z-50 w-64"
                >
                    <h3 className="text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">MQTT状态信息</h3>
                    <p className="text-xs text-gray-600 dark:text-gray-400">
                        MQTT为实时监控提供低延迟通信，启用后可实时查看和控制代理节点。
                    </p>
                    {connected && (
                        <div className="mt-2 text-xs">
                            <div className="font-medium text-green-700 dark:text-green-400">实时监控中</div>
                        </div>
                    )}
                </div>
            )}

            <div className="flex items-center gap-0.5">
                {/* 移动端简化显示 */}
                {isMobile ? (
                    <button
                        onClick={() => setShowSettings(!showSettings)}
                        className={`flex items-center justify-center p-1.5 rounded-full ${getButtonStyle()} transition-colors duration-300`}
                        aria-label={connected ? 'MQTT已连接' : error ? 'MQTT连接错误' : 'MQTT未连接'}
                        title={connected ? 'MQTT已连接' : error ? 'MQTT连接错误' : 'MQTT未连接'}
                    >
                        {connected ? (
                            <Wifi className="w-5 h-5 text-green-500 dark:text-green-400"/>
                        ) : (
                            <WifiOff className="w-5 h-5 text-gray-500 dark:text-gray-400"/>
                        )}
                    </button>
                ) : (
                    // 桌面版完整显示
                    <>
                        {/* 信息按钮 */}
                        <button
                            onClick={() => setTooltipVisible(!tooltipVisible)}
                            className="text-gray-400 hover:text-gray-600 dark:text-gray-500 dark:hover:text-gray-300 focus:outline-none p-1"
                            aria-label="MQTT信息"
                        >
                            <Info className="w-4 h-4"/>
                        </button>

                        {/* MQTT状态按钮 */}
                        <button
                            onClick={() => setShowSettings(!showSettings)}
                            className={`flex items-center gap-1.5 px-2 py-1 rounded-full border ${getButtonStyle()} transition-colors duration-300`}
                            aria-label="MQTT设置"
                            title={connected ? 'MQTT已连接' : error ? 'MQTT连接错误' : 'MQTT未连接'}
                        >
                            {connected ? (
                                <Wifi className="w-4 h-4"/>
                            ) : (
                                <WifiOff className="w-4 h-4"/>
                            )}
                            <span className="text-xs font-medium hidden sm:inline">MQTT</span>
                            <span className={`inline-block w-2 h-2 rounded-full ${getStatusColor()}`}></span>
                        </button>
                    </>
                )}
            </div>

            {/* 设置面板 - 移动端和桌面端共用 */}
            {showSettings && (
                <div
                    className="absolute right-0 top-full mt-2 w-64 bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 z-50 overflow-hidden">
                    <div className="p-3 border-b border-gray-100 dark:border-gray-700">
                        <div className="flex items-center justify-between">
                            <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 flex items-center">
                                <Settings className="w-4 h-4 mr-1 text-gray-500 dark:text-gray-400"/>
                                MQTT设置
                            </h3>
                            <button
                                onClick={() => setShowSettings(false)}
                                className="text-gray-400 hover:text-gray-600 dark:text-gray-500 dark:hover:text-gray-300 rounded-full p-1 hover:bg-gray-100 dark:hover:bg-gray-700"
                                aria-label="关闭"
                            >
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20"
                                     fill="currentColor">
                                    <path fillRule="evenodd"
                                          d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"
                                          clipRule="evenodd"/>
                                </svg>
                            </button>
                        </div>
                    </div>

                    <div className="p-3">
                        <div className="mb-3 flex items-center justify-between">
                            <div className="flex items-center">
                                <div className={`w-3 h-3 rounded-full mr-2 ${getStatusColor()}`}></div>
                                <span className="text-sm dark:text-gray-300">
                                    {connected ? '已连接' : error ? '连接错误' : '未连接'}
                                </span>
                            </div>
                            <span className="text-xs text-gray-500 dark:text-gray-400">
                                {connected ? '实时监控中' : (localMqttEnabled ? '尝试连接中...' : '已禁用')}
                            </span>
                        </div>

                        {/* 显示上次操作信息 */}
                        {lastActionRef.current && (
                            <div className="mb-3 text-xs text-gray-600 dark:text-gray-400 italic">
                                <div className="text-ellipsis overflow-hidden whitespace-nowrap">
                                    上次操作: {lastActionRef.current}
                                </div>
                            </div>
                        )}

                        {/* 显示错误信息 */}
                        {error && (
                            <div className="mb-3 p-2 bg-red-50 dark:bg-red-900/30 rounded text-xs text-red-600 dark:text-red-300 border border-red-100 dark:border-red-800">
                                <div className="text-ellipsis overflow-hidden">
                                    错误: {typeof error === 'string' ? error : '连接失败'}
                                </div>
                            </div>
                        )}

                        {/* MQTT开关 */}
                        <div className="mb-4 flex items-center justify-between">
                            <Switch
                                label="启用MQTT"
                                checked={localMqttEnabled}
                                onChange={toggleMqtt}
                                disabled={isToggling}
                            />
                        </div>

                        {/* 重连按钮 */}
                        <button
                            onClick={handleReconnect}
                            disabled={!localMqttEnabled || isReconnecting}
                            className={`w-full py-2 px-3 rounded-md text-sm font-medium flex items-center justify-center ${
                                localMqttEnabled && !isReconnecting
                                    ? 'bg-blue-600 text-white hover:bg-blue-700 dark:bg-blue-700 dark:hover:bg-blue-600'
                                    : 'bg-gray-100 text-gray-400 cursor-not-allowed dark:bg-gray-700 dark:text-gray-500'
                            } transition-colors duration-200`}
                        >
                            {isReconnecting ? (
                                <>
                                    <Loader2 className="w-4 h-4 mr-2 animate-spin"/>
                                    连接中...
                                </>
                            ) : (
                                <>
                                    <RefreshCw className="w-4 h-4 mr-2"/>
                                    重新连接
                                </>
                            )}
                        </button>

                        {/* 提示文本 */}
                        <p className="mt-3 text-xs text-gray-500 dark:text-gray-400">
                            使用MQTT可以实现更实时的代理监控和控制
                        </p>
                    </div>
                </div>
            )}
        </div>
    );
}
