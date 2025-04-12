// src/app/layout.js
import { Inter } from 'next/font/google';
import './globals.css';
import Link from 'next/link';
import { AppProvider } from './contexts/AppContext';
import UserMenu from '@/components/ui/UserMenu';
import MainNavigation from '@/components/ui/MainNavigation';

const inter = Inter({ subsets: ['latin'] });

export const metadata = {
    title: 'Οὐρανός - 控制台',
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
                                    <Link href="/" className="flex items-center">
                                        <span className="text-2xl font-bold text-gray-900">Οὐρανός</span>
                                        <span className="ml-2 text-sm text-gray-600">控制台</span>
                                    </Link>
                                </div>
                                <MainNavigation />
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
