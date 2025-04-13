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

    // Check if we're on mobile on component mount and window resize
    useEffect(() => {
        const checkIsMobile = () => {
            setIsMobile(window.innerWidth < 768);
            if (window.innerWidth >= 768) {
                setIsOpen(false);
            }
        };

        // Initial check
        checkIsMobile();

        // Add resize listener
        window.addEventListener('resize', checkIsMobile);

        // Clean up
        return () => window.removeEventListener('resize', checkIsMobile);
    }, []);

    // Close mobile menu when route changes
    useEffect(() => {
        setIsOpen(false);
    }, [pathname]);

    // Close menu when clicking outside
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

    // Handle body scroll lock when menu is open
    useEffect(() => {
        if (isOpen) {
            // Lock scroll
            document.body.style.overflow = 'hidden';
        } else {
            // Restore scroll
            document.body.style.overflow = '';
        }

        return () => {
            // Cleanup
            document.body.style.overflow = '';
        };
    }, [isOpen]);

    // Check if current path matches menu item
    const isPathActive = (path) => {
        if (path === '/') {
            return pathname === '/';
        }
        return pathname.startsWith(path);
    };

    // Navigation items
    const navItems = [
        { href: '/', label: '仪表盘', icon: <LayoutDashboard className="h-5 w-5 mr-2" /> },
        { href: '/agents', label: '代理管理', icon: <Globe className="h-5 w-5 mr-2" /> },
        { href: '/settings', label: '设置', icon: <Settings className="h-5 w-5 mr-2" /> }
    ];

    return (
        <div className="relative flex items-center" ref={menuRef}>
            {/* Mobile navigation toggle */}
            {isMobile && (
                <button
                    type="button"
                    className="ml-4 inline-flex items-center justify-center p-2 rounded-md text-gray-600 hover:text-blue-600 hover:bg-blue-50 transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    onClick={() => setIsOpen(!isOpen)}
                    aria-expanded={isOpen}
                >
                    <span className="sr-only">{isOpen ? '关闭菜单' : '打开菜单'}</span>
                    {isOpen ? (
                        <X className="block h-6 w-6" aria-hidden="true" />
                    ) : (
                        <Menu className="block h-6 w-6" aria-hidden="true" />
                    )}
                </button>
            )}

            {/* Desktop navigation */}
            {!isMobile && (
                <nav className="ml-8 flex space-x-6">
                    {navItems.map((item) => (
                        <NavLink
                            key={item.href}
                            href={item.href}
                            className={`inline-flex items-center px-3 py-2 border-b-2 text-sm font-medium transition-all duration-200 ${
                                isPathActive(item.href)
                                    ? 'border-blue-600 text-blue-700'
                                    : 'border-transparent text-gray-600 hover:border-gray-300 hover:text-gray-900 hover:bg-gray-50'
                            }`}
                        >
                            {item.icon}
                            {item.label}
                        </NavLink>
                    ))}
                </nav>
            )}

            {/* Mobile navigation menu and backdrop */}
            {isMobile && isOpen && (
                <>
                    {/* Backdrop overlay */}
                    <div
                        className="fixed inset-0 bg-white/80 backdrop-blur-sm z-10 transition-opacity"
                        onClick={() => setIsOpen(false)}
                        aria-hidden="true"
                    ></div>

                    {/* Menu container - positioned as a sidebar */}
                    <div className="fixed inset-y-0 left-0 w-64 bg-white shadow-lg z-20 transform transition-transform duration-300 ease-in-out">
                        {/* Menu header */}
                        <div className="flex items-center justify-between p-4 border-b border-gray-200">
                            <span className="font-medium text-gray-800">导航菜单</span>
                            <button
                                className="text-gray-500 hover:text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500 rounded-md p-1"
                                onClick={() => setIsOpen(false)}
                            >
                                <X className="h-6 w-6" />
                            </button>
                        </div>

                        {/* Menu items */}
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
                                        <span>{item.label}</span>
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
