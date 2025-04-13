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
    const withLoading = useCallback(async (asyncFn, ...args) => {
        try {
            startLoading();
            return await asyncFn(...args);
        } finally {
            // 确保无论成功还是失败都停止加载
            stopLoading();
        }
    }, [startLoading, stopLoading]);

    return { withLoading };
}
