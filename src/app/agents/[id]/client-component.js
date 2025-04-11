'use client';

import { useState } from 'react';
import { formatDistanceToNow } from 'date-fns';
import Link from 'next/link';
import { ArrowLeft, Server, Globe, FileCheck, Zap, Database, Cpu, Memory, RefreshCw, Edit, XCircle } from 'lucide-react';
import Button from '@/components/ui/Button';

export default function AgentDetail({ agent }) {
    const [activeTab, setActiveTab] = useState('info');

    if (!agent) {
        return (
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 text-center">
                <h2 className="text-xl font-medium text-gray-900">未找到代理信息</h2>
                <p className="mt-2 text-gray-500">
                    该代理可能不存在或已被删除
                </p>
                <div className="mt-6">
                    <Link href="/agents">
                        <Button variant="secondary">
                            返回代理列表
                        </Button>
                    </Link>
                </div>
            </div>
        );
    }

    return (
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
            <div className="mb-6">
                <Link href="/agents" className="flex items-center text-blue-600 hover:text-blue-800">
                    <ArrowLeft className="w-4 h-4 mr-1" />
                    返回代理列表
                </Link>
            </div>

            <header className="mb-6 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-gray-800">{agent.name || agent.uuid}</h1>
                    <p className="text-gray-500">UUID: {agent.uuid}</p>
                </div>
                <div className="flex gap-2">
                    <Button variant="primary">
                        <RefreshCw className="w-4 h-4 mr-1" />
                        重启服务
                    </Button>
                    <Button variant="secondary">
                        <Edit className="w-4 h-4 mr-1" />
                        编辑配置
                    </Button>
                </div>
            </header>

            {/* 状态卡片 */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
                <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-4 transition-shadow hover:shadow">
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-sm text-gray-500 mb-1">状态</p>
                            <p className="text-xl font-bold flex items-center">
                                <span className={`inline-block w-3 h-3 rounded-full mr-2 ${agent.online ? 'bg-green-500' : 'bg-red-500'}`}></span>
                                {agent.online ? '在线' : '离线'}
                            </p>
                            <p className="text-xs text-gray-500 mt-1">
                                最后心跳: {agent.lastHeartbeat
                                ? formatDistanceToNow(new Date(agent.lastHeartbeat), { addSuffix: true })
                                : '未知'}
                            </p>
                        </div>
                        <div className="bg-blue-50 p-3 rounded-full">
                            <Server className="w-6 h-6 text-blue-500" />
                        </div>
                    </div>
                </div>

                <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-4 transition-shadow hover:shadow">
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-sm text-gray-500 mb-1">网站</p>
                            <p className="text-xl font-bold">{agent.stats?.websites || 0}</p>
                            <p className="text-xs text-gray-500 mt-1">托管站点数量</p>
                        </div>
                        <div className="bg-green-50 p-3 rounded-full">
                            <Globe className="w-6 h-6 text-green-500" />
                        </div>
                    </div>
                </div>

                <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-4 transition-shadow hover:shadow">
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-sm text-gray-500 mb-1">SSL证书</p>
                            <p className="text-xl font-bold">{agent.stats?.certificates || 0}</p>
                            <p className="text-xs text-gray-500 mt-1">有效证书数量</p>
                        </div>
                        <div className="bg-purple-50 p-3 rounded-full">
                            <FileCheck className="w-6 h-6 text-purple-500" />
                        </div>
                    </div>
                </div>
            </div>

            {/* 信息标签页导航 */}
            <div className="mb-4 border-b border-gray-200">
                <nav className="flex -mb-px space-x-8 overflow-x-auto" aria-label="Tabs">
                    <button
                        onClick={() => setActiveTab('info')}
                        className={`py-4 px-1 border-b-2 font-medium text-sm ${
                            activeTab === 'info'
                                ? 'border-blue-500 text-blue-600'
                                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                        }`}
                    >
                        系统信息
                    </button>
                    <button
                        onClick={() => setActiveTab('nginx')}
                        className={`py-4 px-1 border-b-2 font-medium text-sm ${
                            activeTab === 'nginx'
                                ? 'border-blue-500 text-blue-600'
                                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                        }`}
                    >
                        Nginx 信息
                    </button>
                    <button
                        onClick={() => setActiveTab('websites')}
                        className={`py-4 px-1 border-b-2 font-medium text-sm ${
                            activeTab === 'websites'
                                ? 'border-blue-500 text-blue-600'
                                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                        }`}
                    >
                        托管站点
                    </button>
                </nav>
            </div>

            <div className="grid grid-cols-1 gap-6">
                {/* 系统信息面板 */}
                {activeTab === 'info' && (
                    <div className="bg-white rounded-lg shadow">
                        <div className="px-4 py-3 border-b border-gray-200">
                            <h2 className="text-lg font-medium text-gray-800">系统信息</h2>
                        </div>
                        <div className="p-4 space-y-4">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div className="flex items-start">
                                    <div className="bg-gray-100 p-2 rounded-md mr-3">
                                        <Cpu className="w-5 h-5 text-gray-500" />
                                    </div>
                                    <div>
                                        <p className="text-sm text-gray-500">操作系统</p>
                                        <p className="text-sm font-medium">{agent.config?.osName || '未知'}</p>
                                    </div>
                                </div>

                                <div className="flex items-start">
                                    <div className="bg-gray-100 p-2 rounded-md mr-3">
                                        <Memory className="w-5 h-5 text-gray-500" />
                                    </div>
                                    <div>
                                        <p className="text-sm text-gray-500">内存</p>
                                        <p className="text-sm font-medium">{agent.config?.memInfo || '未知'}</p>
                                    </div>
                                </div>

                                <div className="flex items-start">
                                    <div className="bg-gray-100 p-2 rounded-md mr-3">
                                        <Database className="w-5 h-5 text-gray-500" />
                                    </div>
                                    <div>
                                        <p className="text-sm text-gray-500">IP地址</p>
                                        <p className="text-sm font-medium">{agent.ip || '未知'}</p>
                                    </div>
                                </div>

                                <div className="flex items-start">
                                    <div className="bg-gray-100 p-2 rounded-md mr-3">
                                        <Zap className="w-5 h-5 text-gray-500" />
                                    </div>
                                    <div>
                                        <p className="text-sm text-gray-500">版本</p>
                                        <p className="text-sm font-medium">{agent.version || '未知'}</p>
                                    </div>
                                </div>
                            </div>

                            <div className="pt-2 border-t border-gray-100">
                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <p className="text-sm text-gray-500">构建时间</p>
                                        <p className="text-sm font-medium">{agent.buildTime || '未知'}</p>
                                    </div>
                                    <div>
                                        <p className="text-sm text-gray-500">提交ID</p>
                                        <p className="text-sm font-medium">{agent.commitId ? agent.commitId.substring(0, 8) : '未知'}</p>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {/* Nginx 信息面板 */}
                {activeTab === 'nginx' && (
                    <div className="bg-white rounded-lg shadow">
                        <div className="px-4 py-3 border-b border-gray-200">
                            <h2 className="text-lg font-medium text-gray-800">Nginx 信息</h2>
                        </div>
                        <div className="p-4 space-y-4">
                            <div className="space-y-3">
                                <div className="flex justify-between items-center p-2 rounded-md bg-gray-50">
                                    <span className="text-sm text-gray-700">Nginx 状态</span>
                                    <span className={`text-sm font-medium ${agent.config?.nginxStatus !== "KO" ? 'text-green-600' : 'text-red-600'}`}>
                                      {agent.config?.nginxStatus !== "KO" ? '运行中' : '已停止'}
                                    </span>
                                </div>
                                <div className="flex justify-between items-center p-2 rounded-md hover:bg-gray-50">
                                    <span className="text-sm text-gray-700">Nginx 版本</span>
                                    <span className="text-sm font-medium">{agent.config?.nginxVersion || '未知'}</span>
                                </div>
                                <div className="flex justify-between items-center p-2 rounded-md hover:bg-gray-50">
                                    <span className="text-sm text-gray-700">SSL 版本</span>
                                    <span className="text-sm font-medium">{agent.config?.sslVersion || '未知'}</span>
                                </div>
                                <div className="flex justify-between items-center p-2 rounded-md hover:bg-gray-50">
                                    <span className="text-sm text-gray-700">配置文件路径</span>
                                    <span className="text-sm font-medium overflow-hidden text-ellipsis">{agent.config?.configPath || '未知'}</span>
                                </div>
                            </div>

                            <div className="pt-2 border-t border-gray-100">
                                <div className="flex justify-end space-x-2 mt-2">
                                    <Button size="sm" variant="primary">
                                        <RefreshCw className="w-3.5 h-3.5 mr-1" />
                                        重载配置
                                    </Button>
                                    <Button size="sm" variant="success">
                                        <Edit className="w-3.5 h-3.5 mr-1" />
                                        编辑配置
                                    </Button>
                                    <Button size="sm" variant="danger">
                                        <XCircle className="w-3.5 h-3.5 mr-1" />
                                        停止服务
                                    </Button>
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {/* 托管站点面板 */}
                {activeTab === 'websites' && (
                    <div className="bg-white rounded-lg shadow">
                        <div className="px-4 py-3 border-b border-gray-200">
                            <h2 className="text-lg font-medium text-gray-800">托管站点</h2>
                        </div>
                        <div className="overflow-x-auto">
                            <table className="min-w-full divide-y divide-gray-200">
                                <thead className="bg-gray-50">
                                <tr>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">域名</th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">反向代理</th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">SSL</th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">证书到期</th>
                                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">操作</th>
                                </tr>
                                </thead>
                                <tbody className="bg-white divide-y divide-gray-200">
                                {agent.config?.sites ? (
                                    agent.config.sites.map((site, index) => (
                                        <tr key={index} className="hover:bg-gray-50">
                                            <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{site.domain}</td>
                                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{site.proxy}</td>
                                            <td className="px-6 py-4 whitespace-nowrap text-sm">
                                              <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${site.ssl ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'}`}>
                                                {site.ssl ? '启用' : '未启用'}
                                              </span>
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                                {site.ssl && site.expiryDate ? site.expiryDate : '-'}
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap text-sm text-right space-x-2">
                                                <button className="text-blue-600 hover:text-blue-900">编辑</button>
                                                <button className="text-gray-600 hover:text-gray-900">配置</button>
                                                <button className="text-red-600 hover:text-red-900">删除</button>
                                            </td>
                                        </tr>
                                    ))
                                ) : (
                                    <tr>
                                        <td colSpan="5" className="px-6 py-4 text-center text-sm text-gray-500">
                                            暂无站点数据
                                        </td>
                                    </tr>
                                )}
                                </tbody>
                            </table>
                        </div>
                        <div className="px-4 py-3 border-t border-gray-200 bg-gray-50 flex justify-end">
                            <Button variant="primary">
                                添加新站点
                            </Button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
