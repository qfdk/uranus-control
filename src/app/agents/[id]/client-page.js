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

        // 确保在组件完全挂载后停止加载状态
        const timer = setTimeout(() => {
            stopLoading();
        }, 300);

        return () => clearTimeout(timer);
    }, [stopLoading]);

    if (!isClient) {
        // 不显示本地加载状态，而是依赖全局LoadingOverlay
        return null;
    }

    return <AgentDetail agent={agent} />;
}
