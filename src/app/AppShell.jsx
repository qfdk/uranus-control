'use client';

import {useAuth} from './contexts/AuthContext';
import {useEffect, useState} from 'react';
import Link from 'next/link';
import UserMenu from '@/components/ui/UserMenu';
import ResponsiveNavigation from '@/components/ui/ResponsiveNavigation';
import {usePathname} from 'next/navigation';
import {useLoading} from '@/lib/loading-hooks';

export default function AppShell({children}) {
    const {isAuthenticated, loading} = useAuth();
    const pathname = usePathname();
    // 客户端渲染标志
    const [isMounted, setIsMounted] = useState(false);
    const {stopLoading} = useLoading();

    // 确保组件只在客户端渲染
    useEffect(() => {
        setIsMounted(true);

        // 确保在组件加载完成后停止全局加载动画
        stopLoading();
    }, [stopLoading]);

    // 如果组件未挂载，返回加载状态
    if (!isMounted) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-gray-100">
                <div
                    className="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
            </div>
        );
    }

    // 如果是登录页面，不显示导航和头部
    if (pathname === '/login') {
        return children;
    }

    // 在认证加载过程中显示加载状态
    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-gray-100">
                <div
                    className="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
            </div>
        );
    }
    // 如果用户已登录，则显示带导航的布局
    if (isAuthenticated) {
        return (
            <div className="min-h-screen bg-gray-100">
                <header className="bg-white shadow-sm sticky top-0 z-20">
                    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                        <div className="flex justify-between h-16">
                            <div className="flex flex-1 items-center">
                                <div className="flex-shrink-0 flex items-center">
                                    <Link href="/" className="flex items-center group">
                                        <span className="text-xl md:text-2xl font-bold text-gray-900 group-hover:text-blue-600 transition-colors">Οὐρανός</span>
                                        <span className="ml-1 text-xs md:text-sm text-gray-600 group-hover:text-blue-500 transition-colors">控制台</span>
                                    </Link>
                                </div>
                                <ResponsiveNavigation />
                            </div>
                            <div className="flex items-center">
                                <UserMenu/>
                            </div>
                        </div>
                    </div>
                </header>

                <main className="pb-16">
                    {children}
                </main>
            </div>
        );
    }

    // 如果用户未登录并且不在登录页，此处应该不会被渲染
    // 因为AuthContext中的路由保护逻辑会先重定向
    return children;
}
