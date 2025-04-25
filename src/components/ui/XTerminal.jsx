// src/components/ui/XTerminal.jsx
'use client';

import React, {useEffect, useRef, useState} from 'react';
import {Terminal} from 'xterm';
import {FitAddon} from 'xterm-addon-fit';
import {WebLinksAddon} from 'xterm-addon-web-links';
import {SearchAddon} from 'xterm-addon-search';
import {WebglAddon} from 'xterm-addon-webgl';
import useMqttStore from '@/store/mqttStore';
import 'xterm/css/xterm.css';

export default function XTerminal({agentUuid, isOnline = true}) {
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
    const [terminalSize, setTerminalSize] = useState({cols: 80, rows: 24});
    const [inputPending, setInputPending] = useState(false);

    // 输入队列，防止快速输入导致问题
    const inputQueueRef = useRef([]);
    const processingInputRef = useRef(false);
    const unsubscribeRef = useRef(null);

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
                const {width, height} = entries[0].contentRect;
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

    // 发送终端输入
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

    // 执行简单命令
    const executeSimpleCommand = async (cmd) => {
        if (!agentUuid || !mqttConnected) {
            console.error('无法执行命令: 代理未连接或MQTT未连接');
            return false;
        }

        try {
            xtermRef.current.write(`${cmd}\r\n`);

            // 使用独立的requestId，不与会话绑定
            const requestId = `cmd-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;

            // 修正：execute命令应发送正确的command参数
            const response = await sendCommand(agentUuid, 'execute', {
                command: cmd,  // 关键修复：直接使用command字段
                requestId: requestId,
                streaming: true
            });

            if (response && response.output) {
                xtermRef.current.write(response.output);
                return true;
            }

            return false;
        } catch (error) {
            console.error(`执行命令 ${cmd} 失败:`, error);
            if (xtermRef.current) {
                xtermRef.current.write(`\r\n\x1b[31m执行错误: ${error.message}\x1b[0m\r\n`);
            }
            return false;
        }
    };

    // 初始化终端
    const initTerminal = async () => {
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
                selection: 'rgba(128, 203, 196, 0.3)'
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
                    const {cols, rows} = terminal;
                    setTerminalSize({cols, rows});
                } catch (e) {
                    console.error('调整终端大小失败:', e);
                }
            }

            // 创建终端会话
            initTerminalSession();
        }, 100);

        // 设置输入处理
        terminal.onData(data => {
            // 只有在会话存在且没有挂起输入时接受输入
            if (!sessionId || inputPending) {
                return;
            }

            // 加入输入队列
            inputQueueRef.current.push(data);

            // 处理队列
            if (!processingInputRef.current) {
                processInputQueue();
            }
        });

        // 监听窗口大小变化
        const handleResize = () => {
            if (fitAddonRef.current && xtermRef.current) {
                try {
                    fitAddonRef.current.fit();
                    const {cols, rows} = xtermRef.current;

                    // 只有大小真正变化时才通知
                    if (terminalSize.cols !== cols || terminalSize.rows !== rows) {
                        setTerminalSize({cols, rows});

                        // 通知服务器
                        if (sessionId && connected) {
                            notifyTerminalResize();
                        }
                    }
                } catch (e) {
                    console.error('窗口大小变化时调整终端失败:', e);
                }
            }
        };

        window.addEventListener('resize', handleResize);

        return () => {
            window.removeEventListener('resize', handleResize);
        };
    };

    // 处理终端输出
    const handleTerminalOutput = (topic, message) => {
        if (!xtermRef.current) return;
        // 无条件显示所有输出内容
        const output = message?.output || message?.message || '';
        if (output) xtermRef.current.write(output);
        // 强制显示错误信息
        if (message?.success === false) {
            const errorMsg = `错误: ${message.message || '执行失败'}\r\n`;
            xtermRef.current.write(`\r\n\x1b[31m${errorMsg}\x1b[0m`);
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
                unsubscribeRef.current = null;
            }

            // 确保MQTT连接
            if (!mqttConnected) {
                xtermRef.current.writeln('\x1b[33m正在连接MQTT...\x1b[0m');
                await connectMqtt();
                xtermRef.current.writeln('\x1b[32mMQTT已连接\x1b[0m');
            }

            // 创建唯一会话ID
            const newSessionId = `term-${Date.now()}`;
            setSessionId(newSessionId);

            // 初始化订阅 - 必须在执行命令前设置
            unsubscribeRef.current = subscribeToResponses(agentUuid, handleTerminalOutput);

            // 初始化会话状态
            setConnected(false);
            setInputPending(false);

            // 显示正在连接消息
            xtermRef.current.writeln('\x1b[33m正在创建终端会话...\x1b[0m');

            // 修正：创建会话使用正确的command格式
            try {
                const response = await sendCommand(agentUuid, 'execute', {
                    command: 'bash', // 关键修复：直接使用command字段
                    sessionId: newSessionId,
                    streaming: true,
                    interactive: true,
                    requestId: `session-${Date.now()}`
                });

                // 检查响应
                if (response && response.success === false) {
                    throw new Error(response.message || '创建会话失败');
                }

                // 会话创建成功
                setConnected(true);
                xtermRef.current.writeln('\x1b[32m终端会话已建立\x1b[0m\r\n');

                // 通知终端大小
                await notifyTerminalResize();

                // 获取当前工作目录
                await executeSimpleCommand('pwd');

            } catch (error) {
                console.error('创建交互式会话失败，尝试备用方法:', error);
                xtermRef.current.writeln(`\x1b[31m创建交互式会话失败: ${error.message}\x1b[0m`);

                // 备用方法：使用非交互式模式
                try {
                    xtermRef.current.writeln('\x1b[33m尝试使用非交互模式...\x1b[0m');

                    // 修正：使用正确的command格式执行简单命令
                    await executeSimpleCommand('echo "Using fallback mode - Type commands and press Enter"');
                    await executeSimpleCommand('pwd');

                    // 标记为连接成功但使用备用模式
                    setConnected(true);

                } catch (fallbackError) {
                    console.error('备用模式也失败:', fallbackError);
                    xtermRef.current.writeln(`\x1b[31m备用模式也失败: ${fallbackError.message}\x1b[0m`);
                    setError('无法创建终端会话，请检查服务器状态');
                }
            }

        } catch (error) {
            console.error('初始化终端会话完全失败:', error);
            if (xtermRef.current) {
                xtermRef.current.writeln(`\x1b[31m终端初始化失败: ${error.message}\x1b[0m`);
                xtermRef.current.writeln('\x1b[33m请尝试刷新页面或联系管理员\x1b[0m');
            }
            setError('终端会话初始化失败');
        }
    };

    // 通知终端大小变化
    const notifyTerminalResize = async () => {
        if (!sessionId || !agentUuid) return false;

        try {
            console.log(`通知终端大小变化: ${terminalSize.cols}x${terminalSize.rows}`);

            // 修正：使用正确的terminal_resize命令格式
            const result = await sendCommand(agentUuid, 'terminal_resize', {
                sessionId: sessionId,
                cols: terminalSize.cols,
                rows: terminalSize.rows,
                requestId: `resize-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`
            });

            // 检查响应
            if (result && result.success === false) {
                console.warn('直接调整大小失败，尝试stty命令');

                // 备用方案：使用stty命令
                await sendCommand(agentUuid, 'execute', {
                    command: `stty rows ${terminalSize.rows} cols ${terminalSize.cols}`, // 修正：使用正确的command字段
                    sessionId: sessionId,
                    requestId: `stty-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
                    silent: true
                });
            }

            return true;
        } catch (error) {
            console.error('调整终端大小失败:', error);
            return false;
        }
    };

    // 组件挂载时初始化终端
    useEffect(() => {
        if (isTerminalReady && !xtermRef.current) {
            initTerminal();
        }
    }, [isTerminalReady]);

    // 卸载时清理资源
    useEffect(() => {
        return () => {
            // 取消订阅
            if (unsubscribeRef.current) {
                unsubscribeRef.current();
                unsubscribeRef.current = null;
            }

            // 清理终端资源
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
    }, []);

    // 监听代理在线状态变化
    useEffect(() => {
        if (!isOnline && connected) {
            // 代理离线显示消息
            if (xtermRef.current) {
                xtermRef.current.writeln('\r\n\x1b[31m代理已离线，终端连接已断开\x1b[0m\r\n');
            }
            // 设置连接状态
            setConnected(false);
            setSessionId(null);
        }
    }, [isOnline, connected]);

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
                // 显示中断提示
                xtermRef.current.write('^C');
            }
        } catch (err) {
            console.error('发送中断信号失败:', err);
        }
    };

    // 重新连接终端
    const retryConnection = () => {
        setError(null);

        // 重置状态
        setSessionId(null);
        setConnected(false);

        // 清理终端显示
        if (xtermRef.current) {
            xtermRef.current.clear();
            xtermRef.current.writeln('\x1b[33m正在重新连接...\x1b[0m');
        }

        // 重新初始化终端会话
        initTerminalSession();
    };

    return (
        <div className="terminal-container h-full flex flex-col">
            {error && (
                <div
                    className="bg-red-100 border-l-4 border-red-500 text-red-700 p-4 mb-4 dark:bg-red-900/30 dark:text-red-300 dark:border-red-600">
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
                style={{height: 'calc(60vh - 80px)', width: '100%'}}
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
                    <button
                        onClick={retryConnection}
                        className="px-2 py-1 bg-blue-100 hover:bg-blue-200 dark:bg-blue-900/30 dark:hover:bg-blue-800/40 rounded transition-colors text-blue-700 dark:text-blue-300"
                    >
                        重新连接
                    </button>
                    <div>按 Ctrl+C 中断命令 | Ctrl+L 清屏</div>
                </div>
            </div>
        </div>
    );
}
