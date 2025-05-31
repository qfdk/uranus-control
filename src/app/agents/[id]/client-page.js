'use client';

import { useState, useEffect } from 'react';
import AgentDetail from './client-component';
import { useLoading } from '@/app/contexts/LoadingContext';

export default function AgentDetailWrapper({ agentId }) {
    // 确保客户端数据加载完成
    const [isClient, setIsClient] = useState(false);
    const { stopLoading } = useLoading();

    useEffect(() => {
        // 组件挂载后，标记为客户端渲染
        setIsClient(true);
        // 立即停止全局loading，让组件内部处理加载状态
        stopLoading();
    }, [stopLoading]);

    if (!isClient) {
        return null;
    }
    
    return <AgentDetail agentId={agentId} />;
}
