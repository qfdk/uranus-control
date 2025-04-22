'use client';

import {useEffect, useRef, useState} from 'react';
import {ChevronDown, LogOut, Moon, Settings, Sun, User} from 'lucide-react';
import {useAuth} from '@/app/contexts/AuthContext';
import {useLoadingNavigation} from '@/lib/loading-hooks';
import MqttStatus from './MqttStatus';
import {initializeTheme, toggleTheme} from '@/lib/theme-utils';

export default function UserMenu() {
    const [isOpen, setIsOpen] = useState(false);
    const {logout} = useAuth();
    const [isMounted, setIsMounted] = useState(false);
    const menuRef = useRef(null);
    const {navigateWithLoading} = useLoadingNavigation();
    const [darkMode, setDarkMode] = useState(false);
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

    // 检查并应用暗黑模式设置
    useEffect(() => {
        if (isMounted) {
            const initialMode = initializeTheme();
            setDarkMode(initialMode);
        }
    }, [isMounted]);

    // 切换暗黑/明亮模式
    const handleToggleTheme = () => {
        const newMode = toggleTheme(darkMode);
        setDarkMode(newMode);

        // 可选：关闭菜单
        setIsOpen(false);
    };

    // 点击外部区域关闭菜单
    useEffect(() => {
        function handleClickOutside(event) {
            if (menuRef.current && !menuRef.current.contains(event.target)) {
                setIsOpen(false);
            }
        }

        document.addEventListener('mousedown', handleClickOutside);
        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, []);

    // 确保组件在客户端渲染
    useEffect(() => {
        setIsMounted(true);
    }, []);

    const handleLogout = () => {
        logout();
        setIsOpen(false);
    };

    const handleSettingsClick = (e) => {
        e.preventDefault();
        setIsOpen(false);
        navigateWithLoading('/settings');
    };

    // 如果组件未挂载，返回一个占位符
    if (!isMounted) {
        return (
            <div className="h-8 w-8 rounded-full bg-gray-200 dark:bg-gray-700 animate-pulse"></div>
        );
    }

    return (
        <div className="flex items-center gap-1 md:gap-3">
            {/* 桌面端显示MQTT状态 */}
            {!isMobile && <MqttStatus/>}

            {/* 暗黑模式快速切换按钮 (小屏幕) */}
            {isMobile && (
                <button
                    onClick={handleToggleTheme}
                    className="p-1.5 rounded-full bg-gray-100 hover:bg-gray-200 dark:bg-gray-700 dark:hover:bg-gray-600 transition-colors duration-200"
                    title={darkMode ? '切换到明亮模式' : '切换到夜间模式'}
                    aria-label={darkMode ? '切换到明亮模式' : '切换到夜间模式'}
                >
                    {darkMode ? (
                        <Sun className="h-5 w-5 text-amber-500"/>
                    ) : (
                        <Moon className="h-5 w-5 text-blue-700 dark:text-blue-400"/>
                    )}
                </button>
            )}

            {/* 用户菜单 */}
            <div className="relative" ref={menuRef}>
                <button
                    onClick={() => setIsOpen(!isOpen)}
                    className="flex items-center focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 rounded-full transition duration-200"
                    aria-expanded={isOpen}
                    aria-haspopup="true"
                >
                    <span className="sr-only">打开用户菜单</span>
                    <div
                        className="flex items-center bg-blue-50 hover:bg-blue-100 dark:bg-blue-900/30 dark:hover:bg-blue-800/50 transition-colors rounded-full p-1.5">
                        <User className="h-5 w-5 text-blue-600 dark:text-blue-400"/>
                        <ChevronDown
                            className={`ml-0.5 h-4 w-4 text-blue-500 dark:text-blue-400 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''} ${isMobile ? 'hidden' : 'block'}`}/>
                    </div>
                </button>

                {isOpen && (
                    <div
                        className="origin-top-right absolute right-0 mt-2 w-56 rounded-lg shadow-lg bg-white dark:bg-gray-800 z-30 divide-y divide-gray-100 dark:divide-gray-700 animate-fadeIn overflow-hidden"
                        role="menu"
                        aria-orientation="vertical"
                        aria-labelledby="user-menu-button"
                    >
                        <div className="py-1" role="none">
                            {/* 暗黑模式切换 */}
                            <button
                                onClick={handleToggleTheme}
                                className="w-full text-left block px-4 py-2 text-sm text-gray-700 dark:text-gray-200 hover:bg-blue-50 hover:text-blue-700 dark:hover:bg-blue-900/30 dark:hover:text-blue-300 transition duration-150"
                                role="menuitem"
                            >
                                <div className="flex items-center">
                                    {darkMode ? (
                                        <>
                                            <Sun className="mr-2 h-4 w-4 text-amber-500"/>
                                            切换到明亮模式
                                        </>
                                    ) : (
                                        <>
                                            <Moon className="mr-2 h-4 w-4 text-blue-700 dark:text-blue-400"/>
                                            切换到夜间模式
                                        </>
                                    )}
                                </div>
                            </button>

                            <a
                                href="/settings"
                                onClick={handleSettingsClick}
                                className="block px-4 py-2 text-sm text-gray-700 dark:text-gray-200 hover:bg-blue-50 hover:text-blue-700 dark:hover:bg-blue-900/30 dark:hover:text-blue-300 transition duration-150"
                                role="menuitem"
                            >
                                <div className="flex items-center">
                                    <Settings className="mr-2 h-4 w-4"/>
                                    账户设置
                                </div>
                            </a>

                            <button
                                onClick={handleLogout}
                                className="w-full text-left block px-4 py-2 text-sm text-gray-700 dark:text-gray-200 hover:bg-red-50 hover:text-red-700 dark:hover:bg-red-900/30 dark:hover:text-red-300 transition duration-150"
                                role="menuitem"
                            >
                                <div className="flex items-center">
                                    <LogOut className="mr-2 h-4 w-4"/>
                                    退出登录
                                </div>
                            </button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
