'use client';

import {useLoading} from '@/app/contexts/LoadingContext';
import {useEffect, useState} from 'react';

export default function LoadingOverlay() {
    const {isLoading} = useLoading();
    const [visible, setVisible] = useState(false);


    // 使用延迟显示和淡出效果，避免闪烁
    useEffect(() => {
        let showTimer;
        let hideTimer;

        if (isLoading) {
            // 立即显示加载状态，无延迟
            setVisible(true);
        } else {
            // 延迟隐藏，使过渡效果更平滑
            hideTimer = setTimeout(() => {
                setVisible(false);
            }, 300);
        }

        return () => {
            clearTimeout(showTimer);
            clearTimeout(hideTimer);
        };
    }, [isLoading]);

    if (!isLoading && !visible) return null;

    return (
        <div
            className={`fixed inset-0 bg-white dark:bg-gray-900 bg-opacity-80 dark:bg-opacity-80 z-50 flex flex-col items-center justify-center transition-opacity duration-300 ${
                isLoading ? 'opacity-100' : 'opacity-0'
            }`}
        >
            <div className="w-16 h-16 border-4 border-blue-600 dark:border-blue-500 border-t-transparent rounded-full animate-spin"></div>
            <p className="mt-4 text-gray-600 dark:text-gray-300 font-medium">加载中...</p>
        </div>
    );
}
