// src/lib/heartbeat-checker.js
import connectDB from './mongodb';
import Agent from '@/models/agent';

// 定义心跳超时时间（毫秒）
const HEARTBEAT_TIMEOUT = 30000; // 30秒

/**
 * 检查并更新代理状态
 * 如果最后心跳时间超过阈值，将代理标记为离线
 */
export async function checkAgentsStatus() {
    await connectDB();

    try {
        const timeoutThreshold = new Date(Date.now() - HEARTBEAT_TIMEOUT);

        // 将所有最后心跳时间早于阈值且状态为在线的代理更新为离线
        const result = await Agent.updateMany(
            {
                online: true,
                lastHeartbeat: { $lt: timeoutThreshold }
            },
            {
                $set: { online: false }
            }
        );

        console.log(`${result.modifiedCount} 个代理标记为离线`);
        return result.modifiedCount;
    } catch (error) {
        console.error('检查代理状态时出错:', error);
        throw error;
    }
}
