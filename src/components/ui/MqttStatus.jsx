// src/components/ui/MqttStatus.jsx
'use client';

import { useEffect, useState } from 'react';
import { useMqtt } from '@/app/contexts/MqttContext';
import { Radio, Wifi, WifiOff, Settings } from 'lucide-react';

export default function MqttStatus() {
    const { connected, error, isMqttEnabled, setIsMqttEnabled, reconnect } = useMqtt();
    const [isClient, setIsClient] = useState(false);
    const [showSettings, setShowSettings] = useState(false);

    // 确保只在客户端渲染
    useEffect(() => {
        setIsClient(true);
    }, []);

    // 如果不是客户端渲染，返回null
    if (!isClient) {
        return null;
    }

    const toggleMqtt = () => {
        setIsMqttEnabled(!isMqttEnabled);
    };

    const handleReconnect = () => {
        reconnect();
    };

    return (
        <div className="relative">
            <button
                onClick={() => setShowSettings(!showSettings)}
                className={`flex items-center px-2 py-1 rounded-md text-sm ${
                    connected
                        ? 'bg-green-100 text-green-800'
                        : error
                            ? 'bg-red-100 text-red-800'
                            : 'bg-gray-100 text-gray-600'
                }`}
            >
                {connected ? (
                    <Wifi className="w-4 h-4 mr-1" />
                ) : (
                    <WifiOff className="w-4 h-4 mr-1" />
                )}
                <span className="hidden sm:inline">MQTT</span>
                <Radio className={`w-3 h-3 ml-1 ${connected ? 'text-green-600 animate-pulse' : 'text-gray-400'}`} />
            </button>

            {showSettings && (
                <div className="absolute right-0 top-full mt-1 bg-white shadow-lg rounded-md p-3 w-64 z-10 border border-gray-200">
                    <div className="text-sm font-medium mb-2 flex items-center justify-between">
                        <span className="flex items-center">
                            <Settings className="w-4 h-4 mr-1" />
                            MQTT设置
                        </span>
                        <button
                            onClick={() => setShowSettings(false)}
                            className="text-gray-400 hover:text-gray-600"
                        >
                            ×
                        </button>
                    </div>

                    <div className="mb-2">
                        <div className="flex items-center mb-1">
                            <span className={`inline-block w-2 h-2 rounded-full mr-2 ${
                                connected ? 'bg-green-500' : error ? 'bg-red-500' : 'bg-gray-400'
                            }`}></span>
                            <span className="text-xs font-medium">
                                {connected
                                    ? '已连接'
                                    : error
                                        ? '连接错误'
                                        : '未连接'}
                            </span>
                        </div>
                        {error && (
                            <p className="text-xs text-red-600 mb-2">
                                错误: {error}
                            </p>
                        )}
                    </div>

                    <div className="mb-3">
                        <label className="flex items-center cursor-pointer">
                            <div className="relative">
                                <input
                                    type="checkbox"
                                    className="sr-only"
                                    checked={isMqttEnabled}
                                    onChange={toggleMqtt}
                                />
                                <div className={`w-10 h-5 ${isMqttEnabled ? 'bg-blue-600' : 'bg-gray-200'} rounded-full shadow-inner`}></div>
                                <div className={`absolute w-4 h-4 bg-white rounded-full shadow -top-0.5 transition ${isMqttEnabled ? 'right-0.5' : 'left-0.5'}`}></div>
                            </div>
                            <div className="ml-3 text-xs">
                                {isMqttEnabled ? '启用MQTT' : '禁用MQTT'}
                            </div>
                        </label>
                    </div>

                    <button
                        onClick={handleReconnect}
                        disabled={!isMqttEnabled}
                        className={`w-full py-1 px-2 text-xs font-medium rounded ${
                            isMqttEnabled
                                ? 'bg-blue-500 text-white hover:bg-blue-600'
                                : 'bg-gray-200 text-gray-500 cursor-not-allowed'
                        }`}
                    >
                        重新连接
                    </button>

                    <div className="mt-2 text-xs text-gray-500">
                        使用MQTT可以实现更实时的代理监控和控制
                    </div>
                </div>
            )}
        </div>
    );
}
