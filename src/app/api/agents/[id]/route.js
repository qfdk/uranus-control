// src/app/api/agents/[id]/route.js
import {NextResponse} from 'next/server';
import connectDB from '@/lib/mongodb';
import Agent from '@/models/agent';
import mongoose from 'mongoose';

export async function GET(request, {params}) {
    await connectDB();

    try {
        const {id} = await params;
        
        // 验证ObjectId格式
        if (!mongoose.Types.ObjectId.isValid(id)) {
            return NextResponse.json({error: 'Invalid agent ID format'}, {status: 400});
        }
        
        const agent = await Agent.findById(id);

        if (!agent) {
            return NextResponse.json({error: 'Agent not found'}, {status: 404});
        }

        return NextResponse.json(agent);
    } catch (error) {
        return NextResponse.json({error: error.message}, {status: 500});
    }
}

export async function PUT(request, {params}) {
    await connectDB();

    try {
        const agentId = params.id;
        const data = await request.json();

        // Find and update the agent
        const updatedAgent = await Agent.findByIdAndUpdate(
            agentId,
            {
                ...data,
                ip: data.ip || 'Unknown' // 确保IP字段有默认值
            },
            {new: true, runValidators: true}
        );

        if (!updatedAgent) {
            return NextResponse.json({error: 'Agent not found'}, {status: 404});
        }

        return NextResponse.json(updatedAgent);
    } catch (error) {
        return NextResponse.json({error: error.message}, {status: 500});
    }
}

export async function DELETE(request, {params}) {
    await connectDB();
    const {id} = await params;
    try {
        // Find and delete the agent
        const deletedAgent = await Agent.findByIdAndDelete(id);

        if (!deletedAgent) {
            return NextResponse.json({error: 'Agent not found'}, {status: 404});
        }

        return NextResponse.json({message: 'Agent deleted successfully'});
    } catch (error) {
        return NextResponse.json({error: error.message}, {status: 500});
    }
}
