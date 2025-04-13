'use client';

import { useLoading } from '@/app/contexts/LoadingContext';
import {useRouter} from 'next/navigation';

// 导出 hook 供组件使用
export { useLoading };

// 提供与旧方法兼容的工具函数
// 这些函数需要在客户端组件中使用
// 并且需要确保 LoadingContext 已经设置

// 全局导航辅助函数
export const useLoadingNavigation = () => {
    const { startLoading } = useLoading();
    const router = useRouter();

    // 带有加载状态的导航
    const navigate = (url, delay = 50) => {
        startLoading();

        setTimeout(() => {
            router.push(url);
        }, delay);
    };

    return { navigate };
};

// 以下是传统的非 React 方法
// 这些方法将使用 DOM 操作，可能会与 React 的渲染机制冲突
// 仅在必要时使用

// 显示加载覆盖
export function showLoading() {
    if (typeof document !== 'undefined') {
        document.body.classList.add('loading-transition');
    }
}

// 隐藏加载覆盖
export function hideLoading() {
    if (typeof document !== 'undefined') {
        document.body.classList.remove('loading-transition');
    }
}

// 带有延迟的导航
export function navigateWithLoading(url, delay = 50) {
    showLoading();

    setTimeout(() => {
        window.location.href = url;
    }, delay);
}
