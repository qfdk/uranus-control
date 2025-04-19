import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';

export function loadEnv() {
    // 确定正确的环境变量文件路径
    const envFiles = [
        '.env.local',  // 本地开发环境，优先级最高
        '.env.development',  // 开发环境特定配置
        '.env'  // 默认配置文件
    ];

    // 遍历并加载第一个找到的环境文件
    for (const file of envFiles) {
        const envPath = path.resolve(process.cwd(), file);

        if (fs.existsSync(envPath)) {
            console.log(`加载环境配置文件: ${file}`);
            dotenv.config({path: envPath});
            break;
        }
    }
}
