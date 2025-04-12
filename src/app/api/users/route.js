// src/app/api/users/route.js
import { NextResponse } from 'next/server';
import connectDB from '@/lib/mongodb';
import User from '@/models/user';
import { seedDefaultUsers } from '@/lib/seed-users';

// 获取所有用户
export async function GET() {
    await connectDB();

    try {
        // 尝试初始化默认用户（如果需要）
        await seedDefaultUsers();

        // 获取所有用户，但不返回密码和盐值
        const users = await User.find().select('-password -salt');

        return NextResponse.json(users);
    } catch (error) {
        console.error('获取用户列表失败:', error);
        return NextResponse.json(
            { error: error.message },
            { status: 500 }
        );
    }
}

// 创建新用户
export async function POST(request) {
    await connectDB();

    try {
        const userData = await request.json();

        // 检查用户名和邮箱是否已存在
        const existingUser = await User.findOne({
            $or: [
                { username: userData.username },
                { email: userData.email }
            ]
        });

        if (existingUser) {
            return NextResponse.json(
                {
                    success: false,
                    message: existingUser.username === userData.username
                        ? '用户名已被使用'
                        : '邮箱已被使用'
                },
                { status: 400 }
            );
        }

        // 创建新用户
        const user = await User.create(userData);

        // 返回用户数据（不包含密码和盐值）
        const safeUser = await User.findById(user._id).select('-password -salt');

        return NextResponse.json({
            success: true,
            user: safeUser
        });
    } catch (error) {
        console.error('创建用户失败:', error);

        // 处理验证错误
        if (error.name === 'ValidationError') {
            const messages = Object.values(error.errors).map(val => val.message);
            return NextResponse.json(
                { success: false, message: messages.join(', ') },
                { status: 400 }
            );
        }

        return NextResponse.json(
            { success: false, message: error.message },
            { status: 500 }
        );
    }
}
