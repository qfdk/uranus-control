'use client';

// src/app/settings/page.js
import {useState} from 'react';
import {Clock, Database, Settings as SettingsIcon, ShieldAlert, User} from 'lucide-react';
import FormInput from '@/components/ui/FormInput';
import FormSelect from '@/components/ui/FormSelect';

export default function SettingsPage() {
    const [activeTab, setActiveTab] = useState('general');

    const languageOptions = [
        {value: 'zh-CN', label: '简体中文'},
        {value: 'en-US', label: 'English'}
    ];

    const timezoneOptions = [
        {value: 'Asia/Shanghai', label: '亚洲/上海 (GMT+8)'},
        {value: 'America/New_York', label: '美国/纽约 (GMT-5)'},
        {value: 'Europe/London', label: '欧洲/伦敦 (GMT+0)'}
    ];

    const backupFrequencyOptions = [
        {value: 'daily', label: '每天'},
        {value: 'weekly', label: '每周'},
        {value: 'monthly', label: '每月'}
    ];

    return (
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
                            <button
                                onClick={() => setActiveTab('users')}
                                className={`w-full flex items-center px-3 py-2 text-sm font-medium rounded-md ${
                                    activeTab === 'users'
                                        ? 'text-blue-700 bg-blue-50'
                                        : 'text-gray-700 hover:bg-gray-50'
                                } mb-1`}
                            >
                                <User className="w-5 h-5 mr-2 text-gray-500"/>
                                用户管理
                            </button>
                            <button
                                onClick={() => setActiveTab('security')}
                                className={`w-full flex items-center px-3 py-2 text-sm font-medium rounded-md ${
                                    activeTab === 'security'
                                        ? 'text-blue-700 bg-blue-50'
                                        : 'text-gray-700 hover:bg-gray-50'
                                } mb-1`}
                            >
                                <ShieldAlert className="w-5 h-5 mr-2 text-gray-500"/>
                                安全设置
                            </button>
                            <button
                                onClick={() => setActiveTab('backup')}
                                className={`w-full flex items-center px-3 py-2 text-sm font-medium rounded-md ${
                                    activeTab === 'backup'
                                        ? 'text-blue-700 bg-blue-50'
                                        : 'text-gray-700 hover:bg-gray-50'
                                } mb-1`}
                            >
                                <Clock className="w-5 h-5 mr-2 text-gray-500"/>
                                备份与恢复
                            </button>
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

                                    <FormSelect
                                        label="时区"
                                        id="timezone"
                                        options={timezoneOptions}
                                        defaultValue="Asia/Shanghai"
                                    />

                                    <div className="flex items-center py-2">
                                        <input
                                            id="emailNotifications"
                                            name="emailNotifications"
                                            type="checkbox"
                                            className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                                            defaultChecked
                                        />
                                        <label htmlFor="emailNotifications"
                                               className="ml-2 block text-sm text-gray-700">
                                            开启电子邮件通知
                                        </label>
                                    </div>

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

                    {/* 用户管理 */}
                    {activeTab === 'users' && (
                        <div className="bg-white rounded-lg shadow">
                            <div className="px-4 py-3 border-b border-gray-200">
                                <h2 className="text-lg font-medium text-gray-800">用户管理</h2>
                            </div>
                            <div className="p-4">
                                <div className="mb-4 flex justify-end">
                                    <button
                                        type="button"
                                        className="inline-flex justify-center px-4 py-2 text-sm font-medium text-white bg-blue-600 border border-transparent rounded-md shadow-sm hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                                    >
                                        添加用户
                                    </button>
                                </div>

                                <div className="overflow-x-auto">
                                    <table className="min-w-full divide-y divide-gray-200">
                                        <thead className="bg-gray-50">
                                        <tr>
                                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">用户名</th>
                                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">电子邮件</th>
                                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">角色</th>
                                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">状态</th>
                                            <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">操作</th>
                                        </tr>
                                        </thead>
                                        <tbody className="bg-white divide-y divide-gray-200">
                                        <tr>
                                            <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">admin</td>
                                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">admin@example.com</td>
                                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">管理员</td>
                                            <td className="px-6 py-4 whitespace-nowrap text-sm">
                                                <span
                                                    className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-green-100 text-green-800">
                                                  活跃
                                                </span>
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap text-sm text-right space-x-2">
                                                <button className="text-blue-600 hover:text-blue-900">编辑</button>
                                                <button className="text-red-600 hover:text-red-900">禁用</button>
                                            </td>
                                        </tr>
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
