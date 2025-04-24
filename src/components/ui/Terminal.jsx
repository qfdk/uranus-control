'use client';

import React from 'react';
import {useCallback, useEffect, useRef, useState} from 'react';
import {Send, RotateCcw, Copy, CheckCheck, X, Terminal as TerminalIcon} from 'lucide-react';
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

// 需要特殊处理的命令列表
const SPECIAL_INTERRUPT_COMMANDS = ['ping', 'traceroute', 'telnet', 'ssh', 'nc', 'netcat'];

/**
 * Web终端组件
 */
export default function Terminal({ agentId, agentUuid, isOnline = true }) {
    console.log('Terminal渲染，agentUuid:', agentUuid);
    
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
    const [debugInfo, setDebugInfo] = useState({ lastMqttEvent: null });
    const [lastCommand, setLastCommand] = useState(null);
    const [receivedResponses, setReceivedResponses] = useState([]);
    const [currentCommandName, setCurrentCommandName] = useState(null);

    // DOM引用
    const terminalRef = useRef(null);
    const bottomRef = useRef(null);
    const inputRef = useRef(null);
    const outputRef = useRef(null);
    const autoScrollRef = useRef(true);
    const interruptTimerRef = useRef(null);
    const isMountedRef = useRef(false);
    const savedSessionTimeoutRef = useRef(null);
    const isUpdatingFromStore = useRef(false);
    const sessionRef = useRef(null);
    const interruptCountRef = useRef(0);

    // 确保MQTT连接
    useEffect(() => {
        // 确保在挂载时连接MQTT
        if (isOnline && !mqttConnected) {
            console.log('Terminal组件: 连接MQTT');
            connectMqtt().then(() => {
                console.log('Terminal: MQTT连接成功');
                setDebugInfo(prev => ({ ...prev, lastMqttEvent: 'MQTT连接成功' }));
            }).catch(err => {
                console.error('Terminal: MQTT连接失败', err);
                setInitError('MQTT连接失败，无法使用终端');
                setDebugInfo(prev => ({ ...prev, lastMqttEvent: 'MQTT连接失败: ' + err.message }));
            });
        } else if (mqttConnected) {
            setDebugInfo(prev => ({ ...prev, lastMqttEvent: 'MQTT已连接' }));
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
            console.log('Terminal: 初始化会话，agentUuid:', agentUuid);

            try {
                // 尝试确保MQTT已连接
                if (!mqttConnected) {
                    console.log('Terminal: MQTT未连接，尝试连接');
                    await connectMqtt();
                    console.log('Terminal: MQTT连接成功');
                }

                // 检查是否已有会话
                let existingSessionId = null;
                let existingSession = null;

                if (terminalSessions) {
                    for (const [id, session] of Object.entries(terminalSessions)) {
                        if (session && session.agentUuid === agentUuid) {
                            existingSessionId = id;
                            existingSession = session;
                            console.log('找到现有会话:', existingSessionId);
                            break;
                        }
                    }
                }

                if (existingSessionId && existingSession) {
                    // 恢复现有会话
                    console.log(`恢复终端会话: ${existingSessionId}`);
                    setSessionId(existingSessionId);
                    sessionRef.current = existingSessionId;
                    setDebugInfo(prev => ({ 
                        ...prev, 
                        sessionId: existingSessionId,
                        sessionFound: true
                    }));

                    // 安全地设置状态，避免直接使用引用
                    if (existingSession.history) {
                        console.log('恢复会话历史记录:', existingSession.history.length, '项');
                        setHistory([...existingSession.history]);
                    }

                    if (existingSession.commandHistory) {
                        setCommandHistory([...existingSession.commandHistory]);
                    }

                    if (existingSession.interactiveMode) {
                        setInteractiveMode(true);
                    }

                    if (existingSession.currentCommandName) {
                        setCurrentCommandName(existingSession.currentCommandName);
                    }
                } else {
                    // 创建新会话
                    try {
                        const newSessionId = startTerminalSession(agentUuid);
                        console.log(`创建新终端会话: ${newSessionId}`);
                        setSessionId(newSessionId);
                        sessionRef.current = newSessionId;
                        setDebugInfo(prev => ({ 
                            ...prev, 
                            sessionId: newSessionId,
                            sessionCreated: true
                        }));

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
                        setDebugInfo(prev => ({ ...prev, sessionError: sessionError.message }));
                    }
                }
            } catch (error) {
                console.error('初始化终端会话时出错:', error);
                setInitError(`初始化终端失败: ${error.message}`);
                setHistory([{
                    type: 'error',
                    text: `初始化终端失败: ${error.message}`
                }]);
                setDebugInfo(prev => ({ ...prev, initError: error.message }));
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
            if (savedSessionTimeoutRef.current) {
                clearTimeout(savedSessionTimeoutRef.current);
            }

            // 标记组件已卸载
            isMountedRef.current = false;

            // 清除任何中断计时器
            if (interruptTimerRef.current) {
                clearTimeout(interruptTimerRef.current);
            }

            // 保存会话状态
            if (sessionId) {
                const simpleHistory = history.slice(-HISTORY_MAX_LENGTH);
                const simpleCommandHistory = commandHistory.slice(-COMMAND_HISTORY_MAX);

                try {
                    // 确保store仍然可用
                    const store = useMqttStore.getState();
                    if (store && typeof store.updateTerminalSession === 'function') {
                        // 更新会话状态
                        store.updateTerminalSession(sessionId, {
                            history: simpleHistory,
                            commandHistory: simpleCommandHistory,
                            interactiveMode,
                            currentCommandName
                        });
                    }
                } catch (err) {
                    console.error('保存终端会话失败:', err);
                }
            }
        };
    }, [mqttConnected, agentUuid, isOnline, startTerminalSession, terminalSessions, history, commandHistory, interactiveMode, sessionId, connectMqtt, initAttempted, currentCommandName]);

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

    // 简化版本的会话监听 - 关键修改
    useEffect(() => {
        if (!sessionId || !terminalSessions) return;
        
        const currentSession = terminalSessions[sessionId];
        if (!currentSession) return;
        
        // 只处理有意义的更新
        if (currentSession.history && currentSession.history.length > 0) {
            // 更新历史记录
            setHistory([...currentSession.history]);
            
            // 检查是否需要结束loading状态
            if (!currentSession.activeCommand && loading) {
                setLoading(false);
            }
            
            // 更新交互模式状态
            if (currentSession.interactiveMode !== undefined && 
                currentSession.interactiveMode !== interactiveMode) {
                setInteractiveMode(currentSession.interactiveMode);
            }
            
            // 更新命令名称
            if (currentSession.currentCommandName !== currentCommandName) {
                setCurrentCommandName(currentSession.currentCommandName);
            }
            
            // 确保滚动到底部
            setTimeout(scrollToBottom, 0);
        }
    }, [sessionId, terminalSessions, loading, interactiveMode, currentCommandName, scrollToBottom]);

    // 监听接收到的响应
    useEffect(() => {
        if (lastCommand && receivedResponses.length > 0) {
            // 找到最新响应
            const latestResponse = receivedResponses[receivedResponses.length - 1];
            
            // 检查是否是最后一条命令的响应
            if (latestResponse.requestId === lastCommand.requestId) {
                // 添加响应到本地历史
                setHistory(prev => {
                    // 检查是否已有此响应
                    const existingIndex = prev.findIndex(
                        item => item.type === 'response' && item.requestId === latestResponse.requestId
                    );
                    
                    if (existingIndex >= 0) {
                        // 更新现有响应
                        const updated = [...prev];
                        updated[existingIndex] = {
                            ...updated[existingIndex],
                            text: latestResponse.text,
                            success: latestResponse.success
                        };
                        return updated;
                    } else {
                        // 添加新响应
                        return [...prev, {
                            type: 'response',
                            requestId: latestResponse.requestId,
                            text: latestResponse.text,
                            success: latestResponse.success
                        }];
                    }
                });
                
                // 命令完成
                if (latestResponse.final) {
                    setLoading(false);
                    setLastCommand(null);
                    setCurrentCommandName(null);
                    
                    // 重置中断计数器
                    interruptCountRef.current = 0;
                }
            }
        }
    }, [receivedResponses, lastCommand]);

    // 发送多重中断信号的增强函数
    const sendEnhancedInterrupt = useCallback(async () => {
        if (!sessionId || !agentUuid || !isMountedRef.current) return;

        try {
            // 增加中断计数
            interruptCountRef.current += 1;
            const attemptCount = interruptCountRef.current;
            
            // 本地显示中断信号
            setHistory(prev => [...prev, { 
                type: 'system', 
                text: `^C (中断尝试 #${attemptCount})` 
            }]);
            
            setInputBuffer('');
            console.log(`发送增强中断信号 #${attemptCount} - 命令: ${currentCommandName || 'unknown'}`);

            // 特殊命令需要更强力的中断手段
            const isSpecialCommand = currentCommandName && 
                SPECIAL_INTERRUPT_COMMANDS.some(cmd => 
                    currentCommandName.toLowerCase().startsWith(cmd.toLowerCase()));

            // 优先使用中断命令 API
            try {
                await interruptCommand(sessionId);
                console.log('已使用interruptCommand API');
            } catch (err) {
                console.error('使用中断命令API失败:', err);
            }

            // 发送标准中断信号 (Ctrl+C)
            await sendCommand(agentUuid, 'terminal_input', {
                sessionId,
                input: SPECIAL_KEYS.CTRL_C,
                timestamp: Date.now()
            });

            // 对于特殊命令或重复中断，使用增强中断方法
            if (isSpecialCommand || attemptCount > 1) {
                console.log(`使用增强中断方法 - 特殊命令: ${isSpecialCommand}, 尝试次数: ${attemptCount}`);
                
                // 发送 force_interrupt 命令 (最强力的中断)
                await sendCommand(agentUuid, 'force_interrupt', {
                    sessionId,
                    requestId: Math.random().toString(36).substring(2, 15),
                    timestamp: Date.now()
                });
                
                // 同时发送特定命令终止，使用多个SIGKILL
                await sendCommand(agentUuid, 'execute', {
                    command: 'pkill -9 ping', // 尝试强制终止ping进程
                    sessionId,
                    streaming: false,
                    silent: true,
                    requestId: Math.random().toString(36).substring(2, 15)
                });
                
                if (currentCommandName === 'ping') {
                    // 备用ping终止命令
                    await sendCommand(agentUuid, 'execute', {
                        command: 'killall -9 ping',
                        sessionId,
                        streaming: false,
                        silent: true
                    });
                }
            }

            // 监控交互模式状态变更
            if (interactiveMode) {
                interruptTimerRef.current = setTimeout(() => {
                    if (!isMountedRef.current) return;

                    const currentSession = terminalSessions[sessionId];
                    if (!currentSession || !currentSession.activeCommand) {
                        setInteractiveMode(false);
                        setCurrentCommandName(null);
                    } else if (attemptCount < 3) {
                        // 如果三次尝试后仍在交互模式，则尝试更强力的中断
                        console.log(`命令仍在运行，尝试更强力的中断方法`);
                        sendEnhancedInterrupt();
                    }
                }, 500);
            }
        } catch (error) {
            console.error('发送中断信号失败:', error);
            setDebugInfo(prev => ({ ...prev, interruptError: error.message }));
        }
    }, [sessionId, agentUuid, interruptCommand, sendCommand, terminalSessions, interactiveMode, currentCommandName]);

    // 发送交互式输入
    const sendInteractiveInput = useCallback(async (input) => {
        if (!sessionId || !agentUuid || !isMountedRef.current) return;

        try {
            // 特殊处理Ctrl+C
            if (input === SPECIAL_KEYS.CTRL_C) {
                sendEnhancedInterrupt();
                return;
            }

            // 常规输入处理
            if (input !== SPECIAL_KEYS.CTRL_C) {
                setInputBuffer(prev => prev + input);
            }

            console.log(`发送交互式输入: "${input.replace('\r', '\\r').replace('\n', '\\n')}"`);
            setDebugInfo(prev => ({ 
                ...prev, 
                lastInput: input.replace('\r', '\\r').replace('\n', '\\n'),
                inputTime: new Date().toISOString() 
            }));

            // 通过MQTT发送按键输入
            await sendCommand(agentUuid, 'terminal_input', {
                sessionId,
                input,
                timestamp: Date.now()
            });
        } catch (error) {
            console.error('发送交互式输入失败:', error);
            setDebugInfo(prev => ({ ...prev, inputError: error.message }));
            if (isMountedRef.current) {
                setHistory(prev => [...prev, {
                    type: 'error',
                    text: `发送输入失败: ${error.message}`
                }]);
            }
        }
    }, [sessionId, agentUuid, sendCommand, sendEnhancedInterrupt]);

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
                sendEnhancedInterrupt();
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
                sendEnhancedInterrupt();
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
    }, [historyIndex, commandHistory, loading, interactiveMode, sendInteractiveInput, sendEnhancedInterrupt]);

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
                    sendEnhancedInterrupt();
                    return false;
                }
            }

            // 其他按键处理委托给handleKeyDown
            handleKeyDown(e);
        };

        // 使用捕获阶段确保能拦截事件
        document.addEventListener('keydown', handleGlobalKeyDown, true);
        return () => document.removeEventListener('keydown', handleGlobalKeyDown, true);
    }, [handleKeyDown, interactiveMode, loading, sendEnhancedInterrupt]);

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

    // 处理MQTT消息传递 - 直接监听处理MQTT响应
    useEffect(() => {
        // 设置一个消息处理函数
        const handleMqttResponse = (topic, message) => {
            try {
                if (!topic.startsWith('uranus/response/') || !message) return;
                
                const payload = typeof message === 'string' ? JSON.parse(message) : message;
                
                // 只处理与当前会话相关的消息
                if (payload.sessionId && payload.sessionId === sessionRef.current) {
                    // 添加到接收到的响应列表
                    setReceivedResponses(prev => [...prev, {
                        requestId: payload.requestId,
                        text: payload.output || payload.message || '',
                        success: payload.success !== false,
                        final: payload.final,
                        timestamp: Date.now()
                    }]);
                }
            } catch (err) {
                console.error('处理MQTT响应失败:', err);
            }
        };

        // 如果MQTT已连接，订阅响应主题
        if (mqttConnected && sessionId && agentUuid) {
            const store = useMqttStore.getState();
            if (store && typeof store.subscribeToResponses === 'function') {
                // 注册消息处理器
                const unsubscribe = store.subscribeToResponses(handleMqttResponse);
                return () => unsubscribe();
            }
        }
    }, [mqttConnected, sessionId, agentUuid]);

    // 检测交互式命令
    const isInteractiveCommand = (cmd) => {
        return /^(vim|vi|nano|emacs|less|more|top|htop|mysql|psql|mongo|ssh|telnet|tmux|screen)/i.test(cmd.trim());
    };

    // 检测特殊处理命令（如ping）
    const isSpecialCommand = (cmd) => {
        const normalizedCmd = cmd.trim().toLowerCase();
        return SPECIAL_INTERRUPT_COMMANDS.some(specialCmd => 
            normalizedCmd.startsWith(specialCmd));
    };

    // 提取命令名称
    const extractCommandName = (cmdString) => {
        const trimmed = cmdString.trim();
        const match = trimmed.match(/^(\S+)/);
        return match ? match[1].toLowerCase() : null;
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

        // 提取命令名称
        const cmdName = extractCommandName(trimmedCommand);
        if (cmdName) {
            setCurrentCommandName(cmdName);
        }

        // 添加命令到历史记录
        setHistory(prev => {
            const newHistory = [...prev, { type: 'command', text: trimmedCommand }];
            return newHistory.slice(-HISTORY_MAX_LENGTH);
        });

        setLoading(true);
        setCommand('');

        console.log('执行命令:', trimmedCommand);
        setDebugInfo(prev => ({ 
            ...prev, 
            lastCommand: trimmedCommand,
            commandName: cmdName,
            commandTime: new Date().toISOString() 
        }));

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
                sessionRef.current = null;
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

            if (trimmedCommand === 'debug') {
                setHistory(prev => [...prev, {
                    type: 'system',
                    text: `调试信息:\n- 会话ID: ${sessionId}\n- MQTT连接: ${mqttConnected ? '已连接' : '未连接'}\n- 代理UUID: ${agentUuid}\n- 交互模式: ${interactiveMode ? '是' : '否'}\n- 当前命令: ${currentCommandName || '无'}\n\n详细信息: ${JSON.stringify(debugInfo, null, 2)}`
                }]);
                setLoading(false);
                return;
            }

            // 重置中断计数器
            interruptCountRef.current = 0;

            // 判断是否是交互式命令
            const isInteractive = isInteractiveCommand(trimmedCommand);
            // 检查是否是需要特殊处理的命令（如ping）
            const needsSpecialHandling = isSpecialCommand(trimmedCommand);

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

            if (needsSpecialHandling) {
                // 添加针对特殊命令的提示
                setHistory(prev => [...prev, {
                    type: 'system',
                    text: `注意: ${cmdName} 是特殊命令，如需中断请按Ctrl+C多次。`
                }]);
            }

            // 确保MQTT已连接
            if (!mqttConnected) {
                console.log('命令执行前确保MQTT连接');
                await connectMqtt();
            }

            console.log(`发送命令到执行: ${trimmedCommand}, 会话ID: ${sessionId}, 交互式: ${isInteractive}`);

            // 生成请求ID
            const requestId = Math.random().toString(36).substring(2, 15);
            
            // 发送命令执行请求
            try {
                const response = await sendCommand(agentUuid, 'execute', {
                    command: trimmedCommand,
                    sessionId,
                    streaming: true,
                    interactive: isInteractive,
                    requestId, // 传递请求ID确保能匹配响应
                    specialCommand: needsSpecialHandling // 标记是否为特殊命令
                });

                console.log('命令初始响应:', response);
                
                // 记录最后一条命令，用于跟踪响应
                setLastCommand({
                    command: trimmedCommand,
                    requestId: requestId || response.requestId,
                    timestamp: Date.now()
                });

                setDebugInfo(prev => ({ 
                    ...prev, 
                    initialResponse: JSON.stringify(response),
                    sentRequestId: requestId
                }));

                // 更新会话状态，记录当前命令名称
                useMqttStore.getState().updateTerminalSession(sessionId, {
                    currentCommandName: cmdName
                });

                // 直接处理首次响应
                if (response && (response.output || response.message)) {
                    console.log('处理首次响应输出:', 
                        response.output?.length || 0, '字节');
                    
                    // 添加到接收到的响应列表
                    setReceivedResponses(prev => [...prev, {
                        requestId: response.requestId || requestId,
                        text: response.output || response.message || '',
                        success: response.success !== false,
                        final: response.final,
                        timestamp: Date.now()
                    }]);
                }
            } catch (err) {
                console.error('发送命令失败:', err);
                // 添加错误消息到历史记录
                setHistory(prev => [...prev, {
                    type: 'error',
                    text: `命令发送失败: ${err.message}`
                }]);
                setLoading(false);
                setCurrentCommandName(null);
            }
        } catch (error) {
            console.error('命令执行失败:', error);
            setDebugInfo(prev => ({ ...prev, commandError: error.message }));

            // 添加错误消息到历史记录
            if (isMountedRef.current) {
                setHistory(prev => [...prev, {
                    type: 'error',
                    text: `执行错误: ${error.message || '未知错误'}`
                }]);

                setLoading(false);
                setInteractiveMode(false);
                setCurrentCommandName(null);
            }
        }
    };

    // 清除历史记录
    const clearHistory = () => {
        setHistory([]);
        if (sessionId) {
            try {
                const store = useMqttStore.getState();
                if (store && typeof store.updateTerminalSession === 'function') {
                    store.updateTerminalSession(sessionId, { history: [] });
                }
            } catch (err) {
                console.error('清除历史记录失败:', err);
            }
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

    // 重新初始化终端
    const reinitialize = () => {
        console.log('重新初始化终端');
        setInitError(null);
        setInitAttempted(false);
        setSessionId(null);
        sessionRef.current = null;
        setHistory([]);
        setInteractiveMode(false);
        setLoading(false);
        setLastCommand(null);
        setReceivedResponses([]);
        setDebugInfo({});
        setCurrentCommandName(null);
        
        // 延迟初始化
        setTimeout(() => {
            if (isMountedRef.current) {
                // 首先尝试连接MQTT
                connectMqtt().then(() => {
                    // 创建新会话
                    if (agentUuid && isOnline) {
                        const newSessionId = startTerminalSession(agentUuid);
                        console.log(`重新初始化：创建新终端会话: ${newSessionId}`);
                        setSessionId(newSessionId);
                        sessionRef.current = newSessionId;
                        setHistory([{
                            type: 'system',
                            text: `连接到代理 ${agentUuid} 的终端。\n输入命令开始操作。`
                        }]);
                    }
                }).catch(err => {
                    console.error('重新初始化MQTT连接失败:', err);
                    setInitError('MQTT连接失败，无法使用终端');
                });
            }
        }, 500);
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
                    onClick={reinitialize}
                    className="mt-3 bg-red-200 dark:bg-red-800 px-3 py-1 rounded text-red-700 dark:text-red-200 hover:bg-red-300 dark:hover:bg-red-700 transition-colors"
                >
                    重新初始化终端
                </button>
                {Object.keys(debugInfo).length > 0 && (
                    <div className="mt-3 text-xs border-t border-red-200 dark:border-red-700 pt-2">
                        <details>
                            <summary className="cursor-pointer font-medium">调试信息</summary>
                            <pre className="mt-2 p-2 bg-red-100 dark:bg-red-900/40 rounded overflow-auto max-h-40">
                                {JSON.stringify(debugInfo, null, 2)}
                            </pre>
                        </details>
                    </div>
                )}
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
                    {currentCommandName && (
                        <span className="ml-2 text-xs px-1.5 py-0.5 bg-gray-600 text-white rounded-full">
                            {currentCommandName}
                        </span>
                    )}
                </div>
                <div className="flex space-x-2">
                    {(loading || interactiveMode) && (
                        <button
                            onClick={sendEnhancedInterrupt}
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
                        <div key={`${index}-${item.type}-${item.requestId || ''}`} className="mb-2">
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
