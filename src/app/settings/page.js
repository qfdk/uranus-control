'use client';

// src/app/settings/page.js
import {useState} from 'react';
import {Database, Settings as SettingsIcon, User} from 'lucide-react';
import FormInput from '@/components/ui/FormInput';
import FormSelect from '@/components/ui/FormSelect';
import AppShell from '@/app/AppShell';
import Link from 'next/link';

export default function SettingsPage() {
    const [activeTab, setActiveTab] = useState('general');

    const languageOptions = [
        {value: 'zh-CN', label: '简体中文'},
        {value: 'en-US', label: 'English'}
    ];

    return (
        <AppShell>
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
                <header className="mb-6">
                    <h1 className="text-2xl font-bold text-gray-800">系统设置</h1>
                </header>

                <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
                    {/* 设置导航 */}
                    <div className="lg:col-span-1">
                        <div className="bg-white rounded-lg shadow">
                            <div className="px-4 py-3 border-b border-gray-200">
                                <h2 className="text-lg font-medium text-gray-800">设置选项</h2>
                            </div>
                            <nav className="p-2">
                                <button
                                    onClick={() => setActiveTab('general')}
                                    className={`w-full flex items-center px-3 py-2 text-sm font-medium rounded-md ${
                                        activeTab === 'general'
                                            ? 'text-blue-700 bg-blue-50'
                                            : 'text-gray-700 hover:bg-gray-50'
                                    } mb-1`}
                                >
                                    <SettingsIcon className="w-5 h-5 mr-2 text-blue-500"/>
                                    常规设置
                                </button>
                                <button
                                    onClick={() => setActiveTab('database')}
                                    className={`w-full flex items-center px-3 py-2 text-sm font-medium rounded-md ${
                                        activeTab === 'database'
                                            ? 'text-blue-700 bg-blue-50'
                                            : 'text-gray-700 hover:bg-gray-50'
                                    } mb-1`}
                                >
                                    <Database className="w-5 h-5 mr-2 text-gray-500"/>
                                    数据库设置
                                </button>
                                <Link
                                    href="/settings/users"
                                    className="w-full flex items-center px-3 py-2 text-sm font-medium rounded-md text-gray-700 hover:bg-gray-50 mb-1"
                                >
                                    <User className="w-5 h-5 mr-2 text-gray-500"/>
                                    用户管理
                                </Link>
                            </nav>
                        </div>
                    </div>

                    {/* 设置内容 */}
                    <div className="lg:col-span-3 space-y-6">
                        {/* 常规设置 */}
                        {activeTab === 'general' && (
                            <div className="bg-white rounded-lg shadow">
                                <div className="px-4 py-3 border-b border-gray-200">
                                    <h2 className="text-lg font-medium text-gray-800">常规设置</h2>
                                </div>
                                <div className="p-4">
                                    <form className="space-y-4">
                                        <FormInput
                                            label="站点名称"
                                            id="siteName"
                                            defaultValue="Οὐρανός 控制台"
                                        />

                                        <FormInput
                                            label="控制台网址"
                                            id="siteUrl"
                                            type="url"
                                            defaultValue="http://localhost:3000"
                                        />

                                        <FormSelect
                                            label="系统语言"
                                            id="language"
                                            options={languageOptions}
                                            defaultValue="zh-CN"
                                        />

                                        <div className="pt-4 flex justify-end">
                                            <button
                                                type="submit"
                                                className="inline-flex justify-center px-4 py-2 text-sm font-medium text-white bg-blue-600 border border-transparent rounded-md shadow-sm hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                                            >
                                                保存设置
                                            </button>
                                        </div>
                                    </form>
                                </div>
                            </div>
                        )}

                        {/* 数据库设置 */}
                        {activeTab === 'database' && (
                            <div className="bg-white rounded-lg shadow">
                                <div className="px-4 py-3 border-b border-gray-200">
                                    <h2 className="text-lg font-medium text-gray-800">数据库设置</h2>
                                </div>
                                <div className="p-4">
                                    <form className="space-y-4">
                                        <FormInput
                                            label="数据库连接字符串"
                                            id="databaseUrl"
                                            defaultValue="mongodb://localhost:27017/uranus-control"
                                        />

                                        <div className="pt-4 flex justify-end">
                                            <button
                                                type="button"
                                                className="inline-flex justify-center px-4 py-2 mr-2 text-sm font-medium text-gray-700 bg-gray-100 border border-gray-300 rounded-md shadow-sm hover:bg-gray-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-500"
                                            >
                                                测试连接
                                            </button>
                                            <button
                                                type="submit"
                                                className="inline-flex justify-center px-4 py-2 text-sm font-medium text-white bg-blue-600 border border-transparent rounded-md shadow-sm hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                                            >
                                                保存设置
                                            </button>
                                        </div>
                                    </form>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </AppShell>
    );
}
