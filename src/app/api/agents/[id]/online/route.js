// src/app/api/agents/[id]/online/route.js
import {NextResponse} from 'next/server';
import connectDB from '@/lib/mongodb';
import Agent from '@/models/agent';
import useMqttStore from '@/store/mqttStore';

export async function POST(request, {params}) {
    await connectDB();

    try {
        const {id} = params;
        const {online} = await request.json();
        
        if (online === undefined) {
            return NextResponse.json({error: 'Missing online status parameter'}, {status: 400});
        }

        // Find the agent first to get the UUID
        const agent = await Agent.findById(id);
        if (!agent) {
            return NextResponse.json({error: 'Agent not found'}, {status: 404});
        }

        // Update the agent's online status
        const updatedAgent = await Agent.findByIdAndUpdate(
            id,
            {
                online: Boolean(online),
                lastHeartbeat: online ? new Date() : agent.lastHeartbeat
            },
            {new: true}
        );

        // If MQTT store is available, also update the MQTT state
        try {
            if (agent.uuid && typeof useMqttStore !== 'undefined' && useMqttStore.getState) {
                const mqttStore = useMqttStore.getState();
                const allAgentState = mqttStore.getAgentState();
                
                if (allAgentState[agent.uuid]) {
                    // Update the MQTT state for this agent
                    allAgentState[agent.uuid].online = Boolean(online);
                    
                    // If turning online, update lastHeartbeat
                    if (online) {
                        allAgentState[agent.uuid].lastHeartbeat = new Date();
                    }
                    
                    // Update the store
                    if (typeof mqttStore.updateMqttAgentState === 'function') {
                        mqttStore.updateMqttAgentState({...allAgentState});
                    }
                }
            }
        } catch (mqttError) {
            console.error('更新MQTT状态时出错:', mqttError);
        }

        return NextResponse.json({
            success: true,
            message: `Agent ${updatedAgent.hostname || updatedAgent.uuid} is now ${online ? 'online' : 'offline'}`,
            agent: updatedAgent
        });
    } catch (error) {
        return NextResponse.json({error: error.message}, {status: 500});
    }
}