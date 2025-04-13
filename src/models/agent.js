// src/models/agent.js
import mongoose from 'mongoose';

const AgentSchema = new mongoose.Schema({
    hostname: {type: String, required: true},
    uuid: {type: String, required: true, unique: true},
    ip: {type: String, required: true},
    version: String,
    buildTime: String,
    commitId: String,
    online: {type: Boolean, default: false},
    lastHeartbeat: {type: Date, default: Date.now},
    token: String,
    url: String,
    os: String,
    memory: String,
    stats: {
        websites: {type: Number, default: 0},
        certificates: {type: Number, default: 0}
    }
}, {timestamps: true});

export default mongoose.models.Agent || mongoose.model('Agent', AgentSchema);
