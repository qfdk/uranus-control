// src/app/api/agents/[id]/command/route.js
import { NextResponse } from 'next/server';
import connectDB from '@/lib/mongodb';
import Agent from '@/models/agent';

export async function POST(request, { params }) {
    await connectDB();

    try {
        const agentId = params.id;
        const { command } = await request.json();

        // Find the agent
        const agent = await Agent.findById(agentId);

        if (!agent) {
            return NextResponse.json({ error: 'Agent not found' }, { status: 404 });
        }

        if (!agent.online) {
            return NextResponse.json({ error: 'Agent is offline' }, { status: 400 });
        }

        // In a real implementation, you would send the command to the agent through a socket or another communication channel
        // For now, we'll just pretend to send the command and return a mock response

        // Mock response
        let response;

        switch (command) {
            case 'restart':
                response = { success: true, message: 'Agent is restarting Nginx service' };
                break;
            case 'reload':
                response = { success: true, message: 'Agent is reloading Nginx configuration' };
                break;
            case 'stop':
                response = { success: true, message: 'Agent is stopping Nginx service' };
                break;
            case 'start':
                response = { success: true, message: 'Agent is starting Nginx service' };
                break;
            case 'update':
                response = { success: true, message: 'Agent is updating' };
                break;
            default:
                response = { success: false, message: 'Unknown command' };
        }

        return NextResponse.json(response);
    } catch (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
