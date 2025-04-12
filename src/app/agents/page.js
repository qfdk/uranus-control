// src/app/agents/page.js
import connectDB from '@/lib/mongodb';
import Agent from '@/models/agent';
import AgentsClientPage from './client-page';

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
    // 服务器端获取数据
    const agents = await getAgentsData();

    // 将数据传递给客户端组件
    return <AgentsClientPage initialAgents={agents} />;
}
