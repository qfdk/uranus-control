// src/app/layout.js
import { Inter } from 'next/font/google';
import './globals.css';
import { LayoutDashboard, Globe, Settings } from 'lucide-react';
import Link from 'next/link';
import { AppProvider } from './contexts/AppContext';
import UserMenu from '@/components/ui/UserMenu';

const inter = Inter({ subsets: ['latin'] });

export const metadata = {
    title: 'Uranus - Nginx管理控制台',
    description: '集中式Nginx服务器管理控制台',
};

export default function RootLayout({ children }) {
    return (
        <html lang="zh">
        <body className={inter.className}>
        <AppProvider>
            <div className="min-h-screen bg-gray-100">
                <header className="bg-white shadow-sm">
                    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                        <div className="flex justify-between h-16">
                            <div className="flex">
                                <div className="flex-shrink-0 flex items-center">
                                    <span className="text-2xl font-bold text-gray-900">Uranus</span>
                                    <span className="ml-2 text-sm text-gray-600">控制台</span>
                                </div>
                                <nav className="ml-6 flex space-x-8">
                                    <Link href="/" className="border-blue-500 text-gray-900 inline-flex items-center px-1 pt-1 border-b-2 text-sm font-medium">
                                        <LayoutDashboard className="h-4 w-4 mr-1" />
                                        仪表盘
                                    </Link>
                                    <Link href="/agents" className="border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700 inline-flex items-center px-1 pt-1 border-b-2 text-sm font-medium">
                                        <Globe className="h-4 w-4 mr-1" />
                                        代理管理
                                    </Link>
                                    <Link href="/settings" className="border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700 inline-flex items-center px-1 pt-1 border-b-2 text-sm font-medium">
                                        <Settings className="h-4 w-4 mr-1" />
                                        设置
                                    </Link>
                                </nav>
                            </div>
                            <div className="flex items-center">
                                <UserMenu />
                            </div>
                        </div>
                    </div>
                </header>

                <main>
                    {children}
                </main>
            </div>
        </AppProvider>
        </body>
        </html>
    );
}
