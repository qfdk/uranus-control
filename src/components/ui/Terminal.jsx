'use client';

import React, {useCallback, useEffect, useRef, useState} from 'react';
import {AlertTriangle, CheckCheck, Copy, RotateCcw, Send, Terminal as TerminalIcon} from 'lucide-react';
import useMqttStore from '@/store/mqttStore';

// 常量定义
const HISTORY_MAX_LENGTH = 500; // 历史记录最大条数

/**
 * 简化的终端组件
 */
export default function TerminalComponent({agentUuid, isOnline = true}) {
    // MQTT 状态
    const {
        connected: mqttConnected,
        sendCommand,
        startTerminalSession,
        endTerminalSession
    } = useMqttStore();

    // 基础状态
    const [sessionId, setSessionId] = useState(null);
    const [command, setCommand] = useState('');
    const [history, setHistory] = useState([]);
    const [copied, setCopied] = useState(false);
    const [commandCounter, setCommandCounter] = useState(0);
    const [activeCommand, setActiveCommand] = useState(null);
    const [error, setError] = useState(null);

    // Refs
    const terminalRef = useRef(null);
    const inputRef = useRef(null);
    const outputRef = useRef(null);
    const bottomRef = useRef(null);
    const autoScrollRef = useRef(true);
    const isMountedRef = useRef(false);
    // 记录命令输出缓存
    const outputCache = useRef({});

    // 初始化终端会话
    useEffect(() => {
        isMountedRef.current = true;

        const initTerminal = async () => {
            if (!agentUuid || !isOnline) {
                setError(isOnline ? '代理ID无效' : '代理当前离线');
                return;
            }

            try {
                // 确保MQTT连接
                if (!mqttConnected) {
                    await useMqttStore.getState().connect();
                }

                // 创建新的终端会话
                const newSessionId = startTerminalSession(agentUuid);
                setSessionId(newSessionId);

                // 添加欢迎消息
                setHistory([
                    {
                        type: 'system',
                        text: `已连接到代理 ${agentUuid} 的终端。\n输入命令开始操作，支持所有常规Linux命令。`
                    }
                ]);

                console.log(`终端会话已创建: ${newSessionId}`);
            } catch (err) {
                console.error('初始化终端失败:', err);
                setError(`初始化终端失败: ${err.message}`);
            }
        };

        initTerminal();

        // 清理函数
        return () => {
            isMountedRef.current = false;

            // 结束终端会话
            if (sessionId) {
                try {
                    endTerminalSession(sessionId);
                } catch (err) {
                    console.error('终端会话清理失败:', err);
                }
            }
        };
    }, [agentUuid, isOnline, mqttConnected, startTerminalSession, endTerminalSession]);

    // 自动滚动到底部
    const scrollToBottom = useCallback(() => {
        if (bottomRef.current && autoScrollRef.current) {
            bottomRef.current.scrollIntoView({behavior: 'auto'});
        }
    }, []);

    // 监听历史变化自动滚动
    useEffect(() => {
        scrollToBottom();
    }, [history, scrollToBottom]);

    // 监听滚动事件以控制自动滚动行为
    useEffect(() => {
        const handleScroll = () => {
            if (!outputRef.current || !isMountedRef.current) return;

            const {scrollTop, scrollHeight, clientHeight} = outputRef.current;
            // 如果用户滚动到接近底部，恢复自动滚动
            const isAtBottom = Math.abs(scrollHeight - scrollTop - clientHeight) < 20;
            autoScrollRef.current = isAtBottom;
        };

        const outputElement = outputRef.current;
        if (outputElement) {
            outputElement.addEventListener('scroll', handleScroll);
            return () => outputElement.removeEventListener('scroll', handleScroll);
        }
    }, []);

    // 发送命令的核心方法
    const executeCommand = useCallback(async (cmdString) => {
        if (!cmdString.trim() || !isOnline || !sessionId || !isMountedRef.current) {
            return false;
        }

        // 防止并发执行
        if (activeCommand) {
            console.log('命令正在执行中，请等待...');
            return false;
        }

        try {
            // 记录当前命令
            const trimmedCmd = cmdString.trim();
            const cmdId = commandCounter + 1;
            setCommandCounter(cmdId);

            // 清空输入框
            setCommand('');

            // 添加命令到历史记录
            setHistory(prev => {
                const newHistory = [...prev, {type: 'command', text: trimmedCmd, id: cmdId}];
                return newHistory.slice(-HISTORY_MAX_LENGTH);
            });

            // 处理内置命令
            if (trimmedCmd === 'clear') {
                setHistory([]);
                return true;
            }

            if (trimmedCmd === 'exit') {
                setHistory(prev => [...prev, {
                    type: 'system',
                    text: '终端会话已结束。刷新页面可重新开始。'
                }]);

                endTerminalSession(sessionId);
                setSessionId(null);
                return true;
            }

            // 创建命令对象记录
            const commandObj = {
                id: cmdId,
                text: trimmedCmd,
                startTime: new Date()
            };

            // 设置活动命令
            setActiveCommand(commandObj);
            // 清空命令输出缓存
            outputCache.current[cmdId] = '';

            // 发送命令到代理
            const requestId = `cmd-${cmdId}-${Date.now()}`;
            await sendCommand(agentUuid, 'execute', {
                command: trimmedCmd,
                sessionId,
                streaming: true,
                requestId: requestId,
                timestamp: Date.now()
            });

            return true;
        } catch (err) {
            console.error('命令执行失败:', err);

            // 添加错误消息
            setHistory(prev => [...prev, {
                type: 'error',
                text: `执行错误: ${err.message || '未知错误'}`
            }]);

            // 重置状态
            setActiveCommand(null);

            return false;
        }
    }, [agentUuid, sessionId, isOnline, activeCommand, commandCounter, endTerminalSession, sendCommand]);

    // 接收MQTT消息更新
    useEffect(() => {
        if (!sessionId || !agentUuid) return;

        console.log(`终端组件: 订阅代理 ${agentUuid} 的响应`);

        // 创建响应处理器 - 只处理当前代理的消息
        const handleMqttResponse = (topic, message) => {
            try {
                // 只处理当前会话的响应
                if (!message.sessionId || message.sessionId !== sessionId) return;

                // 从请求ID中提取命令ID
                const requestId = message.requestId || '';
                let commandId = null;

                if (requestId.startsWith('cmd-')) {
                    const parts = requestId.split('-');
                    if (parts.length >= 2) {
                        commandId = parseInt(parts[1]);
                    }
                }

                if (!commandId && activeCommand) {
                    commandId = activeCommand.id;
                }

                if (!commandId) {
                    console.warn('无法确定命令ID:', message);
                    return;
                }

                // 检查是否有输出或消息
                if (message.output !== undefined || message.message !== undefined) {
                    // 使用缓存存储完整输出，避免重复添加
                    const outputText = message.output || message.message || '';

                    // 首次响应时初始化缓存
                    if (!outputCache.current[commandId]) {
                        outputCache.current[commandId] = outputText;
                    }
                    // 否则追加到缓存
                    else if (!outputCache.current[commandId].includes(outputText)) {
                        outputCache.current[commandId] += outputText;
                    }

                    // 更新历史记录
                    setHistory(prev => {
                        // 查找现有响应
                        const existingIndex = prev.findIndex(
                            item => item.type === 'response' && item.commandId === commandId
                        );

                        const currentOutput = outputCache.current[commandId];

                        if (existingIndex >= 0) {
                            // 使用完整缓存更新现有响应，而不是追加
                            const updatedHistory = [...prev];
                            updatedHistory[existingIndex] = {
                                ...updatedHistory[existingIndex],
                                text: currentOutput,
                                success: message.success !== false
                            };
                            return updatedHistory;
                        } else {
                            // 创建新响应
                            return [...prev, {
                                type: 'response',
                                commandId,
                                text: currentOutput,
                                success: message.success !== false
                            }];
                        }
                    });
                }

                // 当收到final标志时，重置命令状态
                if (message.final === true) {
                    console.log(`命令 ${commandId} 执行完成，重置状态`);
                    setActiveCommand(null);

                    // 命令执行完成后聚焦输入框
                    if (inputRef.current) {
                        setTimeout(() => {
                            inputRef.current.focus();
                        }, 10);
                    }
                }
            } catch (err) {
                console.error('处理MQTT响应消息失败:', err);
                // 出错时也重置状态，防止界面卡住
                setActiveCommand(null);

                // 即使出错也要聚焦输入框
                if (inputRef.current) {
                    setTimeout(() => {
                        inputRef.current.focus();
                    }, 10);
                }
            }
        };

        // 订阅特定代理的响应
        const unsubscribe = useMqttStore.getState().subscribeToResponses(agentUuid, handleMqttResponse);

        // 组件卸载时取消订阅
        return () => {
            console.log(`终端组件: 取消订阅代理 ${agentUuid} 的响应`);
            unsubscribe();
        };
    }, [sessionId, agentUuid]);

    // 命令表单提交处理
    const handleSubmit = (e) => {
        e?.preventDefault();

        if (!command.trim() || activeCommand || !isOnline || !sessionId) {
            return;
        }

        executeCommand(command);
    };

    // 当组件挂载完成或活动命令状态变化时聚焦输入框
    useEffect(() => {
        // 组件挂载后
        if (isMountedRef.current && inputRef.current && !activeCommand) {
            inputRef.current.focus();
        }
    }, [activeCommand, sessionId]);

    // 清除历史记录
    const clearHistory = () => {
        setHistory([]);
    };

    // 复制历史到剪贴板
    const copyHistory = async () => {
        const text = history
            .map(item => {
                if (item.type === 'command') {
                    return `$ ${item.text}`;
                } else {
                    return item.text;
                }
            })
            .join('\n\n');

        try {
            await navigator.clipboard.writeText(text);
            setCopied(true);
            setTimeout(() => {
                if (isMountedRef.current) {
                    setCopied(false);
                }
            }, 2000);
        } catch (err) {
            console.error('复制到剪贴板失败:', err);
            setHistory(prev => [...prev, {
                type: 'error',
                text: '复制到剪贴板失败: ' + (err.message || '浏览器不支持')
            }]);
        }
    };

    // 显示错误状态
    if (error) {
        return (
            <div
                className="rounded-lg border border-red-200 dark:border-red-700 bg-red-50 dark:bg-red-900/20 p-4 text-red-700 dark:text-red-300">
                <div className="flex items-center mb-2">
                    <AlertTriangle className="w-5 h-5 mr-2"/>
                    <span className="font-medium">终端初始化失败</span>
                </div>
                <p>{error}</p>
                <button
                    onClick={() => setError(null)}
                    className="mt-3 bg-red-200 dark:bg-red-800 px-3 py-1 rounded text-red-700 dark:text-red-200 hover:bg-red-300 dark:hover:bg-red-700 transition-colors"
                >
                    重试
                </button>
            </div>
        );
    }

    return (
        <div
            className="rounded-lg border border-gray-200 dark:border-gray-700 bg-black text-white dark:bg-gray-900 overflow-hidden"
            ref={terminalRef}>
            {/* 终端标题栏 */}
            <div
                className="flex justify-between items-center px-4 py-2 bg-gray-800 dark:bg-gray-800 border-b border-gray-700">
                <div className="flex items-center">
                    <div className="flex space-x-2 mr-2">
                        <div className="w-3 h-3 rounded-full bg-red-500"></div>
                        <div className="w-3 h-3 rounded-full bg-yellow-500"></div>
                        <div className="w-3 h-3 rounded-full bg-green-500"></div>
                    </div>
                    <span className="text-sm font-medium flex items-center">
            <TerminalIcon className="w-4 h-4 mr-1"/>
            终端
          </span>
                    {mqttConnected && (
                        <span className="ml-2 text-xs px-1.5 py-0.5 bg-blue-600 text-white rounded-full">MQTT</span>
                    )}
                    {activeCommand && (
                        <span
                            className="ml-2 text-xs px-1.5 py-0.5 bg-gray-600 text-white rounded-full truncate max-w-32">
              {activeCommand.text.split(/\s+/)[0]}
            </span>
                    )}
                </div>
                <div className="flex space-x-2">
                    <button
                        onClick={copyHistory}
                        className="text-gray-400 hover:text-white p-1 rounded transition-colors"
                        disabled={history.length === 0}
                        title="复制内容"
                    >
                        {copied ? <CheckCheck size={16}/> : <Copy size={16}/>}
                    </button>
                    <button
                        onClick={clearHistory}
                        className="text-gray-400 hover:text-white p-1 rounded transition-colors"
                        disabled={history.length === 0}
                        title="清除历史"
                    >
                        <RotateCcw size={16}/>
                    </button>
                </div>
            </div>

            {/* 终端输出区域 */}
            <div
                className="p-4 h-[calc(50vh)] min-h-[300px] overflow-y-auto font-mono text-sm terminal-output"
                style={{backgroundColor: '#0D1117'}}
                ref={outputRef}
            >
                {history.length === 0 ? (
                    <div className="text-gray-400 italic">
                        {sessionId
                            ? '终端已准备就绪。输入命令并按回车执行。'
                            : '正在初始化终端会话...'}
                    </div>
                ) : (
                    history.map((item, index) => (
                        <div key={`${index}-${item.type}-${item.commandId || item.id || ''}`} className="mb-2">
                            {item.type === 'command' ? (
                                <div className="flex items-start">
                                    <span className="text-green-400 mr-2">$</span>
                                    <span className="break-all">{item.text}</span>
                                </div>
                            ) : item.type === 'response' ? (
                                <div className={`pl-4 border-l-2 ${
                                    item.success !== false
                                        ? 'border-green-500 text-gray-300'
                                        : 'border-red-500 text-red-300'
                                } whitespace-pre-wrap break-all`}
                                >
                                    {item.text}
                                </div>
                            ) : item.type === 'error' ? (
                                <div
                                    className="pl-4 border-l-2 border-red-500 text-red-300 whitespace-pre-wrap break-all">
                                    {item.text}
                                </div>
                            ) : (
                                <div className="pl-4 text-blue-300 whitespace-pre-wrap break-all">
                                    {item.text}
                                </div>
                            )}
                        </div>
                    ))
                )}

                <div ref={bottomRef}></div>
            </div>

            {/* 命令输入区域 */}
            <form onSubmit={handleSubmit}
                  className="flex items-center p-2 bg-gray-800 dark:bg-gray-800 border-t border-gray-700">
                <div className="text-green-400 mr-2">$</div>
                <input
                    ref={inputRef}
                    type="text"
                    value={command}
                    onChange={(e) => setCommand(e.target.value)}
                    placeholder={
                        isOnline
                            ? activeCommand
                                ? '命令执行中...'
                                : '输入命令...'
                            : '代理离线，无法执行命令'
                    }
                    disabled={!isOnline || activeCommand || !sessionId}
                    className="flex-1 bg-transparent border-none outline-none text-white placeholder-gray-500"
                    autoComplete="off"
                    spellCheck="false"
                    autoFocus
                />
                <button
                    type="submit"
                    disabled={!command.trim() || !isOnline || activeCommand || !sessionId}
                    className={`ml-2 p-1 rounded ${
                        !command.trim() || !isOnline || activeCommand || !sessionId
                            ? 'text-gray-500 cursor-not-allowed'
                            : 'text-blue-500 hover:text-blue-400'
                    }`}
                >
                    <Send size={16}/>
                </button>
            </form>
        </div>
    );
}
