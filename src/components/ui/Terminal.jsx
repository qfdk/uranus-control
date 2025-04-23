// src/components/ui/Terminal.jsx
'use client';

import { useState, useRef, useEffect } from 'react';
import { Send, RotateCcw, Copy, CheckCheck, X } from 'lucide-react';
import useMqttStore from '@/store/mqttStore';

const HISTORY_MAX_LENGTH = 1000; // 限制历史记录最大条数

export default function Terminal({ agentId, agentUuid, isOnline = true }) {
    const {
        connected: mqttConnected,
        sendCommand,
        startTerminalSession,
        endTerminalSession,
        interruptCommand,
        terminalSessions
    } = useMqttStore();
    const [command, setCommand] = useState('');
    const [history, setHistory] = useState([]);
    const [loading, setLoading] = useState(false);
    const [copied, setCopied] = useState(false);
    const [sessionId, setSessionId] = useState(null);
    const [commandHistory, setCommandHistory] = useState([]);
    const [historyIndex, setHistoryIndex] = useState(-1);
    const terminalRef = useRef(null);
    const bottomRef = useRef(null);
    const inputRef = useRef(null);

    // 创建或恢复终端会话
    useEffect(() => {
        if (mqttConnected && agentUuid && isOnline) {
            // 检查是否已有会话
            const existingSession = Object.entries(terminalSessions)
                .find(([id, session]) => session.agentUuid === agentUuid);

            if (existingSession) {
                // 恢复现有会话
                setSessionId(existingSession[0]);
                setHistory(existingSession[1].history || []);
                if (existingSession[1].commandHistory) {
                    setCommandHistory(existingSession[1].commandHistory);
                }
            } else {
                // 创建新会话
                const newSessionId = startTerminalSession(agentUuid);
                setSessionId(newSessionId);

                // 添加欢迎消息
                setHistory([{
                    type: 'system',
                    text: `连接到代理 ${agentUuid} 的终端。输入命令开始操作。\n输入 'help' 查看可用命令列表。`
                }]);
            }
        }

        return () => {
            // 组件卸载时保存会话状态，但不关闭会话
            if (sessionId) {
                useMqttStore.getState().updateTerminalSession(sessionId, {
                    history,
                    commandHistory
                });
            }
        };
    }, [mqttConnected, agentUuid, isOnline]);

    // 自动滚动到底部
    useEffect(() => {
        if (bottomRef.current) {
            bottomRef.current.scrollIntoView({ behavior: 'smooth' });
        }
    }, [history]);

    // 监听新的终端输出
    useEffect(() => {
        if (!sessionId) return;

        const session = terminalSessions[sessionId];
        if (session && session.history) {
            setHistory(session.history);
        }

        // 命令完成后解除加载状态
        if (session && !session.activeCommand && loading) {
            setLoading(false);
        }
    }, [terminalSessions, sessionId, loading]);

    // 键盘快捷键处理
    useEffect(() => {
        const handleKeyDown = (e) => {
            // 检查是否在终端区域内
            if (!terminalRef.current?.contains(e.target)) return;

            // Ctrl+C - 中断当前命令
            if (e.ctrlKey && e.key === 'c') {
                e.preventDefault();
                if (loading && sessionId) {
                    interruptCommand(sessionId);
                    setLoading(false);
                    setHistory(prev => [...prev, { type: 'system', text: '^C' }]);
                }
                return;
            }

            // 上下键浏览命令历史
            if (e.key === 'ArrowUp' && commandHistory.length > 0) {
                e.preventDefault();
                const newIndex = historyIndex < commandHistory.length - 1 ? historyIndex + 1 : historyIndex;
                setHistoryIndex(newIndex);
                setCommand(commandHistory[commandHistory.length - 1 - newIndex] || '');
            } else if (e.key === 'ArrowDown' && historyIndex > -1) {
                e.preventDefault();
                const newIndex = historyIndex - 1;
                setHistoryIndex(newIndex);
                setCommand(newIndex >= 0 ? commandHistory[commandHistory.length - 1 - newIndex] : '');
            }

            // Tab 自动聚焦到输入框
            if (e.key === 'Tab' && !e.target.tagName === 'INPUT') {
                e.preventDefault();
                inputRef.current?.focus();
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [historyIndex, commandHistory, loading, sessionId, interruptCommand]);

    // 处理命令提交
    const handleSubmit = async (e) => {
        e?.preventDefault();

        if (!command.trim() || !isOnline || !sessionId || loading) return;

        // 重置历史索引
        setHistoryIndex(-1);

        // 更新命令历史
        const trimmedCommand = command.trim();
        setCommandHistory(prev => {
            // 避免连续相同命令重复记录
            if (prev.length > 0 && prev[prev.length - 1] === trimmedCommand) {
                return prev;
            }
            return [...prev, trimmedCommand].slice(-50); // 保留最近50条命令
        });

        // 添加命令到历史记录
        setHistory(prev => {
            const newHistory = [...prev, { type: 'command', text: trimmedCommand }];
            return newHistory.slice(-HISTORY_MAX_LENGTH); // 限制历史记录长度
        });

        setLoading(true);
        setCommand('');

        try {
            // 内置命令处理
            if (trimmedCommand === 'clear') {
                setHistory([]);
                setLoading(false);
                return;
            }

            if (trimmedCommand === 'exit') {
                setHistory(prev => [...prev, {
                    type: 'system',
                    text: '终端会话已结束。刷新页面可重新开始。'
                }]);
                endTerminalSession(sessionId);
                setSessionId(null);
                setLoading(false);
                return;
            }

            if (trimmedCommand === 'help') {
                setHistory(prev => [...prev, {
                    type: 'system',
                    text: `可用命令:\n- clear: 清除终端\n- exit: 结束终端会话\n- help: 显示帮助信息\n\n所有其他命令将在代理上执行。\n使用 Ctrl+C 可以中断正在执行的命令。`
                }]);
                setLoading(false);
                return;
            }

            // 交互式命令的特殊处理
            let isInteractive = false;
            if (trimmedCommand.startsWith('ping ') && !trimmedCommand.includes(' -c ')) {
                // 为ping命令添加计数限制，避免无限运行
                const pingCmd = `${trimmedCommand} -c 5`;
                await sendCommand(agentUuid, 'execute', {
                    command: pingCmd,
                    sessionId,
                    streaming: true
                });
                isInteractive = true;
            } else if (trimmedCommand.match(/^(tail -f|top|htop|nano|vim)\b/)) {
                // 警告用户某些交互式命令可能不完全支持
                setHistory(prev => [...prev, {
                    type: 'warning',
                    text: `警告: '${trimmedCommand.split(' ')[0]}' 是交互式命令，可能在此终端中不完全支持。\n请使用非交互式替代或标准SSH连接。`
                }]);
                setLoading(false);
                return;
            } else {
                // 发送普通命令
                await sendCommand(agentUuid, 'execute', {
                    command: trimmedCommand,
                    sessionId,
                    streaming: true
                });
            }

            // 由于响应是异步流式的，不在这里处理响应
            // 输出会由MQTT存储自动更新到会话历史记录

        } catch (error) {
            console.error('命令执行失败:', error);

            // 添加错误消息到历史记录
            setHistory(prev => [...prev, {
                type: 'error',
                text: `执行错误: ${error.message || '未知错误'}`
            }]);

            setLoading(false);
        }
    };

    // 清除历史记录
    const clearHistory = () => {
        setHistory([]);
        if (sessionId) {
            useMqttStore.getState().updateTerminalSession(sessionId, { history: [] });
        }
    };

    // 复制历史记录到剪贴板
    const copyHistory = () => {
        const text = history
            .map(item => {
                if (item.type === 'command') {
                    return `$ ${item.text}`;
                } else {
                    return item.text;
                }
            })
            .join('\n\n');

        navigator.clipboard.writeText(text);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    // 中断当前命令
    const handleInterrupt = () => {
        if (loading && sessionId) {
            interruptCommand(sessionId);
            setLoading(false);
            setHistory(prev => [...prev, { type: 'system', text: '^C 命令已中断' }]);
        }
    };

    // 处理粘贴
    const handlePaste = (e) => {
        // 阻止特殊字符或多行粘贴
        if (/[\x00-\x08\x0B\x0C\x0E-\x1F]/.test(e.clipboardData.getData('text'))) {
            e.preventDefault();
            const safeText = e.clipboardData.getData('text')
                .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F]/g, '');
            setCommand(prev => prev + safeText);
        }
    };

    return (
        <div className="rounded-lg border border-gray-200 dark:border-gray-700 bg-black text-white dark:bg-gray-900 overflow-hidden" ref={terminalRef}>
            <div className="flex justify-between items-center px-4 py-2 bg-gray-800 dark:bg-gray-800 border-b border-gray-700">
                <div className="flex items-center">
                    <div className="flex space-x-2 mr-2">
                        <div className="w-3 h-3 rounded-full bg-red-500"></div>
                        <div className="w-3 h-3 rounded-full bg-yellow-500"></div>
                        <div className="w-3 h-3 rounded-full bg-green-500"></div>
                    </div>
                    <span className="text-sm font-medium">终端</span>
                    {mqttConnected && agentUuid && (
                        <span className="ml-2 text-xs px-1.5 py-0.5 bg-blue-600 text-white rounded-full">MQTT</span>
                    )}
                    {loading && (
                        <span className="ml-2 text-xs px-1.5 py-0.5 bg-yellow-600 text-white rounded-full flex items-center">
                            <span className="animate-pulse mr-1">⚡</span>
                            执行中
                        </span>
                    )}
                </div>
                <div className="flex space-x-2">
                    {loading && (
                        <button
                            onClick={handleInterrupt}
                            className="text-red-400 hover:text-red-300 p-1 rounded transition-colors"
                            title="中断命令 (Ctrl+C)"
                        >
                            <X size={16} />
                        </button>
                    )}
                    <button
                        onClick={copyHistory}
                        className="text-gray-400 hover:text-white p-1 rounded transition-colors"
                        disabled={history.length === 0}
                        title="复制内容"
                    >
                        {copied ? <CheckCheck size={16} /> : <Copy size={16} />}
                    </button>
                    <button
                        onClick={clearHistory}
                        className="text-gray-400 hover:text-white p-1 rounded transition-colors"
                        disabled={history.length === 0}
                        title="清除历史"
                    >
                        <RotateCcw size={16} />
                    </button>
                </div>
            </div>

            <div className="p-4 h-64 overflow-y-auto font-mono text-sm terminal-output" style={{ backgroundColor: '#0D1117' }}>
                {history.length === 0 ? (
                    <div className="text-gray-400 italic">
                        在此终端中执行命令。使用 Ctrl+C 可以中断命令，使用上下箭头可以浏览命令历史。
                    </div>
                ) : (
                    history.map((item, index) => (
                        <div key={index} className="mb-2">
                            {item.type === 'command' ? (
                                <div className="flex items-start">
                                    <span className="text-green-400 mr-2">$</span>
                                    <span>{item.text}</span>
                                </div>
                            ) : item.type === 'response' ? (
                                <div className={`pl-4 border-l-2 ${item.success !== false ? 'border-green-500 text-gray-300' : 'border-red-500 text-red-300'} whitespace-pre-wrap`}>
                                    {item.text}
                                </div>
                            ) : item.type === 'error' ? (
                                <div className="pl-4 border-l-2 border-red-500 text-red-300 whitespace-pre-wrap">
                                    {item.text}
                                </div>
                            ) : item.type === 'warning' ? (
                                <div className="pl-4 border-l-2 border-yellow-500 text-yellow-300 whitespace-pre-wrap">
                                    {item.text}
                                </div>
                            ) : (
                                <div className="pl-4 text-blue-300 whitespace-pre-wrap">
                                    {item.text}
                                </div>
                            )}
                        </div>
                    ))
                )}
                <div ref={bottomRef}></div>
            </div>

            <form onSubmit={handleSubmit} className="flex items-center p-2 bg-gray-800 dark:bg-gray-800 border-t border-gray-700">
                <div className="text-green-400 mr-2">$</div>
                <input
                    ref={inputRef}
                    type="text"
                    value={command}
                    onChange={(e) => setCommand(e.target.value)}
                    onPaste={handlePaste}
                    placeholder={isOnline ? (loading ? "命令执行中..." : "输入命令...") : "代理离线，无法执行命令"}
                    disabled={!isOnline || loading}
                    className="flex-1 bg-transparent border-none outline-none text-white placeholder-gray-500"
                    autoComplete="off"
                    spellCheck="false"
                />
                <button
                    type="submit"
                    disabled={!command.trim() || !isOnline || loading}
                    className={`ml-2 p-1 rounded ${(!command.trim() || !isOnline || loading) ? 'text-gray-500' : 'text-blue-500 hover:text-blue-400'}`}
                >
                    <Send size={16} />
                </button>
            </form>
        </div>
    );
}
