// src/lib/seed-users.js
import User from '@/models/user';
import connectDB from './mongodb';

/**
 * 初始化默认用户
 * 只有在数据库中没有用户时才会创建默认用户
 */
export async function seedDefaultUsers() {
    try {
        await connectDB();

        // 检查是否已有用户
        const userCount = await User.countDocuments();

        // 如果已经有用户，则跳过
        if (userCount > 0) {
            console.log('数据库中已有用户，跳过初始化');
            return;
        }

        // 创建默认管理员用户
        const adminUser = new User({
            username: 'admin',
            email: 'admin@example.com',
            password: 'admin', // 这将通过模型中间件自动加密
            role: 'admin'
        });

        await adminUser.save();
        console.log('默认管理员用户创建成功');

        return true;
    } catch (error) {
        console.error('初始化默认用户失败:', error);
        return false;
    }
}
