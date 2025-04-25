// XTerminal.jsx修改版本
'use client';

import React, { useEffect, useRef, useState } from 'react';
import { Terminal } from 'xterm';
import { FitAddon } from 'xterm-addon-fit';
import useMqttStore from '@/store/mqttStore';
import 'xterm/css/xterm.css';

export default function XTerminal({ agentUuid, isOnline = true }) {
    // 基础状态
    const terminalRef = useRef(null);
    const xtermRef = useRef(null);
    const fitAddonRef = useRef(null);
    const [sessionId, setSessionId] = useState(null);
    const [connected, setConnected] = useState(false);
    const [error, setError] = useState(null);
    const [terminalSize, setTerminalSize] = useState({ cols: 80, rows: 24 });
    const mountedRef = useRef(true);

    // MQTT连接和方法
    const { connected: mqttConnected, sendCommand, connect, subscribeToResponses } = useMqttStore();

    // 在组件卸载时设置标志
    useEffect(() => {
        return () => { mountedRef.current = false; };
    }, []);

    // 安全执行fit操作
    const safeFit = () => {
        if (!mountedRef.current || !fitAddonRef.current || !xtermRef.current) return;
        try {
            fitAddonRef.current.fit();
            if (xtermRef.current && mountedRef.current) {
                setTerminalSize({
                    cols: xtermRef.current.cols,
                    rows: xtermRef.current.rows
                });
            }
        } catch (err) {
            console.warn('终端尺寸调整失败');
        }
    };

    // 处理终端输出
    const handleOutput = (topic, message) => {
        if (!mountedRef.current || !xtermRef.current) return;
        const output = message?.output || message?.message || '';
        if (output) xtermRef.current.write(output);
    };

    // 初始化终端
    useEffect(() => {
        if (!terminalRef.current || !isOnline || !mountedRef.current) return;

        // 1. 创建终端实例
        const terminal = new Terminal({
            cursorBlink: true,
            fontSize: 14,
            fontFamily: 'Menlo, Monaco, "Courier New", monospace',
            theme: { background: '#0D1117', foreground: '#E5E9F0' }
        });

        // 2. 创建fit插件
        const fitAddon = new FitAddon();
        terminal.loadAddon(fitAddon);

        // 3. 打开终端
        terminal.open(terminalRef.current);

        // 4. 保存引用
        xtermRef.current = terminal;
        fitAddonRef.current = fitAddon;

        // 5. 欢迎信息
        terminal.writeln('\x1b[1;34m欢迎使用 Uranus 控制台终端\x1b[0m');

        // 6. 异步初始化连接
        const initSession = async () => {
            if (!mountedRef.current) return;

            try {
                // 连接MQTT
                if (!mqttConnected) {
                    terminal.writeln('\x1b[33m正在连接MQTT...\x1b[0m');
                    await connect();
                }

                // 创建会话ID
                const newSessionId = `term-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
                setSessionId(newSessionId);

                // 订阅消息
                const unsubscribe = subscribeToResponses(agentUuid, handleOutput);

                // 初次调整大小
                setTimeout(() => {
                    if (mountedRef.current) safeFit();
                }, 100);

                // 创建会话
                terminal.writeln('\x1b[33m正在创建终端会话...\x1b[0m');
                await sendCommand(agentUuid, 'interactiveShell', {
                    sessionId: newSessionId,
                    cols: 80,
                    rows: 24
                });

                // 设置输入处理
                terminal.onData(data => {
                    if (newSessionId && mqttConnected && mountedRef.current) {
                        sendCommand(agentUuid, 'terminal_input', {
                            sessionId: newSessionId,
                            input: data
                        });
                    }
                });

                setConnected(true);
            } catch (err) {
                if (mountedRef.current) {
                    setError(err.message || '终端初始化失败');
                    terminal.writeln(`\r\n\x1b[31m错误: ${err.message}\x1b[0m\r\n`);
                }
            }
        };

        // 延迟初始化，确保DOM已渲染
        const timer = setTimeout(initSession, 300);

        // 窗口大小变化处理
        const handleResize = () => {
            if (mountedRef.current) {
                setTimeout(safeFit, 100);
            }
        };
        window.addEventListener('resize', handleResize);

        // 清理函数
        return () => {
            clearTimeout(timer);
            window.removeEventListener('resize', handleResize);

            // 关闭会话
            if (sessionId) {
                sendCommand(agentUuid, 'closeTerminal', { sessionId });
            }

            // 销毁终端
            if (xtermRef.current) {
                xtermRef.current.dispose();
                xtermRef.current = null;
            }
        };
    }, [agentUuid, connect, isOnline, mqttConnected, sendCommand, subscribeToResponses]);

    // 处理中断信号
    const sendInterrupt = () => {
        if (!sessionId || !mountedRef.current) return;
        sendCommand(agentUuid, 'terminal_input', {
            sessionId,
            input: '\u0003'
        });
    };

    // 清屏
    const clearScreen = () => {
        if (xtermRef.current && mountedRef.current) {
            xtermRef.current.clear();
        }
    };

    // 重新连接
    const reconnect = () => {
        if (!mountedRef.current) return;

        setError(null);

        // 关闭旧会话
        if (sessionId) {
            sendCommand(agentUuid, 'closeTerminal', { sessionId });
            setSessionId(null);
        }

        setConnected(false);

        // 清屏并重新初始化
        if (xtermRef.current) {
            xtermRef.current.clear();
            xtermRef.current.writeln('\x1b[33m正在重新连接...\x1b[0m');

            // 重新初始化会话
            const newSessionId = `term-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
            setSessionId(newSessionId);

            // 延迟发送命令
            setTimeout(async () => {
                if (!mountedRef.current) return;
                try {
                    await sendCommand(agentUuid, 'interactiveShell', {
                        sessionId: newSessionId,
                        cols: terminalSize.cols,
                        rows: terminalSize.rows
                    });
                    setConnected(true);
                } catch (err) {
                    setError(err.message || '重连失败');
                }
            }, 300);
        }
    };

    return (
        <div className="terminal-container h-full flex flex-col">
            {error && (
                <div className="bg-red-100 border-l-4 border-red-500 text-red-700 p-4 mb-4 dark:bg-red-900/30 dark:text-red-400">
                    <p>{error}</p>
                    <button className="mt-2 bg-red-200 px-3 py-1 rounded dark:bg-red-800 dark:text-red-300" onClick={reconnect}>重试连接</button>
                </div>
            )}

            <div
                ref={terminalRef}
                className="flex-grow bg-[#0D1117] rounded-lg overflow-hidden"
                style={{ height: '400px', width: '100%' }}
            />

            <div className="mt-2 flex justify-between text-sm text-gray-500 dark:text-gray-400">
                <div>
                    <span className={connected ? "text-green-500 dark:text-green-400" : "text-red-500 dark:text-red-400"}>
                        ● {connected ? "已连接" : "未连接"}
                    </span>
                    <span className="ml-2">终端大小: {terminalSize.cols}x{terminalSize.rows}</span>
                </div>

                <div className="flex space-x-2">
                    <button onClick={sendInterrupt} className="px-2 py-1 bg-yellow-100 rounded text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400" disabled={!connected}>Ctrl+C</button>
                    <button onClick={clearScreen} className="px-2 py-1 bg-gray-200 rounded dark:bg-gray-700">清屏</button>
                    <button onClick={reconnect} className="px-2 py-1 bg-blue-100 rounded text-blue-700 dark:bg-blue-900/30 dark:text-blue-400">重连</button>
                </div>
            </div>
        </div>
    );
}
