'use client';

import { useRouter } from 'next/navigation';
import { useLoading } from '@/app/contexts/LoadingContext';
import { useCallback } from 'react';

// 创建一个结合导航和加载状态的hook
export function useLoadingNavigation() {
    const router = useRouter();
    const { startLoading, stopLoading } = useLoading();

    // 带有加载状态的导航函数
    const navigateWithLoading = useCallback((url, delay = 50) => {
        startLoading();

        // 设置一个安全超时，确保加载状态最终会被清除
        const safetyTimer = setTimeout(() => {
            stopLoading();
        }, 5000); // 5秒后强制结束加载状态（避免无限加载）

        setTimeout(() => {
            router.push(url);
            // 导航完成后，由目标页面负责停止加载
            // 不在这里调用stopLoading()，而是在目标页面组件中调用

            // 如果导航成功，清除安全计时器
            clearTimeout(safetyTimer);
        }, delay);
    }, [router, startLoading, stopLoading]);

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
            stopLoading();
        }
    }, [startLoading, stopLoading]);

    return { withLoading };
}
