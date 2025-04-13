'use client';

import Link from 'next/link';
import { useLoadingNavigation } from '@/lib/loading-hooks';

export default function NavLink({ href, className, children, ...props }) {
    const { navigateWithLoading } = useLoadingNavigation();

    const handleClick = (e) => {
        // 阻止默认的链接行为
        e.preventDefault();

        // 使用带加载状态的导航函数
        navigateWithLoading(href);
    };

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
