// src/app/settings/page.js
import { Settings as SettingsIcon, Database, User, ShieldAlert, Clock } from 'lucide-react';

export default function SettingsPage() {
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
                            <a
                                href="#general"
                                className="flex items-center px-3 py-2 text-sm font-medium rounded-md text-blue-700 bg-blue-50"
                            >
                                <SettingsIcon className="w-5 h-5 mr-2 text-blue-500" />
                                常规设置
                            </a>
                            <a
                                href="#database"
                                className="flex items-center px-3 py-2 text-sm font-medium rounded-md text-gray-700 hover:bg-gray-50 mt-1"
                            >
                                <Database className="w-5 h-5 mr-2 text-gray-500" />
                                数据库设置
                            </a>
                            <a
                                href="#users"
                                className="flex items-center px-3 py-2 text-sm font-medium rounded-md text-gray-700 hover:bg-gray-50 mt-1"
                            >
                                <User className="w-5 h-5 mr-2 text-gray-500" />
                                用户管理
                            </a>
                            <a
                                href="#security"
                                className="flex items-center px-3 py-2 text-sm font-medium rounded-md text-gray-700 hover:bg-gray-50 mt-1"
                            >
                                <ShieldAlert className="w-5 h-5 mr-2 text-gray-500" />
                                安全设置
                            </a>
                            <a
                                href="#backup"
                                className="flex items-center px-3 py-2 text-sm font-medium rounded-md text-gray-700 hover:bg-gray-50 mt-1"
                            >
                                <Clock className="w-5 h-5 mr-2 text-gray-500" />
                                备份与恢复
                            </a>
                        </nav>
                    </div>
                </div>

                {/* 设置内容 */}
                <div className="lg:col-span-3 space-y-6">
                    {/* 常规设置 */}
                    <div id="general" className="bg-white rounded-lg shadow">
                        <div className="px-4 py-3 border-b border-gray-200">
                            <h2 className="text-lg font-medium text-gray-800">常规设置</h2>
                        </div>
                        <div className="p-4">
                            <form className="space-y-4">
                                <div>
                                    <label htmlFor="siteName" className="block text-sm font-medium text-gray-700 mb-1">
                                        站点名称
                                    </label>
                                    <input
                                        type="text"
                                        id="siteName"
                                        name="siteName"
                                        defaultValue="Uranus 控制台"
                                        className="w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                                    />
                                </div>

                                <div>
                                    <label htmlFor="siteUrl" className="block text-sm font-medium text-gray-700 mb-1">
                                        控制台网址
                                    </label>
                                    <input
                                        type="url"
                                        id="siteUrl"
                                        name="siteUrl"
                                        defaultValue="http://localhost:3000"
                                        className="w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                                    />
                                </div>

                                <div>
                                    <label htmlFor="language" className="block text-sm font-medium text-gray-700 mb-1">
                                        系统语言
                                    </label>
                                    <select
                                        id="language"
                                        name="language"
                                        className="w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                                    >
                                        <option value="zh-CN">简体中文</option>
                                        <option value="en-US">English</option>
                                    </select>
                                </div>

                                <div>
                                    <label htmlFor="timezone" className="block text-sm font-medium text-gray-700 mb-1">
                                        时区
                                    </label>
                                    <select
                                        id="timezone"
                                        name="timezone"
                                        className="w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                                    >
                                        <option value="Asia/Shanghai">亚洲/上海 (GMT+8)</option>
                                        <option value="America/New_York">美国/纽约 (GMT-5)</option>
                                        <option value="Europe/London">欧洲/伦敦 (GMT+0)</option>
                                    </select>
                                </div>

                                <div className="flex items-center">
                                    <input
                                        id="emailNotifications"
                                        name="emailNotifications"
                                        type="checkbox"
                                        className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                                        defaultChecked
                                    />
                                    <label htmlFor="emailNotifications" className="ml-2 block text-sm text-gray-700">
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

                    {/* 数据库设置 */}
                    <div id="database" className="bg-white rounded-lg shadow">
                        <div className="px-4 py-3 border-b border-gray-200">
                            <h2 className="text-lg font-medium text-gray-800">数据库设置</h2>
                        </div>
                        <div className="p-4">
                            <form className="space-y-4">
                                <div>
                                    <label htmlFor="databaseUrl" className="block text-sm font-medium text-gray-700 mb-1">
                                        数据库连接字符串
                                    </label>
                                    <input
                                        type="text"
                                        id="databaseUrl"
                                        name="databaseUrl"
                                        defaultValue="mongodb://localhost:27017/uranus-control"
                                        className="w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                                    />
                                </div>

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

                    {/* 用户管理 */}
                    <div id="users" className="bg-white rounded-lg shadow">
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
                        <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-green-100 text-green-800">
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

                    {/* 安全设置 */}
                    <div id="security" className="bg-white rounded-lg shadow">
                        <div className="px-4 py-3 border-b border-gray-200">
                            <h2 className="text-lg font-medium text-gray-800">安全设置</h2>
                        </div>
                        <div className="p-4">
                            <form className="space-y-4">
                                <div>
                                    <label htmlFor="jwtSecret" className="block text-sm font-medium text-gray-700 mb-1">
                                        JWT密钥
                                    </label>
                                    <div className="flex">
                                        <input
                                            type="password"
                                            id="jwtSecret"
                                            name="jwtSecret"
                                            defaultValue="your-jwt-secret-key"
                                            className="flex-1 rounded-l-md border-r-0 border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                                        />
                                        <button
                                            type="button"
                                            className="px-4 py-2 border border-l-0 border-gray-300 rounded-r-md bg-gray-50 text-sm text-gray-700 hover:bg-gray-100"
                                        >
                                            生成
                                        </button>
                                    </div>
                                </div>

                                <div>
                                    <label htmlFor="tokenExpiry" className="block text-sm font-medium text-gray-700 mb-1">
                                        Token有效期（小时）
                                    </label>
                                    <input
                                        type="number"
                                        id="tokenExpiry"
                                        name="tokenExpiry"
                                        defaultValue="24"
                                        min="1"
                                        className="w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                                    />
                                </div>

                                <div className="flex items-center">
                                    <input
                                        id="twoFactorAuth"
                                        name="twoFactorAuth"
                                        type="checkbox"
                                        className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                                    />
                                    <label htmlFor="twoFactorAuth" className="ml-2 block text-sm text-gray-700">
                                        启用两因素认证
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

                    {/* 备份与恢复 */}
                    <div id="backup" className="bg-white rounded-lg shadow">
                        <div className="px-4 py-3 border-b border-gray-200">
                            <h2 className="text-lg font-medium text-gray-800">备份与恢复</h2>
                        </div>
                        <div className="p-4">
                            <div className="mb-6">
                                <h3 className="text-sm font-medium text-gray-700 mb-2">创建备份</h3>
                                <p className="text-sm text-gray-500 mb-4">
                                    创建系统配置和数据的完整备份，以便在必要时进行恢复。
                                </p>
                                <button
                                    type="button"
                                    className="inline-flex justify-center px-4 py-2 text-sm font-medium text-white bg-blue-600 border border-transparent rounded-md shadow-sm hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                                >
                                    创建备份
                                </button>
                            </div>

                            <div className="border-t border-gray-200 pt-6">
                                <h3 className="text-sm font-medium text-gray-700 mb-2">自动备份设置</h3>
                                <form className="space-y-4">
                                    <div className="flex items-center">
                                        <input
                                            id="autoBackup"
                                            name="autoBackup"
                                            type="checkbox"
                                            className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                                            defaultChecked
                                        />
                                        <label htmlFor="autoBackup" className="ml-2 block text-sm text-gray-700">
                                            启用自动备份
                                        </label>
                                    </div>

                                    <div>
                                        <label htmlFor="backupFrequency" className="block text-sm font-medium text-gray-700 mb-1">
                                            备份频率
                                        </label>
                                        <select
                                            id="backupFrequency"
                                            name="backupFrequency"
                                            className="w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                                        >
                                            <option value="daily">每天</option>
                                            <option value="weekly" selected>每周</option>
                                            <option value="monthly">每月</option>
                                        </select>
                                    </div>

                                    <div>
                                        <label htmlFor="backupRetention" className="block text-sm font-medium text-gray-700 mb-1">
                                            保留备份数量
                                        </label>
                                        <input
                                            type="number"
                                            id="backupRetention"
                                            name="backupRetention"
                                            defaultValue="5"
                                            min="1"
                                            className="w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                                        />
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

                            <div className="border-t border-gray-200 pt-6 mt-6">
                                <h3 className="text-sm font-medium text-gray-700 mb-2">恢复备份</h3>
                                <p className="text-sm text-gray-500 mb-4">
                                    从以前创建的备份中恢复系统。注意：这将覆盖当前所有配置和数据。
                                </p>
                                <div className="flex items-center space-x-4">
                                    <input
                                        type="file"
                                        id="backupFile"
                                        name="backupFile"
                                        className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-medium file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
                                    />
                                    <button
                                        type="button"
                                        className="inline-flex justify-center px-4 py-2 text-sm font-medium text-white bg-amber-600 border border-transparent rounded-md shadow-sm hover:bg-amber-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-amber-500"
                                    >
                                        恢复
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
