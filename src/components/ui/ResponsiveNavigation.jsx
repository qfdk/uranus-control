// 修改 src/components/ui/ResponsiveNavigation.jsx

'use client';

import { useState, useEffect, useRef } from 'react';
import { usePathname } from 'next/navigation';
import { Menu, X, LayoutDashboard, Globe, Settings } from 'lucide-react';
import NavLink from './NavLink';

export default function ResponsiveNavigation() {
    const pathname = usePathname();
    const [isOpen, setIsOpen] = useState(false);
    const [isMobile, setIsMobile] = useState(false);
    const menuRef = useRef(null);

    // 检查是否为移动设备
    useEffect(() => {
        const checkIsMobile = () => {
            setIsMobile(window.innerWidth < 768);
            if (window.innerWidth >= 768) {
                setIsOpen(false);
            }
        };

        // 初始检查
        checkIsMobile();

        // 添加窗口大小变化监听
        window.addEventListener('resize', checkIsMobile);

        // 清理
        return () => window.removeEventListener('resize', checkIsMobile);
    }, []);

    // 路由变化时关闭菜单
    useEffect(() => {
        setIsOpen(false);
    }, [pathname]);

    // 点击外部区域关闭菜单
    useEffect(() => {
        function handleClickOutside(event) {
            if (menuRef.current && !menuRef.current.contains(event.target) && isOpen) {
                setIsOpen(false);
            }
        }

        document.addEventListener('mousedown', handleClickOutside);
        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, [isOpen]);

    // 菜单打开时锁定滚动
    useEffect(() => {
        if (isOpen) {
            // 锁定滚动
            document.body.style.overflow = 'hidden';
        } else {
            // 恢复滚动
            document.body.style.overflow = '';
        }

        return () => {
            // 清理
            document.body.style.overflow = '';
        };
    }, [isOpen]);

    // 检查路径是否匹配菜单项
    const isPathActive = (path) => {
        if (path === '/') {
            return pathname === '/';
        }
        return pathname.startsWith(path);
    };

    // 导航项目
    const navItems = [
        { href: '/', label: '仪表盘', icon: <LayoutDashboard className="h-5 w-5" /> },
        { href: '/agents', label: '代理管理', icon: <Globe className="h-5 w-5" /> },
        { href: '/settings', label: '设置', icon: <Settings className="h-5 w-5" /> }
    ];

    return (
        <div className="relative flex items-center" ref={menuRef}>
            {/* 移动端导航切换按钮 */}
            {isMobile && (
                <button
                    type="button"
                    className="ml-2 inline-flex items-center justify-center p-1.5 rounded-md text-gray-600 hover:text-blue-600 hover:bg-blue-50 transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    onClick={() => setIsOpen(!isOpen)}
                    aria-expanded={isOpen}
                >
                    <span className="sr-only">{isOpen ? '关闭菜单' : '打开菜单'}</span>
                    {isOpen ? (
                        <X className="block h-5 w-5" aria-hidden="true" />
                    ) : (
                        <Menu className="block h-5 w-5" aria-hidden="true" />
                    )}
                </button>
            )}

            {/* 桌面导航 */}
            {!isMobile && (
                <nav className="ml-6 flex space-x-2">
                    {navItems.map((item) => (
                        <NavLink
                            key={item.href}
                            href={item.href}
                            className={`inline-flex items-center px-2.5 py-1.5 text-sm font-medium transition-all duration-200 rounded ${
                                isPathActive(item.href)
                                    ? 'bg-blue-50 text-blue-700'
                                    : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
                            }`}
                        >
                            <span className="flex items-center">
                              {item.icon}
                                <span className="ml-1.5">{item.label}</span>
                            </span>
                        </NavLink>
                    ))}
                </nav>
            )}

            {/* 移动端侧边菜单 */}
            {isMobile && isOpen && (
                <>
                    {/* 半透明背景 */}
                    <div
                        className="fixed inset-0 bg-black/30 backdrop-blur-sm z-10 transition-opacity"
                        onClick={() => setIsOpen(false)}
                        aria-hidden="true"
                    ></div>

                    {/* 侧边菜单 */}
                    <div className="fixed inset-y-0 left-0 w-64 bg-white shadow-lg z-20 transform transition-transform duration-300 ease-in-out">
                        {/* 菜单标题 */}
                        <div className="flex items-center justify-between p-4 border-b border-gray-200">
                            <span className="font-medium text-gray-800">导航菜单</span>
                            <button
                                className="text-gray-500 hover:text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500 rounded-md p-1"
                                onClick={() => setIsOpen(false)}
                            >
                                <X className="h-5 w-5" />
                            </button>
                        </div>

                        {/* 菜单项 */}
                        <nav className="py-2 h-full overflow-y-auto">
                            {navItems.map((item) => (
                                <NavLink
                                    key={item.href}
                                    href={item.href}
                                    className={`flex items-center px-4 py-3 text-base font-medium border-l-4 transition-colors ${
                                        isPathActive(item.href)
                                            ? 'border-blue-600 text-blue-700 bg-blue-50'
                                            : 'border-transparent text-gray-700 hover:bg-gray-50 hover:border-gray-300 hover:text-gray-900'
                                    }`}
                                >
                                    <div className="flex items-center">
                                        {item.icon}
                                        <span className="ml-3">{item.label}</span>
                                    </div>
                                </NavLink>
                            ))}
                        </nav>
                    </div>
                </>
            )}
        </div>
    );
}
