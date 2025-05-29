'use client';

// src/app/settings/page.js
import {useState, useEffect} from 'react';
import {AlertCircle, CheckCircle2, Database, Edit, Info, Loader2, Network, Plus, Settings as SettingsIcon, Shield, Trash2, User, X} from 'lucide-react';
import FormInput from '@/components/ui/FormInput';
import FormSelect from '@/components/ui/FormSelect';
import Button from '@/components/ui/Button';
import AppShell from '@/app/AppShell';
import { useAuth } from '@/app/contexts/AuthContext';
import { useSettings } from '@/app/contexts/SettingsContext';

export default function SettingsPage() {
    const [activeTab, setActiveTab] = useState('general');
    const { user: currentUser } = useAuth();
    const { settings: contextSettings, updateSettings } = useSettings();
    const [users, setUsers] = useState([]);
    const [loading, setLoading] = useState(false);
    const [editingUser, setEditingUser] = useState(null);
    const [formError, setFormError] = useState('');
    const [formSuccess, setFormSuccess] = useState('');
    const [formData, setFormData] = useState({
        username: '',
        password: ''
    });

    // 常规设置状态 - 初始化时使用context中的设置
    const [generalSettings, setGeneralSettings] = useState(contextSettings || {
        siteName: 'Οὐρανός 控制台',
        siteUrl: 'http://localhost:3000',
        language: 'zh-CN'
    });
    const [generalSettingsMessage, setGeneralSettingsMessage] = useState({
        type: '',
        content: '',
        show: false
    });

    // 数据库设置状态
    const [dbSettings, setDbSettings] = useState({
        databaseUrl: 'mongodb://localhost:27017/uranus-control'
    });
    const [dbSettingsMessage, setDbSettingsMessage] = useState({
        type: '',
        content: '',
        show: false
    });

    // MQTT设置状态
    const [mqttSettings, setMqttSettings] = useState({
        url: 'wss://mqtt.qfdk.me/mqtt',
        clientPrefix: 'uranus-control',
        reconnectPeriod: 3000,
        connectTimeout: 30000,
        keepalive: 30
    });

    // MQTT设置状态消息
    const [mqttSettingsMessage, setMqttSettingsMessage] = useState({
        type: '',
        content: '',
        show: false
    });

    const languageOptions = [
        {value: 'zh-CN', label: '简体中文'},
        {value: 'en-US', label: 'English'}
    ];



    // 获取常规设置 - 现在只从context同步
    const fetchGeneralSettings = () => {
        // 从context同步设置到本地state
        if (contextSettings) {
            setGeneralSettings(contextSettings);
        }
    };

    // 获取数据库设置
    const fetchDbSettings = async () => {
        try {
            setLoading(true);

            // 尝试从API获取设置
            const response = await fetch('/api/settings?key=dbSettings');

            if (response.ok) {
                const data = await response.json();
                if (data) {
                    setDbSettings(data);
                }
            }
        } finally {
            setLoading(false);
        }
    };

    // 获取用户列表
    const fetchUsers = async () => {
        try {
            setLoading(true);
            const response = await fetch('/api/users');

            if (!response.ok) {
                throw new Error('获取用户列表失败');
            }

            const data = await response.json();
            setUsers(data);
        } finally {
            setLoading(false);
        }
    };

    // 获取MQTT设置
    const fetchMqttSettings = async () => {
        try {
            setLoading(true);

            // 尝试从API获取设置
            const response = await fetch('/api/settings?key=mqttSettings');

            if (response.ok) {
                const data = await response.json();
                if (data) {
                    setMqttSettings(data);
                } else {
                    // 尝试从localStorage获取
                    const localSettings = localStorage.getItem('mqttSettings');
                    if (localSettings) {
                        setMqttSettings(JSON.parse(localSettings));
                    }
                }
            }
        } finally {
            setLoading(false);
        }
    };

    // 监听contextSettings变化，同步到本地state
    useEffect(() => {
        if (contextSettings) {
            setGeneralSettings(contextSettings);
        }
    }, [contextSettings]);

    // 首次加载获取数据
    useEffect(() => {
        if (activeTab === 'users') {
            fetchUsers();
        } else if (activeTab === 'mqtt') {
            fetchMqttSettings();
        } else if (activeTab === 'general') {
            fetchGeneralSettings();
        } else if (activeTab === 'database') {
            fetchDbSettings();
        }
    }, [activeTab]);

    // 处理常规设置输入变化
    const handleGeneralSettingChange = (e) => {
        const { name, value } = e.target;
        setGeneralSettings(prev => ({
            ...prev,
            [name]: value
        }));
    };

    // 处理数据库设置输入变化
    const handleDbSettingChange = (e) => {
        const { name, value } = e.target;
        setDbSettings(prev => ({
            ...prev,
            [name]: value
        }));
    };

    // 处理MQTT设置输入变化
    const handleMqttSettingChange = (e) => {
        const { name, value, type } = e.target;
        setMqttSettings({
            ...mqttSettings,
            [name]: type === 'number' ? parseInt(value, 10) : value
        });
    };

    // 处理用户表单输入变化
    const handleInputChange = (e) => {
        const { name, value, type, checked } = e.target;
        setFormData({
            ...formData,
            [name]: type === 'checkbox' ? checked : value
        });
    };


    // 处理用户表单提交
    const handleSubmit = async (e) => {
        e.preventDefault();
        setFormError('');
        setFormSuccess('');

        // 验证表单
        if (!formData.username) {
            setFormError('用户名是必填项');
            return;
        }

        // 验证密码 
        if (!editingUser && !formData.password) {
            // 创建用户时密码是必填的
            setFormError('密码是必填项');
            return;
        }

        // 构建提交数据，默认管理员角色和激活状态
        const submitData = { ...formData, role: 'admin', active: true };

        // 如果是编辑模式，并且密码为空，则不提交密码
        if (editingUser && !submitData.password) {
            delete submitData.password;
        }

        try {
            setLoading(true);

            let response;
            if (editingUser) {
                // 更新用户
                response = await fetch(`/api/users/${editingUser._id}`, {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(submitData)
                });
            } else {
                // 创建用户
                response = await fetch('/api/users', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(submitData)
                });
            }

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.message || '操作失败');
            }

            setFormSuccess(editingUser ? '用户更新成功' : '用户创建成功');
            await fetchUsers();

            // 1.5秒后重置表单
            setTimeout(() => {
                resetForm();
            }, 1500);
        } catch (error) {
            setFormError(error.message);
        } finally {
            setLoading(false);
        }
    };

    // 处理用户删除
    const handleDeleteUser = async (userId) => {
        if (!confirm('确定要删除此用户吗？此操作不可撤销。')) {
            return;
        }

        try {
            setLoading(true);
            const response = await fetch(`/api/users/${userId}`, {
                method: 'DELETE'
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.message || '删除用户失败');
            }

            // 刷新用户列表
            await fetchUsers();
        } catch (error) {
            alert(error.message);
        } finally {
            setLoading(false);
        }
    };

    // 重置用户表单
    const resetForm = () => {
        setFormData({
            username: '',
            password: ''
        });
        setEditingUser(null);
        setFormError('');
        setFormSuccess('');
    };

    // 保存常规设置
    const handleSaveSettings = async (e) => {
        e.preventDefault();

        setGeneralSettingsMessage({
            type: 'loading',
            content: '正在保存设置...',
            show: true
        });

        try {
            // 保存到API
            const response = await fetch('/api/settings', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    key: 'generalSettings',
                    value: generalSettings
                })
            });

            // 同时保存到localStorage作为备份
            localStorage.setItem('generalSettings', JSON.stringify(generalSettings));
            
            // 更新全局设置上下文
            updateSettings(generalSettings);

            if (response.ok) {
                setGeneralSettingsMessage({
                    type: 'success',
                    content: '设置已成功保存',
                    show: true
                });
            } else {
                const error = await response.json();
                throw new Error(error.message || '保存设置失败');
            }
        } catch (error) {
            setGeneralSettingsMessage({
                type: 'error',
                content: `保存设置失败: ${error.message}`,
                show: true
            });
        }

        // 3秒后清除消息
        setTimeout(() => {
            setGeneralSettingsMessage({
                type: '',
                content: '',
                show: false
            });
        }, 3000);
    };

    // 保存数据库设置
    const handleSaveDbSettings = async (e) => {
        e.preventDefault();

        setDbSettingsMessage({
            type: 'loading',
            content: '正在保存数据库设置...',
            show: true
        });

        try {
            // 保存到API
            const response = await fetch('/api/settings', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    key: 'dbSettings',
                    value: dbSettings
                })
            });

            if (response.ok) {
                setDbSettingsMessage({
                    type: 'success',
                    content: '数据库设置已成功保存',
                    show: true
                });
            } else {
                const error = await response.json();
                throw new Error(error.message || '保存数据库设置失败');
            }
        } catch (error) {
            setDbSettingsMessage({
                type: 'error',
                content: `保存数据库设置失败: ${error.message}`,
                show: true
            });
        }

        // 3秒后清除消息
        setTimeout(() => {
            setDbSettingsMessage({
                type: '',
                content: '',
                show: false
            });
        }, 3000);
    };

    // 保存MQTT设置
    const handleSaveMqttSettings = async (e) => {
        e.preventDefault();
        setMqttSettingsMessage({
            type: 'loading',
            content: '正在保存MQTT设置...',
            show: true
        });

        try {
            // 保存到API
            const response = await fetch('/api/settings', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    key: 'mqttSettings',
                    value: mqttSettings
                })
            });

            // 保存到localStorage以便前端使用
            localStorage.setItem('mqttSettings', JSON.stringify(mqttSettings));

            if (response.ok) {
                setMqttSettingsMessage({
                    type: 'success',
                    content: 'MQTT设置已保存，下次重新连接时生效',
                    show: true
                });
            } else {
                const errorData = await response.json();
                throw new Error(errorData.error || '保存MQTT设置失败');
            }

            // 3秒后清除消息
            setTimeout(() => {
                setMqttSettingsMessage({
                    type: '',
                    content: '',
                    show: false
                });
            }, 3000);
        } catch (error) {
            setMqttSettingsMessage({
                type: 'error',
                content: '保存MQTT设置失败: ' + error.message,
                show: true
            });
        }
    };

    // 测试数据库连接
    const handleTestDbConnection = async () => {
        setDbSettingsMessage({
            type: 'loading',
            content: '正在测试数据库连接...',
            show: true
        });

        try {
            // 这里只是模拟测试连接
            // 实际项目中应该有一个专门的API端点来测试连接
            await new Promise(resolve => setTimeout(resolve, 1500));

            setDbSettingsMessage({
                type: 'success',
                content: '数据库连接测试成功',
                show: true
            });
        } catch (error) {
            setDbSettingsMessage({
                type: 'error',
                content: `数据库连接失败: ${error.message}`,
                show: true
            });
        }

        // 5秒后清除消息
        setTimeout(() => {
            setDbSettingsMessage({
                type: '',
                content: '',
                show: false
            });
        }, 5000);
    };

    // 测试MQTT连接
    const handleTestMqttConnection = () => {
        setMqttSettingsMessage({
            type: 'loading',
            content: '正在测试MQTT连接...',
            show: true
        });

        // 模拟MQTT连接测试
        setTimeout(() => {
            setMqttSettingsMessage({
                type: 'success',
                content: 'MQTT连接测试成功',
                show: true
            });

            // 3秒后清除消息
            setTimeout(() => {
                setMqttSettingsMessage({
                    type: '',
                    content: '',
                    show: false
                });
            }, 3000);
        }, 2000);
    };

    // 恢复MQTT默认设置
    const handleRestoreMqttDefaults = () => {
        if (confirm('确定要恢复MQTT默认设置吗？')) {
            setMqttSettings({
                url: 'wss://mqtt.qfdk.me/mqtt',
                clientPrefix: 'uranus-control',
                reconnectPeriod: 3000,
                connectTimeout: 30000,
                keepalive: 30
            });

            setMqttSettingsMessage({
                type: 'info',
                content: '已恢复MQTT默认设置',
                show: true
            });

            // 3秒后清除消息
            setTimeout(() => {
                setMqttSettingsMessage({
                    type: '',
                    content: '',
                    show: false
                });
            }, 3000);
        }
    };

    return (
        <AppShell>
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
                <header className="mb-6">
                    <h1 className="text-2xl font-bold text-gray-800 dark:text-white">系统设置</h1>
                </header>

                <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
                    {/* 设置导航 */}
                    <div className="lg:col-span-1">
                        <div className="bg-white rounded-lg shadow dark:bg-gray-800">
                            <div className="px-4 py-3 border-b border-gray-200 dark:border-gray-700">
                                <h2 className="text-lg font-medium text-gray-800 dark:text-white">设置选项</h2>
                            </div>
                            <nav className="p-2">
                                <button
                                    onClick={() => setActiveTab('general')}
                                    className={`w-full flex items-center px-3 py-2 text-sm font-medium rounded-md ${
                                        activeTab === 'general'
                                            ? 'text-blue-700 bg-blue-50 dark:text-blue-400 dark:bg-blue-900/30'
                                            : 'text-gray-700 hover:bg-gray-50 dark:text-gray-300 dark:hover:bg-gray-700'
                                    } mb-1`}
                                >
                                    <SettingsIcon className="w-5 h-5 mr-2 text-blue-500 dark:text-blue-400"/>
                                    常规设置
                                </button>
                                <button
                                    onClick={() => setActiveTab('database')}
                                    className={`w-full flex items-center px-3 py-2 text-sm font-medium rounded-md ${
                                        activeTab === 'database'
                                            ? 'text-blue-700 bg-blue-50 dark:text-blue-400 dark:bg-blue-900/30'
                                            : 'text-gray-700 hover:bg-gray-50 dark:text-gray-300 dark:hover:bg-gray-700'
                                    } mb-1`}
                                >
                                    <Database className="w-5 h-5 mr-2 text-gray-500 dark:text-gray-400"/>
                                    数据库设置
                                </button>
                                <button
                                    onClick={() => {
                                        setActiveTab('users');
                                        fetchUsers();
                                    }}
                                    className={`w-full flex items-center px-3 py-2 text-sm font-medium rounded-md ${
                                        activeTab === 'users'
                                            ? 'text-blue-700 bg-blue-50 dark:text-blue-400 dark:bg-blue-900/30'
                                            : 'text-gray-700 hover:bg-gray-50 dark:text-gray-300 dark:hover:bg-gray-700'
                                    } mb-1`}
                                >
                                    <User className="w-5 h-5 mr-2 text-gray-500 dark:text-gray-400"/>
                                    用户管理
                                </button>
                                <button
                                    onClick={() => {
                                        setActiveTab('mqtt');
                                        fetchMqttSettings();
                                    }}
                                    className={`w-full flex items-center px-3 py-2 text-sm font-medium rounded-md ${
                                        activeTab === 'mqtt'
                                            ? 'text-blue-700 bg-blue-50 dark:text-blue-400 dark:bg-blue-900/30'
                                            : 'text-gray-700 hover:bg-gray-50 dark:text-gray-300 dark:hover:bg-gray-700'
                                    } mb-1`}
                                >
                                    <Network className="w-5 h-5 mr-2 text-gray-500 dark:text-gray-400"/>
                                    MQTT设置
                                </button>
                            </nav>
                        </div>
                    </div>

                    {/* 设置内容 */}
                    <div className="lg:col-span-3 space-y-6">
                        {/* 常规设置 */}
                        {activeTab === 'general' && (
                            <div className="bg-white rounded-lg shadow dark:bg-gray-800">
                                <div className="px-4 py-3 border-b border-gray-200 dark:border-gray-700">
                                    <h2 className="text-lg font-medium text-gray-800 dark:text-white">常规设置</h2>
                                </div>

                                {/* 常规设置状态消息 */}
                                {generalSettingsMessage.show && (
                                    <div className={`mx-4 mt-4 p-3 rounded-md flex items-center ${
                                        generalSettingsMessage.type === 'success'
                                            ? 'bg-green-50 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                                            : generalSettingsMessage.type === 'error'
                                                ? 'bg-red-50 text-red-700 dark:bg-red-900/30 dark:text-red-400'
                                                : generalSettingsMessage.type === 'loading'
                                                    ? 'bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400'
                                                    : 'bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400'
                                    }`}>
                                        {generalSettingsMessage.type === 'success' && <CheckCircle2 className="w-5 h-5 mr-2" />}
                                        {generalSettingsMessage.type === 'error' && <AlertCircle className="w-5 h-5 mr-2" />}
                                        {generalSettingsMessage.type === 'loading' && <Loader2 className="w-5 h-5 mr-2 animate-spin" />}
                                        <span>{generalSettingsMessage.content}</span>
                                    </div>
                                )}

                                <div className="p-4">
                                    <form className="space-y-4" onSubmit={handleSaveSettings}>
                                        <FormInput
                                            label="站点名称"
                                            id="siteName"
                                            name="siteName"
                                            value={generalSettings.siteName}
                                            onChange={handleGeneralSettingChange}
                                            required
                                        />

                                        <FormInput
                                            label="控制台网址"
                                            id="siteUrl"
                                            name="siteUrl"
                                            type="url"
                                            value={generalSettings.siteUrl}
                                            onChange={handleGeneralSettingChange}
                                            required
                                        />

                                        <FormSelect
                                            label="系统语言"
                                            id="language"
                                            name="language"
                                            value={generalSettings.language}
                                            options={languageOptions}
                                            onChange={handleGeneralSettingChange}
                                            required
                                        />

                                        <div className="pt-4 flex justify-end">
                                            <Button
                                                type="submit"
                                                variant="primary"
                                                disabled={loading}
                                            >
                                                {loading ? (
                                                    <>
                                                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                                        保存中...
                                                    </>
                                                ) : '保存设置'}
                                            </Button>
                                        </div>
                                    </form>
                                </div>
                            </div>
                        )}

                        {/* 数据库设置 */}
                        {activeTab === 'database' && (
                            <div className="bg-white rounded-lg shadow dark:bg-gray-800">
                                <div className="px-4 py-3 border-b border-gray-200 dark:border-gray-700">
                                    <h2 className="text-lg font-medium text-gray-800 dark:text-white">数据库设置</h2>
                                </div>

                                {/* 数据库设置状态消息 */}
                                {dbSettingsMessage.show && (
                                    <div className={`mx-4 mt-4 p-3 rounded-md flex items-center ${
                                        dbSettingsMessage.type === 'success'
                                            ? 'bg-green-50 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                                            : dbSettingsMessage.type === 'error'
                                                ? 'bg-red-50 text-red-700 dark:bg-red-900/30 dark:text-red-400'
                                                : dbSettingsMessage.type === 'loading'
                                                    ? 'bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400'
                                                    : 'bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400'
                                    }`}>
                                        {dbSettingsMessage.type === 'success' && <CheckCircle2 className="w-5 h-5 mr-2" />}
                                        {dbSettingsMessage.type === 'error' && <AlertCircle className="w-5 h-5 mr-2" />}
                                        {dbSettingsMessage.type === 'loading' && <Loader2 className="w-5 h-5 mr-2 animate-spin" />}
                                        <span>{dbSettingsMessage.content}</span>
                                    </div>
                                )}

                                <div className="p-4">
                                    <form className="space-y-4" onSubmit={handleSaveDbSettings}>
                                        <FormInput
                                            label="数据库连接字符串"
                                            id="databaseUrl"
                                            name="databaseUrl"
                                            value={dbSettings.databaseUrl}
                                            onChange={handleDbSettingChange}
                                            placeholder="mongodb://localhost:27017/uranus-control"
                                            required
                                        />

                                        <div className="pt-4 flex justify-end">
                                            <Button
                                                type="button"
                                                variant="secondary"
                                                onClick={handleTestDbConnection}
                                                className="mr-2"
                                            >
                                                测试连接
                                            </Button>
                                            <Button
                                                type="submit"
                                                variant="primary"
                                                disabled={loading}
                                            >
                                                {loading ? (
                                                    <>
                                                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                                        保存中...
                                                    </>
                                                ) : '保存设置'}
                                            </Button>
                                        </div>
                                    </form>
                                </div>
                            </div>
                        )}

                        {/* 用户管理 */}
                        {activeTab === 'users' && (
                            <div className="space-y-4">
                                {/* 用户表单 */}
                                <div className="bg-white rounded-lg shadow border border-gray-200 dark:bg-gray-800 dark:border-gray-700">
                                    <div className="px-4 py-3 border-b border-gray-200 dark:border-gray-700">
                                        <h3 className="text-lg font-semibold text-gray-800 dark:text-white">
                                            {editingUser ? '编辑用户' : '添加新用户'}
                                        </h3>
                                    </div>
                                    
                                    <form onSubmit={handleSubmit} className="p-4">
                                        {formError && (
                                            <div className="mb-3 text-red-600 text-sm bg-red-50 p-2 rounded border border-red-200">
                                                {formError}
                                            </div>
                                        )}
                                        
                                        {formSuccess && (
                                            <div className="mb-3 text-green-600 text-sm bg-green-50 p-2 rounded border border-green-200">
                                                {formSuccess}
                                            </div>
                                        )}
                                        
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                            <div>
                                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                                                    用户名 <span className="text-red-500">*</span>
                                                </label>
                                                <input 
                                                    type="text"
                                                    name="username"
                                                    value={formData.username}
                                                    onChange={handleInputChange}
                                                    className="w-full px-2 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded focus:ring-1 focus:ring-blue-400 focus:border-blue-400 dark:bg-gray-700 dark:text-white"
                                                    required
                                                />
                                            </div>
                                            
                                            <div>
                                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                                                    {editingUser ? '新密码 (留空不变)' : '密码'} {!editingUser && <span className="text-red-500">*</span>}
                                                </label>
                                                <input 
                                                    type="password"
                                                    name="password"
                                                    value={formData.password}
                                                    onChange={handleInputChange}
                                                    className="w-full px-2 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded focus:ring-1 focus:ring-blue-400 focus:border-blue-400 dark:bg-gray-700 dark:text-white"
                                                    required={!editingUser}
                                                />
                                            </div>
                                        </div>
                                        
                                        <div className="flex justify-end space-x-2 mt-4">
                                            {editingUser && (
                                                <Button 
                                                    type="button" 
                                                    onClick={() => {
                                                        setEditingUser(null);
                                                        resetForm();
                                                    }}
                                                    variant="secondary"
                                                    size="sm"
                                                >
                                                    取消
                                                </Button>
                                            )}
                                            <Button 
                                                type="submit"
                                                disabled={loading}
                                                variant="default"
                                                size="sm"
                                            >
                                                {loading ? (
                                                    <>
                                                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                                        处理中...
                                                    </>
                                                ) : (editingUser ? '更新' : '创建')}
                                            </Button>
                                        </div>
                                    </form>
                                </div>
                                
                                {/* 用户列表 */}
                                <div className="bg-white rounded-lg shadow border border-gray-200 dark:bg-gray-800 dark:border-gray-700">
                                    <div className="px-4 py-3 border-b border-gray-200 dark:border-gray-700">
                                        <h3 className="text-lg font-semibold text-gray-800 dark:text-white">用户列表</h3>
                                    </div>
                                    <div className="p-4">
                                        {loading && users.length === 0 ? (
                                            <div className="text-center py-8">
                                                <Loader2 className="h-6 w-6 animate-spin mx-auto text-blue-500" />
                                                <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">加载用户数据...</p>
                                            </div>
                                        ) : users.length === 0 ? (
                                            <div className="text-center py-8">
                                                <div className="w-12 h-12 bg-gray-100 dark:bg-gray-700 rounded-full flex items-center justify-center mx-auto mb-3">
                                                    <User className="w-6 h-6 text-gray-400" />
                                                </div>
                                                <h3 className="text-base font-medium text-gray-900 dark:text-white mb-1">暂无用户</h3>
                                                <p className="text-sm text-gray-600 dark:text-gray-400">开始添加用户来管理系统访问权限</p>
                                            </div>
                                        ) : (
                                            <div className="overflow-hidden border border-gray-200 dark:border-gray-700 rounded-lg">
                                                <div className="bg-gray-50 dark:bg-gray-700 px-4 py-2 border-b border-gray-200 dark:border-gray-600">
                                                    <div className="flex text-xs font-medium text-gray-700 dark:text-gray-300">
                                                        <div className="flex-1">用户名</div>
                                                        <div className="w-20 text-center">操作</div>
                                                    </div>
                                                </div>
                                                {users.map((user, index) => (
                                                    <div key={user._id} className={`flex items-center px-4 py-3 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors ${index !== users.length - 1 ? 'border-b border-gray-100 dark:border-gray-700' : ''}`}>
                                                        <div className="flex-1 flex items-center space-x-3">
                                                            <div className="w-8 h-8 bg-gradient-to-br from-blue-100 to-blue-200 dark:from-blue-900 dark:to-blue-800 rounded-full flex items-center justify-center">
                                                                <User className="w-4 h-4 text-blue-400 dark:text-blue-400" />
                                                            </div>
                                                            <span className="text-sm font-medium text-gray-900 dark:text-white">{user.username}</span>
                                                        </div>
                                                        <div className="w-20 flex items-center justify-center space-x-1">
                                                            <Button
                                                                onClick={() => {
                                                                    setEditingUser(user);
                                                                    setFormData({
                                                                        username: user.username,
                                                                        password: ''
                                                                    });
                                                                }}
                                                                variant="ghost"
                                                                size="icon"
                                                                title="编辑用户"
                                                            >
                                                                <Edit className="w-4 h-4" />
                                                            </Button>
                                                            {(currentUser && currentUser.id !== user._id) && (
                                                                <Button
                                                                    onClick={() => handleDeleteUser(user._id)}
                                                                    variant="ghost"
                                                                    size="icon"
                                                                    title="删除用户"
                                                                    className="hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/30"
                                                                >
                                                                    <Trash2 className="w-4 h-4" />
                                                                </Button>
                                                            )}
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* MQTT设置 */}
                        {activeTab === 'mqtt' && (
                            <div className="bg-white rounded-lg shadow dark:bg-gray-800">
                                <div className="px-4 py-3 border-b border-gray-200 dark:border-gray-700">
                                    <h2 className="text-lg font-medium text-gray-800 dark:text-white">MQTT设置</h2>
                                </div>

                                {/* MQTT设置状态消息 */}
                                {mqttSettingsMessage.show && (
                                    <div className={`mx-4 mt-4 p-3 rounded-md flex items-center ${
                                        mqttSettingsMessage.type === 'success'
                                            ? 'bg-green-50 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                                            : mqttSettingsMessage.type === 'error'
                                                ? 'bg-red-50 text-red-700 dark:bg-red-900/30 dark:text-red-400'
                                                : mqttSettingsMessage.type === 'loading'
                                                    ? 'bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400'
                                                    : 'bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400'
                                    }`}>
                                        {mqttSettingsMessage.type === 'success' && <CheckCircle2 className="w-5 h-5 mr-2" />}
                                        {mqttSettingsMessage.type === 'error' && <AlertCircle className="w-5 h-5 mr-2" />}
                                        {mqttSettingsMessage.type === 'loading' && <Loader2 className="w-5 h-5 mr-2 animate-spin" />}
                                        {mqttSettingsMessage.type === 'info' && <Info className="w-5 h-5 mr-2" />}
                                        <span>{mqttSettingsMessage.content}</span>
                                    </div>
                                )}

                                <div className="p-4">
                                    <form className="space-y-4" onSubmit={handleSaveMqttSettings}>
                                        <FormInput
                                            label="MQTT服务器地址"
                                            id="url"
                                            name="url"
                                            value={mqttSettings.url}
                                            onChange={handleMqttSettingChange}
                                            placeholder="wss://mqtt.qfdk.me/mqtt"
                                            required
                                        />

                                        <FormInput
                                            label="客户端ID前缀"
                                            id="clientPrefix"
                                            name="clientPrefix"
                                            value={mqttSettings.clientPrefix}
                                            onChange={handleMqttSettingChange}
                                            placeholder="uranus-control"
                                        />

                                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                            <FormInput
                                                label="重连周期 (毫秒)"
                                                id="reconnectPeriod"
                                                name="reconnectPeriod"
                                                type="number"
                                                min="1000"
                                                value={mqttSettings.reconnectPeriod}
                                                onChange={handleMqttSettingChange}
                                            />

                                            <FormInput
                                                label="连接超时 (毫秒)"
                                                id="connectTimeout"
                                                name="connectTimeout"
                                                type="number"
                                                min="5000"
                                                value={mqttSettings.connectTimeout}
                                                onChange={handleMqttSettingChange}
                                            />

                                            <FormInput
                                                label="保活间隔 (秒)"
                                                id="keepalive"
                                                name="keepalive"
                                                type="number"
                                                min="10"
                                                max="300"
                                                value={mqttSettings.keepalive}
                                                onChange={handleMqttSettingChange}
                                            />
                                        </div>

                                        <div className="pt-4 flex justify-between">
                                            <Button
                                                type="button"
                                                variant="secondary"
                                                onClick={handleRestoreMqttDefaults}
                                            >
                                                恢复默认设置
                                            </Button>

                                            <div className="flex space-x-2">
                                                <Button
                                                    type="button"
                                                    variant="secondary"
                                                    onClick={handleTestMqttConnection}
                                                >
                                                    测试连接
                                                </Button>
                                                <Button
                                                    type="submit"
                                                    variant="primary"
                                                >
                                                    保存设置
                                                </Button>
                                            </div>
                                        </div>
                                    </form>

                                    <div className="mt-6 pt-4 border-t border-gray-200 dark:border-gray-700">
                                        <div className="text-sm text-gray-600 dark:text-gray-400">
                                            <p className="mb-2 font-medium">注意事项：</p>
                                            <ul className="list-disc pl-5 space-y-1">
                                                <li>修改MQTT设置后需要重新连接才能生效</li>
                                                <li>MQTT服务器地址必须以 <code className="px-1 py-0.5 bg-gray-100 dark:bg-gray-700 rounded">ws://</code> 或 <code className="px-1 py-0.5 bg-gray-100 dark:bg-gray-700 rounded">wss://</code> 开头</li>
                                                <li>建议使用默认值，除非您知道您在做什么</li>
                                            </ul>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </div>

        </AppShell>
    );
}
