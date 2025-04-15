// src/app/contexts/LoadingContext.js
'use client';

import { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { usePathname } from 'next/navigation';

const LoadingContext = createContext();

export function LoadingProvider({ children }) {
    // 修改初始值为false
    const [isLoading, setIsLoading] = useState(false);
    const loadingCountRef = useRef(0);
    const timeoutRef = useRef(null);
    const pathname = usePathname();
    const [autoRefreshActive, setAutoRefreshActive] = useState(true);
    const previousPathRef = useRef(pathname);
    const navigationInProgressRef = useRef(false);

    // 监听路径变化
    useEffect(() => {
        if (previousPathRef.current !== pathname) {
            console.log(`路径变化: ${previousPathRef.current} -> ${pathname}`);

            // 登录页不显示加载状态
            if (pathname === '/login') {
                setIsLoading(false);
                loadingCountRef.current = 0;
                return;
            }

            navigationInProgressRef.current = true;
            previousPathRef.current = pathname;

            if (pathname !== '/login') {
                setIsLoading(true);
                loadingCountRef.current += 1;
            }

            const timer = setTimeout(() => {
                if (navigationInProgressRef.current) {
                    navigationInProgressRef.current = false;
                    loadingCountRef.current = Math.max(0, loadingCountRef.current - 1);
                    if (loadingCountRef.current === 0) {
                        setIsLoading(false);
                    }
                }
            }, 600);

            return () => clearTimeout(timer);
        }
    }, [pathname]);

    const setAutoRefresh = useCallback((active) => {
        setAutoRefreshActive(active);
    }, []);

    // 强制结束所有加载状态 - 移到前面定义
    const resetLoading = useCallback(() => {
        loadingCountRef.current = 0;
        navigationInProgressRef.current = false;
        setIsLoading(false);

        if (timeoutRef.current) {
            clearTimeout(timeoutRef.current);
            timeoutRef.current = null;
        }
    }, []);

    const startLoading = useCallback(() => {
        // 登录页不显示加载状态
        if (pathname === '/login') {
            return;
        }

        const isAuthenticated = typeof window !== 'undefined' &&
            localStorage.getItem('isAuthenticated') === 'true';

        if (!isAuthenticated && pathname !== '/login') {
            return;
        }

        if (typeof window !== 'undefined' && window.navigationInProgress) {
            navigationInProgressRef.current = true;
            window.navigationInProgress = false;
        }

        if (autoRefreshActive && !navigationInProgressRef.current) {
            return;
        }

        loadingCountRef.current += 1;
        setIsLoading(true);

        if (timeoutRef.current) {
            clearTimeout(timeoutRef.current);
        }

        timeoutRef.current = setTimeout(() => {
            resetLoading();
        }, 5000);
    }, [autoRefreshActive, pathname, resetLoading]);

    const stopLoading = useCallback(() => {
        loadingCountRef.current = Math.max(0, loadingCountRef.current - 1);

        if (loadingCountRef.current === 0) {
            if (timeoutRef.current) {
                clearTimeout(timeoutRef.current);
                timeoutRef.current = null;
            }

            setTimeout(() => {
                setIsLoading(false);
                navigationInProgressRef.current = false;
            }, 300);
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

export function useLoading() {
    const context = useContext(LoadingContext);
    if (context === undefined) {
        throw new Error('useLoading must be used within a LoadingProvider');
    }
    return context;
}
