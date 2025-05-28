// src/app/api/agents/[id]/upgrade/route.js
import {NextResponse} from 'next/server';
import connectDB from '@/lib/mongodb';
import Agent from '@/models/agent';

export async function POST(request, {params}) {
    await connectDB();

    try {
        const {id} = await params;

        // Find the agent
        const agent = await Agent.findById(id);

        if (!agent) {
            return NextResponse.json({error: 'Agent not found'}, {status: 404});
        }

        if (!agent.online) {
            return NextResponse.json({error: 'Agent is offline'}, {status: 400});
        }

        // 获取由心跳上报的信息
        const {token} = agent;
        // 从心跳上报的数据中构建URL
        const url = agent.url || `http://${agent.ip}:7777`;

        if (!token) {
            return NextResponse.json({error: 'Agent token is missing'}, {status: 400});
        }

        // 确保有可用的URL
        if (!url && !agent.ip) {
            return NextResponse.json({error: 'Agent URL could not be determined'}, {status: 400});
        }

        // 构建升级请求URL
        const upgradeUrl = `${url}/upgrade`;


        // 发送升级请求
        const response = await fetch(upgradeUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({token})
        });

        if (!response.ok) {
            let errorText;
            try {
                const errorData = await response.json();
                errorText = errorData.message || `Status code: ${response.status}`;
            } catch {
                errorText = await response.text() || `Status code: ${response.status}`;
            }

            return NextResponse.json({
                error: `Failed to upgrade agent: ${errorText}`
            }, {status: response.status});
        }

        let result;
        try {
            result = await response.json();
        } catch (e) {
            // 如果响应不是JSON格式，使用响应文本
            const text = await response.text();
            result = {status: 'OK', raw: text};
        }

        return NextResponse.json({
            message: 'Upgrade request sent successfully',
            result
        });
    } catch (error) {
        console.error('Error upgrading agent:', error);
        return NextResponse.json({
            error: `Error upgrading agent: ${error.message}`
        }, {status: 500});
    }
}
