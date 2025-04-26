'use client';

import React, { useState, useEffect, useRef } from 'react';
import { Send, Clipboard, RefreshCw, Terminal, XCircle } from 'lucide-react';
import Button from '@/components/ui/Button';
import useMqttStore from '@/store/mqttStore';
import toast from 'react-hot-toast';

export default function CommandExecutor({ agentUuid, isActive = false }) {
    // 状态管理
    const [command, setCommand] = useState('');
    const [output, setOutput] = useState('');
    const [isExecuting, setIsExecuting] = useState(false);
    const [commandHistory, setCommandHistory] = useState([]);
    const [historyIndex, setHistoryIndex] = useState(-1);
    const outputRef = useRef(null);
    const commandInputRef = useRef(null);

    // MQTT连接状态
    const { connected: mqttConnected, connect, sendCommand } = useMqttStore();
    const [isConnecting, setIsConnecting] = useState(false);

    // 当组件变为活动状态时初始化MQTT连接并聚焦输入框
    useEffect(() => {
        if (isActive) {
            // 初始化MQTT连接
            if (!mqttConnected && !isConnecting) {
                initializeMqtt();
            }

            // 聚焦输入框
            if (commandInputRef.current) {
                setTimeout(() => {
                    commandInputRef.current.focus();
                }, 100);
            }
        }
    }, [isActive, mqttConnected]);

    // 监听执行状态变化，命令执行完成后聚焦输入框
    useEffect(() => {
        if (!isExecuting && commandInputRef.current) {
            // 使用setTimeout确保DOM更新后再聚焦
            setTimeout(() => {
                commandInputRef.current.focus();
            }, 100);
        }
    }, [isExecuting]);

    // 初始化MQTT连接
    const initializeMqtt = async () => {
        if (isConnecting) return;

        setIsConnecting(true);
        toast.loading('正在连接MQTT服务器...');

        try {
            await connect();
            toast.success('MQTT连接成功');
        } catch (error) {
            console.error('MQTT连接失败:', error);
            toast.error(`MQTT连接失败: ${error.message}`);
        } finally {
            setIsConnecting(false);
        }
    };

    // 执行命令
    const executeCommand = async () => {
        if (!command.trim() || isExecuting || !agentUuid) return;

        // 添加到历史记录
        const trimmedCommand = command.trim();
        if (!commandHistory.includes(trimmedCommand)) {
            setCommandHistory(prev => [trimmedCommand, ...prev.slice(0, 19)]);
        }
        setHistoryIndex(-1);

        setIsExecuting(true);

        // 显示命令和清除之前的输出
        setOutput(prev => `$ ${trimmedCommand}\n`);

        try {
            // 确保MQTT已连接
            if (!mqttConnected) {
                await initializeMqtt();
            }

            // 显示加载提示
            const loadingToast = toast.loading('命令执行中...');

            // 发送命令
            const response = await sendCommand(agentUuid, 'execute', {
                command: trimmedCommand
            });

            // 隐藏加载提示
            toast.dismiss(loadingToast);

            // 处理响应
            if (response.success) {
                setOutput(prev => `${prev}${response.output || '命令执行成功，无输出'}`);
                toast.success('命令执行成功');
                setCommand('');
            } else {
                setOutput(prev => `${prev}Error: ${response.message || '命令执行失败'}\n`);
                toast.error(response.message || '命令执行失败');
            }
        } catch (error) {
            console.error('命令执行错误:', error);
            setOutput(prev => `${prev}Error: ${error.message || '命令执行失败'}\n`);
            toast.error(error.message || '命令执行失败');
        } finally {
            setIsExecuting(false);

            // 滚动到输出底部
            if (outputRef.current) {
                outputRef.current.scrollTop = outputRef.current.scrollHeight;
            }

            // 聚焦命令输入框 - 使用更可靠的延时聚焦
            if (commandInputRef.current) {
                setTimeout(() => {
                    commandInputRef.current.focus();
                }, 10);
            }
        }
    };

    // 复制输出到剪贴板
    const copyToClipboard = () => {
        if (!output) return;
        console.log(output);
        navigator.clipboard.writeText(output)
            .then(() => {
                toast.success('已复制到剪贴板');
            })
            .catch(err => {
                console.error('复制失败:', err);
                toast.error('复制失败');
            });
    };

    // 清空输出
    const clearOutput = () => {
        setOutput('');
        toast.success('输出已清空');
    };

    // 键盘事件处理
    const handleKeyDown = (e) => {
        // 按Enter执行命令
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            executeCommand();
        }

        // 上下键浏览历史
        if (e.key === 'ArrowUp') {
            e.preventDefault();
            if (commandHistory.length > 0) {
                const newIndex = historyIndex < commandHistory.length - 1 ? historyIndex + 1 : historyIndex;
                setHistoryIndex(newIndex);
                setCommand(commandHistory[newIndex] || '');
            }
        } else if (e.key === 'ArrowDown') {
            e.preventDefault();
            if (historyIndex > 0) {
                const newIndex = historyIndex - 1;
                setHistoryIndex(newIndex);
                setCommand(commandHistory[newIndex]);
            } else if (historyIndex === 0) {
                setHistoryIndex(-1);
                setCommand('');
            }
        }
    };

    if (!isActive) return null;

    return (
        <div className="bg-white rounded-lg shadow dark:bg-gray-800 p-4 relative">
            {/* 命令输入区 */}
            <div className="mb-4">
                <div className="flex items-center mb-2">
                    <Terminal className="w-5 h-5 mr-2 text-gray-500 dark:text-gray-400" />
                    <h3 className="text-lg font-medium text-gray-800 dark:text-white">命令执行</h3>
                </div>

                <div className="flex gap-2">
                    <div className="flex-grow relative">
                        <input
                            ref={commandInputRef}
                            type="text"
                            value={command}
                            onChange={(e) => setCommand(e.target.value)}
                            onKeyDown={handleKeyDown}
                            className="w-full rounded-md border border-gray-300 shadow-sm px-3 py-2 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 disabled:bg-gray-100 disabled:text-gray-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                            placeholder="输入命令，如: ls -la"
                            disabled={isExecuting || !mqttConnected}
                        />
                        {isExecuting && (
                            <RefreshCw className="absolute right-3 top-2 h-5 w-5 text-blue-500 animate-spin" />
                        )}
                    </div>
                    <Button
                        onClick={executeCommand}
                        disabled={isExecuting || !command.trim() || !mqttConnected}
                        variant="primary"
                    >
                        <Send className="w-4 h-4 mr-1" />
                        执行
                    </Button>
                </div>

                {!mqttConnected && !isConnecting && (
                    <button
                        onClick={initializeMqtt}
                        className="mt-2 text-sm text-blue-500 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300"
                    >
                        连接MQTT服务器
                    </button>
                )}
            </div>

            {/* 命令输出区 - 只在有输出时显示 */}
            {output && (
                <div className="relative mb-2">
                    <div className="flex justify-between items-center mb-2">
                        <span className="text-sm text-gray-500 dark:text-gray-400">输出结果</span>
                        <div className="flex gap-2">
                            <button
                                onClick={copyToClipboard}
                                className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300"
                                title="复制到剪贴板"
                            >
                                <Clipboard className="w-4 h-4" />
                            </button>
                            <button
                                onClick={clearOutput}
                                className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300"
                                title="清空输出"
                            >
                                <XCircle className="w-4 h-4" />
                            </button>
                        </div>
                    </div>

                    <pre
                        ref={outputRef}
                        className="bg-gray-900 text-gray-200 rounded-md p-3 overflow-auto h-64 font-mono text-sm"
                    >
                        {output}
                    </pre>
                </div>
            )}

            {/* 命令历史提示 */}
            {commandHistory.length > 0 && (
                <div className="text-xs text-gray-500 dark:text-gray-400">
                    提示: 使用↑↓箭头键浏览命令历史
                </div>
            )}
        </div>
    );
}
