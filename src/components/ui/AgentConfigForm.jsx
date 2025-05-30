// src/components/ui/AgentConfigForm.jsx
import React, { useState } from 'react';
import Button from './Button';
import FormInput from './FormInput';
import { Save, RotateCw, RefreshCw } from 'lucide-react';

export default function AgentConfigForm({ 
    onSave, 
    isSaving 
}) {
    const [formData, setFormData] = useState({
        mqttBroker: '',
        email: '',
        username: '',
        vhostPath: '',
        sslPath: '',
        controlCenter: '',
        token: ''
    });


    const handleInputChange = (name, value) => {
        setFormData(prev => ({
            ...prev,
            [name]: value
        }));
    };

    // 生成随机token
    const generateRandomToken = () => {
        const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
        let token = '';
        for (let i = 0; i < 32; i++) {
            token += chars.charAt(Math.floor(Math.random() * chars.length));
        }
        handleInputChange('token', token);
    };

    const handleSubmit = (e) => {
        e.preventDefault();
        
        // 过滤掉空值
        const cleanedData = {};
        Object.entries(formData).forEach(([key, value]) => {
            if (value && value.trim() !== '') {
                cleanedData[key] = value.trim();
            }
        });
        
        if (Object.keys(cleanedData).length === 0) {
            alert('请至少填写一个配置项');
            return;
        }
        
        onSave(cleanedData);
    };

    return (
        <div className="bg-white rounded-lg shadow dark:bg-gray-800">
            <div className="p-6 border-b border-gray-200 dark:border-gray-700">
                <h2 className="text-lg font-medium text-gray-800 dark:text-white">Agent配置管理</h2>
                <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                    修改Agent配置并远程推送到目标服务器
                </p>
            </div>
            
            <form onSubmit={handleSubmit} className="p-6 space-y-6">
                {/* MQTT配置部分 */}
                <div>
                    <h3 className="text-md font-medium text-gray-800 dark:text-white mb-3">MQTT配置</h3>
                    <div className="space-y-4">
                        <FormInput
                            label="MQTT服务器"
                            type="text"
                            value={formData.mqttBroker}
                            onChange={(e) => handleInputChange('mqttBroker', e.target.value)}
                            placeholder="mqtt://mqtt.qfdk.me:1883"
                        />
                        <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                            留空使用默认MQTT服务器
                        </p>
                    </div>
                </div>

                {/* 基本配置部分 */}
                <div>
                    <h3 className="text-md font-medium text-gray-800 dark:text-white mb-3">基本配置</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                            <FormInput
                                label="邮箱地址"
                                type="email"
                                value={formData.email}
                                onChange={(e) => handleInputChange('email', e.target.value)}
                                placeholder="hello@world.com"
                            />
                            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                                用于SSL证书申请
                            </p>
                        </div>
                        
                        <div>
                            <FormInput
                                label="用户名"
                                type="text"
                                value={formData.username}
                                onChange={(e) => handleInputChange('username', e.target.value)}
                                placeholder="admin"
                            />
                            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                                Web管理界面用户名
                            </p>
                        </div>
                        
                        <div>
                            <FormInput
                                label="Nginx配置路径"
                                type="text"
                                value={formData.vhostPath}
                                onChange={(e) => handleInputChange('vhostPath', e.target.value)}
                                placeholder="/etc/nginx/conf.d"
                            />
                            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                                虚拟主机配置文件目录
                            </p>
                        </div>
                        
                        <div>
                            <FormInput
                                label="SSL证书路径"
                                type="text"
                                value={formData.sslPath}
                                onChange={(e) => handleInputChange('sslPath', e.target.value)}
                                placeholder="/etc/nginx/ssl"
                            />
                            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                                SSL证书存储目录
                            </p>
                        </div>
                    </div>
                </div>

                {/* 高级配置部分 */}
                <div>
                    <h3 className="text-md font-medium text-gray-800 dark:text-white mb-3">高级配置</h3>
                    <div className="space-y-4">
                        <div>
                            <FormInput
                                label="控制中心地址"
                                type="text"
                                value={formData.controlCenter}
                                onChange={(e) => handleInputChange('controlCenter', e.target.value)}
                                placeholder="https://uranus-control.vercel.app"
                            />
                            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                                留空使用默认控制中心
                            </p>
                        </div>
                        
                        <div>
                            <div className="flex gap-2 items-end">
                                <div className="flex-1">
                                    <FormInput
                                        label="新Token"
                                        type="password"
                                        value={formData.token}
                                        onChange={(e) => handleInputChange('token', e.target.value)}
                                        placeholder="留空保持现有token不变"
                                    />
                                </div>
                                <Button
                                    type="button"
                                    variant="secondary"
                                    onClick={generateRandomToken}
                                    className="px-3 py-2 mb-4 whitespace-nowrap"
                                    title="生成随机Token"
                                >
                                    <RefreshCw className="w-4 h-4 mr-1" />
                                    生成
                                </Button>
                            </div>
                            <p className="text-xs text-yellow-600 dark:text-yellow-400 mt-1">
                                ⚠️ 修改token后Agent将重启并使用新token
                            </p>
                        </div>
                    </div>
                </div>

                {/* 提交按钮 */}
                <div className="flex justify-end pt-4 border-t border-gray-200 dark:border-gray-700">
                    <Button
                        type="submit"
                        variant="primary"
                        disabled={isSaving}
                        className="min-w-[120px]"
                    >
                        {isSaving ? (
                            <>
                                <RotateCw className="w-4 h-4 mr-2 animate-spin" />
                                发送中...
                            </>
                        ) : (
                            <>
                                <Save className="w-4 h-4 mr-2" />
                                推送配置
                            </>
                        )}
                    </Button>
                </div>
            </form>
            
            {/* 说明信息 */}
            <div className="px-6 pb-6">
                <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-4">
                    <h4 className="text-sm font-medium text-yellow-800 dark:text-yellow-200">重要说明</h4>
                    <ul className="text-xs text-yellow-700 dark:text-yellow-300 mt-2 space-y-1">
                        <li>• 配置将通过MQTT传输到Agent</li>
                        <li>• 只有填写的字段会被更新，空字段将保持原值</li>
                        <li>• 修改token或MQTT服务器后Agent会自动重启</li>
                        <li>• 请确保Agent在线且MQTT连接正常</li>
                    </ul>
                </div>
            </div>
        </div>
    );
}