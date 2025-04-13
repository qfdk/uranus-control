'use client';

import { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';

// 创建加载状态上下文
const LoadingContext = createContext();

// 加载状态提供组件
export function LoadingProvider({ children }) {
    const [isLoading, setIsLoading] = useState(false);
    const loadingCountRef = useRef(0);
    const timeoutRef = useRef(null);

    // 清除任何可能的超时计时器
    useEffect(() => {
        return () => {
            if (timeoutRef.current) {
                clearTimeout(timeoutRef.current);
            }
        };
    }, []);

    // 开始加载 - 计数器模式，支持嵌套调用
    const startLoading = useCallback(() => {
        loadingCountRef.current += 1;
        setIsLoading(true);

        // 清除之前的超时计时器
        if (timeoutRef.current) {
            clearTimeout(timeoutRef.current);
            timeoutRef.current = null;
        }
    }, []);

    // 结束加载 - 只有当所有加载请求都结束时才设置为false
    const stopLoading = useCallback(() => {
        loadingCountRef.current = Math.max(0, loadingCountRef.current - 1);

        if (loadingCountRef.current === 0) {
            // 添加短暂延迟，使状态变化更平滑
            timeoutRef.current = setTimeout(() => {
                setIsLoading(false);
                timeoutRef.current = null;
            }, 100);
        }
    }, []);

    // 强制结束所有加载状态
    const resetLoading = useCallback(() => {
        loadingCountRef.current = 0;
        setIsLoading(false);

        if (timeoutRef.current) {
            clearTimeout(timeoutRef.current);
            timeoutRef.current = null;
        }
    }, []);

    return (
        <LoadingContext.Provider
            value={{
                isLoading,
                startLoading,
                stopLoading,
                resetLoading
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
