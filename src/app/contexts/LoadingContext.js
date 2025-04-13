'use client';

import { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { usePathname } from 'next/navigation';

// 创建加载状态上下文
const LoadingContext = createContext();

// 加载状态提供组件
export function LoadingProvider({ children }) {
    const [isLoading, setIsLoading] = useState(false);
    const loadingCountRef = useRef(0);
    const timeoutRef = useRef(null);
    const pathname = usePathname();

    // 监听路径变化，自动重置加载状态
    useEffect(() => {
        // 如果路径变化，等待一小段时间后重置加载状态
        // 这样可以确保显示加载动画一小段时间，提升用户体验
        const timer = setTimeout(() => {
            resetLoading();
        }, 300);

        return () => clearTimeout(timer);
    }, [pathname]);

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

        // 设置安全超时，防止无限加载
        if (timeoutRef.current) {
            clearTimeout(timeoutRef.current);
        }

        timeoutRef.current = setTimeout(() => {
            resetLoading();
        }, 10000); // 10秒后自动重置加载状态
    }, []);

    // 结束加载 - 只有当所有加载请求都结束时才设置为false
    const stopLoading = useCallback(() => {
        loadingCountRef.current = Math.max(0, loadingCountRef.current - 1);

        if (loadingCountRef.current === 0) {
            // 清除安全超时
            if (timeoutRef.current) {
                clearTimeout(timeoutRef.current);
                timeoutRef.current = null;
            }

            // 添加短暂延迟，使状态变化更平滑
            setIsLoading(false);
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
