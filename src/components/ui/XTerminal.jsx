// src/components/ui/XTerminal.jsx
'use client';

import React, { useEffect, useRef, useState } from 'react';
import { Terminal } from 'xterm';
import { FitAddon } from 'xterm-addon-fit';
import { WebLinksAddon } from 'xterm-addon-web-links';
import { SearchAddon } from 'xterm-addon-search';
import { WebglAddon } from 'xterm-addon-webgl';
import 'xterm/css/xterm.css';
import useMqttStore from '@/store/mqttStore';

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
            const newSessionId = `term-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
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
            subscribeToResponses(agentUuid, handleTerminalOutput);

            // 设置终端输入处理
            xtermRef.current.onData(data => {
                if (newSessionId && mqttConnected) {
                    sendTerminalInput(newSessionId, data);
                }
            });

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
        sendCommand(agentUuid, 'execute', {
            command: `stty rows ${rows} cols ${cols}`,
            sessionId: sid,
            silent: true  // 不需要响应
        }).catch(err => console.error('终端大小调整失败:', err));
    };

    // 发送终端输入
    const sendTerminalInput = (sid, data) => {
        sendCommand(agentUuid, 'terminal_input', {
            sessionId: sid,
            input: data
        }).catch(err => console.error('发送终端输入失败:', err));
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
        }
    };

    // 清理终端会话
    const cleanupTerminalSession = () => {
        if (sessionId && agentUuid) {
            try {
                // 发送退出命令
                sendCommand(agentUuid, 'terminal_input', {
                    sessionId: sessionId,
                    input: '\u0004'  // Ctrl+D (EOF)
                }).catch(console.error);

                setSessionId(null);
                setConnected(false);
            } catch (err) {
                console.error('终端会话清理失败:', err);
            }
        }
    };

    return (
        <div className="terminal-container h-full flex flex-col">
            {error && (
                <div className="bg-red-100 border-l-4 border-red-500 text-red-700 p-4 mb-4">
                    <p>{error}</p>
                    <button
                        className="mt-2 bg-red-200 hover:bg-red-300 text-red-700 px-3 py-1 rounded"
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
                <div>
                    按 Ctrl+C 中断命令 | Ctrl+L 清屏
                </div>
            </div>
        </div>
    );
}