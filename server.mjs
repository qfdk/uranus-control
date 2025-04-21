// server.js - Next.js自定义服务器与MQTT集成
import {createServer} from 'http';
import {parse} from 'url';
import next from 'next';
import mqtt from 'mqtt';
// 导入现有的数据库连接和模型
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
const CLIENT_ID = `uranus-control-server`;
const MQTT_OPTIONS = {
    clientId: CLIENT_ID,
    clean: true,
    reconnectPeriod: 5000,
    connectTimeout: 30 * 1000,
    keepalive: 60,
    will: {
        topic: 'uranus/clients/status',
        payload: JSON.stringify({clientId: CLIENT_ID, status: 'offline', serverProcess: true}),
        qos: 1,
        retain: false
    }
};

// MQTT主题
const TOPICS = {
    HEARTBEAT: 'uranus/heartbeat',
    STATUS: 'uranus/status',
    COMMAND: 'uranus/command/',
    RESPONSE: 'uranus/response/',
    CLIENT_HEARTBEAT: 'uranus/clients/heartbeat'
};

// 数据库更新限流（按代理）
const updateThrottles = new Map();
const UPDATE_INTERVAL = 5000; // 同一代理最少5秒更新一次

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

            // 订阅主题
            mqttClient.subscribe(TOPICS.HEARTBEAT, {qos: 1});
            mqttClient.subscribe(TOPICS.STATUS, {qos: 1});

            // 宣告服务器在线
            mqttClient.publish('uranus/clients/status', JSON.stringify({
                clientId: CLIENT_ID,
                status: 'online',
                serverProcess: true,
                timestamp: Date.now()
            }), {qos: 1});

            // 请求所有代理的状态
            mqttClient.publish('uranus/request_status', JSON.stringify({
                clientId: CLIENT_ID,
                serverProcess: true,
                timestamp: Date.now()
            }), {qos: 1});
        });

        mqttClient.on('error', (error) => {
            console.error('MQTT错误:', error);
        });

        mqttClient.on('reconnect', () => {
            console.log('MQTT正在重新连接...');
        });

        mqttClient.on('close', () => {
            console.log('MQTT连接已关闭');
        });

        // 处理接收到的MQTT消息
        mqttClient.on('message', async (topic, message) => {
            try {
                const payload = JSON.parse(message.toString());

                // 处理心跳消息
                if (topic === TOPICS.HEARTBEAT) {
                    if (payload.uuid) {
                        const uuid = payload.uuid;
                        // 实现限流以避免数据库过载
                        const now = Date.now();
                        const lastUpdate = updateThrottles.get(uuid) || 0;

                        if (now - lastUpdate >= UPDATE_INTERVAL) {
                            updateThrottles.set(uuid, now);

                            // 更新数据库中的代理
                            try {
                                const updatedAgent = await Agent.findOneAndUpdate(
                                    {uuid},
                                    {
                                        ...payload,
                                        online: true,
                                        lastHeartbeat: new Date() // 明确设置为当前时间
                                    },
                                    {upsert: true, new: true}
                                );
                            } catch (dbError) {
                                console.error(`在数据库中更新代理 ${uuid} 时出错:`, dbError);
                            }
                        }
                    }
                }

                // 处理状态消息
                else if (topic === TOPICS.STATUS) {
                    if (payload.uuid) {
                        const uuid = payload.uuid;
                        try {
                            const updatedAgent = await Agent.findOneAndUpdate(
                                {uuid},
                                {
                                    online: payload.status === 'online',
                                    ...(payload.status === 'online' ? {lastHeartbeat: new Date()} : {})
                                },
                                {upsert: false, new: true}
                            );

                            if (updatedAgent) {
                                console.log(`已将代理 ${uuid}(${updatedAgent.hostname}) 的状态更新为 ${payload.status}`);
                            }
                        } catch (dbError) {
                            console.error(`更新代理 ${uuid} 的状态时出错:`, dbError);
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
                const timeoutThreshold = new Date(Date.now() - 30000); // 30秒超时

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
        }, 15000); // 每15秒运行一次

        // 准备Next.js应用
        await app.prepare();

        // 创建HTTP服务器
        createServer(async (req, res) => {
            try {
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

        // 处理优雅关闭
        process.on('SIGTERM', gracefulShutdown);
        process.on('SIGINT', gracefulShutdown);

        function gracefulShutdown() {
            console.log('收到关闭信号，正在关闭连接...');

            // 通过MQTT发送离线状态
            if (mqttClient.connected) {
                mqttClient.publish('uranus/clients/status', JSON.stringify({
                    clientId: CLIENT_ID,
                    status: 'offline',
                    serverProcess: true,
                    timestamp: Date.now()
                }), {qos: 1}, () => {
                    mqttClient.end(true, () => {
                        console.log('MQTT连接已关闭');
                        process.exit(0);
                    });
                });
            } else {
                process.exit(0);
            }

            // 如果优雅关闭失败，3秒后强制退出
            setTimeout(() => {
                console.log('超时后强制退出');
                process.exit(1);
            }, 3000);
        }
    } catch (error) {
        console.error('启动服务器时出错:', error);
        process.exit(1);
    }
}

// 启动服务器
startServer();
