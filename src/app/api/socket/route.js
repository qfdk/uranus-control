// src/app/api/socket/route.js
import {NextResponse} from 'next/server';
import {Server as SocketIOServer} from 'socket.io';

let io;

export function GET(req) {
    if (!io) {
        // 获取服务器实例
        const res = new NextResponse();
        const httpServer = res.socket.server;

        // 初始化Socket.IO
        io = new SocketIOServer(httpServer, {
            path: '/api/socket',
            addTrailingSlash: false
        });

        io.on('connection', (socket) => {
            console.log('Client connected:', socket.id);

            // 监听心跳事件
            socket.on('agent:heartbeat', (data) => {
                console.log('Heartbeat from agent:', data.uuid);

                // 可以在这里处理代理的心跳更新
                // 例如：更新数据库中的代理状态

                // 广播给所有客户端
                io.emit('agent:update', data);
            });

            socket.on('disconnect', () => {
                console.log('Client disconnected:', socket.id);
            });
        });

        // 存储io实例到res.socket.server
        res.socket.server.io = io;
    }

    return new NextResponse('WebSocket server is running');
}
