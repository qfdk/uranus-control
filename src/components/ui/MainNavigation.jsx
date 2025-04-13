'use client';

import { usePathname } from 'next/navigation';
import { LayoutDashboard, Globe, Settings } from 'lucide-react';
import NavLink from './NavLink';

export default function MainNavigation() {
    const pathname = usePathname();

    // 判断当前路径是否匹配菜单项路径
    const isPathActive = (path) => {
        if (path === '/') {
            return pathname === '/';
        }
        // 使用 startsWith 可以匹配子路径，例如 /agents/123 会匹配 /agents
        return pathname.startsWith(path);
    };

    return (
        <nav className="ml-6 flex space-x-8">
            <NavLink
                href="/"
                className={`inline-flex items-center px-1 pt-1 border-b-2 text-sm font-medium ${
                    isPathActive('/')
                        ? 'border-blue-500 text-gray-900'
                        : 'border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700'
                }`}
            >
                <LayoutDashboard className="h-4 w-4 mr-1" />
                仪表盘
            </NavLink>

            <NavLink
                href="/agents"
                className={`inline-flex items-center px-1 pt-1 border-b-2 text-sm font-medium ${
                    isPathActive('/agents')
                        ? 'border-blue-500 text-gray-900'
                        : 'border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700'
                }`}
            >
                <Globe className="h-4 w-4 mr-1" />
                代理管理
            </NavLink>

            <NavLink
                href="/settings"
                className={`inline-flex items-center px-1 pt-1 border-b-2 text-sm font-medium ${
                    isPathActive('/settings')
                        ? 'border-blue-500 text-gray-900'
                        : 'border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700'
                }`}
            >
                <Settings className="h-4 w-4 mr-1" />
                设置
            </NavLink>
        </nav>
    );
}
