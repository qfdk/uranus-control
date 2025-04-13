'use client';

import { useState, useEffect } from 'react';
import AgentDetail from './client-component';

export default function AgentDetailWrapper({ agent }) {
    // 确保客户端数据加载完成
    const [isClient, setIsClient] = useState(false);

    useEffect(() => {
        // 组件挂载后，标记为客户端渲染
        setIsClient(true);

        // 延迟移除加载状态，确保组件已完全渲染
        const timer = setTimeout(() => {
            document.body.classList.remove('loading-transition');
        }, 500);

        return () => clearTimeout(timer);
    }, []);

    if (!isClient) {
        // 本地加载状态
        return (
            <div className="max-w-7xl mx-auto px-4 py-8 flex items-center justify-center">
                <div className="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
                <p className="ml-4 text-lg font-medium text-gray-600">加载代理详情...</p>
            </div>
        );
    }

    return <AgentDetail agent={agent} />;
}
