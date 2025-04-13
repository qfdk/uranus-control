'use client';

import { useState, useEffect, useRef } from 'react';
import { User, LogOut, Settings, ChevronDown } from 'lucide-react';
import { useAuth } from '@/app/contexts/AuthContext';
import { useLoadingNavigation } from '@/lib/loading-hooks';

export default function UserMenu() {
    const [isOpen, setIsOpen] = useState(false);
    const { user, logout } = useAuth();
    const [isMounted, setIsMounted] = useState(false);
    const menuRef = useRef(null);
    const { navigateWithLoading } = useLoadingNavigation();

    // Close menu when clicking outside
    useEffect(() => {
        function handleClickOutside(event) {
            if (menuRef.current && !menuRef.current.contains(event.target)) {
                setIsOpen(false);
            }
        }

        // Add event listener
        document.addEventListener('mousedown', handleClickOutside);

        // Clean up
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
            <div className="h-8 w-8 rounded-full bg-gray-200 animate-pulse"></div>
        );
    }

    return (
        <div className="relative" ref={menuRef}>
            <button
                onClick={() => setIsOpen(!isOpen)}
                className="flex items-center text-sm font-medium focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 rounded-full transition duration-200"
                aria-expanded={isOpen}
                aria-haspopup="true"
            >
                <span className="sr-only">打开用户菜单</span>
                <div className="flex items-center bg-blue-50 hover:bg-blue-100 transition-colors rounded-full p-2">
                    <User className="h-5 w-5 text-blue-600" />
                    <ChevronDown className={`ml-1 h-4 w-4 text-blue-500 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`} />
                </div>
            </button>

            {isOpen && (
                <div
                    className="origin-top-right absolute right-0 mt-2 w-56 rounded-lg shadow-lg bg-white z-30 divide-y divide-gray-100 animate-fadeIn overflow-hidden"
                    role="menu"
                    aria-orientation="vertical"
                    aria-labelledby="user-menu-button"
                >
                    <div className="py-1" role="none">
                        <a
                            href="/settings"
                            onClick={handleSettingsClick}
                            className="block px-4 py-2 text-sm text-gray-700 hover:bg-blue-50 hover:text-blue-700 transition duration-150"
                            role="menuitem"
                        >
                            <div className="flex items-center">
                                <Settings className="mr-2 h-4 w-4" />
                                账户设置
                            </div>
                        </a>

                        <button
                            onClick={handleLogout}
                            className="w-full text-left block px-4 py-2 text-sm text-gray-700 hover:bg-red-50 hover:text-red-700 transition duration-150"
                            role="menuitem"
                        >
                            <div className="flex items-center">
                                <LogOut className="mr-2 h-4 w-4" />
                                退出登录
                            </div>
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}
