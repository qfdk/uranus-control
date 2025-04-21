// src/app/api/agents/route.js
import {NextResponse} from 'next/server';
import connectDB from '@/lib/mongodb';
import Agent from '@/models/agent';
import {checkAgentsStatus} from '@/lib/heartbeat-checker';

export async function GET() {
    await connectDB();

    try {
        // 先检查并更新代理状态
        await checkAgentsStatus();
        // 然后获取最新的代理列表，按照hostname
        const agents = await Agent.find({}).sort({hostname: 1});
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
                $set: {
                    ...data,
                    online: true,
                    lastHeartbeat: new Date() // 显式设置最新时间戳
                }
            },
            {upsert: true, new: true, runValidators: true}
        );
        return NextResponse.json(agent);
    } catch (error) {
        console.error('更新代理心跳失败:', error);
        return NextResponse.json({error: error.message}, {status: 500});
    }
}
