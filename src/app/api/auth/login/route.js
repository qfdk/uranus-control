// src/app/api/auth/login/route.js
import { NextResponse } from 'next/server';

export async function POST(request) {
    try {
        const { username, password } = await request.json();

        // 在实际应用中，您应该在这里连接数据库并验证用户凭据
        // 这里只是一个简化的示例，实际实现时应当加入密码哈希等安全措施

        // 模拟用户验证 - 仅用于演示
        if (username === 'admin' && password === 'password') {
            return NextResponse.json({
                success: true,
                user: {
                    id: 1,
                    username: 'admin',
                    role: 'admin',
                    email: 'admin@example.com'
                }
            });
        } else {
            return NextResponse.json(
                { success: false, message: '用户名或密码不正确' },
                { status: 401 }
            );
        }
    } catch (error) {
        console.error('登录处理错误:', error);
        return NextResponse.json(
            { success: false, message: '服务器错误，请稍后再试' },
            { status: 500 }
        );
    }
}
