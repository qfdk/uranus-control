'use client';

import Link from 'next/link';
import {useRouter} from 'next/navigation';
import {useCallback} from 'react';
import {useLoading} from '@/app/contexts/LoadingContext';

export default function NavLink({href, className, children, onClick, ...props}) {
    const router = useRouter();
    const {startLoading} = useLoading();

    const handleClick = useCallback((e) => {
        // 如果有外部传入的onClick，先调用它
        if (onClick) {
            onClick(e);
        }

        // 如果外部onClick没有阻止默认行为，显示加载状态
        if (!e.defaultPrevented) {
            console.log(`NavLink: 导航到 ${href} - 启动加载状态`);

            // 添加全局导航状态标记
            window.navigationInProgress = true;

            // 清理之前的安全超时
            if (window.navigationSafetyTimeout) {
                clearTimeout(window.navigationSafetyTimeout);
            }

            // 立即开始加载
            startLoading();

            // 设置一个安全超时，以防导航失败
            const safetyTimeout = setTimeout(() => {
                console.warn('[NavLink] Navigation safety timeout - navigation took longer than 3 seconds');
                if (window.navigationInProgress) {
                    window.navigationInProgress = false;
                }
            }, 3000);
            
            // 存储timeout以便清理
            window.navigationSafetyTimeout = safetyTimeout;
        }
    }, [href, startLoading, onClick]);

    return (
        <Link
            href={href}
            onClick={handleClick}
            className={className}
            {...props}
        >
            {children}
        </Link>
    );
}
