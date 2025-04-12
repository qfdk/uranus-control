'use client';

import { useState, useEffect } from 'react';
import { User, LogOut, Settings, ChevronDown } from 'lucide-react';
import { useAuth } from '@/app/contexts/AuthContext';

export default function UserMenu() {
    const [isOpen, setIsOpen] = useState(false);
    const { user, logout } = useAuth();
    const [isMounted, setIsMounted] = useState(false);

    // 确保组件在客户端渲染
    useEffect(() => {
        setIsMounted(true);
    }, []);

    const handleLogout = () => {
        logout();
        setIsOpen(false);
    };

    // 如果组件未挂载，返回一个占位符
    if (!isMounted) {
        return (
            <div className="h-8 w-8 rounded-full bg-gray-200 animate-pulse"></div>
        );
    }

    return (
        <div className="relative">
            <button
                onClick={() => setIsOpen(!isOpen)}
                className="flex items-center text-sm font-medium text-gray-700 hover:text-gray-900 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
            >
                <div className="flex items-center bg-gray-100 hover:bg-gray-200 transition-colors rounded-full p-1.5">
                    <User className="h-5 w-5 text-gray-600" />
                    <ChevronDown className="ml-1 h-4 w-4 text-gray-500" />
                </div>
            </button>

            {isOpen && (
                <div className="origin-top-right absolute right-0 mt-2 w-48 rounded-md shadow-lg bg-white ring-1 ring-black ring-opacity-5 z-10">
                    <div className="py-1" role="menu" aria-orientation="vertical" aria-labelledby="user-menu">
                        <div className="px-4 py-2 border-b border-gray-100">
                            <p className="text-sm font-medium text-gray-900">{user?.username || '管理员'}</p>
                            <p className="text-xs text-gray-500">{user?.email || 'admin@example.com'}</p>
                        </div>
                        <a href="/settings" className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-100" role="menuitem">
                            <div className="flex items-center">
                                <Settings className="mr-2 h-4 w-4" />
                                账户设置
                            </div>
                        </a>
                        <button
                            onClick={handleLogout}
                            className="w-full text-left block px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
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
