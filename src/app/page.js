// src/app/page.js
import connectDB from '@/lib/mongodb';
import Agent from '@/models/agent';
import AppShell from './AppShell';
import DashboardClientPage from './client-page';

async function getAgentsData() {
  await connectDB();

  try {
    const agents = await Agent.find({}).sort({lastHeartbeat: -1});
    return JSON.parse(JSON.stringify(agents));
  } catch (error) {
    console.error('Error fetching agents:', error);
    return [];
  }
}

export default async function DashboardPage() {
  // 服务器端获取初始数据
  const initialAgents = await getAgentsData();

  return (
      <AppShell>
        <DashboardClientPage initialAgents={initialAgents} />
      </AppShell>
  );
}
