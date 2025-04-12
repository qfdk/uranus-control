'use client';

import { useState, useEffect } from 'react';
import { AlertCircle, CheckCircle2, Edit, Loader2, Plus, Search, Shield, Trash2, User } from 'lucide-react';
import Button from '@/components/ui/Button';
import FormInput from '@/components/ui/FormInput';
import FormSelect from '@/components/ui/FormSelect';
import { useAuth } from '@/app/contexts/AuthContext';
import AppShell from '@/app/AppShell';

export default function UserManagementPage() {
    const { user: currentUser } = useAuth();
    const [users, setUsers] = useState([]);
    const [loading, setLoading] = useState(true);
    const [showForm, setShowForm] = useState(false);
    const [editingUser, setEditingUser] = useState(null);
    const [formError, setFormError] = useState('');
    const [formSuccess, setFormSuccess] = useState('');
    const [searchTerm, setSearchTerm] = useState('');
    const [formData, setFormData] = useState({
        username: '',
        email: '',
        password: '',
        confirmPassword: '',
        role: 'user',
        active: true
    });

    // 角色选项
    const roleOptions = [
        { value: 'admin', label: '管理员' },
        { value: 'manager', label: '管理人员' },
        { value: 'user', label: '普通用户' }
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
        fetchUsers();
    }, []);

    // 处理表单输入变化
    const handleInputChange = (e) => {
        const { name, value, type, checked } = e.target;
        setFormData({
            ...formData,
            [name]: type === 'checkbox' ? checked : value
        });
    };

    // 处理表单提交
    const handleSubmit = async (e) => {
        e.preventDefault();
        setFormError('');
        setFormSuccess('');

        // 验证表单
        if (!formData.username || !formData.email) {
            setFormError('用户名和邮箱是必填项');
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

            // 重置表单
            if (!editingUser) {
                resetForm();
            }

            // 3秒后清除成功消息
            setTimeout(() => {
                setFormSuccess('');
            }, 3000);
        } catch (error) {
            setFormError(error.message);
        } finally {
            setLoading(false);
        }
    };

    // 处理用户编辑
    const handleEditUser = (user) => {
        setEditingUser(user);
        setFormData({
            username: user.username,
            email: user.email,
            password: '',
            confirmPassword: '',
            role: user.role,
            active: user.active
        });
        setShowForm(true);
        setFormError('');
        setFormSuccess('');
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
            email: '',
            password: '',
            confirmPassword: '',
            role: 'user',
            active: true
        });
        setEditingUser(null);
        setFormError('');
        setFormSuccess('');
    };

    // 过滤用户列表
    const filteredUsers = users.filter(user => {
        const searchLower = searchTerm.toLowerCase();
        return (
            user.username.toLowerCase().includes(searchLower) ||
            user.email.toLowerCase().includes(searchLower) ||
            user.role.toLowerCase().includes(searchLower)
        );
    });

    return (
        <AppShell>
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
                <header className="mb-6 flex justify-between items-center">
                    <h1 className="text-2xl font-bold text-gray-800">用户管理</h1>
                    <Button
                        variant="primary"
                        onClick={() => {
                            resetForm();
                            setShowForm(!showForm);
                        }}
                    >
                        {showForm ? '关闭表单' : (
                            <>
                                <Plus className="w-4 h-4 mr-1" />
                                添加用户
                            </>
                        )}
                    </Button>
                </header>

                {/* 用户表单 */}
                {showForm && (
                    <div className="bg-white rounded-lg shadow mb-6 p-4">
                        <h2 className="text-lg font-medium mb-4">
                            {editingUser ? '编辑用户' : '创建新用户'}
                        </h2>

                        {formError && (
                            <div className="mb-4 flex items-center p-4 bg-red-50 border-l-4 border-red-500 text-red-700">
                                <AlertCircle className="w-5 h-5 mr-2" />
                                <span>{formError}</span>
                            </div>
                        )}

                        {formSuccess && (
                            <div className="mb-4 flex items-center p-4 bg-green-50 border-l-4 border-green-500 text-green-700">
                                <CheckCircle2 className="w-5 h-5 mr-2" />
                                <span>{formSuccess}</span>
                            </div>
                        )}

                        <form onSubmit={handleSubmit} className="space-y-4">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <FormInput
                                    label="用户名"
                                    id="username"
                                    name="username"
                                    value={formData.username}
                                    onChange={handleInputChange}
                                    required
                                />

                                <FormInput
                                    label="电子邮箱"
                                    id="email"
                                    name="email"
                                    type="email"
                                    value={formData.email}
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
                            </div>

                            <div className="flex justify-end space-x-3 pt-2">
                                <Button
                                    type="button"
                                    variant="secondary"
                                    onClick={() => {
                                        resetForm();
                                        if (!editingUser) {
                                            setShowForm(false);
                                        }
                                    }}
                                >
                                    {editingUser ? '取消' : '重置'}
                                </Button>

                                <Button
                                    type="submit"
                                    variant="primary"
                                    disabled={loading}
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
                            </div>
                        </form>
                    </div>
                )}

                {/* 用户搜索 */}
                <div className="mb-4">
                    <div className="relative">
                        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                            <Search className="h-5 w-5 text-gray-400" />
                        </div>
                        <input
                            type="text"
                            className="block w-full pl-10 pr-3 py-2 border border-gray-300 rounded-md leading-5 bg-white placeholder-gray-500 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                            placeholder="搜索用户..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                        />
                    </div>
                </div>

                {/* 用户列表 */}
                <div className="bg-white rounded-lg shadow overflow-hidden">
                    <div className="overflow-x-auto">
                        <table className="min-w-full divide-y divide-gray-200">
                            <thead className="bg-gray-50">
                            <tr>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">用户名</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">电子邮箱</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">角色</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">状态</th>
                                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">操作</th>
                            </tr>
                            </thead>
                            <tbody className="bg-white divide-y divide-gray-200">
                            {loading && users.length === 0 ? (
                                <tr>
                                    <td colSpan="5" className="px-6 py-4 text-center text-gray-500">
                                        <Loader2 className="h-6 w-6 animate-spin mx-auto" />
                                        <span className="mt-2 block">加载用户数据...</span>
                                    </td>
                                </tr>
                            ) : filteredUsers.length === 0 ? (
                                <tr>
                                    <td colSpan="5" className="px-6 py-4 text-center text-gray-500">
                                        {searchTerm ? (
                                            <>
                                                <p>没有找到匹配"{searchTerm}"的用户</p>
                                                <Button
                                                    variant="secondary"
                                                    size="sm"
                                                    className="mt-2"
                                                    onClick={() => setSearchTerm('')}
                                                >
                                                    清除搜索
                                                </Button>
                                            </>
                                        ) : (
                                            <>
                                                <p>暂无用户数据</p>
                                                <Button
                                                    variant="primary"
                                                    size="sm"
                                                    className="mt-2"
                                                    onClick={() => {
                                                        resetForm();
                                                        setShowForm(true);
                                                    }}
                                                >
                                                    <Plus className="w-4 h-4 mr-1" />
                                                    添加第一个用户
                                                </Button>
                                            </>
                                        )}
                                    </td>
                                </tr>
                            ) : (
                                filteredUsers.map(user => (
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
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                            {user.email}
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            <div className="flex items-center text-sm text-gray-500">
                                                {user.role === 'admin' && (
                                                    <Shield className="h-4 w-4 mr-1 text-blue-500" />
                                                )}
                                                {user.role === 'admin'
                                                    ? '管理员'
                                                    : user.role === 'manager'
                                                        ? '管理人员'
                                                        : '普通用户'
                                                }
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
                                                onClick={() => handleEditUser(user)}
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
            </div>
        </AppShell>
    );
}
