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
        
        // 输入验证
        if (!data.uuid || typeof data.uuid !== 'string') {
            return NextResponse.json({error: 'UUID is required and must be a string'}, {status: 400});
        }
        
        if (!data.hostname || typeof data.hostname !== 'string') {
            return NextResponse.json({error: 'Hostname is required and must be a string'}, {status: 400});
        }
        
        // 限制UUID长度防止恶意输入
        if (data.uuid.length > 100) {
            return NextResponse.json({error: 'UUID too long'}, {status: 400});
        }
        
        // 过滤允许的字段，防止污染
        const allowedFields = [
            'uuid', 'hostname', 'ip', 'os', 'memory', 'url', 'token',
            'buildTime', 'buildVersion', 'commitId', 'goVersion'
        ];
        
        const filteredData = {};
        for (const field of allowedFields) {
            if (data[field] !== undefined) {
                filteredData[field] = data[field];
            }
        }
        
        // 处理心跳更新或新代理注册
        const agent = await Agent.findOneAndUpdate(
            {uuid: filteredData.uuid},
            {
                $set: {
                    ...filteredData,
                    ip: filteredData.ip || 'Unknown',
                    online: true,
                    lastHeartbeat: new Date()
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
