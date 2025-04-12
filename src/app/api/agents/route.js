// src/app/api/agents/route.js
import {NextResponse} from 'next/server';
import connectDB from '@/lib/mongodb';
import Agent from '@/models/agent';

export async function GET() {
    await connectDB();

    try {
        const agents = await Agent.find({}).sort({lastHeartbeat: -1});
        return NextResponse.json(agents);
    } catch (error) {
        return NextResponse.json({error: error.message}, {status: 500});
    }
}

export async function POST(request) {
    await connectDB();

    try {
        const data = await request.json();
        // 处理心跳更新或新代理注册
        const agent = await Agent.findOneAndUpdate(
            {uuid: data.uuid},
            {
                ...data,
                online: true,
                lastHeartbeat: new Date()
            },
            {upsert: true, new: true}
        );

        return NextResponse.json(agent);
    } catch (error) {
        return NextResponse.json({error: error.message}, {status: 500});
    }
}
