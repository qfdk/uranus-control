// src/app/agents/[id]/page.js
import connectDB from '@/lib/mongodb';
import Agent from '@/models/agent';
import { notFound } from 'next/navigation';
import AgentDetailWrapper from './client-page';

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

    return <AgentDetailWrapper agent={agent} />;
}
