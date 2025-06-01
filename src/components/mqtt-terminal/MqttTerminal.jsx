'use client';

import React, {useEffect, useRef, useState, useCallback} from 'react';
import {Terminal} from '@xterm/xterm';
import {FitAddon} from '@xterm/addon-fit';
import {WebLinksAddon} from '@xterm/addon-web-links';
import {SearchAddon} from '@xterm/addon-search';
import {v4 as uuidv4} from 'uuid';
import useMqttStore from '@/store/mqttStore';
import {AlertCircle, Eraser, Square, Maximize2, Minimize2} from 'lucide-react';
import '@xterm/xterm/css/xterm.css';
import './terminal.css';
import toast from 'react-hot-toast';
import { safelyFit, createSafeResizeObserver } from './terminal-fix';

const MqttTerminal = ({agentUuid, isActive = true}) => {
    const [isFullscreen, setIsFullscreen] = useState(false);
    const terminalRef = useRef(null);
    const fitAddonRef = useRef(null);
    const searchAddonRef = useRef(null);
    const terminalInstanceRef = useRef(null);
    const resizeObserverRef = useRef(null);

    const [error, setError] = useState(null);
    const [isConnecting, setIsConnecting] = useState(false);
    const [sessionId, setSessionId] = useState(null);
    const [isReady, setIsReady] = useState(false);
    const [firstCommand, setFirstCommand] = useState(true);

    const processedMessagesRef = useRef(new Set());
    const [isTyping, setIsTyping] = useState(false);
    const typingTimeoutRef = useRef(null);

    const {connected: mqttConnected, connect} = useMqttStore();

    useEffect(() => {
        let terminal = null;
        let fitAddon = null;
        let searchAddon = null;
        let webLinksAddon = null;

        if (isActive && terminalRef.current && !terminalInstanceRef.current) {

            try {
                const terminalTheme = {
                    background: '#0f172a',
                    foreground: '#ffffff',
                    cursor: '#60a5fa',
                    selection: 'rgba(96, 165, 250, 0.3)',
                    black: '#0f172a',
                    red: '#ff6b6b',
                    green: '#51cf66',
                    yellow: '#ffd43b',
                    blue: '#74c0fc',
                    magenta: '#d0bfff',
                    cyan: '#3bc9db',
                    white: '#ffffff',
                    brightBlack: '#868e96',
                    brightRed: '#ff8787',
                    brightGreen: '#8ce99a',
                    brightYellow: '#ffec99',
                    brightBlue: '#91a7ff',
                    brightMagenta: '#e599f7',
                    brightCyan: '#66d9ef',
                    brightWhite: '#ffffff'
                };

                terminal = new Terminal({
                    cursorBlink: true,
                    cursorStyle: 'bar',
                    fontFamily: 'Menlo, Monaco, "Courier New", monospace',
                    fontSize: 14,
                    lineHeight: 1.4,
                    letterSpacing: 0,
                    convertEol: true,
                    scrollback: 5000,
                    padding: 0,
                    allowTransparency: false,
                    windowOptions: {
                        setWinSizePixels: false,
                        setWinSizeChars: true
                    },
                    theme: terminalTheme
                });

                fitAddon = new FitAddon();
                searchAddon = new SearchAddon();
                webLinksAddon = new WebLinksAddon();

                terminal.loadAddon(fitAddon);
                terminal.loadAddon(searchAddon);
                terminal.loadAddon(webLinksAddon);

                terminal.open(terminalRef.current);
                
                terminalInstanceRef.current = terminal;
                fitAddonRef.current = fitAddon;
                searchAddonRef.current = searchAddon;

                setIsReady(true);
                
                requestAnimationFrame(() => {
                    if (fitAddon && terminalRef.current) {
                        fitAddon.fit();
                    }
                });

                const resizeObserver = createSafeResizeObserver(fitAddon, terminalRef.current, () => {
                    if (sessionId && mqttConnected && terminalInstanceRef.current) {
                        try {
                            const {cols, rows} = terminalInstanceRef.current;
                            sendResizeCommand(cols, rows);
                        } catch (error) {
                        }
                    }
                });
                
                resizeObserverRef.current = resizeObserver;

                terminal.onData(() => {
                    setIsTyping(true);

                    if (typingTimeoutRef.current) {
                        clearTimeout(typingTimeoutRef.current);
                    }

                    typingTimeoutRef.current = setTimeout(() => {
                        setIsTyping(false);
                    }, 500);
                });
            } catch (error) {
                setError('xterm初始化失败: ' + error.message);
            }
        }

        return () => {
            if (resizeObserverRef.current) {
                resizeObserverRef.current.disconnect();
            }

            if (terminalInstanceRef.current) {
                try {
                    terminalInstanceRef.current.dispose();
                    terminalInstanceRef.current = null;
                } catch (e) {
                }
            }

            processedMessagesRef.current.clear();
        };
    }, [isActive]);


    const initializeConnection = useCallback(async () => {
        if (isConnecting || !agentUuid) return;

        setIsConnecting(true);
        setError(null);
        setFirstCommand(true);

        try {
            if (!mqttConnected) {
                await connect();
            }

            const newSessionId = `term-${uuidv4()}`;
            setSessionId(newSessionId);

            const result = await useMqttStore.getState().createTerminalSession(agentUuid, newSessionId);

            if (result && result.success) {
                setupTerminalInput(newSessionId);

                if (terminalInstanceRef.current) {

                    const {cols, rows} = terminalInstanceRef.current;
                    sendResizeCommand(cols, rows);
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

    useEffect(() => {
        if (isActive && isReady && agentUuid && !isConnecting && !sessionId) {
            initializeConnection();
        }
    }, [isActive, isReady, agentUuid, mqttConnected, isConnecting, sessionId, initializeConnection]);

    const containsPrompt = useCallback((text) => {
        const promptPatterns = [
            /\$\s*$/,
            />\s*$/,
            /#\s*$/,
            /\w+@\w+:.*\$\s*$/,
            /\w+@\w+:.*#\s*$/,
            /\[\w+@\w+.*\]\$\s*$/,
            /\[\w+@\w+.*\]#\s*$/
        ];

        return promptPatterns.some(pattern => pattern.test(text));
    }, []);

    useEffect(() => {
        if (!sessionId) return;

        const unsubscribe = useMqttStore.getState().setTerminalCallback(sessionId, (message) => {
            if (!terminalInstanceRef.current) return;

            const messageId = `${message.type}-${message.timestamp}`;

            if (processedMessagesRef.current.has(messageId)) {
                return;
            }

            processedMessagesRef.current.add(messageId);

            setTimeout(() => {
                processedMessagesRef.current.delete(messageId);
            }, 5000);

            if (message.type === 'output' && message.data) {
                const outputData = message.data;

                const hasPrompt = containsPrompt(outputData);
                const isFirstPrompt = firstCommand && hasPrompt;

                if (isFirstPrompt) {
                    if (!outputData.startsWith('\r\n') && !outputData.startsWith('\n')) {
                        terminalInstanceRef.current.write('\r\n');
                    }
                    setFirstCommand(false);
                }

                terminalInstanceRef.current.write(outputData);
            } else if (message.type === 'error') {
                terminalInstanceRef.current.writeln(`\r\n\x1b[31m错误: ${message.data || '未知错误'}\x1b[0m`);
                setError(message.data || '终端错误');
            } else if (message.type === 'closed') {
                terminalInstanceRef.current.writeln('\r\n\x1b[33m连接已断开\x1b[0m');
                setSessionId(null);
            }
        });

        return () => {
            unsubscribe();
        };
    }, [sessionId, firstCommand]);


    const setupTerminalInput = useCallback((termSessionId) => {
        if (!terminalInstanceRef.current || !termSessionId) return;

        const sendInput = (input) => {
            if (mqttConnected) {
                useMqttStore.getState().sendTerminalInput(agentUuid, termSessionId, input)
                    .catch(() => {
                    });
            }
        };

        // 使用防抖函数
        const debouncedSend = debounce(sendInput, 5);

        terminalInstanceRef.current.onData(data => {
            if (data === '\r') {
                setFirstCommand(false);
            }

            debouncedSend(data);
        });
    }, [mqttConnected, agentUuid]);


    const sendResizeCommand = useCallback((cols, rows) => {
        if (!sessionId || !mqttConnected || !agentUuid || !cols || !rows) return;

        if (cols <= 0 || rows <= 0 || isNaN(cols) || isNaN(rows)) {
            return;
        }

        useMqttStore.getState().resizeTerminal(agentUuid, sessionId, cols, rows)
            .catch(() => {
            });
    }, [sessionId, mqttConnected, agentUuid]);



    const reconnect = useCallback(async () => {
        if (terminalInstanceRef.current) {
            terminalInstanceRef.current.clear();
        }

        processedMessagesRef.current.clear();

        setFirstCommand(true);

        setError(null);
        initializeConnection();
    }, [initializeConnection]);

    function debounce(func, wait) {
        let timeout;
        return function(...args) {
            clearTimeout(timeout);
            timeout = setTimeout(() => {
                func.apply(this, args);
            }, wait);
        };
    }

    const sendCtrlC = useCallback(() => {
        if (!sessionId || !mqttConnected || !agentUuid) return;

        useMqttStore.getState().sendTerminalInput(agentUuid, sessionId, '\x03')
            .catch(() => {
            });
    }, [sessionId, mqttConnected, agentUuid]);

    const toggleFullscreen = useCallback(() => {
        const newFullscreenState = !isFullscreen;
        setIsFullscreen(newFullscreenState);
        
        const performResize = () => {
            if (fitAddonRef.current && terminalRef.current) {
                safelyFit(fitAddonRef.current, terminalRef.current);
                
                if (sessionId && mqttConnected && terminalInstanceRef.current) {
                    try {
                        const {cols, rows} = terminalInstanceRef.current;
                        useMqttStore.getState().resizeTerminal(agentUuid, sessionId, cols, rows)
                            .catch(() => {
                            });
                    } catch (error) {
                    }
                }
            }
        };
        
        setTimeout(performResize, 100);
        setTimeout(performResize, 300);
    }, [isFullscreen, sessionId, mqttConnected, agentUuid]);

    // 全屏容器ref回调
    const fullscreenContainerRef = useCallback((node) => {
        // 当全屏容器渲染完成后立即调整终端大小
        if (node && fitAddonRef.current && terminalRef.current) {
            setTimeout(() => {
                safelyFit(fitAddonRef.current, terminalRef.current);
                if (sessionId && mqttConnected && terminalInstanceRef.current) {
                    try {
                        const {cols, rows} = terminalInstanceRef.current;
                        useMqttStore.getState().resizeTerminal(agentUuid, sessionId, cols, rows)
                            .catch(() => {
                            });
                    } catch (error) {
                    }
                }
            }, 10);
        }
    }, [sessionId, mqttConnected, agentUuid]);

    // 普通模式容器ref回调
    const normalContainerRef = useCallback((node) => {
        // 当普通容器渲染完成后立即调整终端大小
        if (node && fitAddonRef.current && terminalRef.current) {
            setTimeout(() => {
                safelyFit(fitAddonRef.current, terminalRef.current);
                if (sessionId && mqttConnected && terminalInstanceRef.current) {
                    try {
                        const {cols, rows} = terminalInstanceRef.current;
                        useMqttStore.getState().resizeTerminal(agentUuid, sessionId, cols, rows)
                            .catch(() => {
                            });
                    } catch (error) {
                    }
                }
            }, 10);
        }
    }, [sessionId, mqttConnected, agentUuid]);

    // 只有在组件激活时渲染
    if (!isActive) return null;


    const terminalContent = (
        <>
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
        </>
    );

    if (isFullscreen) {
        // 全屏模式：直接覆盖整个屏幕
        return (
            <div
                className="fixed inset-0 z-[9999] bg-[#1e1e1e] flex flex-col"
                style={{ margin: 0, padding: '20px' }}
                ref={fullscreenContainerRef}
            >
                {terminalContent}
            </div>
        );
    }

    // 普通模式
    return (
        <div
            className="h-full w-full flex flex-col overflow-hidden"
            style={{padding: 0, borderRadius: '0.375rem'}}
            ref={normalContainerRef}
        >
            {terminalContent}
        </div>
    );
};

export default MqttTerminal;
