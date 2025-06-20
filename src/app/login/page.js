'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Eye, EyeOff, Lock, User } from 'lucide-react';
import { useAuth } from '@/app/contexts/AuthContext';
import { useSettings } from '@/app/contexts/SettingsContext';
import dynamic from 'next/dynamic';

// 纯客户端登录页面组件
function LoginPageComponent() {
    const router = useRouter();
    const { login } = useAuth();
    const { settings } = useSettings();
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [formData, setFormData] = useState({
        username: '',
        password: '',
        remember: false
    });
    
    // 动态设置页面标题
    useEffect(() => {
        if (settings?.siteName) {
            document.title = `登录 - ${settings.siteName}`;
        }
    }, [settings?.siteName]);

    // 客户端处理逻辑

    const handleChange = (e) => {
        const { name, value, type, checked } = e.target;
        setFormData({
            ...formData,
            [name]: type === 'checkbox' ? checked : value
        });
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setIsLoading(true);
        setError('');
        
        try {
            // 调用登录API
            const response = await fetch('/api/auth/login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(formData)
            });
            
            // 检查响应内容类型
            const contentType = response.headers.get('content-type');
            if (!contentType || !contentType.includes('application/json')) {
                throw new Error('服务器返回了非JSON格式的响应，请检查服务器状态');
            }
        
            const data = await response.json();
        
            if (!response.ok) {
                throw new Error(data.message || '登录失败');
            }
        
            if (data.success) {
                // 只使用AuthContext的login函数，它会处理路由跳转
                login(data.user);
            } else {
                throw new Error(data.message || '未知错误');
            }
        } catch (err) {
            if (err.name === 'SyntaxError' && err.message.includes('Unexpected token')) {
                setError('服务器配置错误，请检查数据库连接。默认用户名：admin，密码：admin');
            } else if (err.message.includes('Failed to fetch')) {
                setError('网络连接失败，请检查网络或服务器状态');
            } else {
                setError(err.message || '登录失败，请重试');
            }
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="min-h-screen min-h-[100dvh] bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800 flex flex-col justify-center px-4 sm:px-6 lg:px-8">
            <div className="sm:mx-auto sm:w-full sm:max-w-md">
                <div className="bg-white dark:bg-gray-800 py-6 px-6 shadow-xl rounded-2xl sm:px-10">
                    <div className="sm:mx-auto sm:w-full sm:max-w-md mb-6">
                        <div className="text-center">
                            <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-white">
                                {settings?.siteName || 'Οὐρανός 控制台'}
                            </h1>
                        </div>
                    </div>

                    {error && (
                        <div className="mb-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-400 px-4 py-3 rounded-lg"
                             role="alert">
                            <div className="flex items-center">
                                <svg className="w-5 h-5 mr-2" fill="currentColor" viewBox="0 0 20 20">
                                    <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                                </svg>
                                <span>{error}</span>
                            </div>
                        </div>
                    )}

                    <form className="space-y-4" onSubmit={handleSubmit}>
                        <div>
                            <label htmlFor="username" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                                用户名
                            </label>
                            <div className="relative">
                                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                    <User className="h-5 w-5 text-gray-400 dark:text-gray-500"/>
                                </div>
                                <input
                                    id="username"
                                    name="username"
                                    type="text"
                                    required
                                    value={formData.username}
                                    onChange={handleChange}
                                    className="block w-full pl-10 pr-3 py-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                                    placeholder="请输入用户名"
                                />
                            </div>
                        </div>

                        <div>
                            <label htmlFor="password" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                                密码
                            </label>
                            <div className="relative">
                                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                    <Lock className="h-5 w-5 text-gray-400 dark:text-gray-500"/>
                                </div>
                                <input
                                    id="password"
                                    name="password"
                                    type={showPassword ? 'text' : 'password'}
                                    required
                                    value={formData.password}
                                    onChange={handleChange}
                                    className="block w-full pl-10 pr-10 py-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                                    placeholder="请输入密码"
                                />
                                <div className="absolute inset-y-0 right-0 pr-3 flex items-center">
                                    <button
                                        type="button"
                                        onClick={() => setShowPassword(!showPassword)}
                                        className="text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-400 focus:outline-none transition-colors"
                                    >
                                        {showPassword ? (
                                            <EyeOff className="h-5 w-5"/>
                                        ) : (
                                            <Eye className="h-5 w-5"/>
                                        )}
                                    </button>
                                </div>
                            </div>
                        </div>

                        <div className="pt-1">
                            <button
                                type="submit"
                                disabled={isLoading}
                                className={`w-full flex justify-center py-3 px-4 border border-transparent rounded-lg shadow-md text-sm font-medium text-white focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transform transition-all duration-300 ${
                                    isLoading 
                                        ? 'bg-gray-400 cursor-not-allowed' 
                                        : 'bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 hover:scale-[1.02] active:scale-[0.98]'
                                }`}
                            >
                                {isLoading ? (
                                    <div className="flex items-center">
                                        {/* 改进的loading动画 */}
                                        <div className="relative mr-3">
                                            <div className="w-5 h-5 border-2 border-white/30 rounded-full"></div>
                                            <div className="absolute top-0 left-0 w-5 h-5 border-2 border-white border-r-transparent rounded-full animate-spin"></div>
                                        </div>
                                        <span className="animate-pulse">登录中...</span>
                                    </div>
                                ) : (
                                    <div className="flex items-center">
                                        <span>登录</span>
                                        <svg className="ml-2 w-4 h-4 transform transition-transform group-hover:translate-x-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M14 5l7 7m0 0l-7 7m7-7H3" />
                                        </svg>
                                    </div>
                                )}
                            </button>
                        </div>
                        
                        <div className="mt-4 text-center">
                            <p className="text-xs text-gray-500 dark:text-gray-400">
                                © 2024 {settings?.siteName || 'Οὐρανός 控制台'}
                            </p>
                        </div>
                    </form>
                </div>
            </div>
        </div>
    );
}

// 使用动态导入避免SSR
export default dynamic(() => Promise.resolve(LoginPageComponent), { ssr: false });
