'use client';

import { useState, useEffect } from 'react';
import AgentDetail from './client-component';

export default function AgentDetailWrapper({ agent }) {
    // 确保客户端数据加载完成
    const [isClient, setIsClient] = useState(false);

    useEffect(() => {
        // 组件挂载后，标记为客户端渲染
        setIsClient(true);
    }, []);

    if (!isClient) {
        // 防止初始服务器渲染与客户端渲染不匹配问题
        return <div className="max-w-7xl mx-auto px-4 py-8 flex justify-center">
            <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
        </div>;
    }

    return <AgentDetail agent={agent} />;
}
