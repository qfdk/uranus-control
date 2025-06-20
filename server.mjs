// server.mjs - Next.js自定义服务器与MQTT集成
import {createServer} from 'http';
import {parse} from 'url';
import next from 'next';
import mqtt from 'mqtt';
import connectDB from './src/lib/mongodb.js';
import Agent from './src/models/agent.js';

// 环境配置
const dev = process.env.NODE_ENV !== 'production';
const hostname = 'localhost';
const port = process.env.PORT || 3000;

// 初始化Next.js应用
const app = next({dev, hostname, port});
const handle = app.getRequestHandler();

// MQTT配置
const MQTT_BROKER = process.env.MQTT_BROKER || 'wss://mqtt.qfdk.me/mqtt';
const CLIENT_ID = `uranus-web-server`;
const MQTT_OPTIONS = {
    clientId: CLIENT_ID,
    clean: true,
    reconnectPeriod: 5000,
    connectTimeout: 30 * 1000,
    keepalive: 60
};

// MQTT主题
const TOPICS = {
    HEARTBEAT: 'uranus/heartbeat',
    STATUS: 'uranus/status'
};


// 设置并启动服务器
async function startServer() {
    try {
        // 首先连接到MongoDB
        await connectDB();
        console.log('MongoDB连接成功');

        // 初始化MQTT客户端
        const mqttClient = mqtt.connect(MQTT_BROKER, MQTT_OPTIONS);

        // 设置MQTT事件处理
        mqttClient.on('connect', () => {
            console.log('MQTT连接成功');

            // 只订阅心跳和状态主题
            mqttClient.subscribe(TOPICS.HEARTBEAT, {qos: 0});
            mqttClient.subscribe(TOPICS.STATUS, {qos: 0});
        });

        mqttClient.on('error', (error) => {
            console.error('MQTT错误:', error);
            // 记录错误但不退出进程，让自动重连机制处理
        });


        // 处理接收到的MQTT消息
        mqttClient.on('message', async (topic, message) => {
            try {
                const payload = JSON.parse(message.toString());

                // 处理心跳消息
                if (topic === TOPICS.HEARTBEAT) {
                    if (payload.uuid) {
                        const uuid = payload.uuid;
                        
                        // 直接更新数据库中的代理 - 使用UUID作为唯一标识
                        try {
                            await Agent.findOneAndUpdate(
                                {uuid},
                                {
                                    ...payload,
                                    ip: payload.ip || 'Unknown',
                                    online: true,
                                    lastHeartbeat: new Date()
                                },
                                {upsert: true, new: true}
                            );
                        } catch (dbError) {
                            console.error(`在数据库中更新代理 ${uuid} 时出错:`, dbError);
                        }
                    }
                }
                // 处理状态消息（包括遗嘱消息）
                else if (topic === TOPICS.STATUS) {
                    // 检查payload是否包含代理uuid和状态信息
                    if (payload.uuid && payload.status === 'offline') {
                        const uuid = payload.uuid;
                        console.log(`收到代理离线状态消息: ${uuid}`);

                        try {
                            // 立即更新数据库中代理的在线状态
                            const result = await Agent.findOneAndUpdate(
                                {uuid},
                                {
                                    online: false,
                                    lastHeartbeat: new Date() // 记录最后状态更新时间
                                },
                                {new: true}
                            );

                            if (result) {
                                console.log(`代理 ${uuid} 已标记为离线（通过遗嘱消息）`);
                            } else {
                                console.log(`未找到要更新状态的代理: ${uuid}`);
                            }
                        } catch (dbError) {
                            console.error(`更新代理 ${uuid} 离线状态时出错:`, dbError);
                        }
                    }
                }
            } catch (error) {
                console.error('处理MQTT消息时出错:', error);
            }
        });

        // 定时任务：标记没有发送心跳的代理为离线
        setInterval(async () => {
            try {
                const timeoutThreshold = new Date(Date.now() - 20000); // 20秒超时，减少一些超时时间

                const result = await Agent.updateMany(
                    {online: true, lastHeartbeat: {$lt: timeoutThreshold}},
                    {$set: {online: false}}
                );

                if (result.modifiedCount > 0) {
                    console.log(`由于心跳超时，已将 ${result.modifiedCount} 个代理标记为离线`);
                }
            } catch (error) {
                console.error('运行心跳检查时出错:', error);
            }
        }, 5000); // 每5秒运行一次，更快地检测离线


        // 准备Next.js应用
        await app.prepare();

        // 创建HTTP服务器
        createServer(async (req, res) => {
            try {
                // 获取真实IP地址 (Vercel优化)
                const realIP = req.headers['x-forwarded-for']?.split(',')[0]?.trim() ||
                    req.headers['x-real-ip'] ||
                    req.headers['cf-connecting-ip'] ||
                    req.connection?.remoteAddress ||
                    req.socket?.remoteAddress ||
                    'unknown';

                // 记录API请求的IP地址
                if (req.url && req.url.startsWith('/api/')) {
                    console.log(`[HTTP] ${req.method} ${req.url} - IP: ${realIP} - User-Agent: ${req.headers['user-agent'] || 'Unknown'}`);
                }

                const parsedUrl = parse(req.url, true);
                await handle(req, res, parsedUrl);
            } catch (err) {
                console.error('处理请求时出错:', err);
                res.statusCode = 500;
                res.end('服务器内部错误');
            }
        }).listen(port, (err) => {
            if (err) throw err;
            console.log(`> 服务已就绪 http://${hostname}:${port}`);
        });

    } catch (error) {
        console.error('启动服务器时出错:', error);
        process.exit(1);
    }
}

// 启动服务器
startServer();
