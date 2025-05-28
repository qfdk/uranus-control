// src/models/user.js
import mongoose from 'mongoose';
import crypto from 'crypto';

// 用户模式定义
const UserSchema = new mongoose.Schema({
    username: {
        type: String,
        required: [true, '用户名是必填项'],
        unique: true,
        trim: true,
        minlength: [3, '用户名至少需要3个字符']
    },
    email: {
        type: String,
        required: false,
        unique: false,
        match: [
            /^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/,
            '请提供有效的邮箱地址'
        ]
    },
    password: {
        type: String,
        required: [true, '密码是必填项'],
        select: false // 默认查询不返回密码
    },
    salt: {
        type: String,
        select: false
    },
    role: {
        type: String,
        enum: ['admin', 'manager', 'user'],
        default: 'user'
    },
    active: {
        type: Boolean,
        default: true
    },
    resetPasswordToken: String,
    resetPasswordExpire: Date
}, {
    timestamps: true
});

// 密码加密中间件
UserSchema.pre('save', function (next) {
    // 如果密码没有被修改，则跳过
    if (!this.isModified('password')) {
        return next();
    }

    // 生成盐值
    this.salt = crypto.randomBytes(16).toString('hex');

    // 使用盐值加密密码
    this.password = crypto
        .pbkdf2Sync(this.password, this.salt, 1000, 64, 'sha512')
        .toString('hex');

    next();
});

// 验证密码的方法
UserSchema.methods.matchPassword = function (enteredPassword) {
    const hash = crypto
        .pbkdf2Sync(enteredPassword, this.salt, 1000, 64, 'sha512')
        .toString('hex');
    return this.password === hash;
};

// 生成重置密码的token
UserSchema.methods.getResetPasswordToken = function () {
    // 生成token
    const resetToken = crypto.randomBytes(20).toString('hex');

    // 加密token并存入数据库
    this.resetPasswordToken = crypto
        .createHash('sha256')
        .update(resetToken)
        .digest('hex');

    // 设置过期时间 (10分钟)
    this.resetPasswordExpire = Date.now() + 10 * 60 * 1000;

    return resetToken;
};

// 防止 mongoose 多次编译模型
export default mongoose.models.User || mongoose.model('User', UserSchema);
