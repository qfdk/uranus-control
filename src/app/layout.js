// src/app/layout.js
import { Inter } from 'next/font/google';
import './globals.css';
import Link from 'next/link';
import { AppProvider } from './contexts/AppContext';
import { AuthProvider } from './contexts/AuthContext';
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
        <AuthProvider>
            <AppProvider>
                {children}
            </AppProvider>
        </AuthProvider>
        </body>
        </html>
    );
}
