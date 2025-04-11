// src/app/api/agents/[id]/route.js
import { NextResponse } from 'next/server';
import connectDB from '@/lib/mongodb';
import Agent from '@/models/agent';

export async function GET(request, { params }) {
    await connectDB();

    try {
        const agentId = params.id;
        const agent = await Agent.findById(agentId);

        if (!agent) {
            return NextResponse.json({ error: 'Agent not found' }, { status: 404 });
        }

        return NextResponse.json(agent);
    } catch (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

export async function PUT(request, { params }) {
    await connectDB();

    try {
        const agentId = params.id;
        const data = await request.json();

        // Find and update the agent
        const updatedAgent = await Agent.findByIdAndUpdate(
            agentId,
            { ...data },
            { new: true, runValidators: true }
        );

        if (!updatedAgent) {
            return NextResponse.json({ error: 'Agent not found' }, { status: 404 });
        }

        return NextResponse.json(updatedAgent);
    } catch (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

export async function DELETE(request, { params }) {
    await connectDB();

    try {
        const agentId = params.id;

        // Find and delete the agent
        const deletedAgent = await Agent.findByIdAndDelete(agentId);

        if (!deletedAgent) {
            return NextResponse.json({ error: 'Agent not found' }, { status: 404 });
        }

        return NextResponse.json({ message: 'Agent deleted successfully' });
    } catch (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
