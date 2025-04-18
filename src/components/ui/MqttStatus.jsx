'use client';

import { useEffect, useState, useRef } from 'react';
import { useMqtt } from '@/app/contexts/MqttContext';
import { Wifi, WifiOff, Settings, RefreshCw, Loader2 } from 'lucide-react';

export default function MqttStatus() {
    const { connected, error, isMqttEnabled, setIsMqttEnabled, reconnect } = useMqtt();
    const [isClient, setIsClient] = useState(false);
    const [showSettings, setShowSettings] = useState(false);
    const [localMqttEnabled, setLocalMqttEnabled] = useState(false);
    const [isToggling, setIsToggling] = useState(false);
    const [isReconnecting, setIsReconnecting] = useState(false);
    const settingsRef = useRef(null);
    const lastActionRef = useRef(null);

    // 确保只在客户端渲染
    useEffect(() => {
        setIsClient(true);
        if (typeof isMqttEnabled !== 'undefined') {
            setLocalMqttEnabled(isMqttEnabled);
        }
    }, []);

    // 将本地状态与上下文状态同步
    useEffect(() => {
        if (typeof isMqttEnabled !== 'undefined' && !isToggling) {
            setLocalMqttEnabled(isMqttEnabled);
        }
    }, [isMqttEnabled, isToggling]);

    // 处理点击外部关闭设置面板
    useEffect(() => {
        function handleClickOutside(event) {
            if (settingsRef.current && !settingsRef.current.contains(event.target)) {
                setShowSettings(false);
            }
        }

        document.addEventListener('mousedown', handleClickOutside);
        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, []);

    // 如果不是客户端渲染，返回null
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
                reconnect();
            }, 100);
        }
    };

    // 手动重新连接
    const handleReconnect = () => {
        if (!localMqttEnabled) return;

        lastActionRef.current = `尝试重新连接 (${new Date().toLocaleTimeString()})`;
        setIsReconnecting(true);
        reconnect();

        setTimeout(() => {
            setIsReconnecting(false);
        }, 2000);
    };

    // 获取状态颜色
    const getStatusColor = () => {
        if (connected) return 'bg-green-500';
        if (error) return 'bg-red-500';
        return 'bg-gray-400';
    };

    // 获取按钮样式
    const getButtonStyle = () => {
        if (connected) return 'text-green-700 bg-green-50 hover:bg-green-100 border-green-200';
        if (error) return 'text-red-700 bg-red-50 hover:bg-red-100 border-red-200';
        return 'text-gray-600 bg-gray-50 hover:bg-gray-100 border-gray-200';
    };

    return (
        <div className="relative" ref={settingsRef}>
            <button
                onClick={() => setShowSettings(!showSettings)}
                className={`flex items-center gap-2 px-3 py-1.5 rounded-full border ${getButtonStyle()} transition-colors duration-300`}
                aria-label="MQTT设置"
                title={connected ? "MQTT已连接" : error ? "MQTT连接错误" : "MQTT未连接"}
            >
                {connected ? (
                    <Wifi className="w-4 h-4" />
                ) : (
                    <WifiOff className="w-4 h-4" />
                )}
                <span className="text-xs font-medium hidden sm:inline">MQTT</span>
                <span className={`inline-block w-2 h-2 rounded-full ${getStatusColor()}`}></span>
            </button>

            {showSettings && (
                <div className="absolute right-0 top-full mt-2 w-64 bg-white rounded-lg shadow-lg border border-gray-200 z-50 overflow-hidden sm:min-w-64">
                    <div className="p-3 border-b border-gray-100">
                        <div className="flex items-center justify-between">
                            <h3 className="text-sm font-medium text-gray-700 flex items-center">
                                <Settings className="w-4 h-4 mr-1 text-gray-500" />
                                MQTT设置
                            </h3>
                            <button
                                onClick={() => setShowSettings(false)}
                                className="text-gray-400 hover:text-gray-600 rounded-full p-1 hover:bg-gray-100"
                                aria-label="关闭"
                            >
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                                    <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                                </svg>
                            </button>
                        </div>
                    </div>

                    <div className="p-3">
                        <div className="mb-3 flex items-center justify-between">
                            <div className="flex items-center">
                                <div className={`w-3 h-3 rounded-full mr-2 ${getStatusColor()}`}></div>
                                <span className="text-sm">
                                    {connected ? '已连接' : error ? '连接错误' : '未连接'}
                                </span>
                            </div>
                            <span className="text-xs text-gray-500">
                                {connected ? '实时监控中' : (localMqttEnabled ? '尝试连接中...' : '已禁用')}
                            </span>
                        </div>

                        {/* 显示上次操作信息 */}
                        {lastActionRef.current && (
                            <div className="mb-3 text-xs text-gray-600 italic">
                                <div className="text-ellipsis overflow-hidden whitespace-nowrap">
                                    上次操作: {lastActionRef.current}
                                </div>
                            </div>
                        )}

                        {error && (
                            <div className="mb-3 p-2 bg-red-50 rounded text-xs text-red-600 border border-red-100">
                                <div className="text-ellipsis overflow-hidden">
                                    错误: {typeof error === 'string' ? error : '连接失败'}
                                </div>
                            </div>
                        )}

                        {/* 统一开关按钮样式 */}
                        <div className="mb-4">
                            <div className="flex items-center justify-between">
                                <span className="text-sm text-gray-700 flex-shrink-0 mr-3">启用MQTT</span>
                                <div className="inline-block" style={{ width: '44px', flexShrink: 0 }}>
                                    <div className="relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
                                         style={{ backgroundColor: localMqttEnabled ? '#2563eb' : '#e5e7eb' }}
                                         onClick={toggleMqtt}
                                         role="switch"
                                         aria-checked={localMqttEnabled}
                                         tabIndex={0}
                                    >
                                        <span className="sr-only">
                                            {localMqttEnabled ? '禁用MQTT' : '启用MQTT'}
                                        </span>
                                        <span
                                            aria-hidden="true"
                                            className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                                                isToggling ? 'opacity-70' : ''
                                            } ${localMqttEnabled ? 'translate-x-5' : 'translate-x-0'}`}
                                        />
                                    </div>
                                </div>
                            </div>
                        </div>

                        <button
                            onClick={handleReconnect}
                            disabled={!localMqttEnabled || isReconnecting}
                            className={`w-full py-2 px-3 rounded-md text-sm font-medium flex items-center justify-center ${
                                localMqttEnabled && !isReconnecting
                                    ? 'bg-blue-600 text-white hover:bg-blue-700'
                                    : 'bg-gray-100 text-gray-400 cursor-not-allowed'
                            } transition-colors duration-200`}
                        >
                            {isReconnecting ? (
                                <>
                                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                    连接中...
                                </>
                            ) : (
                                <>
                                    <RefreshCw className="w-4 h-4 mr-2" />
                                    重新连接
                                </>
                            )}
                        </button>

                        <p className="mt-3 text-xs text-gray-500">
                            使用MQTT可以实现更实时的代理监控和控制
                        </p>
                    </div>
                </div>
            )}
        </div>
    );
}
