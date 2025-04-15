'use client';

import {useLoading} from '@/app/contexts/LoadingContext';
import {useEffect, useState} from 'react';

export default function LoadingOverlay() {
    const {isLoading} = useLoading();
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
            // 立即显示加载状态，无延迟
            setVisible(true);
            console.log('LoadingOverlay: 显示加载overlay');
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
