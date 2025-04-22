// src/app/providers.jsx
'use client';

import { useEffect, useRef } from 'react';
import { usePathname } from 'next/navigation';
import { AuthProvider } from './contexts/AuthContext';
import { LoadingProvider } from './contexts/LoadingContext';
import LoadingOverlay from '@/components/ui/LoadingOverlay';
import useAgentStore from '@/store/agentStore';
import useMqttStore from '@/store/mqttStore';

export function AppProviders({ children }) {
    const pathname = usePathname();
    const fetchAgents = useAgentStore(state => state.fetchAgents);
    const connectMqtt = useMqttStore(state => state.connect);
    const initializedRef = useRef(false);

    // 初始加载时获取所有代理数据 - 使用ref确保只执行一次
    useEffect(() => {
        // 只在非登录页面获取数据
        if (pathname !== '/login' && !initializedRef.current) {
            console.log('应用启动，初始化全局数据...');
            initializedRef.current = true;

            // 获取代理数据
            fetchAgents().catch(err => {
                console.error('初始加载代理数据失败:', err);
            });

            // 连接MQTT
            setTimeout(() => {
                connectMqtt();
            }, 1000); // 延迟1秒再连接MQTT，避免状态冲突
        }
    }, [pathname]);

    return (
        <AuthProvider>
            <LoadingProvider>
                <LoadingOverlay />
                {children}
            </LoadingProvider>
        </AuthProvider>
    );
}

// 这个文件替代了原来的AppContext
