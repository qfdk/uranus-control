'use client';

import { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { usePathname } from 'next/navigation';

// 创建加载状态上下文
const LoadingContext = createContext();

// 加载状态提供组件
export function LoadingProvider({ children }) {
    const [isLoading, setIsLoading] = useState(true); // 默认为加载状态
    const loadingCountRef = useRef(0);
    const timeoutRef = useRef(null);
    const pathname = usePathname();
    const [autoRefreshActive, setAutoRefreshActive] = useState(true);
    const previousPathRef = useRef(pathname);
    const navigationInProgressRef = useRef(false);

    // 监听路径变化，处理页面导航
    useEffect(() => {
        if (previousPathRef.current !== pathname) {
            console.log(`路径变化: ${previousPathRef.current} -> ${pathname}`);

            // 标记导航开始
            navigationInProgressRef.current = true;

            // 设置加载状态为true
            setIsLoading(true);
            loadingCountRef.current += 1;

            // 更新前一个路径
            previousPathRef.current = pathname;

            // 设置一个延迟，在新页面完全加载后再检查是否需要停止加载状态
            const timer = setTimeout(() => {
                // 页面应该已经加载了，可以停止导航加载状态
                if (navigationInProgressRef.current) {
                    navigationInProgressRef.current = false;
                    loadingCountRef.current = Math.max(0, loadingCountRef.current - 1);

                    // 如果没有其他加载任务，则停止加载状态
                    if (loadingCountRef.current === 0) {
                        setIsLoading(false);
                    }

                    console.log('导航完成，停止加载状态');
                }
            }, 600); // 略微延长时间，确保新页面有足够时间处理

            return () => clearTimeout(timer);
        }
    }, [pathname]);

    // 设置自动刷新状态
    const setAutoRefresh = useCallback((active) => {
        setAutoRefreshActive(active);
    }, []);

    // 开始加载 - 计数器模式，支持嵌套调用
    const startLoading = useCallback(() => {
        // 如果自动刷新活跃，则不显示全局加载状态，除非是导航操作
        if (autoRefreshActive && !navigationInProgressRef.current) {
            console.log('自动刷新活跃，忽略非导航的加载请求');
            return;
        }

        console.log('启动全局加载状态', loadingCountRef.current);
        loadingCountRef.current += 1;
        setIsLoading(true);

        // 设置安全超时，防止无限加载
        if (timeoutRef.current) {
            clearTimeout(timeoutRef.current);
        }

        timeoutRef.current = setTimeout(() => {
            console.log('安全超时触发，重置加载状态');
            resetLoading();
        }, 10000); // 10秒后自动重置加载状态
    }, [autoRefreshActive]);

    // 结束加载 - 只有当所有加载请求都结束时才设置为false
    const stopLoading = useCallback(() => {
        loadingCountRef.current = Math.max(0, loadingCountRef.current - 1);
        console.log('停止一个加载请求，剩余:', loadingCountRef.current);

        if (loadingCountRef.current === 0) {
            // 清除安全超时
            if (timeoutRef.current) {
                clearTimeout(timeoutRef.current);
                timeoutRef.current = null;
            }

            console.log('所有加载请求完成，关闭全局加载状态');

            // 添加短暂延迟，使状态变化更平滑
            setTimeout(() => {
                setIsLoading(false);
                // 重置导航状态
                navigationInProgressRef.current = false;
            }, 300);
        }
    }, []);

    // 强制结束所有加载状态
    const resetLoading = useCallback(() => {
        console.log('强制重置所有加载状态');
        loadingCountRef.current = 0;
        navigationInProgressRef.current = false;
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
                resetLoading,
                setAutoRefresh,
                autoRefreshActive
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
