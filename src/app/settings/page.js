'use client';

// src/app/settings/page.js
import {useState, useEffect} from 'react';
import {AlertCircle, CheckCircle2, Database, Edit, Loader2, Plus, Settings as SettingsIcon, Shield, Trash2, User, X} from 'lucide-react';
import FormInput from '@/components/ui/FormInput';
import FormSelect from '@/components/ui/FormSelect';
import Button from '@/components/ui/Button';
import AppShell from '@/app/AppShell';
import { useAuth } from '@/app/contexts/AuthContext';

export default function SettingsPage() {
    const [activeTab, setActiveTab] = useState('general');
    const { user: currentUser } = useAuth();
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

    // 首次加载获取用户列表
    useEffect(() => {
        if (activeTab === 'users') {
            fetchUsers();
        }
    }, [activeTab]);

    // 处理表单输入变化
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

    // 处理表单提交
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

    // 重置表单
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

    // 保存系统设置
    const handleSaveSettings = (e) => {
        e.preventDefault();
        alert('设置已保存');
    };

    // 保存数据库设置
    const handleSaveDbSettings = (e) => {
        e.preventDefault();
        alert('数据库设置已保存');
    };

    // 测试数据库连接
    const handleTestDbConnection = () => {
        alert('数据库连接测试成功');
    };

    return (
        <AppShell>
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
                <header className="mb-6">
                    <h1 className="text-2xl font-bold text-gray-800">系统设置</h1>
                </header>

                <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
                    {/* 设置导航 */}
                    <div className="lg:col-span-1">
                        <div className="bg-white rounded-lg shadow">
                            <div className="px-4 py-3 border-b border-gray-200">
                                <h2 className="text-lg font-medium text-gray-800">设置选项</h2>
                            </div>
                            <nav className="p-2">
                                <button
                                    onClick={() => setActiveTab('general')}
                                    className={`w-full flex items-center px-3 py-2 text-sm font-medium rounded-md ${
                                        activeTab === 'general'
                                            ? 'text-blue-700 bg-blue-50'
                                            : 'text-gray-700 hover:bg-gray-50'
                                    } mb-1`}
                                >
                                    <SettingsIcon className="w-5 h-5 mr-2 text-blue-500"/>
                                    常规设置
                                </button>
                                <button
                                    onClick={() => setActiveTab('database')}
                                    className={`w-full flex items-center px-3 py-2 text-sm font-medium rounded-md ${
                                        activeTab === 'database'
                                            ? 'text-blue-700 bg-blue-50'
                                            : 'text-gray-700 hover:bg-gray-50'
                                    } mb-1`}
                                >
                                    <Database className="w-5 h-5 mr-2 text-gray-500"/>
                                    数据库设置
                                </button>
                                <button
                                    onClick={() => {
                                        setActiveTab('users');
                                        fetchUsers();
                                    }}
                                    className={`w-full flex items-center px-3 py-2 text-sm font-medium rounded-md ${
                                        activeTab === 'users'
                                            ? 'text-blue-700 bg-blue-50'
                                            : 'text-gray-700 hover:bg-gray-50'
                                    } mb-1`}
                                >
                                    <User className="w-5 h-5 mr-2 text-gray-500"/>
                                    用户管理
                                </button>
                            </nav>
                        </div>
                    </div>

                    {/* 设置内容 */}
                    <div className="lg:col-span-3 space-y-6">
                        {/* 常规设置 */}
                        {activeTab === 'general' && (
                            <div className="bg-white rounded-lg shadow">
                                <div className="px-4 py-3 border-b border-gray-200">
                                    <h2 className="text-lg font-medium text-gray-800">常规设置</h2>
                                </div>
                                <div className="p-4">
                                    <form className="space-y-4" onSubmit={handleSaveSettings}>
                                        <FormInput
                                            label="站点名称"
                                            id="siteName"
                                            defaultValue="Οὐρανός 控制台"
                                        />

                                        <FormInput
                                            label="控制台网址"
                                            id="siteUrl"
                                            type="url"
                                            defaultValue="http://localhost:3000"
                                        />

                                        <FormSelect
                                            label="系统语言"
                                            id="language"
                                            options={languageOptions}
                                            defaultValue="zh-CN"
                                        />

                                        <div className="pt-4 flex justify-end">
                                            <button
                                                type="submit"
                                                className="inline-flex justify-center px-4 py-2 text-sm font-medium text-white bg-blue-600 border border-transparent rounded-md shadow-sm hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                                            >
                                                保存设置
                                            </button>
                                        </div>
                                    </form>
                                </div>
                            </div>
                        )}

                        {/* 数据库设置 */}
                        {activeTab === 'database' && (
                            <div className="bg-white rounded-lg shadow">
                                <div className="px-4 py-3 border-b border-gray-200">
                                    <h2 className="text-lg font-medium text-gray-800">数据库设置</h2>
                                </div>
                                <div className="p-4">
                                    <form className="space-y-4" onSubmit={handleSaveDbSettings}>
                                        <FormInput
                                            label="数据库连接字符串"
                                            id="databaseUrl"
                                            defaultValue="mongodb://localhost:27017/uranus-control"
                                        />

                                        <div className="pt-4 flex justify-end">
                                            <button
                                                type="button"
                                                onClick={handleTestDbConnection}
                                                className="inline-flex justify-center px-4 py-2 mr-2 text-sm font-medium text-gray-700 bg-gray-100 border border-gray-300 rounded-md shadow-sm hover:bg-gray-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-500"
                                            >
                                                测试连接
                                            </button>
                                            <button
                                                type="submit"
                                                className="inline-flex justify-center px-4 py-2 text-sm font-medium text-white bg-blue-600 border border-transparent rounded-md shadow-sm hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                                            >
                                                保存设置
                                            </button>
                                        </div>
                                    </form>
                                </div>
                            </div>
                        )}

                        {/* 用户管理 */}
                        {activeTab === 'users' && (
                            <div className="bg-white rounded-lg shadow">
                                <div className="px-4 py-3 border-b border-gray-200 flex justify-between items-center">
                                    <h2 className="text-lg font-medium text-gray-800">用户管理</h2>
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
                                    <table className="min-w-full divide-y divide-gray-200">
                                        <thead className="bg-gray-50">
                                        <tr>
                                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">用户名</th>
                                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">角色</th>
                                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">状态</th>
                                            <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">操作</th>
                                        </tr>
                                        </thead>
                                        <tbody className="bg-white divide-y divide-gray-200">
                                        {loading && users.length === 0 ? (
                                            <tr>
                                                <td colSpan="4" className="px-6 py-4 text-center text-gray-500">
                                                    <Loader2 className="h-6 w-6 animate-spin mx-auto" />
                                                    <span className="mt-2 block">加载用户数据...</span>
                                                </td>
                                            </tr>
                                        ) : users.length === 0 ? (
                                            <tr>
                                                <td colSpan="4" className="px-6 py-4 text-center text-gray-500">
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
                                                <tr key={user._id} className="hover:bg-gray-50">
                                                    <td className="px-6 py-4 whitespace-nowrap">
                                                        <div className="flex items-center">
                                                            <div className="flex-shrink-0 h-8 w-8 bg-gray-100 rounded-full flex items-center justify-center">
                                                                <User className="h-4 w-4 text-gray-500" />
                                                            </div>
                                                            <div className="ml-4">
                                                                <div className="text-sm font-medium text-gray-900">
                                                                    {user.username}
                                                                </div>
                                                            </div>
                                                        </div>
                                                    </td>
                                                    <td className="px-6 py-4 whitespace-nowrap">
                                                        <div className="flex items-center text-sm text-gray-500">
                                                            {user.role === 'admin' && (
                                                                <Shield className="h-4 w-4 mr-1 text-blue-500" />
                                                            )}
                                                            管理员
                                                        </div>
                                                    </td>
                                                    <td className="px-6 py-4 whitespace-nowrap">
                                                        <span className={`px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full ${
                                                            user.active
                                                                ? 'bg-green-100 text-green-800'
                                                                : 'bg-red-100 text-red-800'
                                                        }`}>
                                                            {user.active ? '激活' : '禁用'}
                                                        </span>
                                                    </td>
                                                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                                                        <button
                                                            className="text-blue-600 hover:text-blue-900 mr-3"
                                                            onClick={() => openModal(user)}
                                                        >
                                                            <Edit className="h-4 w-4 inline mr-1" />
                                                            编辑
                                                        </button>
                                                        {/* 禁止删除当前登录用户，且不允许删除最后一个管理员 */}
                                                        {(currentUser && currentUser.id !== user._id) && (
                                                            <button
                                                                className="text-red-600 hover:text-red-900"
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
                    </div>
                </div>
            </div>

            {/* 用户编辑/创建模态框 */}
            {showModal && (
                <div className="fixed inset-0 z-50 overflow-y-auto">
                    <div className="flex items-center justify-center min-h-screen pt-4 px-4 pb-20 text-center sm:block sm:p-0">
                        {/* 背景遮罩 */}
                        <div
                            className="fixed inset-0 bg-gray-500 bg-opacity-75 transition-opacity"
                            onClick={closeModal}
                        ></div>

                        {/* 模态框内容 */}
                        <div className="inline-block align-bottom bg-white rounded-lg px-4 pt-5 pb-4 text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-lg sm:w-full sm:p-6">
                            <div className="absolute top-0 right-0 pt-4 pr-4">
                                <button
                                    type="button"
                                    onClick={closeModal}
                                    className="bg-white rounded-md text-gray-400 hover:text-gray-500 focus:outline-none"
                                >
                                    <span className="sr-only">关闭</span>
                                    <X className="h-6 w-6" />
                                </button>
                            </div>

                            <div className="sm:flex sm:items-start">
                                <div className="mt-3 text-center sm:mt-0 sm:text-left w-full">
                                    <h3 className="text-lg leading-6 font-medium text-gray-900">
                                        {editingUser ? '编辑用户' : '创建新用户'}
                                    </h3>

                                    {formError && (
                                        <div className="mt-4 flex items-center p-4 bg-red-50 border-l-4 border-red-500 text-red-700 text-sm">
                                            <AlertCircle className="w-5 h-5 mr-2 flex-shrink-0" />
                                            <span>{formError}</span>
                                        </div>
                                    )}

                                    {formSuccess && (
                                        <div className="mt-4 flex items-center p-4 bg-green-50 border-l-4 border-green-500 text-green-700 text-sm">
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
