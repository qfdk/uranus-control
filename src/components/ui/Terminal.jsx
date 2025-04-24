// src/components/ui/Terminal.jsx
'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { Send, RotateCcw, Copy, CheckCheck, X, Terminal as TerminalIcon } from 'lucide-react';
import useMqttStore from '@/store/mqttStore';

// 常量定义
const HISTORY_MAX_LENGTH = 200; // 历史记录最大条数
const COMMAND_HISTORY_MAX = 50;  // 命令历史记录最大条数

// 特殊键代码映射
const SPECIAL_KEYS = {
    ESCAPE: '\u001b',
    CTRL_C: '\u0003',
    CTRL_D: '\u0004',
    CTRL_Z: '\u001a',
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

/**
 * Web终端组件
 */
export default function Terminal({ agentId, agentUuid, isOnline = true }) {
    // MQTT Store相关功能
    const {
        connected: mqttConnected,
        sendCommand,
        startTerminalSession,
        endTerminalSession,
        interruptCommand,
        terminalSessions,
        connect: connectMqtt
    } = useMqttStore();

    // 状态管理
    const [command, setCommand] = useState('');
    const [history, setHistory] = useState([]);
    const [commandHistory, setCommandHistory] = useState([]);
    const [historyIndex, setHistoryIndex] = useState(-1);
    const [loading, setLoading] = useState(false);
    const [copied, setCopied] = useState(false);
    const [sessionId, setSessionId] = useState(null);
    const [interactiveMode, setInteractiveMode] = useState(false);
    const [inputBuffer, setInputBuffer] = useState('');
    const [initAttempted, setInitAttempted] = useState(false);
    const [initError, setInitError] = useState(null);

    // DOM引用
    const terminalRef = useRef(null);
    const bottomRef = useRef(null);
    const inputRef = useRef(null);
    const outputRef = useRef(null);
    const autoScrollRef = useRef(true);
    const interruptTimerRef = useRef(null);
    const isMountedRef = useRef(false);

    // 确保MQTT连接
    useEffect(() => {
        // 确保在挂载时连接MQTT
        if (isOnline && !mqttConnected) {
            console.log('Terminal组件: 连接MQTT');
            connectMqtt().catch(err => {
                console.error('Terminal: MQTT连接失败', err);
                setInitError('MQTT连接失败，无法使用终端');
            });
        }
    }, [isOnline, mqttConnected, connectMqtt]);

    // 创建或恢复终端会话
    useEffect(() => {
        // 标记组件已挂载
        isMountedRef.current = true;
        
        // 异步初始化会话
        const initSession = async () => {
            if (!agentUuid || !isOnline || initAttempted) return;
            
            setInitAttempted(true);
            
            try {
                // 尝试确保MQTT已连接
                if (!mqttConnected) {
                    await connectMqtt();
                }
                
                // 检查是否已有会话
                let existingSessionId = null;
                let existingSession = null;
                
                if (terminalSessions) {
                    for (const [id, session] of Object.entries(terminalSessions)) {
                        if (session && session.agentUuid === agentUuid) {
                            existingSessionId = id;
                            existingSession = session;
                            break;
                        }
                    }
                }

                if (existingSessionId && existingSession) {
                    // 恢复现有会话
                    console.log(`恢复终端会话: ${existingSessionId}`);
                    setSessionId(existingSessionId);
                    
                    // 安全地设置状态，避免直接使用引用
                    if (existingSession.history) {
                        setHistory([...existingSession.history]);
                    }

                    if (existingSession.commandHistory) {
                        setCommandHistory([...existingSession.commandHistory]);
                    }

                    if (existingSession.interactiveMode) {
                        setInteractiveMode(true);
                    }
                } else {
                    // 创建新会话
                    try {
                        const newSessionId = startTerminalSession(agentUuid);
                        console.log(`创建新终端会话: ${newSessionId}`);
                        setSessionId(newSessionId);

                        // 添加欢迎消息
                        setHistory([{
                            type: 'system',
                            text: `连接到代理 ${agentUuid} 的终端。\n` +
                                `输入命令开始操作。输入 'help' 查看可用命令。\n` +
                                `支持vim等交互式命令，按Ctrl+C可中断命令执行。`
                        }]);
                    } catch (sessionError) {
                        console.error('创建终端会话失败:', sessionError);
                        setInitError('创建终端会话失败，请刷新页面重试');
                    }
                }
            } catch (error) {
                console.error('初始化终端会话时出错:', error);
                setInitError(`初始化终端失败: ${error.message}`);
                setHistory([{
                    type: 'error',
                    text: `初始化终端失败: ${error.message}`
                }]);
            }
        };

        // 延迟初始化，确保MQTT有时间连接
        const timer = setTimeout(() => {
            initSession();
        }, 500);
        
        // 组件卸载时清理
        return () => {
            // 清除定时器
            clearTimeout(timer);
            
            // 标记组件已卸载
            isMountedRef.current = false;
            
            // 保存会话状态 - 使用更简单的方法避免循环引用
            if (sessionId) {
                try {
                    // 手动创建简单的新对象，避免使用深度克隆
                    // 这样可以确保不会有循环引用
                    
                    // 为历史记录创建简单的新对象数组
                    const simpleHistory = history.slice(-HISTORY_MAX_LENGTH).map(item => {
                        // 只保留必要的字段
                        return {
                            type: item.type,
                            text: item.text,
                            requestId: item.requestId,
                            success: item.success
                        };
                    });
                    
                    // 命令历史是简单的字符串数组，直接复制
                    const simpleCommandHistory = commandHistory.slice(-COMMAND_HISTORY_MAX);
                    
                    // 更新会话状态
                    const updateData = {
                        history: simpleHistory,
                        commandHistory: simpleCommandHistory,
                        interactiveMode,
                        lastSaved: new Date().toISOString()
                    };
                    
                    // 安全地更新会话
                    useMqttStore.getState().updateTerminalSession(sessionId, updateData);
                } catch (error) {
                    console.error('保存终端会话状态时出错:', error);
                }
            }

            // 清除任何中断计时器
            if (interruptTimerRef.current) {
                clearTimeout(interruptTimerRef.current);
            }
        };
    }, [mqttConnected, agentUuid, isOnline, startTerminalSession, terminalSessions, history, commandHistory, interactiveMode, sessionId, connectMqtt, initAttempted]);

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
        if (!sessionId || !isMountedRef.current || !terminalSessions) return;

        const session = terminalSessions[sessionId];
        if (!session) return;

        try {
            // 检查会话中的历史记录有无更新
            if (session.history) {
                setHistory([...session.history]);
                
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
        } catch (error) {
            console.error('处理终端会话数据时出错:', error);
        }
    }, [terminalSessions, sessionId, loading, scrollToBottom]);

    // 发送交互式输入
    const sendInteractiveInput = useCallback(async (input) => {
        if (!sessionId || !agentUuid || !isMountedRef.current) return;

        try {
            // 特殊处理Ctrl+C
            if (input === SPECIAL_KEYS.CTRL_C) {
                // 本地显示中断信号
                setHistory(prev => [...prev, { type: 'system', text: '^C' }]);
                setInputBuffer('');

                // 连续发送多个信号增加中断成功率
                console.log('发送Ctrl+C中断信号');

                // 首先尝试使用优化的中断命令 - 这包含了多重中断机制
                if (interruptCommand && typeof interruptCommand === 'function') {
                    try {
                        interruptCommand(sessionId);
                    } catch (err) {
                        console.error('使用中断命令失败:', err);
                    }
                }

                // 备份方案: 直接发送Ctrl+C (3次尝试)
                for (let i = 0; i < 3; i++) {
                    try {
                        if (!isMountedRef.current) break;
                        
                        await sendCommand(agentUuid, 'terminal_input', {
                            sessionId,
                            input: SPECIAL_KEYS.CTRL_C,
                            timestamp: Date.now()
                        });

                        // 短暂延迟确保服务器有时间处理
                        if (i < 2) await new Promise(r => setTimeout(r, 50));
                    } catch (e) {
                        console.error(`第${i+1}次Ctrl+C发送失败:`, e);
                    }
                }

                // 延迟一段时间后检查交互模式状态
                interruptTimerRef.current = setTimeout(() => {
                    if (!isMountedRef.current) return;
                    
                    const currentSession = terminalSessions[sessionId];
                    if (!currentSession || !currentSession.activeCommand) {
                        setInteractiveMode(false);
                    }
                }, 500);

                return;
            }

            // 常规输入处理
            if (input !== SPECIAL_KEYS.CTRL_C) {
                setInputBuffer(prev => prev + input);
            }

            // 通过MQTT发送按键输入
            await sendCommand(agentUuid, 'terminal_input', {
                sessionId,
                input,
                timestamp: Date.now()
            });
        } catch (error) {
            console.error('发送交互式输入失败:', error);
            if (isMountedRef.current) {
                setHistory(prev => [...prev, {
                    type: 'error',
                    text: `发送输入失败: ${error.message}`
                }]);
            }
        }
    }, [sessionId, agentUuid, terminalSessions, sendCommand, interruptCommand]);

    // 处理键盘事件
    const handleKeyDown = useCallback((e) => {
        // 如果组件已卸载，不处理事件
        if (!isMountedRef.current) return;
        
        // 检查是否在终端区域内
        if (!terminalRef.current?.contains(e.target)) return;

        // 处理Ctrl+C
        if (e.ctrlKey && (e.key === 'c' || e.keyCode === 67)) {
            e.preventDefault();

            if (loading || interactiveMode) {
                sendInteractiveInput(SPECIAL_KEYS.CTRL_C);
                return;
            }
        }

        // 交互式模式下的键盘处理
        if (interactiveMode) {
            e.preventDefault();

            // 特殊键处理
            if (e.key === 'Escape') {
                sendInteractiveInput(SPECIAL_KEYS.ESCAPE);
            } else if (e.ctrlKey && e.key === 'c') {
                sendInteractiveInput(SPECIAL_KEYS.CTRL_C);
            } else if (e.ctrlKey && e.key === 'd') {
                sendInteractiveInput(SPECIAL_KEYS.CTRL_D);
            } else if (e.ctrlKey && e.key === 'z') {
                sendInteractiveInput(SPECIAL_KEYS.CTRL_Z);
            } else if (e.key === 'Backspace') {
                sendInteractiveInput(SPECIAL_KEYS.BACKSPACE);
            } else if (e.key === 'Tab') {
                sendInteractiveInput(SPECIAL_KEYS.TAB);
            } else if (e.key === 'Enter') {
                sendInteractiveInput(SPECIAL_KEYS.ENTER);
            } else if (e.key === 'ArrowUp') {
                sendInteractiveInput(SPECIAL_KEYS.UP);
            } else if (e.key === 'ArrowDown') {
                sendInteractiveInput(SPECIAL_KEYS.DOWN);
            } else if (e.key === 'ArrowRight') {
                sendInteractiveInput(SPECIAL_KEYS.RIGHT);
            } else if (e.key === 'ArrowLeft') {
                sendInteractiveInput(SPECIAL_KEYS.LEFT);
            } else if (e.key === 'Home') {
                sendInteractiveInput(SPECIAL_KEYS.HOME);
            } else if (e.key === 'End') {
                sendInteractiveInput(SPECIAL_KEYS.END);
            } else if (e.key === 'Delete') {
                sendInteractiveInput(SPECIAL_KEYS.DELETE);
            } else if (e.key === 'PageUp') {
                sendInteractiveInput(SPECIAL_KEYS.PAGE_UP);
            } else if (e.key === 'PageDown') {
                sendInteractiveInput(SPECIAL_KEYS.PAGE_DOWN);
            } else if (e.key.length === 1) {
                // 普通字符输入
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
    }, [historyIndex, commandHistory, loading, interactiveMode, sendInteractiveInput]);

    // 全局键盘事件处理
    useEffect(() => {
        const handleGlobalKeyDown = (e) => {
            if (!isMountedRef.current) return;
            
            // 确保只处理终端内的按键事件
            if (!terminalRef.current?.contains(e.target) &&
                !terminalRef.current?.contains(document.activeElement)) {
                return;
            }

            // 特别处理Ctrl+C - 中断正在执行的命令
            if (e.ctrlKey && (e.key === 'c' || e.keyCode === 67)) {
                if (interactiveMode || loading) {
                    e.preventDefault();
                    e.stopPropagation();
                    console.log("检测到Ctrl+C，中断命令");
                    sendInteractiveInput(SPECIAL_KEYS.CTRL_C);
                    return false;
                }
            }

            // 其他按键处理委托给handleKeyDown
            handleKeyDown(e);
        };

        // 使用捕获阶段确保能拦截事件
        document.addEventListener('keydown', handleGlobalKeyDown, true);
        return () => document.removeEventListener('keydown', handleGlobalKeyDown, true);
    }, [handleKeyDown, interactiveMode, loading, sendInteractiveInput]);

    // 处理滚动事件
    useEffect(() => {
        const handleScroll = () => {
            if (!outputRef.current || !isMountedRef.current) return;

            const { scrollTop, scrollHeight, clientHeight } = outputRef.current;
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
        return /^(vim|vi|nano|emacs|less|more|top|htop|mysql|psql|mongo|ssh|telnet|tmux|screen)/i.test(cmd.trim());
    };

    // 处理命令提交
    const handleSubmit = async (e) => {
        e?.preventDefault();

        if (!command.trim() || !isOnline || !sessionId || loading || !isMountedRef.current) return;

        // 重置历史索引
        setHistoryIndex(-1);

        // 更新命令历史
        const trimmedCommand = command.trim();
        setCommandHistory(prev => {
            // 避免连续相同命令重复记录
            if (prev.length > 0 && prev[prev.length - 1] === trimmedCommand) {
                return prev;
            }
            return [...prev, trimmedCommand].slice(-COMMAND_HISTORY_MAX);
        });

        // 添加命令到历史记录
        setHistory(prev => {
            const newHistory = [...prev, { type: 'command', text: trimmedCommand }];
            return newHistory.slice(-HISTORY_MAX_LENGTH);
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
                if (endTerminalSession) {
                    endTerminalSession(sessionId);
                }
                setSessionId(null);
                setLoading(false);
                return;
            }

            if (trimmedCommand === 'help') {
                setHistory(prev => [...prev, {
                    type: 'system',
                    text: `可用命令:\n- clear: 清除终端\n- exit: 结束终端会话\n- help: 显示帮助信息\n\n其他命令将直接发送给服务器执行。使用Ctrl+C可以中断命令。`
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

                // 添加提示消息
                setHistory(prev => [...prev, {
                    type: 'system',
                    text: `进入交互式模式。使用键盘直接与应用交互，按Ctrl+C可退出。`
                }]);
            }

            // 确保MQTT已连接
            if (!mqttConnected) {
                await connectMqtt();
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
            if (isMountedRef.current) {
                setHistory(prev => [...prev, {
                    type: 'error',
                    text: `执行错误: ${error.message || '未知错误'}`
                }]);

                setLoading(false);
                setInteractiveMode(false);
            }
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
        setTimeout(() => {
            if (isMountedRef.current) {
                setCopied(false);
            }
        }, 2000);
    };

    // 如果有初始化错误，显示错误信息
    if (initError) {
        return (
            <div className="rounded-lg border border-red-200 dark:border-red-700 bg-red-50 dark:bg-red-900/20 p-4 text-red-700 dark:text-red-300">
                <div className="flex items-center mb-2">
                    <svg className="w-5 h-5 mr-2" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2h-1V9z" clipRule="evenodd" />
                    </svg>
                    <span className="font-medium">终端初始化失败</span>
                </div>
                <p>{initError}</p>
                <button 
                    onClick={() => window.location.reload()}
                    className="mt-3 bg-red-200 dark:bg-red-800 px-3 py-1 rounded text-red-700 dark:text-red-200 hover:bg-red-300 dark:hover:bg-red-700 transition-colors"
                >
                    刷新页面重试
                </button>
            </div>
        );
    }

    return (
        <div className="rounded-lg border border-gray-200 dark:border-gray-700 bg-black text-white dark:bg-gray-900 overflow-hidden" ref={terminalRef}>
            {/* 终端标题栏 */}
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
                            onClick={() => sendInteractiveInput(SPECIAL_KEYS.CTRL_C)}
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

            {/* 终端输出区域 */}
            <div
                className="p-4 h-80 overflow-y-auto font-mono text-sm terminal-output"
                style={{ backgroundColor: '#0D1117' }}
                ref={outputRef}
            >
                {history.length === 0 ? (
                    <div className="text-gray-400 italic">
                        {sessionId ? 
                            '在此终端中执行命令。支持vim等交互式命令。使用Ctrl+C可以中断命令，使用上下箭头可以浏览命令历史。' :
                            '正在初始化终端会话...'
                        }
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

            {/* 命令输入区域 */}
            <form onSubmit={handleSubmit} className="flex items-center p-2 bg-gray-800 dark:bg-gray-800 border-t border-gray-700">
                <div className="text-green-400 mr-2">$</div>
                <input
                    ref={inputRef}
                    type="text"
                    value={command}
                    onChange={(e) => setCommand(e.target.value)}
                    placeholder={isOnline
                        ? (loading ? "命令执行中..." : interactiveMode ? "交互模式中，使用键盘直接输入..." : "输入命令...")
                        : "代理离线，无法执行命令"}
                    disabled={!isOnline || loading || interactiveMode || !sessionId}
                    className="flex-1 bg-transparent border-none outline-none text-white placeholder-gray-500"
                    autoComplete="off"
                    spellCheck="false"
                />
                <button
                    type="submit"
                    disabled={!command.trim() || !isOnline || loading || interactiveMode || !sessionId}
                    className={`ml-2 p-1 rounded ${(!command.trim() || !isOnline || loading || interactiveMode || !sessionId) ? 'text-gray-500' : 'text-blue-500 hover:text-blue-400'}`}
                >
                    <Send size={16} />
                </button>
            </form>
        </div>
    );
}
