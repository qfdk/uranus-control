// src/components/ui/XTerminal.jsx
'use client';

import React, { useEffect, useRef, useState } from 'react';
import { Terminal } from 'xterm';
import { FitAddon } from 'xterm-addon-fit';
import { WebLinksAddon } from 'xterm-addon-web-links';
import { SearchAddon } from 'xterm-addon-search';
import { WebglAddon } from 'xterm-addon-webgl';
import useMqttStore from '@/store/mqttStore';
import 'xterm/css/xterm.css';

export default function XTerminal({ agentUuid, isOnline = true }) {
    // 终端和插件的引用
    const terminalRef = useRef(null);
    const xtermRef = useRef(null);
    const fitAddonRef = useRef(null);
    const searchAddonRef = useRef(null);
    const webglAddonRef = useRef(null);

    // 会话状态
    const [sessionId, setSessionId] = useState(null);
    const [connected, setConnected] = useState(false);
    const [error, setError] = useState(null);
    const [isTerminalReady, setIsTerminalReady] = useState(false);
    const [terminalSize, setTerminalSize] = useState({ cols: 80, rows: 24 });
    const [inputPending, setInputPending] = useState(false);

    // 输入队列，防止快速输入导致问题
    const inputQueueRef = useRef([]);
    const processingInputRef = useRef(false);

    // MQTT 状态和方法
    const {
        connected: mqttConnected,
        sendCommand,
        connect: connectMqtt,
        subscribeToResponses
    } = useMqttStore();

    // 确保DOM元素已就绪
    useEffect(() => {
        if (terminalRef.current) {
            // 使用ResizeObserver监控容器大小变化
            const resizeObserver = new ResizeObserver(entries => {
                const { width, height } = entries[0].contentRect;
                if (width > 0 && height > 0 && !isTerminalReady) {
                    setIsTerminalReady(true);
                }
            });

            resizeObserver.observe(terminalRef.current);

            return () => {
                resizeObserver.disconnect();
            };
        }
    }, []);

    // 处理输入队列，确保按顺序发送
    const processInputQueue = async () => {
        if (processingInputRef.current || inputQueueRef.current.length === 0) {
            return;
        }

        processingInputRef.current = true;

        try {
            while (inputQueueRef.current.length > 0) {
                const data = inputQueueRef.current.shift();
                await sendTerminalInput(data);
                // 添加小延迟确保稳定性
                await new Promise(r => setTimeout(r, 10));
            }
        } catch (error) {
            console.error('处理输入队列出错:', error);
            if (xtermRef.current) {
                xtermRef.current.write('\r\n\x1b[31m输入处理错误，请重试\x1b[0m\r\n');
            }
        } finally {
            processingInputRef.current = false;
        }
    };

    // 发送终端输入，改进错误处理
    const sendTerminalInput = async (data) => {
        if (!sessionId || !mqttConnected) {
            throw new Error('会话未建立或MQTT未连接');
        }

        setInputPending(true);

        try {
            // 检测特殊控制字符
            if (data.length === 1 && data.charCodeAt(0) === 3) {
                // Ctrl+C
                console.log('检测到Ctrl+C，发送中断信号');
                await sendCommand(agentUuid, 'terminal_signal', {
                    sessionId: sessionId,
                    signal: 'CTRL_C',
                    requestId: `signal-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`
                });
            } else if (data.length === 1 && data.charCodeAt(0) === 4) {
                // Ctrl+D (EOF)
                console.log('检测到Ctrl+D，发送EOF信号');
                await sendCommand(agentUuid, 'terminal_signal', {
                    sessionId: sessionId,
                    signal: 'EOF',
                    requestId: `signal-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`
                });
            } else {
                // 普通数据
                await sendCommand(agentUuid, 'terminal_input', {
                    sessionId: sessionId,
                    input: data,
                    requestId: `input-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`
                });
            }

            return true;
        } catch (error) {
            console.error('发送终端输入失败:', error);
            throw error;
        } finally {
            setInputPending(false);
        }
    };

    // 初始化终端 - 仅在容器就绪时执行
    useEffect(() => {
        if (!isTerminalReady || !terminalRef.current) return;

        // 创建终端实例
        const terminal = new Terminal({
            cursorBlink: true,
            fontSize: 14,
            fontFamily: 'Menlo, Monaco, "Courier New", monospace',
            theme: {
                background: '#0D1117',
                foreground: '#E5E9F0',
                cursor: '#F8F8F8',
                selection: 'rgba(128, 203, 196, 0.3)',
            },
            allowTransparency: true,
            scrollback: 10000
        });

        // 创建插件实例
        fitAddonRef.current = new FitAddon();
        searchAddonRef.current = new SearchAddon();

        // 先打开终端，然后再加载插件
        terminal.open(terminalRef.current);

        // 确保终端已打开后再加载插件
        terminal.loadAddon(fitAddonRef.current);
        terminal.loadAddon(searchAddonRef.current);
        terminal.loadAddon(new WebLinksAddon());

        // 尝试加载WebGL插件以提高性能
        try {
            webglAddonRef.current = new WebglAddon();
            terminal.loadAddon(webglAddonRef.current);
        } catch (e) {
            console.warn('WebGL渲染初始化失败，使用Canvas渲染', e);
        }

        // 保存终端引用
        xtermRef.current = terminal;

        // 设置欢迎消息
        terminal.writeln('\x1b[1;34m欢迎使用 Uranus 控制台终端\x1b[0m');
        terminal.writeln('\x1b[90m终端准备就绪，正在连接...\x1b[0m');

        // 延迟调用fit，确保DOM已完全渲染
        setTimeout(() => {
            if (fitAddonRef.current) {
                try {
                    fitAddonRef.current.fit();
                    const { cols, rows } = terminal;
                    setTerminalSize({ cols, rows });
                } catch (e) {
                    console.error('调整终端大小失败:', e);
                }
            }

            // 创建终端会话
            initTerminalSession();
        }, 100);

        // 监听窗口大小变化
        const handleResize = () => {
            if (fitAddonRef.current && xtermRef.current) {
                try {
                    fitAddonRef.current.fit();
                    const { cols, rows } = xtermRef.current;
                    setTerminalSize({ cols, rows });

                    // 向服务器通知终端大小变化
                    if (sessionId && connected) {
                        notifyTerminalResize();
                    }
                } catch (e) {
                    console.error('窗口大小变化时调整终端失败:', e);
                }
            }
        };

        window.addEventListener('resize', handleResize);

        // 清理函数
        return () => {
            window.removeEventListener('resize', handleResize);
            cleanupTerminalSession();

            if (webglAddonRef.current) {
                try {
                    webglAddonRef.current.dispose();
                } catch (e) {
                    console.error('WebGL插件清理失败:', e);
                }
            }

            if (xtermRef.current) {
                try {
                    xtermRef.current.dispose();
                } catch (e) {
                    console.error('终端实例清理失败:', e);
                }
            }
        };
    }, [isTerminalReady]);

    // 初始化终端会话
    const initTerminalSession = async () => {
        if (!agentUuid || !isOnline || !xtermRef.current) return;

        try {
            // 确保MQTT连接
            if (!mqttConnected) {
                await connectMqtt();
            }

            // 创建会话ID (生成唯一标识)
            const newSessionId = `term-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
            setSessionId(newSessionId);

            // 发送创建会话命令
            await sendCommand(agentUuid, 'execute', {
                command: 'bash',
                sessionId: newSessionId,
                streaming: true,
                interactive: true
            });

            setConnected(true);

            // 订阅终端输出
            const unsubscribe = subscribeToResponses(agentUuid, handleTerminalOutput);

            // 确保会话建立后再设置输入处理
            setTimeout(() => {
                if (xtermRef.current) {
                    // 设置终端输入处理
                    xtermRef.current.onData(data => {
                        if (!sessionId || inputPending) {
                            return; // 忽略没有会话或正在处理输入时的新输入
                        }

                        // 将输入添加到队列
                        inputQueueRef.current.push(data);

                        // 处理队列
                        if (!processingInputRef.current) {
                            processInputQueue();
                        }
                    });
                }
            }, 500);

            // 通知服务器终端大小
            notifyTerminalResize(newSessionId);

            xtermRef.current.writeln('\x1b[1;32m终端会话已建立.\x1b[0m');
            xtermRef.current.writeln('');

        } catch (err) {
            console.error('初始化终端会话失败:', err);
            setError('终端会话初始化失败: ' + (err.message || '未知错误'));

            if (xtermRef.current) {
                xtermRef.current.writeln('\x1b[1;31m终端连接错误: ' + (err.message || '未知错误') + '\x1b[0m');
            }
        }
    };

    // 向服务器通知终端大小变化
    const notifyTerminalResize = (sid = sessionId) => {
        if (!sid || !xtermRef.current) return;

        const { cols, rows } = terminalSize;

        // 使用execute命令发送窗口大小信息
        sendCommand(agentUuid, 'terminal_resize', {
            sessionId: sid,
            cols,
            rows,
            requestId: `resize-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`
        }).catch(err => console.error('终端大小调整失败:', err));
    };

    // 处理终端输出
    const handleTerminalOutput = (topic, message) => {
        if (!message || !xtermRef.current) return;

        // 过滤当前会话的输出
        if (message.sessionId && message.sessionId === sessionId) {
            // 优先使用output字段，如果没有则使用message字段
            const output = message.output || message.message || '';
            if (output) {
                xtermRef.current.write(output);
            }

            // 如果收到final标记，表示命令结束
            if (message.final) {
                console.log('终端命令执行完成');
                // 可以在这里添加命令完成后的逻辑
            }
        }
    };

    // 清理终端会话
    const cleanupTerminalSession = () => {
        if (sessionId && agentUuid) {
            try {
                // 发送退出命令
                sendCommand(agentUuid, 'terminal_input', {
                    sessionId: sessionId,
                    input: '\u0004',  // Ctrl+D (EOF)
                    requestId: `exit-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`
                }).catch(console.error);

                setSessionId(null);
                setConnected(false);
            } catch (err) {
                console.error('终端会话清理失败:', err);
            }
        }
    };

    // 发送中断信号 (Ctrl+C)
    const sendInterrupt = async () => {
        if (!sessionId || !agentUuid) return;

        try {
            await sendCommand(agentUuid, 'terminal_signal', {
                sessionId: sessionId,
                signal: 'CTRL_C',
                requestId: `signal-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`
            });

            if (xtermRef.current) {
                // 显示中断提示，但不换行
                xtermRef.current.write('^C');
            }
        } catch (err) {
            console.error('发送中断信号失败:', err);
        }
    };

    return (
        <div className="terminal-container h-full flex flex-col">
            {error && (
                <div className="bg-red-100 border-l-4 border-red-500 text-red-700 p-4 mb-4 dark:bg-red-900/30 dark:text-red-300 dark:border-red-600">
                    <p>{error}</p>
                    <button
                        className="mt-2 bg-red-200 hover:bg-red-300 text-red-700 px-3 py-1 rounded dark:bg-red-800 dark:hover:bg-red-700 dark:text-red-300"
                        onClick={() => {
                            setError(null);
                            initTerminalSession();
                        }}
                    >
                        重试连接
                    </button>
                </div>
            )}

            <div
                ref={terminalRef}
                className="flex-grow bg-[#0D1117] rounded-lg overflow-hidden"
                style={{ height: 'calc(60vh - 80px)', width: '100%' }}
            />

            <div className="mt-2 flex items-center justify-between text-sm text-gray-500 dark:text-gray-400">
                <div>
                    {connected ? (
                        <span className="text-green-500 dark:text-green-400">● 连接中</span>
                    ) : (
                        <span className="text-red-500 dark:text-red-400">● 未连接</span>
                    )}
                    <span className="ml-2">
            终端大小: {terminalSize.cols}x{terminalSize.rows}
          </span>
                </div>
                <div className="flex space-x-2">
                    <button
                        onClick={sendInterrupt}
                        className="px-2 py-1 bg-gray-200 hover:bg-gray-300 dark:bg-gray-700 dark:hover:bg-gray-600 rounded transition-colors"
                        disabled={!connected || inputPending}
                    >
                        发送 Ctrl+C
                    </button>
                    <div>按 Ctrl+C 中断命令 | Ctrl+L 清屏</div>
                </div>
            </div>
        </div>
    );
}