'use client';

import { useState, useEffect } from 'react';
import AgentDetail from './client-component';
import { useLoading } from '@/app/contexts/LoadingContext';

export default function AgentDetailWrapper({ agent }) {
    // 确保客户端数据加载完成
    const [isClient, setIsClient] = useState(false);
    const { stopLoading } = useLoading();

    useEffect(() => {
        // 组件挂载后，标记为客户端渲染
        setIsClient(true);

        // 重要：确保在组件完全挂载后延迟一段时间再停止加载状态
        // 这能确保用户能看到加载状态，提升感知性能
        const timer = setTimeout(() => {
            stopLoading();
        }, 500); // 增加延迟时间，确保加载状态可见

        return () => clearTimeout(timer);
    }, [stopLoading]);

    if (!isClient) {
        // 不显示本地加载状态，而是依赖全局LoadingOverlay
        return null;
    }
    return <AgentDetail agent={agent} />;
}
