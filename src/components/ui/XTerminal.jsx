'use client';

import React, { useEffect, useRef, useState } from 'react';
import { Terminal } from 'xterm';
import { FitAddon } from 'xterm-addon-fit';
import useMqttStore from '@/store/mqttStore';
import 'xterm/css/xterm.css';

export default function XTerminal({ agentUuid, isOnline = true }) {
    const terminalRef = useRef(null);
    const xtermRef = useRef(null);
    const fitAddonRef = useRef(null);
    const unsubscribeRef = useRef(null);

    const [sessionId, setSessionId] = useState(null);
    const [connected, setConnected] = useState(false);
    const [error, setError] = useState(null);
    const [terminalSize, setTerminalSize] = useState({ cols: 80, rows: 24 });

    const { connected: mqttConnected, sendCommand, connect, subscribeToResponses } = useMqttStore();

    // 初始化DOM监控
    useEffect(() => {
        if (terminalRef.current) {
            const resizeObserver = new ResizeObserver(entries => {
                if (entries[0].contentRect.width > 0) {
                    initTerminal();
                }
            });
            resizeObserver.observe(terminalRef.current);
            return () => resizeObserver.disconnect();
        }
    }, []);

    // 处理输出
    const handleTerminalOutput = (topic, message) => {
        if (!xtermRef.current) return;
        const output = message?.output || message?.message || '';
        if (output) xtermRef.current.write(output);
    };

    // 创建会话
    const initTerminalSession = async () => {
        if (!agentUuid || !isOnline || !xtermRef.current) return;

        try {
            if (unsubscribeRef.current) unsubscribeRef.current();

            // 确保MQTT连接
            if (!mqttConnected) {
                xtermRef.current.writeln('\x1b[33m正在连接MQTT...\x1b[0m');
                await connect();
            }

            // 创建会话
            const newSessionId = `term-${Date.now()}`;
            setSessionId(newSessionId);

            // 订阅消息
            unsubscribeRef.current = subscribeToResponses(agentUuid, handleTerminalOutput);

            // 会话初始化
            xtermRef.current.writeln('\x1b[33m正在创建终端会话...\x1b[0m');

            // 发送bash命令
            await sendCommand(agentUuid, 'execute', {
                command: 'bash',
                sessionId: newSessionId,
                interactive: true,
                streaming: true
            });

            setConnected(true);
        } catch (error) {
            setError('终端初始化失败');
        }
    };

    // 初始化终端
    const initTerminal = () => {
        if (xtermRef.current) return;

        // 创建终端
        const terminal = new Terminal({
            cursorBlink: true,
            fontSize: 14,
            fontFamily: 'Menlo, Monaco, "Courier New", monospace',
            theme: {
                background: '#0D1117',
                foreground: '#E5E9F0'
            }
        });

        // 安装插件
        fitAddonRef.current = new FitAddon();
        terminal.loadAddon(fitAddonRef.current);

        // 打开终端
        terminal.open(terminalRef.current);
        xtermRef.current = terminal;

        // 欢迎信息
        terminal.writeln('\x1b[1;34m欢迎使用 Uranus 控制台终端\x1b[0m');
        terminal.writeln('\x1b[90m终端准备就绪，正在连接...\x1b[0m');

        // 调整大小
        setTimeout(() => {
            if (fitAddonRef.current) {
                fitAddonRef.current.fit();
                setTerminalSize({
                    cols: terminal.cols,
                    rows: terminal.rows
                });

                // 初始化会话
                initTerminalSession();
            }
        }, 100);

        // 关键：处理输入
        terminal.onData(data => {
            if (sessionId && mqttConnected) {
                // 发送所有输入数据
                sendCommand(agentUuid, 'terminal_input', {
                    sessionId,
                    input: data
                }).catch(err => console.error('输入处理失败'));
            }
        });

        // 窗口大小变化
        const handleResize = () => {
            if (fitAddonRef.current && xtermRef.current) {
                fitAddonRef.current.fit();
                setTerminalSize({
                    cols: xtermRef.current.cols,
                    rows: xtermRef.current.rows
                });
            }
        };

        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    };

    // 清理资源
    useEffect(() => {
        return () => {
            if (unsubscribeRef.current) unsubscribeRef.current();
            if (xtermRef.current) xtermRef.current.dispose();
        };
    }, []);

    // 清屏
    const clearScreen = () => {
        if (xtermRef.current) xtermRef.current.clear();
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

    return (
        <div className="terminal-container h-full flex flex-col">
            {error && (
                <div className="bg-red-100 border-l-4 border-red-500 text-red-700 p-4 mb-4">
                    <p>{error}</p>
                    <button className="mt-2 bg-red-200 px-3 py-1 rounded" onClick={retryConnection}>重试连接</button>
                </div>
            )}

            <div
                ref={terminalRef}
                className="flex-grow bg-[#0D1117] rounded-lg overflow-hidden"
                style={{ height: 'calc(70vh - 80px)', width: '100%' }}
            />

            <div className="mt-2 flex justify-between text-sm text-gray-500">
                <div>
          <span className={connected ? "text-green-500" : "text-red-500"}>
            ● {connected ? "连接中" : "未连接"}
          </span>
                    <span className="ml-2">终端大小: {terminalSize.cols}x{terminalSize.rows}</span>
                </div>
                <div className="flex space-x-2">
                    <button onClick={clearScreen} className="px-2 py-1 bg-gray-200 rounded">清屏</button>
                    <button onClick={retryConnection} className="px-2 py-1 bg-blue-100 rounded text-blue-700">重新连接</button>
                </div>
            </div>
        </div>
    );
}
