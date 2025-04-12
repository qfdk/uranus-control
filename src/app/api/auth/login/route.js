// src/app/api/auth/login/route.js
import { NextResponse } from 'next/server';
import connectDB from '@/lib/mongodb';
import User from '@/models/user';

export async function POST(request) {
    await connectDB();

    try {
        const { username, password } = await request.json();

        // 验证请求数据
        if (!username || !password) {
            return NextResponse.json(
                { success: false, message: '请提供用户名和密码' },
                { status: 400 }
            );
        }

        // 查找用户并包含密码字段（默认是不返回的）
        const user = await User.findOne({ username }).select('+password +salt');

        // 如果用户不存在
        if (!user) {
            return NextResponse.json(
                { success: false, message: '用户名或密码不正确' },
                { status: 401 }
            );
        }

        // 检查用户是否激活
        if (!user.active) {
            return NextResponse.json(
                { success: false, message: '账户已被禁用，请联系管理员' },
                { status: 401 }
            );
        }

        // 验证密码
        const isMatch = user.matchPassword(password);

        if (!isMatch) {
            return NextResponse.json(
                { success: false, message: '用户名或密码不正确' },
                { status: 401 }
            );
        }

        // 创建用户对象（不包含敏感信息）
        const userResponse = {
            id: user._id,
            username: user.username,
            email: user.email,
            role: user.role
        };

        return NextResponse.json({
            success: true,
            user: userResponse
        });
    } catch (error) {
        console.error('登录处理错误:', error);
        return NextResponse.json(
            { success: false, message: '服务器错误，请稍后再试' },
            { status: 500 }
        );
    }
}
