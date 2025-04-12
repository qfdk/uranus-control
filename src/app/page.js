// src/app/page.js
import {formatDistanceToNow} from 'date-fns';
import {FileCheck, Globe, Server} from 'lucide-react';
import Link from 'next/link';
import StatusCard from '@/components/ui/StatusCard';
import QuickActionButton from '@/components/ui/QuickActionButton';
import connectDB from '@/lib/mongodb';
import Agent from '@/models/agent';

async function getAgentsData() {
  await connectDB();

  try {
    return await Agent.find({}).sort({lastHeartbeat: -1});
  } catch (error) {
    console.error('Error fetching agents:', error);
    return [];
  }
}

export default async function DashboardPage() {
  const agents = await getAgentsData();
  const onlineAgents = agents.filter(agent => agent.online);
  const totalWebsites = agents.reduce((sum, agent) => sum + (agent.stats?.websites || 0), 0);
  const totalCertificates = agents.reduce((sum, agent) => sum + (agent.stats?.certificates || 0), 0);

  // 获取最近的5个代理
  const recentAgents = agents
      .sort((a, b) => new Date(b.lastHeartbeat) - new Date(a.lastHeartbeat))
      .slice(0, 5);

  return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <h1 className="text-2xl font-bold text-gray-800 mb-6">控制台仪表盘</h1>

        {/* 状态卡片 */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <StatusCard
              title="代理节点"
              value={`${onlineAgents.length}/${agents.length}`}
              description="在线/总数"
              icon={<Server className="w-8 h-8 text-blue-500" />}
              color="blue"
          />
          <StatusCard
              title="网站"
              value={totalWebsites}
              description="托管网站总数"
              icon={<Globe className="w-8 h-8 text-green-500" />}
              color="green"
          />
          <StatusCard
              title="SSL证书"
              value={totalCertificates}
              description="有效证书数量"
              icon={<FileCheck className="w-8 h-8 text-purple-500" />}
              color="purple"
          />
        </div>

        {/* 最近活动的代理 */}
        <div className="bg-white rounded-lg shadow mb-8">
          <div className="px-4 py-3 border-b border-gray-200">
            <h2 className="text-lg font-medium text-gray-800">最近活动的代理</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">名称</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">IP地址</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">状态</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">版本</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">最后心跳</th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">操作</th>
              </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
              {recentAgents.map(agent => (
                  <tr key={agent._id.toString()}>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{agent.hostname}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{agent.ip}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm">
                    <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${agent.online ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                      {agent.online ? '在线' : '离线'}
                    </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{agent.version || '未知'}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {formatDistanceToNow(new Date(agent.lastHeartbeat), { addSuffix: true })}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-right">
                      <Link
                          href={`/agents/${agent._id.toString()}`}
                          className="text-blue-600 hover:text-blue-900 mr-3"
                      >
                        详情
                      </Link>
                    </td>
                  </tr>
              ))}
              {agents.length === 0 && (
                  <tr>
                    <td colSpan="6" className="px-6 py-4 text-center text-sm text-gray-500">
                      暂无代理数据
                    </td>
                  </tr>
              )}
              </tbody>
            </table>
          </div>
          <div className="px-4 py-3 border-t border-gray-200 bg-gray-50 text-right">
            <Link
                href="/agents"
                className="text-sm font-medium text-blue-600 hover:text-blue-900"
            >
              查看所有代理 →
            </Link>
          </div>
        </div>

        {/* 系统信息和快速操作 */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="bg-white rounded-lg shadow">
            <div className="px-4 py-3 border-b border-gray-200">
              <h2 className="text-lg font-medium text-gray-800">系统信息</h2>
            </div>
            <div className="p-4">
              <div className="space-y-3">
                <div className="flex justify-between">
                  <span className="text-sm text-gray-500">控制台版本</span>
                  <span className="text-sm font-medium">v1.0.0</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-gray-500">最后更新</span>
                  <span className="text-sm font-medium">{new Date().toLocaleDateString()}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-gray-500">数据库状态</span>
                  <span className="text-sm font-medium text-green-600">正常</span>
                </div>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow">
            <div className="px-4 py-3 border-b border-gray-200">
              <h2 className="text-lg font-medium text-gray-800">快速操作</h2>
            </div>
            <div className="p-4">
              <div className="grid grid-cols-2 gap-3">
                <QuickActionButton text="更新所有代理" color="blue" />
                <QuickActionButton text="检查SSL证书" color="green" />
                <QuickActionButton text="同步网站配置" color="purple" />
                <QuickActionButton text="系统备份" color="amber" />
              </div>
            </div>
          </div>
        </div>
      </div>
  );
}
