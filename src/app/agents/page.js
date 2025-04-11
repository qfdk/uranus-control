// src/app/agents/page.js
import { formatDistanceToNow } from 'date-fns';
import Link from 'next/link';
import connectDB from '@/lib/mongodb';
import Agent from '@/models/agent';

async function getAgentsData() {
    await connectDB();

    try {
        const agents = await Agent.find({}).sort({ lastHeartbeat: -1 });
        return JSON.parse(JSON.stringify(agents));
    } catch (error) {
        console.error('Error fetching agents:', error);
        return [];
    }
}

export default async function AgentsPage() {
    const agents = await getAgentsData();

    return (
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
            <header className="mb-6 flex justify-between items-center">
                <h1 className="text-2xl font-bold text-gray-800">代理管理</h1>
                <button className="px-4 py-2 bg-blue-600 text-white rounded-md text-sm font-medium hover:bg-blue-700">
                    添加新代理
                </button>
            </header>

            {/* 代理过滤和搜索 */}
            <div className="mb-6 bg-white p-4 rounded-lg shadow-sm">
                <div className="flex flex-col sm:flex-row gap-4">
                    <div className="flex-1">
                        <label htmlFor="search" className="block text-sm font-medium text-gray-700 mb-1">搜索</label>
                        <input
                            type="text"
                            id="search"
                            className="w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                            placeholder="搜索代理名称或IP地址..."
                        />
                    </div>
                    <div className="w-full sm:w-48">
                        <label htmlFor="status" className="block text-sm font-medium text-gray-700 mb-1">状态</label>
                        <select
                            id="status"
                            className="w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                        >
                            <option value="all">全部</option>
                            <option value="online">在线</option>
                            <option value="offline">离线</option>
                        </select>
                    </div>
                </div>
            </div>

            {/* 代理列表 */}
            <div className="bg-white rounded-lg shadow overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-200">
                        <thead className="bg-gray-50">
                        <tr>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">名称</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">IP地址</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">状态</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">版本</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">网站</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">最后心跳</th>
                            <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">操作</th>
                        </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-gray-200">
                        {agents.map(agent => (
                            <tr key={agent._id}>
                                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{agent.name || '未命名代理'}</td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{agent.ip}</td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm">
                    <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${agent.online ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                      {agent.online ? '在线' : '离线'}
                    </span>
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{agent.version || '未知'}</td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{agent.stats?.websites || 0}</td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                    {agent.lastHeartbeat
                                        ? formatDistanceToNow(new Date(agent.lastHeartbeat), { addSuffix: true })
                                        : '未知'}
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-right space-x-2">
                                    <Link
                                        href={`/agents/${agent._id}`}
                                        className="text-blue-600 hover:text-blue-900"
                                    >
                                        详情
                                    </Link>
                                    <button className="text-gray-600 hover:text-gray-900">
                                        编辑
                                    </button>
                                    <button className="text-red-600 hover:text-red-900">
                                        删除
                                    </button>
                                </td>
                            </tr>
                        ))}
                        {agents.length === 0 && (
                            <tr>
                                <td colSpan="7" className="px-6 py-4 text-center text-sm text-gray-500">
                                    暂无代理数据
                                </td>
                            </tr>
                        )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
}
