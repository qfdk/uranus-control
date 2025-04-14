'use client';

import { useRouter } from 'next/navigation';
import { useLoading } from '@/app/contexts/LoadingContext';
import { useCallback } from 'react';

// 为页面切换创建的hook
export function useLoadingNavigation() {
    const router = useRouter();
    const { startLoading } = useLoading();

    // 支持编程式导航并显示加载状态
    const navigateWithLoading = useCallback((url) => {
        // 开始显示加载状态
        startLoading();

        // 记录导航开始时间，用于诊断问题
        console.log(`Navigation to ${url} started at ${new Date().toISOString()}`);

        // 使用路由器导航
        router.push(url);

        // 注意：不需要在这里调用stopLoading
        // 页面转换完成后，新页面组件会自己调用stopLoading
    }, [router, startLoading]);

    return { navigateWithLoading };
}

// 创建一个用于异步操作的加载状态hook
export function useAsyncLoading() {
    const { startLoading, stopLoading } = useLoading();

    // 包装异步函数，自动管理加载状态
    const withLoading = useCallback(async (asyncFn, useGlobalLoading = true) => {
        try {
            // 只有需要全局加载状态时才调用startLoading
            if (useGlobalLoading) {
                startLoading();
                console.log('Global loading started for async operation');
            }
            return await asyncFn();
        } finally {
            // 确保无论成功还是失败，且如果使用了全局加载状态，都停止加载
            if (useGlobalLoading) {
                // 添加小延迟，确保加载状态可见
                setTimeout(() => {
                    stopLoading();
                    console.log('Global loading stopped for async operation');
                }, 300);
            }
        }
    }, [startLoading, stopLoading]);

    return { withLoading };
}

// 新增：用于页面间导航的hook
export function usePageTransition() {
    const { startLoading } = useLoading();

    // 在组件挂载时启动加载
    const startPageLoading = useCallback(() => {
        startLoading();
        console.log('Page transition loading started');

        // 返回一个函数，该函数将在组件挂载完成后调用
        return () => {
            console.log('Component mounted, ready to stop loading');
        };
    }, [startLoading]);

    return { startPageLoading };
}
