'use client';

import React, { useEffect, useRef, useState } from 'react';
import { Terminal } from 'xterm';
import { FitAddon } from 'xterm-addon-fit';
import useMqttStore from '@/store/mqttStore';
import 'xterm/css/xterm.css';

export default function XTerminal({ agentUuid, isOnline = true }) {
    // 核心引用
    const terminalRef = useRef(null);
    const xtermRef = useRef(null);
    const fitAddonRef = useRef(null);
    const unsubscribeRef = useRef(null);
    const inputRef = useRef(null);

    // 状态管理
    const [sessionId, setSessionId] = useState(null);
    const [connected, setConnected] = useState(false);
    const [error, setError] = useState(null);
    const [terminalSize, setTerminalSize] = useState({ cols: 80, rows: 24 });
    const [terminalReady, setTerminalReady] = useState(false);
    const [inputValue, setInputValue] = useState('');
    const [commandHistory, setCommandHistory] = useState([]);
    const [historyIndex, setHistoryIndex] = useState(-1);

    // MQTT 连接
    const { connected: mqttConnected, sendCommand, connect, subscribeToResponses } = useMqttStore();

    // 初始化DOM监控
    useEffect(() => {
        if (terminalRef.current) {
            const resizeObserver = new ResizeObserver(entries => {
                if (entries[0].contentRect.width > 0) setTerminalReady(true);
            });
            resizeObserver.observe(terminalRef.current);
            return () => resizeObserver.disconnect();
        }
    }, []);

    // 处理终端输出
    const handleTerminalOutput = (topic, message) => {
        if (!xtermRef.current) return;

        // 显示输出内容
        const output = message?.output || message?.message || '';
        if (output) xtermRef.current.write(output);

        // 显示错误信息
        if (message?.success === false) {
            xtermRef.current.write(`\r\n\x1b[31m错误: ${message.message || '执行失败'}\x1b[0m\r\n`);
        }

        // 最终输出完成后显示提示符
        if (message?.final) {
            xtermRef.current.write('\r\n\x1b[32m$ \x1b[0m');
        }
    };

    // 执行命令
    const executeCommand = async (cmd) => {
        if (!sessionId || !mqttConnected || !cmd.trim()) return false;

        // 将命令添加到历史记录
        setCommandHistory(prev => {
            const newHistory = [cmd, ...prev.slice(0, 19)]; // 最多保留20条记录
            return newHistory;
        });
        setHistoryIndex(-1);

        try {
            // 显示命令
            if (xtermRef.current) {
                xtermRef.current.write(`\r\n\x1b[34m$ ${cmd}\x1b[0m\r\n`);
            }

            // 发送命令执行请求
            const response = await sendCommand(agentUuid, 'execute', {
                command: cmd,
                sessionId,
                streaming: true,
                requestId: `cmd-${Date.now()}`
            });

            return true;
        } catch (error) {
            console.error(`命令执行失败: ${cmd}`, error);
            if (xtermRef.current) {
                xtermRef.current.write(`\r\n\x1b[31m错误: ${error.message}\x1b[0m\r\n\x1b[32m$ \x1b[0m`);
            }
            return false;
        }
    };

    // 初始化终端会话
    const initTerminalSession = async () => {
        if (!agentUuid || !isOnline || !xtermRef.current) {
            setError('代理离线或终端未就绪');
            return;
        }

        try {
            // 清理旧会话
            if (unsubscribeRef.current) {
                unsubscribeRef.current();
            }

            // 确保MQTT连接
            if (!mqttConnected) {
                xtermRef.current.writeln('\x1b[33m正在连接MQTT...\x1b[0m');
                await connect();
                xtermRef.current.writeln('\x1b[32mMQTT已连接\x1b[0m');
            }

            // 创建会话ID
            const newSessionId = `term-${Date.now()}`;
            setSessionId(newSessionId);

            // 订阅响应
            unsubscribeRef.current = subscribeToResponses(agentUuid, handleTerminalOutput);

            // 显示连接中
            xtermRef.current.writeln('\x1b[33m正在创建终端会话...\x1b[0m');

            try {
                // 使用非交互式命令模式
                const response = await sendCommand(agentUuid, 'execute', {
                    command: 'echo "终端会话已建立 [非交互式模式]"',
                    sessionId: newSessionId,
                    streaming: true,
                    requestId: `session-${Date.now()}`
                });

                setConnected(true);

                // 获取当前目录
                await executeCommand('pwd');

                // 获取主机名
                await executeCommand('hostname');

                // 显示欢迎信息
                if (xtermRef.current) {
                    xtermRef.current.write('\x1b[32m$ \x1b[0m');
                }

                // 聚焦到输入框
                setTimeout(() => {
                    inputRef.current?.focus();
                }, 100);
            } catch (error) {
                console.error('创建会话失败:', error);
                xtermRef.current.writeln(`\x1b[31m创建会话失败: ${error.message}\x1b[0m\r\n`);
                setError('无法创建终端会话');
            }
        } catch (error) {
            console.error('终端初始化失败:', error);
            setError('终端初始化失败');
        }
    };

    // 初始化终端
    const initTerminal = () => {
        if (!terminalReady || !terminalRef.current) return;

        // 创建终端实例
        const terminal = new Terminal({
            cursorBlink: true,
            fontSize: 14,
            fontFamily: 'Menlo, Monaco, "Courier New", monospace',
            theme: {
                background: '#0D1117',
                foreground: '#E5E9F0',
                cursor: '#F8F8F8'
            },
            scrollback: 5000
        });

        // 添加插件
        fitAddonRef.current = new FitAddon();
        terminal.loadAddon(fitAddonRef.current);

        // 打开终端
        terminal.open(terminalRef.current);
        xtermRef.current = terminal;

        // 欢迎消息
        terminal.writeln('\x1b[1;34m欢迎使用 Uranus 控制台终端\x1b[0m');
        terminal.writeln('\x1b[90m终端准备就绪，正在连接...\x1b[0m');

        // 调整大小并初始化会话
        setTimeout(() => {
            if (fitAddonRef.current) {
                try {
                    fitAddonRef.current.fit();
                    const { cols, rows } = terminal;
                    setTerminalSize({ cols, rows });
                } catch (e) {
                    console.error('调整大小失败:', e);
                }
            }
            initTerminalSession();
        }, 100);

        // 窗口大小变化处理
        const handleResize = () => {
            if (fitAddonRef.current && xtermRef.current) {
                try {
                    fitAddonRef.current.fit();
                    const { cols, rows } = xtermRef.current;
                    setTerminalSize({ cols, rows });
                } catch (e) {
                    console.error('窗口大小变化处理失败:', e);
                }
            }
        };

        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    };

    // 初始化终端
    useEffect(() => {
        if (terminalReady && !xtermRef.current) {
            initTerminal();
        }
    }, [terminalReady]);

    // 清理资源
    useEffect(() => {
        return () => {
            if (unsubscribeRef.current) {
                unsubscribeRef.current();
            }

            if (xtermRef.current) {
                xtermRef.current.dispose();
            }
        };
    }, []);

    // 代理状态变化处理
    useEffect(() => {
        if (!isOnline && connected && xtermRef.current) {
            xtermRef.current.writeln('\r\n\x1b[31m代理已离线，终端连接已断开\x1b[0m\r\n');
            setConnected(false);
            setSessionId(null);
        }
    }, [isOnline, connected]);

    // 发送中断信号
    const sendInterrupt = async () => {
        if (!sessionId) return;

        try {
            // 发送强制中断
            await sendCommand(agentUuid, 'force_interrupt', {
                sessionId,
                requestId: `force-${Date.now()}`
            });

            if (xtermRef.current) {
                xtermRef.current.write('\r\n\x1b[31m^C\x1b[0m\r\n\x1b[32m$ \x1b[0m');
            }
        } catch (err) {
            console.error('中断信号发送失败:', err);
        }
    };

    // 清屏
    const clearScreen = () => {
        if (xtermRef.current) {
            xtermRef.current.clear();
            xtermRef.current.write('\x1b[32m$ \x1b[0m');
        }
    };

    // 重新连接
    const retryConnection = () => {
        setError(null);
        setSessionId(null);
        setConnected(false);

        if (xtermRef.current) {
            xtermRef.current.clear();
            xtermRef.current.writeln('\x1b[33m正在重新连接...\x1b[0m');
        }

        initTerminalSession();
    };

    // 命令历史导航
    const navigateHistory = (direction) => {
        if (commandHistory.length === 0) return;

        let newIndex = historyIndex;

        if (direction === 'up') {
            newIndex = historyIndex >= commandHistory.length - 1 ? commandHistory.length - 1 : historyIndex + 1;
        } else {
            newIndex = historyIndex <= 0 ? -1 : historyIndex - 1;
        }

        setHistoryIndex(newIndex);
        setInputValue(newIndex >= 0 ? commandHistory[newIndex] : '');
    };

    // 处理键盘事件
    const handleKeyDown = (e) => {
        switch (e.key) {
            case 'ArrowUp':
                e.preventDefault();
                navigateHistory('up');
                break;
            case 'ArrowDown':
                e.preventDefault();
                navigateHistory('down');
                break;
            case 'l':
                if (e.ctrlKey) {
                    e.preventDefault();
                    clearScreen();
                }
                break;
            case 'c':
                if (e.ctrlKey) {
                    e.preventDefault();
                    sendInterrupt();
                }
                break;
        }
    };

    return (
        <div className="terminal-container h-full flex flex-col">
            {error && (
                <div className="bg-red-100 border-l-4 border-red-500 text-red-700 p-4 mb-4 dark:bg-red-900/30 dark:text-red-300 dark:border-red-600">
                    <p>{error}</p>
                    <button
                        className="mt-2 bg-red-200 hover:bg-red-300 text-red-700 px-3 py-1 rounded dark:bg-red-800 dark:hover:bg-red-700 dark:text-red-300"
                        onClick={retryConnection}
                    >
                        重试连接
                    </button>
                </div>
            )}

            <div
                ref={terminalRef}
                className="flex-grow bg-[#0D1117] rounded-lg overflow-hidden"
                style={{ height: 'calc(50vh - 80px)', width: '100%' }}
            />

            <div className="mt-2">
                <form
                    onSubmit={(e) => {
                        e.preventDefault();
                        executeCommand(inputValue);
                        setInputValue('');
                    }}
                    className="flex"
                >
                    <input
                        ref={inputRef}
                        type="text"
                        value={inputValue}
                        onChange={(e) => setInputValue(e.target.value)}
                        onKeyDown={handleKeyDown}
                        className="flex-grow p-2 border rounded-l bg-gray-900 text-white font-mono"
                        placeholder="输入命令..."
                        disabled={!connected}
                    />
                    <button
                        type="submit"
                        className="px-4 py-2 bg-blue-500 text-white rounded-r hover:bg-blue-600 disabled:opacity-50"
                        disabled={!connected}
                    >
                        执行
                    </button>
                </form>
            </div>

            <div className="mt-2 flex items-center justify-between text-sm text-gray-500 dark:text-gray-400">
                <div>
                    {connected ? (
                        <span className="text-green-500 dark:text-green-400">● 连接中</span>
                    ) : (
                        <span className="text-red-500 dark:text-red-400">● 未连接</span>
                    )}
                    <span className="ml-2">终端大小: {terminalSize.cols}x{terminalSize.rows}</span>
                </div>
                <div className="flex space-x-2">
                    <button
                        onClick={sendInterrupt}
                        className="px-2 py-1 bg-gray-200 hover:bg-gray-300 dark:bg-gray-700 dark:hover:bg-gray-600 rounded transition-colors"
                        disabled={!connected}
                    >
                        Ctrl+C
                    </button>
                    <button
                        onClick={clearScreen}
                        className="px-2 py-1 bg-gray-200 hover:bg-gray-300 dark:bg-gray-700 dark:hover:bg-gray-600 rounded transition-colors"
                        disabled={!connected}
                    >
                        清屏
                    </button>
                    <button
                        onClick={retryConnection}
                        className="px-2 py-1 bg-blue-100 hover:bg-blue-200 dark:bg-blue-900/30 dark:hover:bg-blue-800/40 rounded transition-colors text-blue-700 dark:text-blue-300"
                    >
                        重新连接
                    </button>
                </div>
            </div>
        </div>
    );
}
