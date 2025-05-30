// 简单的AES加密解密工具 (用于MQTT命令传输)
import crypto from 'crypto';

const ALGORITHM = 'aes-256-cbc';
const IV_LENGTH = 16; // 对于AES，这是16字节

/**
 * 使用AES-256-GCM加密数据
 * @param {string} text - 要加密的文本
 * @param {string} key - 加密密钥 (agent token)
 * @returns {string} 加密后的数据 (hex编码)
 */
export function encrypt(text, key) {
    try {
        // 创建密钥hash (确保是32字节)
        const keyHash = crypto.createHash('sha256').update(key).digest();
        
        // 生成随机IV
        const iv = crypto.randomBytes(12); // GCM推荐12字节IV
        
        // 创建加密器
        const cipher = crypto.createCipherGCM('aes-256-gcm', keyHash, iv);
        
        // 加密数据
        let encrypted = cipher.update(text, 'utf8', 'hex');
        encrypted += cipher.final('hex');
        
        // 获取认证标签
        const authTag = cipher.getAuthTag();
        
        // 返回: iv + authTag + encrypted (都是hex编码)
        return iv.toString('hex') + authTag.toString('hex') + encrypted;
    } catch (error) {
        console.error('加密失败:', error);
        throw new Error('加密失败');
    }
}

/**
 * 使用AES-256-GCM解密数据  
 * @param {string} encryptedData - 加密的数据 (hex编码)
 * @param {string} key - 解密密钥 (agent token)
 * @returns {string} 解密后的文本
 */
export function decrypt(encryptedData, key) {
    try {
        // 创建密钥hash
        const keyHash = crypto.createHash('sha256').update(key).digest();
        
        // 解析加密数据: 12字节IV + 16字节authTag + 加密内容
        const data = Buffer.from(encryptedData, 'hex');
        const iv = data.slice(0, 12);
        const authTag = data.slice(12, 28);
        const encrypted = data.slice(28);
        
        // 创建解密器
        const decipher = crypto.createDecipherGCM('aes-256-gcm', keyHash, iv);
        decipher.setAuthTag(authTag);
        
        // 解密数据
        let decrypted = decipher.update(encrypted, null, 'utf8');
        decrypted += decipher.final('utf8');
        
        return decrypted;
    } catch (error) {
        console.error('解密失败:', error);
        throw new Error('解密失败');
    }
}

/**
 * 创建安全的命令消息
 * @param {Object} command - 命令对象
 * @param {string} agentToken - Agent token
 * @returns {Object} 加密的命令消息
 */
export function createSecureCommand(command, agentToken) {
    const timestamp = Date.now();
    const commandWithMeta = {
        ...command,
        timestamp,
        nonce: crypto.randomBytes(8).toString('hex') // 防重放
    };
    
    const encryptedPayload = encrypt(JSON.stringify(commandWithMeta), agentToken);
    
    return {
        type: 'secure_command',
        payload: encryptedPayload,
        timestamp
    };
}

/**
 * 验证和解析安全命令
 * @param {Object} message - 接收到的消息
 * @param {string} agentToken - Agent token  
 * @param {number} timeWindow - 时间窗口(毫秒) 默认5分钟
 * @returns {Object} 解密的命令对象
 */
export function parseSecureCommand(message, agentToken, timeWindow = 5 * 60 * 1000) {
    if (message.type !== 'secure_command') {
        throw new Error('无效的命令类型');
    }
    
    // 解密负载
    const decryptedPayload = decrypt(message.payload, agentToken);
    const command = JSON.parse(decryptedPayload);
    
    // 验证时间窗口
    const now = Date.now();
    if (now - command.timestamp > timeWindow) {
        throw new Error('命令已过期');
    }
    
    return command;
}