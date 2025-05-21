'use client';

import { useEffect, useRef, useState } from 'react';
import { usePathname } from 'next/navigation';
import { AuthProvider } from './contexts/AuthContext';
import { LoadingProvider } from './contexts/LoadingContext';
import LoadingOverlay from '@/components/ui/LoadingOverlay';
import useAgentStore from '@/store/agentStore';
import useMqttStore from '@/store/mqttStore';
import dynamic from 'next/dynamic';

// 使用动态导入来避免Toaster的SSR水合问题
const Toaster = dynamic(() => import('react-hot-toast').then(mod => mod.Toaster), {
  ssr: false,
});

export function AppProviders({ children }) {
    const pathname = usePathname();
    const fetchAgents = useAgentStore(state => state.fetchAgents);
    const connectMqtt = useMqttStore(state => state.connect);
    const initializedRef = useRef(false);
    const mqttInitializedRef = useRef(false);
    const [mqttInitAttempted, setMqttInitAttempted] = useState(false);

    // 初始加载时获取所有代理数据 - 使用ref确保只执行一次
    useEffect(() => {
        // 只在非登录页面获取数据
        if (pathname !== '/login' && !initializedRef.current) {
            initializedRef.current = true;

            // 获取代理数据
            fetchAgents().catch(err => {
                console.error('初始加载代理数据失败:', err);
            });
        }
    }, [pathname, fetchAgents]);

    // 分离MQTT初始化，并增加错误处理和重试逻辑
    useEffect(() => {
        // 只在非登录页面初始化MQTT，且仅尝试一次
        if (pathname !== '/login' && !mqttInitializedRef.current && !mqttInitAttempted) {
            setMqttInitAttempted(true);

            // 延迟初始化MQTT，确保页面渲染完成
            const timer = setTimeout(async () => {
                console.log('初始化MQTT连接...');
                mqttInitializedRef.current = true;

                try {
                    await connectMqtt();
                    console.log('MQTT连接成功初始化');
                } catch (error) {
                    console.error('MQTT初始化失败:', error);

                    // 如果初始连接失败，稍后再尝试一次
                    setTimeout(async () => {
                        console.log('尝试MQTT重新连接...');
                        try {
                            await connectMqtt();
                            console.log('MQTT重连成功');
                        } catch (retryError) {
                            console.error('MQTT重连失败:', retryError);
                        }
                    }, 5000); // 5秒后重试
                }
            }, 1500); // 延迟1.5秒初始化MQTT

            return () => clearTimeout(timer);
        }
    }, [pathname, connectMqtt, mqttInitAttempted]);

    return (
        <AuthProvider>
            <LoadingProvider>
                <Toaster
                    position="top-right"
                    toastOptions={{
                        duration: 3000
                    }}
                />
                <LoadingOverlay />
                {children}
            </LoadingProvider>
        </AuthProvider>
    );
}
