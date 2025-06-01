'use client';

import React, {useEffect, useRef, useState, useCallback} from 'react';
import {Terminal} from '@xterm/xterm';
import {FitAddon} from '@xterm/addon-fit';
import {WebLinksAddon} from '@xterm/addon-web-links';
import {SearchAddon} from '@xterm/addon-search';
import {v4 as uuidv4} from 'uuid';
import useMqttStore from '@/store/mqttStore';
import {AlertCircle, Maximize2, Minimize2, Eraser, Square} from 'lucide-react';
import '@xterm/xterm/css/xterm.css';
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

            try {
                // 终端始终使用优化的暗色主题，更适合开发者使用
                const terminalTheme = {
                    background: '#0f172a', // slate-900 - 深色但不会太黑
                    foreground: '#ffffff', // 纯白色 - 更鲜亮的前景色
                    cursor: '#60a5fa', // blue-400 - 主题蓝色光标
                    selection: 'rgba(96, 165, 250, 0.3)', // blue-400 with opacity
                    black: '#0f172a', // slate-900
                    red: '#ff6b6b', // 更鲜亮的红色
                    green: '#51cf66', // 更鲜亮的绿色
                    yellow: '#ffd43b', // 更鲜亮的黄色
                    blue: '#74c0fc', // 更鲜亮的蓝色
                    magenta: '#d0bfff', // 更鲜亮的紫色
                    cyan: '#3bc9db', // 更鲜亮的青色
                    white: '#ffffff', // 纯白色
                    brightBlack: '#868e96', // 更亮的灰色
                    brightRed: '#ff8787', // 更亮的红色
                    brightGreen: '#8ce99a', // 更亮的绿色
                    brightYellow: '#ffec99', // 更亮的黄色
                    brightBlue: '#91a7ff', // 更亮的蓝色
                    brightMagenta: '#e599f7', // 更亮的紫色
                    brightCyan: '#66d9ef', // 更亮的青色
                    brightWhite: '#ffffff' // 纯白色 - 最亮的白色
                };

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
                    theme: terminalTheme
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
                }
            }

            if (resizeObserverRef.current) {
                resizeObserverRef.current.disconnect();
            }

            // 清理终端实例
            if (terminalInstanceRef.current) {
                try {
                    terminalInstanceRef.current.dispose();
                    terminalInstanceRef.current = null;
                } catch (e) {
                }
            }

            // 清理处理过的消息集合
            processedMessagesRef.current.clear();
        };
    }, [isActive, isFullscreen]);

    // 前向声明函数
    const sendTerminalDataRef = useRef();
    const resizeTerminalRef = useRef();

    // 初始化连接函数声明提前
    const initializeConnection = useCallback(async () => {
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
                // 使用ref方式调用函数，避免循环依赖
                if (terminalInstanceRef.current) {
                    // 设置终端输入处理
                    if (typeof sendTerminalDataRef.current === 'function') {
                        sendTerminalDataRef.current(newSessionId);
                    }

                    // 发送初始的调整大小命令
                    const {cols, rows} = terminalInstanceRef.current;
                    if (typeof resizeTerminalRef.current === 'function') {
                        resizeTerminalRef.current(cols, rows);
                    }
                }

                toast.success('连接成功');
            } else {
                throw new Error(result?.message || '连接失败');
            }
        } catch (error) {
            setError(error.message || '连接失败');
            toast.error(`连接失败: ${error.message || '未知错误'}`);

            if (terminalInstanceRef.current) {
                terminalInstanceRef.current.writeln(`\r\n\x1b[31m错误: ${error.message || '连接失败'}\x1b[0m`);
            }

            setSessionId(null);
        } finally {
            setIsConnecting(false);
        }
    }, [agentUuid, mqttConnected, connect]);

    // 初始化MQTT连接
    useEffect(() => {
        // 只有在组件激活和终端准备好的情况下才连接
        if (isActive && isReady && agentUuid && !isConnecting && !sessionId) {
            initializeConnection();
        }
    }, [isActive, isReady, agentUuid, mqttConnected, isConnecting, sessionId, initializeConnection]);

    // 检查输出是否包含命令提示符
    const containsPrompt = useCallback((text) => {
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
    }, []);

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
                // 静默忽略重复消息
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


    // 设置终端输入处理
    const setupTerminalInput = useCallback((termSessionId) => {
        if (!terminalInstanceRef.current || !termSessionId) return;

        // 创建发送函数
        const sendInput = (input) => {
            if (mqttConnected) {
                useMqttStore.getState().sendTerminalInput(agentUuid, termSessionId, input)
                    .catch(() => {
                        // 忽略所有错误，提高用户体验
                    });
            }
        };

        // 使用防抖函数
        const debouncedSend = debounce(sendInput, 5);

        // 监听终端输入
        terminalInstanceRef.current.onData(data => {
            // 如果是回车键，可能是发送命令
            if (data === '\r') {
                setFirstCommand(false);
            }

            // 使用防抖函数发送输入数据到MQTT
            debouncedSend(data);
        });
    }, [mqttConnected, agentUuid]);

    // 更新ref引用
    useEffect(() => {
        sendTerminalDataRef.current = setupTerminalInput;
    }, [setupTerminalInput]);

    // 发送调整大小命令
    const sendResizeCommand = useCallback((cols, rows) => {
        if (!sessionId || !mqttConnected || !agentUuid || !cols || !rows) return;

        // 确保尺寸值合理
        if (cols <= 0 || rows <= 0 || isNaN(cols) || isNaN(rows)) {
            return;
        }

        useMqttStore.getState().resizeTerminal(agentUuid, sessionId, cols, rows)
            .catch(() => {
                // 忽略调整大小错误
            });
    }, [sessionId, mqttConnected, agentUuid]);

    // 更新resize命令的ref引用
    useEffect(() => {
        resizeTerminalRef.current = sendResizeCommand;
    }, [sendResizeCommand]);


    // 重新连接
    const reconnect = useCallback(async () => {
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
    }, [initializeConnection]);

    // 创建简单防抖函数
    function debounce(func, wait) {
        let timeout;
        return function(...args) {
            clearTimeout(timeout);
            timeout = setTimeout(() => {
                func.apply(this, args);
            }, wait);
        };
    }

    // 发送Ctrl+C（SIGINT）
    const sendCtrlC = useCallback(() => {
        if (!sessionId || !mqttConnected || !agentUuid) return;

        // 发送Ctrl+C字符（ASCII 3）
        useMqttStore.getState().sendTerminalInput(agentUuid, sessionId, '\x03')
            .catch(() => {
                // 完全忽略错误，不显示任何提示
            });
    }, [sessionId, mqttConnected, agentUuid]);

    // 切换全屏模式
    const toggleFullscreen = useCallback(() => {
        const newFullscreenState = !isFullscreen;
        setIsFullscreen(newFullscreenState);

        // 查找终端的父容器
        const terminalContainer = terminalRef.current?.parentElement;
        if (!terminalContainer) {
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
            console.warn('切换全屏时出错:', e);
        }

        // 在状态改变后安全地调整终端大小，增加延迟确保DOM更新完成
        setTimeout(() => {
            if (fitAddonRef.current && terminalRef.current && terminalInstanceRef.current) {
                try {
                    // 新版本xterm需要重新fit才能正确显示
                    fitAddonRef.current.fit();
                    
                    // 强制重新渲染整个终端
                    terminalInstanceRef.current.refresh(0, terminalInstanceRef.current.rows - 1);
                    
                    // 再次fit确保尺寸正确
                    setTimeout(() => {
                        fitAddonRef.current?.fit();
                        
                        // 发送调整大小命令
                        if (sessionId && mqttConnected && terminalInstanceRef.current) {
                            try {
                                const {cols, rows} = terminalInstanceRef.current;
                                sendResizeCommand(cols, rows);
                            } catch (error) {
                                console.warn('发送resize命令失败:', error);
                            }
                        }
                    }, 100);
                } catch (error) {
                    console.warn('终端resize失败:', error);
                }
            }
        }, 300);
    }, [isFullscreen, sessionId, mqttConnected, sendResizeCommand]);

    // 只有在组件激活时渲染
    if (!isActive) return null;


    return (
        <div
            className="h-full w-full flex flex-col overflow-hidden"
            style={{padding: 0, borderRadius: '0.375rem'}}>
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
                {/* 控制按钮组和状态指示器合并在一行 */}
                <div className="terminal-controls">
                    {/* 状态指示器 - 放在左侧 */}
                    {sessionId && (
                        <div className="terminal-status">
                            <div
                                className={`status-indicator ${isTyping ? 'typing' : (mqttConnected ? 'connected' : 'disconnected')}`}></div>
                            <span>{isTyping ? '输入中...' : (mqttConnected ? '已连接' : '已断开')}</span>
                        </div>
                    )}
                    
                    {/* Ctrl+C 按钮 */}
                    <button
                        onClick={sendCtrlC}
                        className="text-gray-400 hover:text-white bg-gray-700 hover:bg-gray-600 rounded-full p-1"
                        title="发送 Ctrl+C (SIGINT)"
                    >
                        <Square className="w-5 h-5" />
                    </button>

                    {/* 清空终端按钮 */}
                    <button
                        onClick={useCallback(() => {
                            if (terminalInstanceRef.current) {
                                terminalInstanceRef.current.clear();
                            }
                        }, [terminalInstanceRef])}
                        className="text-gray-400 hover:text-white bg-gray-700 hover:bg-gray-600 rounded-full p-1"
                        title="清空终端"
                    >
                        <Eraser className="w-5 h-5"/>
                    </button>

                    {/* 全屏按钮 */}
                    <button
                        onClick={toggleFullscreen}
                        className="text-gray-400 hover:text-white bg-gray-700 hover:bg-gray-600 rounded-full p-1"
                        title={isFullscreen ? '退出全屏' : '全屏模式'}
                    >
                        {isFullscreen ? <Minimize2 className="w-5 h-5"/> : <Maximize2 className="w-5 h-5"/>}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default MqttTerminal;
