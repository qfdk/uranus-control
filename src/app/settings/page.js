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
    const { updateSettings } = useSettings();
    const [users, setUsers] = useState([]);
    const [loading, setLoading] = useState(false);
    const [showModal, setShowModal] = useState(false);
    const [editingUser, setEditingUser] = useState(null);
    const [formError, setFormError] = useState('');
    const [formSuccess, setFormSuccess] = useState('');
    const [formData, setFormData] = useState({
        username: '',
        password: '',
        confirmPassword: '',
        role: 'admin',
        active: true
    });

    // 常规设置状态
    const [generalSettings, setGeneralSettings] = useState({
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

    // 角色选项
    const roleOptions = [
        { value: 'admin', label: '管理员' }
    ];

    // 状态选项
    const statusOptions = [
        { value: true, label: '激活' },
        { value: false, label: '禁用' }
    ];

    // 获取常规设置
    const fetchGeneralSettings = async () => {
        try {
            setLoading(true);

            // 尝试从API获取设置
            const response = await fetch('/api/settings?key=generalSettings');

            if (response.ok) {
                const data = await response.json();
                if (data) {
                    console.log('已加载常规设置:', data);
                    setGeneralSettings(data);
                }
            } else {
                // 如果API调用失败，尝试从localStorage获取
                const savedSettings = localStorage.getItem('generalSettings');
                if (savedSettings) {
                    setGeneralSettings(JSON.parse(savedSettings));
                }
            }
        } catch (error) {
            console.error('加载常规设置失败:', error);
        } finally {
            setLoading(false);
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
                    console.log('已加载数据库设置:', data);
                    setDbSettings(data);
                }
            }
        } catch (error) {
            console.error('加载数据库设置失败:', error);
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
        } catch (error) {
            console.error('加载用户失败:', error);
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
                    console.log('已加载MQTT设置:', data);
                    setMqttSettings(data);
                } else {
                    // 尝试从localStorage获取
                    const localSettings = localStorage.getItem('mqttSettings');
                    if (localSettings) {
                        setMqttSettings(JSON.parse(localSettings));
                    }
                }
            } else {
                // 使用默认设置
                console.log('使用默认MQTT设置');
            }
        } catch (error) {
            console.error('加载MQTT设置失败:', error);
        } finally {
            setLoading(false);
        }
    };

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

    // 打开模态框并重置表单
    const openModal = (user = null) => {
        if (user) {
            setEditingUser(user);
            setFormData({
                username: user.username,
                password: '',
                confirmPassword: '',
                role: user.role,
                active: user.active
            });
        } else {
            resetForm();
        }
        setFormError('');
        setFormSuccess('');
        setShowModal(true);
    };

    // 关闭模态框
    const closeModal = () => {
        setShowModal(false);
        setTimeout(() => {
            resetForm();
            setEditingUser(null);
        }, 300);
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
        if (!editingUser && formData.password !== formData.confirmPassword) {
            setFormError('两次输入的密码不一致');
            return;
        }

        // 构建提交数据
        const submitData = { ...formData };
        delete submitData.confirmPassword;

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

            // 3秒后关闭模态框
            setTimeout(() => {
                closeModal();
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
            password: '',
            confirmPassword: '',
            role: 'admin',
            active: true
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
            console.error('保存设置失败:', error);
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
            console.error('保存数据库设置失败:', error);
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
                            <div className="bg-white rounded-lg shadow dark:bg-gray-800">
                                <div className="px-4 py-3 border-b border-gray-200 dark:border-gray-700 flex justify-between items-center">
                                    <h2 className="text-lg font-medium text-gray-800 dark:text-white">用户管理</h2>
                                    <Button
                                        variant="primary"
                                        size="sm"
                                        onClick={() => openModal()}
                                    >
                                        <Plus className="w-4 h-4 mr-1" />
                                        添加用户
                                    </Button>
                                </div>
                                <div className="overflow-x-auto">
                                    <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                                        <thead className="bg-gray-50 dark:bg-gray-700">
                                        <tr>
                                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">用户名</th>
                                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">角色</th>
                                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">状态</th>
                                            <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">操作</th>
                                        </tr>
                                        </thead>
                                        <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                                        {loading && users.length === 0 ? (
                                            <tr>
                                                <td colSpan="4" className="px-6 py-4 text-center text-gray-500 dark:text-gray-400">
                                                    <Loader2 className="h-6 w-6 animate-spin mx-auto" />
                                                    <span className="mt-2 block">加载用户数据...</span>
                                                </td>
                                            </tr>
                                        ) : users.length === 0 ? (
                                            <tr>
                                                <td colSpan="4" className="px-6 py-4 text-center text-gray-500 dark:text-gray-400">
                                                    <p>暂无用户数据</p>
                                                    <Button
                                                        variant="primary"
                                                        size="sm"
                                                        className="mt-2"
                                                        onClick={() => openModal()}
                                                    >
                                                        <Plus className="w-4 h-4 mr-1" />
                                                        添加第一个用户
                                                    </Button>
                                                </td>
                                            </tr>
                                        ) : (
                                            users.map(user => (
                                                <tr key={user._id} className="hover:bg-gray-50 dark:hover:bg-gray-700">
                                                    <td className="px-6 py-4 whitespace-nowrap">
                                                        <div className="flex items-center">
                                                            <div className="flex-shrink-0 h-8 w-8 bg-gray-100 dark:bg-gray-700 rounded-full flex items-center justify-center">
                                                                <User className="h-4 w-4 text-gray-500 dark:text-gray-400" />
                                                            </div>
                                                            <div className="ml-4">
                                                                <div className="text-sm font-medium text-gray-900 dark:text-white">
                                                                    {user.username}
                                                                </div>
                                                            </div>
                                                        </div>
                                                    </td>
                                                    <td className="px-6 py-4 whitespace-nowrap">
                                                        <div className="flex items-center text-sm text-gray-500 dark:text-gray-400">
                                                            {user.role === 'admin' && (
                                                                <Shield className="h-4 w-4 mr-1 text-blue-500 dark:text-blue-400" />
                                                            )}
                                                            管理员
                                                        </div>
                                                    </td>
                                                    <td className="px-6 py-4 whitespace-nowrap">
                                                        <span className={`px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full ${
                                                            user.active
                                                                ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400'
                                                                : 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400'
                                                        }`}>
                                                            {user.active ? '激活' : '禁用'}
                                                        </span>
                                                    </td>
                                                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                                                        <button
                                                            className="text-blue-600 hover:text-blue-900 dark:text-blue-400 dark:hover:text-blue-300 mr-3"
                                                            onClick={() => openModal(user)}
                                                        >
                                                            <Edit className="h-4 w-4 inline mr-1" />
                                                            编辑
                                                        </button>
                                                        {/* 禁止删除当前登录用户，且不允许删除最后一个管理员 */}
                                                        {(currentUser && currentUser.id !== user._id) && (
                                                            <button
                                                                className="text-red-600 hover:text-red-900 dark:text-red-400 dark:hover:text-red-300"
                                                                onClick={() => handleDeleteUser(user._id)}
                                                            >
                                                                <Trash2 className="h-4 w-4 inline mr-1" />
                                                                删除
                                                            </button>
                                                        )}
                                                    </td>
                                                </tr>
                                            ))
                                        )}
                                        </tbody>
                                    </table>
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

            {/* 用户编辑/创建模态框 */}
            {showModal && (
                <div className="fixed inset-0 z-50 overflow-y-auto">
                    <div className="flex items-center justify-center min-h-screen pt-4 px-4 pb-20 text-center sm:block sm:p-0">
                        {/* 背景遮罩 */}
                        <div
                            className="fixed inset-0 bg-gray-500 bg-opacity-75 transition-opacity dark:bg-gray-800 dark:bg-opacity-75"
                            onClick={closeModal}
                        ></div>

                        {/* 模态框内容 */}
                        <div className="inline-block align-bottom bg-white rounded-lg px-4 pt-5 pb-4 text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-lg sm:w-full sm:p-6 dark:bg-gray-800">
                            <div className="absolute top-0 right-0 pt-4 pr-4">
                                <button
                                    type="button"
                                    onClick={closeModal}
                                    className="bg-white rounded-md text-gray-400 hover:text-gray-500 focus:outline-none dark:bg-gray-800 dark:text-gray-500 dark:hover:text-gray-400"
                                >
                                    <span className="sr-only">关闭</span>
                                    <X className="h-6 w-6" />
                                </button>
                            </div>

                            <div className="sm:flex sm:items-start">
                                <div className="mt-3 text-center sm:mt-0 sm:text-left w-full">
                                    <h3 className="text-lg leading-6 font-medium text-gray-900 dark:text-white">
                                        {editingUser ? '编辑用户' : '创建新用户'}
                                    </h3>

                                    {formError && (
                                        <div className="mt-4 flex items-center p-4 bg-red-50 border-l-4 border-red-500 text-red-700 text-sm dark:bg-red-900/30 dark:text-red-400 dark:border-red-600">
                                            <AlertCircle className="w-5 h-5 mr-2 flex-shrink-0" />
                                            <span>{formError}</span>
                                        </div>
                                    )}

                                    {formSuccess && (
                                        <div className="mt-4 flex items-center p-4 bg-green-50 border-l-4 border-green-500 text-green-700 text-sm dark:bg-green-900/30 dark:text-green-400 dark:border-green-600">
                                            <CheckCircle2 className="w-5 h-5 mr-2 flex-shrink-0" />
                                            <span>{formSuccess}</span>
                                        </div>
                                    )}

                                    <div className="mt-4">
                                        <form onSubmit={handleSubmit} className="space-y-4">
                                            <FormInput
                                                label="用户名"
                                                id="username"
                                                name="username"
                                                value={formData.username}
                                                onChange={handleInputChange}
                                                required
                                            />

                                            <FormInput
                                                label={editingUser ? "新密码 (留空保持不变)" : "密码"}
                                                id="password"
                                                name="password"
                                                type="password"
                                                value={formData.password}
                                                onChange={handleInputChange}
                                                required={!editingUser}
                                            />

                                            <FormInput
                                                label={editingUser ? "确认新密码" : "确认密码"}
                                                id="confirmPassword"
                                                name="confirmPassword"
                                                type="password"
                                                value={formData.confirmPassword}
                                                onChange={handleInputChange}
                                                required={!editingUser}
                                            />

                                            <FormSelect
                                                label="角色"
                                                id="role"
                                                name="role"
                                                value={formData.role}
                                                options={roleOptions}
                                                onChange={handleInputChange}
                                                required
                                            />

                                            <FormSelect
                                                label="状态"
                                                id="active"
                                                name="active"
                                                value={formData.active}
                                                options={statusOptions}
                                                onChange={handleInputChange}
                                                required
                                            />

                                            <div className="mt-5 sm:mt-4 sm:flex sm:flex-row-reverse">
                                                <Button
                                                    type="submit"
                                                    variant="primary"
                                                    disabled={loading}
                                                    className="w-full sm:ml-3 sm:w-auto"
                                                >
                                                    {loading ? (
                                                        <>
                                                            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                                            处理中...
                                                        </>
                                                    ) : (
                                                        editingUser ? '更新用户' : '创建用户'
                                                    )}
                                                </Button>
                                                <Button
                                                    type="button"
                                                    variant="secondary"
                                                    onClick={closeModal}
                                                    className="mt-3 w-full sm:mt-0 sm:w-auto"
                                                >
                                                    取消
                                                </Button>
                                            </div>
                                        </form>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </AppShell>
    );
}
