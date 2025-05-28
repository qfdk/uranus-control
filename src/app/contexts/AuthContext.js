'use client';

import { createContext, useContext, useState, useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';

// 创建认证上下文
const AuthContext = createContext();

// 定义需要认证的路径
const protectedRoutes = [
    '/',
    '/agents',
    '/settings',
    // 添加其他需要登录的路径
];

// 不需要认证的路径
const publicRoutes = [
    '/login',
    // 添加其他公开路径
];

// Context provider组件
export function AuthProvider({ children }) {
    const router = useRouter();
    const pathname = usePathname();
    const [user, setUser] = useState(null);
    const [loading, setLoading] = useState(true);
    const [isClient, setIsClient] = useState(false);
    const [sessionExpiration, setSessionExpiration] = useState(null);

    // 确保只在客户端执行
    useEffect(() => {
        setIsClient(true);

        // 检查认证状态
        const checkAuth = () => {
            // 从localStorage获取认证状态
            const isAuthenticated = localStorage.getItem('isAuthenticated') === 'true';
            const userData = localStorage.getItem('user');
            const sessionExpirationTime = localStorage.getItem('sessionExpiration');

            if (isAuthenticated && userData && sessionExpirationTime) {
                const expirationTime = new Date(sessionExpirationTime);
                if (expirationTime > new Date()) {
                    try {
                        setUser(JSON.parse(userData));
                        setSessionExpiration(expirationTime);
                    } catch (e) {
                        // 如果解析失败，清除无效数据
                        localStorage.removeItem('user');
                        localStorage.removeItem('sessionExpiration');
                        setUser(null);
                        setSessionExpiration(null);
                    }
                } else {
                    // 会话已过期
                    localStorage.removeItem('isAuthenticated');
                    localStorage.removeItem('user');
                    localStorage.removeItem('sessionExpiration');
                    setUser(null);
                    setSessionExpiration(null);
                }
            } else {
                setUser(null);
                setSessionExpiration(null);
            }

            setLoading(false);
        };

        checkAuth();
    }, []);

    // 客户端路由保护逻辑 - 简化并减少重定向
    useEffect(() => {
        if (!isClient || loading) return;

        const isProtectedRoute = protectedRoutes.some(route => pathname === route || pathname.startsWith(`${route}/`));
        const isPublicRoute = publicRoutes.includes(pathname);

        // 只有在明确需要重定向时才执行
        if (!user && isProtectedRoute && pathname !== '/login') {
            router.replace('/login');
        } else if (user && pathname === '/login') {
            router.replace('/');
        }
    }, [user, pathname, loading, router, isClient]);

    // 检查会话是否过期
    useEffect(() => {
        if (!sessionExpiration) return;

        const interval = setInterval(() => {
            if (new Date() > sessionExpiration) {
                logout();
            }
        }, 1000);

        return () => clearInterval(interval);
    }, [sessionExpiration]);

    // 登录函数
    const login = (userData, callback) => {
        const expirationTime = new Date();
        expirationTime.setHours(expirationTime.getHours() + 1);

        // 立即设置状态
        setUser(userData);
        setSessionExpiration(expirationTime);

        // 设置存储
        localStorage.setItem('isAuthenticated', 'true');
        localStorage.setItem('user', JSON.stringify(userData));
        localStorage.setItem('sessionExpiration', expirationTime.toISOString());

        // 设置cookies
        document.cookie = `isAuthenticated=true; path=/; max-age=${60*60*24*7}`;
        document.cookie = `sessionExpiration=${expirationTime.toISOString()}; path=/; max-age=${60*60*24*7}`;

        // 使用 requestAnimationFrame 确保状态更新后再跳转
        requestAnimationFrame(() => {
            if (typeof callback === 'function') {
                callback();
            } else {
                router.replace('/');
            }
        });
    };

    // 登出函数
    const logout = () => {
        // 立即设置状态
        setUser(null);
        setSessionExpiration(null);
        
        // 清除存储
        localStorage.removeItem('isAuthenticated');
        localStorage.removeItem('user');
        localStorage.removeItem('sessionExpiration');

        // 清除cookie
        document.cookie = 'isAuthenticated=; path=/; max-age=0';
        document.cookie = 'sessionExpiration=; path=/; max-age=0';

        // 使用 requestAnimationFrame 确保状态更新后再跳转
        requestAnimationFrame(() => {
            router.replace('/login');
        });
    };

    return (
        <AuthContext.Provider
            value={{
                user,
                isAuthenticated: !!user,
                loading,
                login,
                logout
            }}
        >
            {children}
        </AuthContext.Provider>
    );
}

// 自定义hook以使用认证上下文
export function useAuth() {
    const context = useContext(AuthContext);
    if (context === undefined) {
        throw new Error('useAuth must be used within an AuthProvider');
    }
    return context;
}
