// src/app/agents/[id]/page.js
import { formatDistanceToNow } from 'date-fns';
import Link from 'next/link';
import { ArrowLeft, Server, Globe, FileCheck, Zap, Database, Cpu, Memory } from 'lucide-react';
import connectDB from '@/lib/mongodb';
import Agent from '@/models/agent';
import { notFound } from 'next/navigation';

async function getAgentData(id) {
    await connectDB();

    try {
        const agent = await Agent.findById(id);
        if (!agent) return null;
        return JSON.parse(JSON.stringify(agent));
    } catch (error) {
        console.error('Error fetching agent:', error);
        return null;
    }
}

export default async function AgentDetailPage({ params }) {
    const agent = await getAgentData(params.id);

    if (!agent) {
        notFound();
    }

    return (
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
            <div className="mb-6">
                <Link href="/agents" className="flex items-center text-blue-600 hover:text-blue-800">
                    <ArrowLeft className="w-4 h-4 mr-1" />
                    返回代理列表
                </Link>
            </div>

            <header className="mb-6 flex justify-between items-center">
                <div>
                    <h1 className="text-2xl font-bold text-gray-800">{agent.name || agent.uuid}</h1>
                    <p className="text-gray-500">UUID: {agent.uuid}</p>
                </div>
                <div className="flex gap-2">
                    <button className="px-4 py-2 bg-blue-600 text-white rounded-md text-sm font-medium hover:bg-blue-700">
                        重启服务
                    </button>
                    <button className="px-4 py-2 bg-gray-600 text-white rounded-md text-sm font-medium hover:bg-gray-700">
                        编辑配置
                    </button>
                </div>
            </header>

            {/* 状态卡片 */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
                <div className="bg-white rounded-lg border border-gray-200 p-4">
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

                <div className="bg-white rounded-lg border border-gray-200 p-4">
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

                <div className="bg-white rounded-lg border border-gray-200 p-4">
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

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* 系统信息 */}
                <div className="bg-white rounded-lg shadow">
                    <div className="px-4 py-3 border-b border-gray-200">
                        <h2 className="text-lg font-medium text-gray-800">系统信息</h2>
                    </div>
                    <div className="p-4 space-y-4">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="flex items-start">
                                <div className="bg-gray-100 p-2 rounded mr-3">
                                    <Cpu className="w-5 h-5 text-gray-500" />
                                </div>
                                <div>
                                    <p className="text-sm text-gray-500">操作系统</p>
                                    <p className="text-sm font-medium">{agent.config?.osName || '未知'}</p>
                                </div>
                            </div>

                            <div className="flex items-start">
                                <div className="bg-gray-100 p-2 rounded mr-3">
                                    <Memory className="w-5 h-5 text-gray-500" />
                                </div>
                                <div>
                                    <p className="text-sm text-gray-500">内存</p>
                                    <p className="text-sm font-medium">{agent.config?.memInfo || '未知'}</p>
                                </div>
                            </div>

                            <div className="flex items-start">
                                <div className="bg-gray-100 p-2 rounded mr-3">
                                    <Database className="w-5 h-5 text-gray-500" />
                                </div>
                                <div>
                                    <p className="text-sm text-gray-500">IP地址</p>
                                    <p className="text-sm font-medium">{agent.ip || '未知'}</p>
                                </div>
                            </div>

                            <div className="flex items-start">
                                <div className="bg-gray-100 p-2 rounded mr-3">
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

                {/* Nginx 信息 */}
                <div className="bg-white rounded-lg shadow">
                    <div className="px-4 py-3 border-b border-gray-200">
                        <h2 className="text-lg font-medium text-gray-800">Nginx 信息</h2>
                    </div>
                    <div className="p-4 space-y-4">
                        <div className="space-y-3">
                            <div className="flex justify-between">
                                <span className="text-sm text-gray-500">Nginx 状态</span>
                                <span className={`text-sm font-medium ${agent.config?.nginxStatus !== "KO" ? 'text-green-600' : 'text-red-600'}`}>
                  {agent.config?.nginxStatus !== "KO" ? '运行中' : '已停止'}
                </span>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-sm text-gray-500">Nginx 版本</span>
                                <span className="text-sm font-medium">{agent.config?.nginxVersion || '未知'}</span>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-sm text-gray-500">SSL 版本</span>
                                <span className="text-sm font-medium">{agent.config?.sslVersion || '未知'}</span>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-sm text-gray-500">配置文件路径</span>
                                <span className="text-sm font-medium">{agent.config?.configPath || '未知'}</span>
                            </div>
                        </div>

                        <div className="pt-2 border-t border-gray-100">
                            <div className="flex justify-end space-x-2 mt-2">
                                <button className="px-3 py-1 bg-blue-600 text-white rounded text-xs font-medium hover:bg-blue-700">
                                    重载配置
                                </button>
                                <button className="px-3 py-1 bg-green-600 text-white rounded text-xs font-medium hover:bg-green-700">
                                    编辑配置
                                </button>
                                <button className="px-3 py-1 bg-red-600 text-white rounded text-xs font-medium hover:bg-red-700">
                                    停止服务
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* 站点列表 */}
            <div className="mt-6 bg-white rounded-lg shadow">
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
                                <tr key={index}>
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
                    <button className="px-4 py-2 bg-blue-600 text-white rounded-md text-sm font-medium hover:bg-blue-700">
                        添加新站点
                    </button>
                </div>
            </div>
        </div>
    );
}
