// src/app/api/users/[id]/route.js
import { NextResponse } from 'next/server';
import connectDB from '@/lib/mongodb';
import User from '@/models/user';

// 获取单个用户
export async function GET(request, { params }) {
    await connectDB();

    try {
        const { id } = params;
        const user = await User.findById(id).select('-password -salt');

        if (!user) {
            return NextResponse.json(
                { error: '用户不存在' },
                { status: 404 }
            );
        }

        return NextResponse.json(user);
    } catch (error) {
        return NextResponse.json(
            { error: error.message },
            { status: 500 }
        );
    }
}

// 更新用户
export async function PUT(request, { params }) {
    await connectDB();

    try {
        const { id } = params;
        const updateData = await request.json();

        // 检查是否是唯一约束字段的更新
        if (updateData.username || updateData.email) {
            const existingUser = await User.findOne({
                _id: { $ne: id }, // 排除当前用户
                $or: [
                    updateData.username ? { username: updateData.username } : null,
                    updateData.email ? { email: updateData.email } : null
                ].filter(Boolean) // 过滤掉null值
            });

            if (existingUser) {
                const field = existingUser.username === updateData.username ? '用户名' : '邮箱';
                return NextResponse.json(
                    { success: false, message: `该${field}已被使用` },
                    { status: 400 }
                );
            }
        }

        // 如果更新包含密码，需要确保通过用户模型的保存方法
        // 以触发密码加密中间件
        if (updateData.password) {
            const user = await User.findById(id).select('+password +salt');
            if (!user) {
                return NextResponse.json(
                    { success: false, message: '用户不存在' },
                    { status: 404 }
                );
            }

            // 更新用户字段
            Object.keys(updateData).forEach(key => {
                if (key !== '_id') { // 防止修改_id
                    user[key] = updateData[key];
                }
            });

            // 保存用户以触发密码加密
            await user.save();

            // 重新查询用户以排除敏感信息
            const updatedUser = await User.findById(id).select('-password -salt');

            return NextResponse.json({
                success: true,
                user: updatedUser
            });
        } else {
            // 常规更新（无密码变更）
            const updatedUser = await User.findByIdAndUpdate(
                id,
                { $set: updateData },
                { new: true, runValidators: true }
            ).select('-password -salt');

            if (!updatedUser) {
                return NextResponse.json(
                    { success: false, message: '用户不存在' },
                    { status: 404 }
                );
            }

            return NextResponse.json({
                success: true,
                user: updatedUser
            });
        }
    } catch (error) {
        console.error('更新用户失败:', error);

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

// 删除用户
export async function DELETE(request, { params }) {
    await connectDB();

    try {
        const { id } = params;

        // 防止删除最后一个管理员
        const adminCount = await User.countDocuments({ role: 'admin' });
        const userToDelete = await User.findById(id);

        if (!userToDelete) {
            return NextResponse.json(
                { success: false, message: '用户不存在' },
                { status: 404 }
            );
        }

        if (userToDelete.role === 'admin' && adminCount <= 1) {
            return NextResponse.json(
                { success: false, message: '无法删除最后一个管理员账户' },
                { status: 400 }
            );
        }

        await User.findByIdAndDelete(id);

        return NextResponse.json({
            success: true,
            message: '用户已成功删除'
        });
    } catch (error) {
        return NextResponse.json(
            { success: false, message: error.message },
            { status: 500 }
        );
    }
}
