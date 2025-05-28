// src/app/layout.js
import { Inter } from 'next/font/google';
import './globals.css';
import { AppProviders } from './providers';
import { seedDefaultUsers } from '@/lib/seed-users';

// 确保在应用启动时创建默认用户
seedDefaultUsers().catch(console.error);

const inter = Inter({ subsets: ['latin'] });

export const metadata = {
    title: 'Οὐρανός - 控制台',
    description: '集中式Nginx服务器管理控制台',
};

export const viewport = {
    width: 'device-width',
    initialScale: 1,
    maximumScale: 1,
    themeColor: '#3b82f6',
};

export default function RootLayout({ children }) {
    return (
        <html lang="zh">
        <head>
        </head>
        <body className={inter.className}>
        <AppProviders>
            {children}
        </AppProviders>
        </body>
        </html>
    );
}
