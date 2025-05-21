// src/app/api/agents/[id]/debug/route.js
import {NextResponse} from 'next/server';
import connectDB from '@/lib/mongodb';
import Agent from '@/models/agent';
import useMqttStore from '@/store/mqttStore';

export async function GET(request, {params}) {
    await connectDB();

    try {
        const {id} = await params;
        const agent = await Agent.findById(id);

        if (!agent) {
            return NextResponse.json({error: 'Agent not found'}, {status: 404});
        }

        // Get MQTT state for comparison
        let mqttState = null;
        let mqttConnected = false;
        
        try {
            if (typeof useMqttStore !== 'undefined' && useMqttStore.getState) {
                const mqttStore = useMqttStore.getState();
                mqttConnected = mqttStore.connected;
                
                if (agent.uuid && mqttStore.getAgentState) {
                    const allAgentState = mqttStore.getAgentState();
                    mqttState = allAgentState[agent.uuid] || null;
                }
            }
        } catch (mqttError) {
            console.error('获取MQTT状态时出错:', mqttError);
        }

        return NextResponse.json({
            agentFromDB: agent,
            mqttState,
            mqttConnected,
            now: new Date(),
            lastHeartbeatAge: agent.lastHeartbeat ? 
                Math.round((new Date() - new Date(agent.lastHeartbeat)) / 1000) + ' seconds ago' : 
                'unknown'
        });
    } catch (error) {
        return NextResponse.json({error: error.message}, {status: 500});
    }
}