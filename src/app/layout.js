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
    manifest: '/manifest.json',
    themeColor: '#3b82f6',
    viewport: 'width=device-width, initial-scale=1, maximum-scale=1',
};

export default function RootLayout({ children }) {
    return (
        <html lang="zh">
        <head>
            <meta name="apple-mobile-web-app-capable" content="yes" />
            <meta name="apple-mobile-web-app-status-bar-style" content="default" />
            <meta name="apple-mobile-web-app-title" content="Οὐρανός" />
            <link rel="apple-touch-icon" href="/icon-192x192.png" />
        </head>
        <body className={inter.className}>
        <AppProviders>
            {children}
        </AppProviders>
        </body>
        </html>
    );
}
