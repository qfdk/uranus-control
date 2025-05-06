'use client';

import React, {useEffect, useRef, useState} from 'react';
import {Terminal} from 'xterm';
import {FitAddon} from 'xterm-addon-fit';
import {WebLinksAddon} from 'xterm-addon-web-links';
import {SearchAddon} from 'xterm-addon-search';
import {v4 as uuidv4} from 'uuid';
import useMqttStore from '@/store/mqttStore';
import {AlertCircle, Maximize2, Minimize2, XCircle} from 'lucide-react';
import 'xterm/css/xterm.css';
import './terminal.css';
import toast from 'react-hot-toast';
import { safelyFit, createSafeResizeObserver } from './terminal-fix';

const MqttTerminal = ({agentUuid, isActive = true}) => {
    // 全屏状态
    const [isFullscreen, setIsFullscreen] = useState(false);
    // 终端DOM引用
    const terminalRef = useRef(null);
    const fitAddonRef = useRef(null);
    const searchAddonRef = useRef(null);
    const terminalInstanceRef = useRef(null);
    const resizeObserverRef = useRef(null);
    const prevOverflowStyleRef = useRef(null); // 存储原来的overflow样式

    // 状态管理
    const [error, setError] = useState(null);
    const [isConnecting, setIsConnecting] = useState(false);
    const [sessionId, setSessionId] = useState(null);
    const [isReady, setIsReady] = useState(false);
    const [resizing, setResizing] = useState(false);
    const [firstCommand, setFirstCommand] = useState(true);

    // 用于防止重复处理消息
    const processedMessagesRef = useRef(new Set());
    // 用于跟踪最后收到的输出
    const lastOutputRef = useRef('');
    // 终端状态
    const [isTyping, setIsTyping] = useState(false);
    const typingTimeoutRef = useRef(null);

    // MQTT连接状态
    const {connected: mqttConnected, connect} = useMqttStore();

    // 初始化xterm
    useEffect(() => {
        let terminal = null;
        let fitAddon = null;
        let searchAddon = null;
        let webLinksAddon = null;

        // 只在组件激活时初始化终端
        if (isActive && terminalRef.current && !terminalInstanceRef.current) {
            console.log('初始化xterm终端');

            try {
                // 创建终端实例
                terminal = new Terminal({
                    cursorBlink: true,
                    cursorStyle: 'bar',
                    fontFamily: 'Menlo, Monaco, "Courier New", monospace',
                    fontSize: 14,
                    lineHeight: 1.5,
                    letterSpacing: 0.5,
                    convertEol: true,
                    scrollback: 5000,
                    padding: 0,
                    theme: {
                        background: '#1e1e1e',
                        foreground: '#f0f0f0',
                        cursor: '#f0f0f0',
                        selection: 'rgba(255, 255, 255, 0.3)',
                        black: '#000000',
                        red: '#cd3131',
                        green: '#0dbc79',
                        yellow: '#e5e510',
                        blue: '#2472c8',
                        magenta: '#bc3fbc',
                        cyan: '#11a8cd',
                        white: '#e5e5e5',
                        brightBlack: '#666666',
                        brightRed: '#f14c4c',
                        brightGreen: '#23d18b',
                        brightYellow: '#f5f543',
                        brightBlue: '#3b8eea',
                        brightMagenta: '#d670d6',
                        brightCyan: '#29b8db',
                        brightWhite: '#ffffff'
                    }
                });

                // 创建插件
                fitAddon = new FitAddon();
                searchAddon = new SearchAddon();
                webLinksAddon = new WebLinksAddon();

                // 加载插件
                terminal.loadAddon(fitAddon);
                terminal.loadAddon(searchAddon);
                terminal.loadAddon(webLinksAddon);

                // 直接打开终端，不调用fit
                terminal.open(terminalRef.current);
                
                // 存储引用
                terminalInstanceRef.current = terminal;
                fitAddonRef.current = fitAddon;
                searchAddonRef.current = searchAddon;

                // 设置初始化完成标志
                setIsReady(true);
                
                // 使用安全的调整大小方法
                setTimeout(() => {
                    safelyFit(fitAddon, terminalRef.current);
                }, 100);

                // 创建安全的大小调整观察器
                const resizeObserver = createSafeResizeObserver(fitAddon, terminalRef.current, () => {
                    if (sessionId && mqttConnected && terminalInstanceRef.current) {
                        try {
                            const {cols, rows} = terminalInstanceRef.current;
                            sendResizeCommand(cols, rows);
                        } catch (error) {
                            console.log('调整大小失败，忽略错误:', error.message);
                        }
                    }
                });
                
                // 设置引用
                resizeObserverRef.current = resizeObserver;

                // 设置终端数据处理事件
                terminal.onData(() => {
                    // 显示输入状态指示器
                    setIsTyping(true);

                    // 清除之前的超时
                    if (typingTimeoutRef.current) {
                        clearTimeout(typingTimeoutRef.current);
                    }

                    // 设置新的超时，500ms 后隐藏输入状态
                    typingTimeoutRef.current = setTimeout(() => {
                        setIsTyping(false);
                    }, 500);
                });
            } catch (error) {
                console.error('xterm初始化失败:', error);
                setError('xterm初始化失败: ' + error.message);
            }
        }

        // 卸载时清理
        return () => {
            // 如果处于全屏模式，恢复页面滚动状态
            if (isFullscreen) {
                try {
                    document.documentElement.style.overflow = prevOverflowStyleRef.current || '';
                } catch (e) {
                    console.error('恢复页面滚动状态失败:', e);
                }
            }

            if (resizeObserverRef.current) {
                resizeObserverRef.current.disconnect();
            }

            // 不再发送关闭会话命令，防止后端关闭
            // 直接清理终端实例
            if (terminalInstanceRef.current) {
                try {
                    terminalInstanceRef.current.dispose();
                    terminalInstanceRef.current = null;
                } catch (e) {
                    console.error('清理终端实例失败:', e);
                }
            }

            // 清理处理过的消息集合
            processedMessagesRef.current.clear();
        };
    }, [isActive]);

    // 初始化MQTT连接
    useEffect(() => {
        // 只有在组件激活和终端准备好的情况下才连接
        if (isActive && isReady && agentUuid && !isConnecting && !sessionId) {
            initializeConnection();
        }
    }, [isActive, isReady, agentUuid, mqttConnected]);

    // 检查输出是否包含命令提示符
    const containsPrompt = (text) => {
        // 检测常见的命令提示符模式
        const promptPatterns = [
            /\$\s*$/,                // $
            />\s*$/,                 // >
            /#\s*$/,                 // #
            /\w+@\w+:.*\$\s*$/,      // user@host:path$
            /\w+@\w+:.*#\s*$/,       // user@host:path#
            /\[\w+@\w+.*\]\$\s*$/,   // [user@host path]$
            /\[\w+@\w+.*\]#\s*$/     // [user@host path]#
        ];

        return promptPatterns.some(pattern => pattern.test(text));
    };

    // 处理MQTT终端消息
    useEffect(() => {
        if (!sessionId) return;

        // 设置终端消息处理回调
        const unsubscribe = useMqttStore.getState().setTerminalCallback(sessionId, (message) => {
            if (!terminalInstanceRef.current) return;

            // 生成消息唯一标识（使用类型和时间戳）
            const messageId = `${message.type}-${message.timestamp}`;

            // 检查是否是重复消息
            if (processedMessagesRef.current.has(messageId)) {
                console.log('忽略重复消息:', messageId);
                return;
            }

            // 添加到已处理消息集合
            processedMessagesRef.current.add(messageId);

            // 设置一个定时器，一段时间后从已处理集合中删除，避免集合无限增长
            setTimeout(() => {
                processedMessagesRef.current.delete(messageId);
            }, 5000);

            if (message.type === 'output' && message.data) {
                const outputData = message.data;

                // 检查是否包含命令提示符
                const hasPrompt = containsPrompt(outputData);
                const isFirstPrompt = firstCommand && hasPrompt;

                // 如果是首次命令提示符，确保有换行
                if (isFirstPrompt) {
                    // 确保在第一个命令提示符前有换行
                    if (!outputData.startsWith('\r\n') && !outputData.startsWith('\n')) {
                        terminalInstanceRef.current.write('\r\n');
                    }
                    setFirstCommand(false);
                }

                // 记录最后的输出
                lastOutputRef.current = outputData;

                // 写入输出数据
                terminalInstanceRef.current.write(outputData);
            } else if (message.type === 'error') {
                // 写入错误信息
                terminalInstanceRef.current.writeln(`\r\n\x1b[31m错误: ${message.data || '未知错误'}\x1b[0m`);
                setError(message.data || '终端错误');
            } else if (message.type === 'closed') {
                // 会话已关闭
                terminalInstanceRef.current.writeln('\r\n\x1b[33m连接已断开\x1b[0m');
                setSessionId(null);
            }
        });

        // 组件卸载时清除回调
        return () => {
            unsubscribe();
        };
    }, [sessionId, firstCommand]);

    // 初始化连接
    const initializeConnection = async () => {
        if (isConnecting || !agentUuid) return;

        setIsConnecting(true);
        setError(null);
        setFirstCommand(true);

        try {
            // 确保MQTT已连接
            if (!mqttConnected) {
                await connect();
            }

            // 创建唯一会话ID
            const newSessionId = `term-${uuidv4()}`;
            setSessionId(newSessionId);

            // 发送创建会话命令
            const result = await useMqttStore.getState().createTerminalSession(agentUuid, newSessionId);

            if (result && result.success) {
                // 设置终端输入处理
                setupTerminalInput(newSessionId);

                // 发送初始的调整大小命令
                if (terminalInstanceRef.current) {
                    const {cols, rows} = terminalInstanceRef.current;
                    sendResizeCommand(cols, rows);
                }

                toast.success('连接成功');
            } else {
                throw new Error(result?.message || '连接失败');
            }
        } catch (error) {
            console.error('初始化终端连接失败:', error);
            setError(error.message || '连接失败');
            toast.error(`连接失败: ${error.message || '未知错误'}`);

            if (terminalInstanceRef.current) {
                terminalInstanceRef.current.writeln(`\r\n\x1b[31m错误: ${error.message || '连接失败'}\x1b[0m`);
            }

            setSessionId(null);
        } finally {
            setIsConnecting(false);
        }
    };

    // 设置终端输入处理
    const setupTerminalInput = (termSessionId) => {
        if (!terminalInstanceRef.current || !termSessionId) return;

        // 监听终端输入
        terminalInstanceRef.current.onData(data => {
            // 如果是回车键，可能是发送命令
            if (data === '\r') {
                setFirstCommand(false);
            }

            // 发送输入数据到MQTT
            if (mqttConnected) {
                useMqttStore.getState().sendTerminalInput(agentUuid, termSessionId, data)
                    .catch(error => {
                        // 忽略会话ID已存在的错误，因为可能是重复发送
                        if (!error.message.includes('会话ID已存在')) {
                            console.error('发送终端输入失败:', error);
                        }
                    });
            }
        });
    };

    // 发送调整大小命令
    const sendResizeCommand = (cols, rows) => {
        if (!sessionId || !mqttConnected || !agentUuid || !cols || !rows) return;

        // 确保尺寸值合理
        if (cols <= 0 || rows <= 0 || isNaN(cols) || isNaN(rows)) {
            console.warn(`无效的终端尺寸值: ${cols}x${rows}`);
            return;
        }

        console.log(`调整终端大小: ${cols}x${rows}`);

        useMqttStore.getState().resizeTerminal(agentUuid, sessionId, cols, rows)
            .catch(error => {
                // 忽略会话ID已存在的错误，因为可能是重复发送
                if (!error.message.includes('会话ID已存在')) {
                    console.error('发送调整大小命令失败:', error);
                }
            });
    };

    // 关闭终端会话
    const closeTerminalSession = async () => {
        if (!sessionId || !mqttConnected || !agentUuid) return;

        try {
            await useMqttStore.getState().closeTerminalSession(agentUuid, sessionId);
            console.log('终端会话已关闭:', sessionId);
        } catch (error) {
            console.error('关闭终端会话失败:', error);
        }
    };

    // 重新连接
    const reconnect = async () => {
        // 不再发送关闭会话命令，防止后端关闭
        
        // 清空终端
        if (terminalInstanceRef.current) {
            terminalInstanceRef.current.clear();
        }

        // 清理处理过的消息集合
        processedMessagesRef.current.clear();

        // 重置首次命令标记
        setFirstCommand(true);

        setError(null);
        initializeConnection();
    };

    // 防抖函数
    function debounce(func, wait) {
        let timeout;
        return function executedFunction(...args) {
            const later = () => {
                clearTimeout(timeout);
                func(...args);
            };
            clearTimeout(timeout);
            timeout = setTimeout(later, wait);
        };
    }

    // 切换全屏模式
    const toggleFullscreen = () => {
        const newFullscreenState = !isFullscreen;
        setIsFullscreen(newFullscreenState);

        const terminalContainer = terminalRef.current?.closest('.terminal-container');
        if(!terminalContainer) {
            console.error('找不到终端容器');
            return;
        }

        try {
            if (newFullscreenState) {
                // 进入全屏模式
                prevOverflowStyleRef.current = document.documentElement.style.overflow;
                document.documentElement.style.overflow = 'hidden';

                // 添加全屏样式
                terminalContainer.classList.add('fullscreen-terminal');
                document.body.classList.add('terminal-fullscreen-mode');
            } else {
                // 退出全屏模式
                document.documentElement.style.overflow = prevOverflowStyleRef.current || '';

                // 移除全屏样式
                terminalContainer.classList.remove('fullscreen-terminal');
                document.body.classList.remove('terminal-fullscreen-mode');
            }
        } catch (e) {
            console.error('设置全屏模式样式失败:', e);
        }

        // 在状态改变后安全地调整终端大小
        setTimeout(() => {
            if (fitAddonRef.current) {
                safelyFit(fitAddonRef.current, terminalRef.current);
                
                // 发送调整大小命令
                if (sessionId && mqttConnected && terminalInstanceRef.current) {
                    try {
                        const {cols, rows} = terminalInstanceRef.current;
                        sendResizeCommand(cols, rows);
                    } catch (error) {
                        console.log('全屏切换时调整大小失败:', error.message);
                    }
                }
            }
        }, 300); // 增加延迟确保样式变化完成
    };

    // 只有在组件激活时渲染
    if (!isActive) return null;

    return (
        <div
            className="h-full w-full flex flex-col overflow-hidden"
            style={{padding: 0, backgroundColor: '#1e1e1e', borderRadius: '0.375rem'}}>
            {/* 错误提示 */}
            {error && (
                <div
                    className="absolute top-0 left-0 right-0 bg-red-500 text-white px-4 py-2 flex items-center justify-between z-10">
                    <div className="flex items-center">
                        <AlertCircle className="w-4 h-4 mr-2"/>
                        <span>{error}</span>
                    </div>
                    <button
                        onClick={reconnect}
                        className="ml-2 bg-red-600 hover:bg-red-700 text-white py-1 px-2 rounded text-xs"
                    >
                        重新连接
                    </button>
                </div>
            )}

            {/* 终端容器 */}
            <div
                ref={terminalRef}
                className={`flex-1 ${error ? 'pt-10' : ''} relative`}
                style={{width: '100%', height: '100%', overflow: 'hidden', backgroundColor: '#1e1e1e', borderRadius: '0.375rem'}}
            >
                {/* 控制按钮组 */}
                <div className="terminal-controls">
                    {/* 全屏按钮 */}
                    <button
                        onClick={toggleFullscreen}
                        className="text-gray-400 hover:text-white bg-gray-700 hover:bg-gray-600 rounded-full p-1"
                        title={isFullscreen ? '退出全屏' : '全屏模式'}
                    >
                        {isFullscreen ? <Minimize2 className="w-5 h-5"/> : <Maximize2 className="w-5 h-5"/>}
                    </button>

                {/* 关闭按钮 */}
                    <button
                        onClick={() => {
                            // 仅清空终端，不发送关闭命令
                            if (terminalInstanceRef.current) {
                                terminalInstanceRef.current.clear();
                                terminalInstanceRef.current.writeln('\x1b[33m终端已清空\x1b[0m');
                            }
                        }}
                        className="text-gray-400 hover:text-white bg-gray-700 hover:bg-gray-600 rounded-full p-1"
                        title="清空终端"
                    >
                        <XCircle className="w-5 h-5"/>
                    </button>
                </div>

                {/* 状态指示器 */}
                {sessionId && (
                    <div className="terminal-status">
                        <div
                            className={`status-indicator ${isTyping ? 'typing' : (mqttConnected ? 'connected' : 'disconnected')}`}></div>
                        <span>{isTyping ? '输入中...' : (mqttConnected ? '已连接' : '已断开')}</span>
                    </div>
                )}
            </div>
        </div>
    );
};

export default MqttTerminal;
