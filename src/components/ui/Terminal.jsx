// src/components/ui/Terminal.jsx
'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { Send, RotateCcw, Copy, CheckCheck, X, Terminal as TerminalIcon } from 'lucide-react';
import useMqttStore from '@/store/mqttStore';

const HISTORY_MAX_LENGTH = 1000; // 限制历史记录最大条数
const SPECIAL_KEYS = {
    ESCAPE: '\u001b',
    CTRL_C: '\u0003',
    BACKSPACE: '\u0008',
    TAB: '\u0009',
    ENTER: '\r',
    UP: '\u001b[A',
    DOWN: '\u001b[B',
    RIGHT: '\u001b[C',
    LEFT: '\u001b[D',
    HOME: '\u001b[H',
    END: '\u001b[F',
    DELETE: '\u001b[3~',
    PAGE_UP: '\u001b[5~',
    PAGE_DOWN: '\u001b[6~'
};

export default function Terminal({ agentId, agentUuid, isOnline = true }) {
    const {
        connected: mqttConnected,
        sendCommand,
        startTerminalSession,
        endTerminalSession,
        interruptCommand,
        terminalSessions
    } = useMqttStore();

    // 基本状态
    const [command, setCommand] = useState('');
    const [history, setHistory] = useState([]);
    const [loading, setLoading] = useState(false);
    const [copied, setCopied] = useState(false);
    const [sessionId, setSessionId] = useState(null);
    const [commandHistory, setCommandHistory] = useState([]);
    const [historyIndex, setHistoryIndex] = useState(-1);

    // 交互式命令状态
    const [interactiveMode, setInteractiveMode] = useState(false);
    const [cursorPosition, setCursorPosition] = useState(0);
    const [inputBuffer, setInputBuffer] = useState('');

    // Refs
    const terminalRef = useRef(null);
    const bottomRef = useRef(null);
    const inputRef = useRef(null);
    const outputRef = useRef(null);
    const autoScrollRef = useRef(true);

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
                if (existingSession[1].interactiveMode) {
                    setInteractiveMode(true);
                }
            } else {
                // 创建新会话
                const newSessionId = startTerminalSession(agentUuid);
                setSessionId(newSessionId);

                // 添加欢迎消息
                setHistory([{
                    type: 'system',
                    text: `连接到代理 ${agentUuid} 的终端。输入命令开始操作。\n输入 'help' 查看可用命令列表。\n对于vim等交互式命令，已启用增强支持。`
                }]);
            }
        }

        return () => {
            // 组件卸载时保存会话状态，但不关闭会话
            if (sessionId) {
                useMqttStore.getState().updateTerminalSession(sessionId, {
                    history,
                    commandHistory,
                    interactiveMode
                });
            }
        };
    }, [mqttConnected, agentUuid, isOnline]);

    // 强制滚动到底部的函数
    const scrollToBottom = useCallback(() => {
        if (bottomRef.current && autoScrollRef.current) {
            bottomRef.current.scrollIntoView({ behavior: 'auto' });
        }
    }, []);

    // 监听历史变化自动滚动
    useEffect(() => {
        scrollToBottom();
    }, [history, interactiveMode, inputBuffer, scrollToBottom]);

    // 监听新的终端输出
    useEffect(() => {
        if (!sessionId) return;

        const session = terminalSessions[sessionId];
        if (session && session.history) {
            setHistory(session.history);
            // 确保在收到新历史时滚动
            setTimeout(scrollToBottom, 0);
        }

        // 命令完成后解除加载状态
        if (session && !session.activeCommand && loading) {
            setLoading(false);
        }

        // 同步交互式模式状态
        if (session && session.interactiveMode !== undefined) {
            setInteractiveMode(session.interactiveMode);
        }
    }, [terminalSessions, sessionId, loading, scrollToBottom]);

    // 发送交互式输入
    const sendInteractiveInput = useCallback(async (input) => {
        if (!sessionId || !agentUuid) return;

        try {
            // 更新输入缓冲区（可选，用于显示用户输入）
            if (input !== SPECIAL_KEYS.CTRL_C) {
                setInputBuffer(prev => prev + input);
            } else {
                // Ctrl+C特殊处理
                setInputBuffer('');
                setHistory(prev => [...prev, { type: 'system', text: '^C' }]);
            }

            // 通过MQTT发送按键输入
            await sendCommand(agentUuid, 'terminal_input', {
                sessionId,
                input,
                timestamp: Date.now()
            });

            // 如果是Ctrl+C，尝试终止交互模式
            if (input === SPECIAL_KEYS.CTRL_C) {
                console.log('发送Ctrl+C中断信号');

                // 延迟一段时间后检查是否还在交互模式
                setTimeout(() => {
                    const currentSession = terminalSessions[sessionId];
                    if (!currentSession || !currentSession.activeCommand) {
                        setInteractiveMode(false);
                        useMqttStore.getState().updateTerminalSession(sessionId, {
                            interactiveMode: false
                        });
                    }
                }, 500);
            }
        } catch (error) {
            console.error('发送交互式输入失败:', error);
            setHistory(prev => [...prev, {
                type: 'error',
                text: `发送输入失败: ${error.message}`
            }]);
        }
    }, [sessionId, agentUuid, terminalSessions, sendCommand]);

    // 强制中断命令 - 处理棘手情况
    const forceInterruptCommand = useCallback(() => {
        if (!sessionId || !agentUuid) return;

        console.log("强制中断会话:", sessionId);

        // 1. 先发送中断命令
        interruptCommand(sessionId);

        // 2. 再发送Ctrl+C字符
        sendCommand(agentUuid, 'terminal_input', {
            sessionId,
            input: SPECIAL_KEYS.CTRL_C,
            timestamp: Date.now()
        }).catch(err => console.error("发送Ctrl+C失败:", err));

        // 3. 发送特殊的强制中断命令
        sendCommand(agentUuid, 'force_interrupt', {
            sessionId,
            timestamp: Date.now()
        }).catch(err => console.error("发送强制中断命令失败:", err));

        // 修改UI状态
        setLoading(false);
        setInteractiveMode(false);
        setHistory(prev => [...prev, { type: 'system', text: '^C 强制中断命令' }]);

        // 更新会话状态
        useMqttStore.getState().updateTerminalSession(sessionId, {
            interactiveMode: false,
            activeCommand: null
        });
    }, [sessionId, agentUuid, interruptCommand, sendCommand]);

    // 全局Ctrl+C处理
    useEffect(() => {
        const handleGlobalCtrlC = (e) => {
            if (!terminalRef.current) return;

            // 检测Ctrl+C
            if (e.ctrlKey && (e.key === 'c' || e.keyCode === 67)) {
                console.log("全局检测到Ctrl+C", {loading, interactiveMode, sessionId});

                // 如果有会话，直接强制中断
                if (sessionId) {
                    e.preventDefault();
                    e.stopPropagation();

                    // 使用强制中断函数
                    forceInterruptCommand();
                    return false;
                }
            }
        };

        document.addEventListener('keydown', handleGlobalCtrlC, true);
        return () => document.removeEventListener('keydown', handleGlobalCtrlC, true);
    }, [sessionId, forceInterruptCommand]);

    // 处理键盘事件
    const handleKeyDown = useCallback((e) => {
        // 检查是否在终端区域内
        if (!terminalRef.current?.contains(e.target)) return;

        // 在此处理Ctrl+C
        if (e.ctrlKey && (e.key === 'c' || e.keyCode === 67)) {
            e.preventDefault();

            if (loading || interactiveMode) {
                forceInterruptCommand();
                return;
            }
        }

        // 交互式模式下的键盘处理
        if (interactiveMode) {
            e.preventDefault(); // 在交互模式下阻止默认行为

            // 特殊键处理
            if (e.key === 'Escape') {
                sendInteractiveInput(SPECIAL_KEYS.ESCAPE);
                return;
            }

            if (e.ctrlKey && e.key === 'c') {
                sendInteractiveInput(SPECIAL_KEYS.CTRL_C);
                return;
            }

            if (e.key === 'Backspace') {
                sendInteractiveInput(SPECIAL_KEYS.BACKSPACE);
                return;
            }

            if (e.key === 'Tab') {
                sendInteractiveInput(SPECIAL_KEYS.TAB);
                return;
            }

            if (e.key === 'Enter') {
                sendInteractiveInput(SPECIAL_KEYS.ENTER);
                return;
            }

            if (e.key === 'ArrowUp') {
                sendInteractiveInput(SPECIAL_KEYS.UP);
                return;
            }

            if (e.key === 'ArrowDown') {
                sendInteractiveInput(SPECIAL_KEYS.DOWN);
                return;
            }

            if (e.key === 'ArrowRight') {
                sendInteractiveInput(SPECIAL_KEYS.RIGHT);
                return;
            }

            if (e.key === 'ArrowLeft') {
                sendInteractiveInput(SPECIAL_KEYS.LEFT);
                return;
            }

            if (e.key === 'Home') {
                sendInteractiveInput(SPECIAL_KEYS.HOME);
                return;
            }

            if (e.key === 'End') {
                sendInteractiveInput(SPECIAL_KEYS.END);
                return;
            }

            if (e.key === 'Delete') {
                sendInteractiveInput(SPECIAL_KEYS.DELETE);
                return;
            }

            if (e.key === 'PageUp') {
                sendInteractiveInput(SPECIAL_KEYS.PAGE_UP);
                return;
            }

            if (e.key === 'PageDown') {
                sendInteractiveInput(SPECIAL_KEYS.PAGE_DOWN);
                return;
            }

            // 普通字符输入
            if (e.key.length === 1) {
                sendInteractiveInput(e.key);
            }

            return;
        }

        // 非交互模式下的键盘处理

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
        if (e.key === 'Tab' && e.target.tagName !== 'INPUT') {
            e.preventDefault();
            inputRef.current?.focus();
        }
    }, [historyIndex, commandHistory, loading, sessionId, interactiveMode, sendInteractiveInput, forceInterruptCommand]);

    // 键盘事件监听
    useEffect(() => {
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [handleKeyDown]);

    // 处理滚动事件
    useEffect(() => {
        const handleScroll = () => {
            if (!outputRef.current) return;

            const { scrollTop, scrollHeight, clientHeight } = outputRef.current;
            // 检测用户是否已经滚动离开了底部
            const isAtBottom = Math.abs(scrollHeight - scrollTop - clientHeight) < 10;
            autoScrollRef.current = isAtBottom;
        };

        const outputElement = outputRef.current;
        if (outputElement) {
            outputElement.addEventListener('scroll', handleScroll);
            return () => outputElement.removeEventListener('scroll', handleScroll);
        }
    }, []);

    // 检测交互式命令
    const isInteractiveCommand = (cmd) => {
        return /^(vim|vi|nano|emacs|less|more|top|htop|mysql|psql)/i.test(cmd.trim());
    };

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
                    text: `可用命令:\n- clear: 清除终端\n- exit: 结束终端会话\n- help: 显示帮助信息\n\n交互式命令支持:\n- vim, nano, less 等交互式命令现在可以使用\n- 使用 Ctrl+C 可以中断正在执行的命令`
                }]);
                setLoading(false);
                return;
            }

            // 判断是否是交互式命令
            const isInteractive = isInteractiveCommand(trimmedCommand);

            if (isInteractive) {
                // 设置交互式模式
                setInteractiveMode(true);
                setInputBuffer('');

                // 更新会话状态
                useMqttStore.getState().updateTerminalSession(sessionId, {
                    interactiveMode: true
                });

                // 添加提示消息
                setHistory(prev => [...prev, {
                    type: 'system',
                    text: `进入交互式模式。使用键盘直接与应用交互，按Ctrl+C可退出。`
                }]);
            }

            // 发送命令执行请求
            await sendCommand(agentUuid, 'execute', {
                command: trimmedCommand,
                sessionId,
                streaming: true,
                interactive: isInteractive
            });

            // 响应由MQTT推送更新
        } catch (error) {
            console.error('命令执行失败:', error);

            // 添加错误消息到历史记录
            setHistory(prev => [...prev, {
                type: 'error',
                text: `执行错误: ${error.message || '未知错误'}`
            }]);

            setLoading(false);
            setInteractiveMode(false);
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
        if ((loading || interactiveMode) && sessionId) {
            forceInterruptCommand();
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
                    {interactiveMode && (
                        <span className="ml-2 text-xs px-1.5 py-0.5 bg-purple-600 text-white rounded-full flex items-center">
              <TerminalIcon className="w-3 h-3 mr-1" />
              交互式
            </span>
                    )}
                    {loading && !interactiveMode && (
                        <span className="ml-2 text-xs px-1.5 py-0.5 bg-yellow-600 text-white rounded-full flex items-center">
              <span className="animate-pulse mr-1">⚡</span>
              执行中
            </span>
                    )}
                </div>
                <div className="flex space-x-2">
                    {(loading || interactiveMode) && (
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

            <div
                className="p-4 h-80 overflow-y-auto font-mono text-sm terminal-output"
                style={{ backgroundColor: '#0D1117' }}
                ref={outputRef}
            >
                {history.length === 0 ? (
                    <div className="text-gray-400 italic">
                        在此终端中执行命令。支持vim等交互式命令。使用Ctrl+C可以中断命令，使用上下箭头可以浏览命令历史。
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
                {interactiveMode && (
                    <div className="relative pl-4 border-l-2 border-purple-500 text-white">
                        <span className="text-green-400">&gt;</span> <span className="whitespace-pre">{inputBuffer}</span>
                        <span className="animate-pulse">▌</span>
                    </div>
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
                    onKeyDown={(e) => {
                        // 监听输入框中的Ctrl+C
                        if (e.ctrlKey && (e.key === 'c' || e.keyCode === 67) && (loading || interactiveMode)) {
                            e.preventDefault();
                            console.log("输入框检测到Ctrl+C");
                            forceInterruptCommand();
                        }
                    }}
                    placeholder={isOnline
                        ? (loading ? "命令执行中..." : interactiveMode ? "交互模式中，使用键盘直接输入..." : "输入命令...")
                        : "代理离线，无法执行命令"}
                    disabled={!isOnline || loading || interactiveMode}
                    className="flex-1 bg-transparent border-none outline-none text-white placeholder-gray-500"
                    autoComplete="off"
                    spellCheck="false"
                />
                <button
                    type="submit"
                    disabled={!command.trim() || !isOnline || loading || interactiveMode}
                    className={`ml-2 p-1 rounded ${(!command.trim() || !isOnline || loading || interactiveMode) ? 'text-gray-500' : 'text-blue-500 hover:text-blue-400'}`}
                >
                    <Send size={16} />
                </button>
            </form>
        </div>
    );
}
