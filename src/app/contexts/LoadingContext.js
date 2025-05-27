// src/app/contexts/LoadingContext.js
'use client';

import {createContext, useCallback, useContext, useEffect, useRef, useState} from 'react';
import {usePathname} from 'next/navigation';

const LoadingContext = createContext();

export function LoadingProvider({children}) {
    // 修改初始值为false
    const [isLoading, setIsLoading] = useState(false);
    const loadingCountRef = useRef(0);
    const timeoutRef = useRef(null);
    const pathname = usePathname();
    const previousPathRef = useRef(pathname);
    const navigationInProgressRef = useRef(false);

    // 强制结束所有加载状态
    const resetLoading = useCallback(() => {
        loadingCountRef.current = 0;
        navigationInProgressRef.current = false;
        setIsLoading(false);

        if (timeoutRef.current) {
            clearTimeout(timeoutRef.current);
            timeoutRef.current = null;
        }
        
        // 清理导航状态
        if (typeof window !== 'undefined') {
            window.navigationInProgress = false;
            if (window.navigationSafetyTimeout) {
                clearTimeout(window.navigationSafetyTimeout);
                window.navigationSafetyTimeout = null;
            }
        }
    }, []);

    // 监听路径变化 - 简化逻辑
    useEffect(() => {
        if (previousPathRef.current !== pathname) {
            previousPathRef.current = pathname;
            
            // 路径已经变化，说明导航完成，立即停止加载状态
            resetLoading();
        }
    }, [pathname, resetLoading]);

    const startLoading = useCallback(() => {
        // 登录页不显示加载状态
        if (pathname === '/login') {
            return;
        }

        loadingCountRef.current += 1;
        setIsLoading(true);

        // 清除之前的超时
        if (timeoutRef.current) {
            clearTimeout(timeoutRef.current);
        }

        // 设置新的超时 - 10秒后自动清除（作为保险机制）
        timeoutRef.current = setTimeout(() => {
            console.warn('[LoadingContext] Loading timeout after 10 seconds - force stopping');
            resetLoading();
        }, 10000);
    }, [pathname, resetLoading]);

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
                resetLoading
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
