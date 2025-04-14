'use client';

import { useLoading } from '@/app/contexts/LoadingContext';
import { useEffect, useState } from 'react';

export default function LoadingOverlay() {
    const { isLoading } = useLoading();
    const [visible, setVisible] = useState(false);

    // 追踪加载状态变化
    useEffect(() => {
        console.log('LoadingOverlay: 加载状态变为', isLoading);
    }, [isLoading]);

    // 使用延迟显示和淡出效果，避免闪烁
    useEffect(() => {
        let showTimer;
        let hideTimer;

        if (isLoading) {
            // 延迟显示，避免短暂操作的闪烁，但要快速响应
            showTimer = setTimeout(() => {
                console.log('LoadingOverlay: 显示加载overlay');
                setVisible(true);
            }, 50); // 减少延迟，使导航时的加载指示器更快显示
        } else {
            // 延迟隐藏，使过渡效果更平滑
            hideTimer = setTimeout(() => {
                console.log('LoadingOverlay: 隐藏加载overlay');
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
            className={`fixed inset-0 bg-white bg-opacity-80 z-50 flex flex-col items-center justify-center transition-opacity duration-300 ${
                isLoading ? 'opacity-100' : 'opacity-0'
            }`}
        >
            <div className="w-16 h-16 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
            <p className="mt-4 text-gray-600 font-medium">加载中...</p>
        </div>
    );
}
