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
    const { isAuthenticated, loading: authLoading, user } = useAuth();
    const pathname = usePathname();
    const { settings, loading: settingsLoading } = useSettings();
    // 客户端渲染标志
    const [isMounted, setIsMounted] = useState(false);
    const { stopLoading } = useLoading();
    const [isMobile, setIsMobile] = useState(false);
    const [showContent, setShowContent] = useState(false);

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
        setShowContent(true);
        // 立即停止全局加载动画
        stopLoading();
    }, [stopLoading]);
    
    // 当认证状态或路径改变时，重新显示内容
    useEffect(() => {
        if (isMounted) {
            setShowContent(true);
        }
    }, [user, pathname, isMounted]);
    
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

    // 如果组件未挂载或正在认证加载，显示加载画面
    if (!isMounted || authLoading || !showContent) {
        return (
            <div className="min-h-screen bg-gray-100 dark:bg-gray-900 flex items-center justify-center">
                <div className="flex flex-col items-center space-y-4">
                    <div className="w-8 h-8 border-4 border-blue-500/30 border-t-blue-500 rounded-full animate-spin"></div>
                    <div className="text-sm text-gray-600 dark:text-gray-400">加载中...</div>
                </div>
            </div>
        );
    }

    // 如果是登录页面，直接返回内容，不包装导航
    if (pathname === '/login') {
        return (
            <div className="transition-opacity duration-300 opacity-100">
                {children}
            </div>
        );
    }

    // 如果用户已登录，则显示带导航的布局
    if (isAuthenticated) {
        return (
            <div className="min-h-screen min-h-[100dvh] bg-gray-100 dark:bg-gray-900 transition-opacity duration-300 opacity-100">
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

    // 如果用户未登录，显示加载状态等待重定向
    return (
        <div className="min-h-screen bg-gray-100 dark:bg-gray-900 flex items-center justify-center">
            <div className="w-8 h-8 border-4 border-blue-500/30 border-t-blue-500 rounded-full animate-spin"></div>
        </div>
    );
}
