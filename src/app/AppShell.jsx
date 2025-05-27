'use client';

import { useAuth } from './contexts/AuthContext';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import UserMenu from '@/components/ui/UserMenu';
import ResponsiveNavigation from '@/components/ui/ResponsiveNavigation';
import { usePathname } from 'next/navigation';
import { useLoading } from '@/app/contexts/LoadingContext';
import { useSettings } from '@/app/contexts/SettingsContext';

export default function AppShell({ children }) {
    const { isAuthenticated, loading: authLoading } = useAuth();
    const pathname = usePathname();
    const { settings, loading: settingsLoading } = useSettings();
    // 客户端渲染标志
    const [isMounted, setIsMounted] = useState(false);
    const { stopLoading } = useLoading();
    const [isMobile, setIsMobile] = useState(false);

    // 检查设备类型
    useEffect(() => {
        const checkIsMobile = () => {
            setIsMobile(window.innerWidth < 768);
        };

        // 初始检查
        checkIsMobile();

        // 添加窗口大小变化监听
        window.addEventListener('resize', checkIsMobile);

        return () => window.removeEventListener('resize', checkIsMobile);
    }, []);

    // 确保组件只在客户端渲染
    useEffect(() => {
        setIsMounted(true);

        // 确保在组件加载完成后停止全局加载动画
        const timer = setTimeout(() => {
            stopLoading();
        }, 300);

        return () => clearTimeout(timer);
    }, [stopLoading]);
    
    // 动态设置页面标题
    useEffect(() => {
        if (settings?.siteName && isMounted) {
            document.title = settings.siteName;
        }
    }, [settings?.siteName, isMounted]);

    // 监听路径变化，确保页面切换后停止加载状态
    useEffect(() => {
        if (isMounted) {
            stopLoading();
            
            // 清理导航安全超时
            if (window.navigationSafetyTimeout) {
                clearTimeout(window.navigationSafetyTimeout);
                window.navigationSafetyTimeout = null;
            }
            
            // 重置导航状态
            window.navigationInProgress = false;
        }
    }, [pathname, stopLoading, isMounted]);

    // 如果组件未挂载，继续显示加载状态
    if (!isMounted) {
        return null; // 返回null，这样LoadingOverlay将继续显示
    }

    // 如果是登录页面，不显示导航和头部
    if (pathname === '/login') {
        return children;
    }

    // 在认证加载过程中显示加载状态
    if (authLoading) {
        return null; // 返回null，这样LoadingOverlay将继续显示
    }

    // 如果用户已登录，则显示带导航的布局
    if (isAuthenticated) {
        return (
            <div className="min-h-screen min-h-[100dvh] bg-gray-100 dark:bg-gray-900 transition-colors duration-300">
                <header className="bg-white dark:bg-gray-800 shadow-sm sticky top-0 z-20 transition-colors duration-300">
                    <div className="max-w-7xl mx-auto nav-container">
                        <div className="flex justify-between items-center h-14 px-2 sm:px-4 lg:px-6">
                            {/* Logo 部分 */}
                            <div className="flex flex-1 items-center">
                                <div className="flex-shrink-0 flex items-center">
                                    <Link href="/" className="flex items-center group">
                                        <span className="text-lg md:text-xl font-bold text-gray-900 dark:text-white group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
                                            {settings?.siteName || 'Οὐρανός 控制台'}
                                        </span>
                                    </Link>
                                </div>
                                {/* 响应式导航组件 */}
                                <ResponsiveNavigation />
                            </div>

                            {/* 用户菜单部分 - 使用自定义类名 */}
                            <div className="flex items-center user-menu">
                                <UserMenu />
                            </div>
                        </div>
                    </div>
                </header>

                <main className="pb-16 transition-colors duration-300">
                    {children}
                </main>
            </div>
        );
    }

    // 如果用户未登录并且不在登录页，此处应该不会被渲染
    // 因为AuthContext中的路由保护逻辑会先重定向
    return children;
}
