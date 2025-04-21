// src/app/api/settings/route.js
import {NextResponse} from 'next/server';
import connectDB from '@/lib/mongodb';
import mongoose from 'mongoose';

// 创建设置模型 (如果尚未存在)
let Settings;
try {
    Settings = mongoose.model('Settings');
} catch (error) {
    const SettingsSchema = new mongoose.Schema({
        key: {type: String, required: true, unique: true},
        value: {type: mongoose.Schema.Types.Mixed, required: true}
    }, {timestamps: true});

    Settings = mongoose.model('Settings', SettingsSchema);
}

// 获取设置
export async function GET(request) {
    try {
        await connectDB();

        // 获取URL参数
        const url = new URL(request.url);
        const key = url.searchParams.get('key');

        let response;

        if (key) {
            // 获取单个设置
            const setting = await Settings.findOne({key});
            response = setting ? setting.value : null;
        } else {
            // 获取所有设置
            const allSettings = await Settings.find();
            response = allSettings.reduce((acc, setting) => {
                acc[setting.key] = setting.value;
                return acc;
            }, {});
        }

        return NextResponse.json(response);
    } catch (error) {
        console.error('获取设置失败:', error);
        return NextResponse.json({error: error.message}, {status: 500});
    }
}

// 保存设置
export async function POST(request) {
    try {
        await connectDB();

        const data = await request.json();

        if (!data.key || data.value === undefined) {
            return NextResponse.json(
                {error: '请提供key和value字段'},
                {status: 400}
            );
        }

        // 使用upsert操作 - 如果存在则更新，不存在则创建
        const result = await Settings.findOneAndUpdate(
            {key: data.key},
            {value: data.value},
            {upsert: true, new: true}
        );

        return NextResponse.json({
            success: true,
            message: '设置已保存',
            data: result
        });
    } catch (error) {
        console.error('保存设置失败:', error);
        return NextResponse.json({error: error.message}, {status: 500});
    }
}

// 删除设置
export async function DELETE(request) {
    try {
        await connectDB();

        const url = new URL(request.url);
        const key = url.searchParams.get('key');

        if (!key) {
            return NextResponse.json(
                {error: '请提供要删除的设置key'},
                {status: 400}
            );
        }

        const result = await Settings.deleteOne({key});

        if (result.deletedCount === 0) {
            return NextResponse.json(
                {error: '未找到指定的设置'},
                {status: 404}
            );
        }

        return NextResponse.json({
            success: true,
            message: '设置已删除'
        });
    } catch (error) {
        console.error('删除设置失败:', error);
        return NextResponse.json({error: error.message}, {status: 500});
    }
}
