'use client';

import { useRouter } from 'next/navigation';
import { useLoading } from '@/app/contexts/LoadingContext';

// 创建一个结合导航和加载状态的hook
export function useLoadingNavigation() {
    const router = useRouter();
    const { startLoading } = useLoading();

    // 带有加载状态的导航函数
    const navigateWithLoading = (url, delay = 50) => {
        startLoading();

        setTimeout(() => {
            router.push(url);
        }, delay);
    };

    return { navigateWithLoading };
}
