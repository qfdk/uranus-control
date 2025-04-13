'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useCallback } from 'react';
import { useLoading } from '@/app/contexts/LoadingContext';

export default function NavLink({ href, className, children, onClick, ...props }) {
    const router = useRouter();
    const { startLoading } = useLoading();

    const handleClick = useCallback((e) => {
        // 不阻止默认行为，让Link组件正常工作

        // 如果有外部传入的onClick，先调用它
        if (onClick) {
            onClick(e);
        }

        // 如果外部onClick没有阻止默认行为，显示加载状态
        if (!e.defaultPrevented) {
            startLoading();

            // 无需手动导航，交给Link组件处理
            // router.push已经由Link组件内部处理
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
