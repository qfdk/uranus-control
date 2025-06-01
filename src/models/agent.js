// src/models/agent.js
import mongoose from 'mongoose';

const AgentSchema = new mongoose.Schema({
    uuid: {type: String, required: true, unique: true},
    // 构建信息
    buildTime: String,
    buildVersion: String,
    commitId: String,
    goVersion: String,
    // 系统信息
    hostname: {type: String, required: true},
    ip: {type: String, default: 'Unknown'},
    os: String,
    memory: String,
    url: String,
    token: String,

    online: {type: Boolean, default: false},
    lastHeartbeat: {type: Date, default: Date.now}
}, {timestamps: true});

// 添加复合索引优化查询性能
AgentSchema.index({ online: 1, lastHeartbeat: 1 }); // 用于心跳超时查询

export default mongoose.models.Agent || mongoose.model('Agent', AgentSchema);
