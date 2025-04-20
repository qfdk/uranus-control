// src/components/ui/StatusMessage.jsx
'use client';

import { CheckCircle2, AlertCircle, Info, XCircle, Loader2 } from 'lucide-react';

/**
 * 通用状态消息组件
 * @param {object} props - 组件属性
 * @param {'success'|'error'|'info'|'warning'|'loading'} props.type - 消息类型
 * @param {string} props.message - 消息内容
 * @param {boolean} props.show - 是否显示消息
 * @param {function} props.onClose - 关闭消息的回调函数
 * @param {string} props.className - 额外的CSS类名
 * @returns {JSX.Element|null} 状态消息组件
 */
export default function StatusMessage({
                                          type = 'info',
                                          message = '',
                                          show = true,
                                          onClose = null,
                                          className = ''
                                      }) {
    if (!show || !message) return null;

    const typeStyles = {
        success: {
            bg: 'bg-green-50 dark:bg-green-900/30',
            border: 'border-l-4 border-green-500 dark:border-green-600',
            text: 'text-green-700 dark:text-green-300',
            icon: <CheckCircle2 className="h-5 w-5 text-green-500 dark:text-green-400" />
        },
        error: {
            bg: 'bg-red-50 dark:bg-red-900/30',
            border: 'border-l-4 border-red-500 dark:border-red-600',
            text: 'text-red-700 dark:text-red-300',
            icon: <XCircle className="h-5 w-5 text-red-500 dark:text-red-400" />
        },
        warning: {
            bg: 'bg-amber-50 dark:bg-amber-900/30',
            border: 'border-l-4 border-amber-500 dark:border-amber-600',
            text: 'text-amber-700 dark:text-amber-300',
            icon: <AlertCircle className="h-5 w-5 text-amber-500 dark:text-amber-400" />
        },
        info: {
            bg: 'bg-blue-50 dark:bg-blue-900/30',
            border: 'border-l-4 border-blue-500 dark:border-blue-600',
            text: 'text-blue-700 dark:text-blue-300',
            icon: <Info className="h-5 w-5 text-blue-500 dark:text-blue-400" />
        },
        loading: {
            bg: 'bg-blue-50 dark:bg-blue-900/30',
            border: 'border-l-4 border-blue-500 dark:border-blue-600',
            text: 'text-blue-700 dark:text-blue-300',
            icon: <Loader2 className="h-5 w-5 text-blue-500 dark:text-blue-400 animate-spin" />
        }
    };

    const style = typeStyles[type] || typeStyles.info;

    return (
        <div className={`p-4 mb-4 ${style.bg} ${style.border} ${className}`}>
            <div className="flex">
                <div className="flex-shrink-0">
                    {style.icon}
                </div>
                <div className="ml-3 flex-grow">
                    <p className={`text-sm ${style.text}`}>{message}</p>
                </div>
                {onClose && (
                    <button
                        onClick={onClose}
                        className="flex-shrink-0 ml-auto -mx-1.5 -my-1.5 rounded-lg p-1.5 inline-flex items-center justify-center h-8 w-8 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-400 dark:focus:ring-gray-700 hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
                    >
                        <span className="sr-only">关闭</span>
                        <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg">
                            <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd"></path>
                        </svg>
                    </button>
                )}
            </div>
        </div>
    );
}
