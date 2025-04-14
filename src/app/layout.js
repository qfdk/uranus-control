// src/app/layout.js
import { Inter } from 'next/font/google';
import './globals.css';
import { AppProvider } from './contexts/AppContext';
import { AuthProvider } from './contexts/AuthContext';
import { LoadingProvider } from './contexts/LoadingContext';
import LoadingOverlay from '@/components/ui/LoadingOverlay';
import { seedDefaultUsers } from '@/lib/seed-users';

// 确保在应用启动时创建默认用户
seedDefaultUsers().catch(console.error);

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
            <LoadingProvider>
                <AppProvider>
                    <LoadingOverlay />
                    {children}
                </AppProvider>
            </LoadingProvider>
        </AuthProvider>
        </body>
        </html>
    );
}
