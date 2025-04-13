'use client';

import { createContext, useContext, useState } from 'react';

// 创建加载状态上下文
const LoadingContext = createContext();

// 加载状态提供组件
export function LoadingProvider({ children }) {
    const [isLoading, setIsLoading] = useState(false);

    // 开始加载
    const startLoading = () => {
        setIsLoading(true);
    };

    // 结束加载
    const stopLoading = () => {
        setIsLoading(false);
    };

    return (
        <LoadingContext.Provider
            value={{
                isLoading,
                startLoading,
                stopLoading
            }}
        >
            {children}
        </LoadingContext.Provider>
    );
}

// 自定义hook，用于在组件中访问加载状态
export function useLoading() {
    const context = useContext(LoadingContext);
    if (context === undefined) {
        throw new Error('useLoading must be used within a LoadingProvider');
    }
    return context;
}
