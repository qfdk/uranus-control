// src/components/ui/Terminal.jsx
'use client';

import { useState, useRef, useEffect } from 'react';
import { Send, RotateCcw, Copy, CheckCheck } from 'lucide-react';
import { useMqttClient } from '@/lib/mqtt';

export default function Terminal({ agentId, agentUuid, isOnline = true }) {
    const { connected: mqttConnected, sendCommand } = useMqttClient();
    const [command, setCommand] = useState('');
    const [history, setHistory] = useState([]);
    const [loading, setLoading] = useState(false);
    const [copied, setCopied] = useState(false);
    const bottomRef = useRef(null);

    // 自动滚动到底部
    useEffect(() => {
        if (bottomRef.current) {
            bottomRef.current.scrollIntoView({ behavior: 'smooth' });
        }
    }, [history]);

    // 处理命令提交
    const handleSubmit = async (e) => {
        e.preventDefault();

        if (!command.trim() || !isOnline) return;

        // 添加命令到历史记录
        setHistory(prev => [...prev, { type: 'command', text: command }]);
        setLoading(true);

        try {
            if (mqttConnected && agentUuid) {
                try {
                    console.log(`通过MQTT向代理 ${agentUuid} 发送命令: ${command}`);
                    const result = await sendCommand(agentUuid, 'execute', { command });

                    // 添加响应到历史记录
                    setHistory(prev => [...prev, {
                        type: 'response',
                        text: result.output || result.message || '命令执行成功，但没有输出',
                        success: !result.error
                    }]);
                } catch (error) {
                    console.error('MQTT命令执行失败:', error);

                    // 添加错误消息到历史记录
                    setHistory(prev => [...prev, {
                        type: 'response',
                        text: error.message === 'Command execution timeout'
                            ? '命令执行超时，请稍后重试'
                            : `执行错误: ${error.message}`,
                        success: false
                    }]);
                }
            } else {
                setHistory(prev => [...prev, {
                    type: 'response',
                    text: 'MQTT未连接，无法执行命令',
                    success: false
                }]);
            }
        } finally {
            setLoading(false);
            setCommand('');
        }
    };

    // 清除历史记录
    const clearHistory = () => {
        setHistory([]);
    };

    // 复制历史记录到剪贴板
    const copyHistory = () => {
        const text = history
            .map(item => {
                if (item.type === 'command') {
                    return `$ ${item.text}`;
                } else {
                    return item.text;
                }
            })
            .join('\n\n');

        navigator.clipboard.writeText(text);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    return (
        <div className="rounded-lg border border-gray-200 dark:border-gray-700 bg-black text-white dark:bg-gray-900 overflow-hidden">
            <div className="flex justify-between items-center px-4 py-2 bg-gray-800 dark:bg-gray-800 border-b border-gray-700">
                <div className="flex items-center">
                    <div className="flex space-x-2 mr-2">
                        <div className="w-3 h-3 rounded-full bg-red-500"></div>
                        <div className="w-3 h-3 rounded-full bg-yellow-500"></div>
                        <div className="w-3 h-3 rounded-full bg-green-500"></div>
                    </div>
                    <span className="text-sm font-medium">终端</span>
                    {mqttConnected && agentUuid && (
                        <span className="ml-2 text-xs px-1.5 py-0.5 bg-blue-600 text-white rounded-full">MQTT</span>
                    )}
                </div>
                <div className="flex space-x-2">
                    <button
                        onClick={copyHistory}
                        className="text-gray-400 hover:text-white p-1 rounded transition-colors"
                        disabled={history.length === 0}
                        title="复制内容"
                    >
                        {copied ? <CheckCheck size={16} /> : <Copy size={16} />}
                    </button>
                    <button
                        onClick={clearHistory}
                        className="text-gray-400 hover:text-white p-1 rounded transition-colors"
                        disabled={history.length === 0}
                        title="清除历史"
                    >
                        <RotateCcw size={16} />
                    </button>
                </div>
            </div>

            <div className="p-4 h-64 overflow-y-auto font-mono text-sm" style={{ backgroundColor: '#0D1117' }}>
                {history.length === 0 ? (
                    <div className="text-gray-400 italic">
                        在此终端中执行命令，了解更多信息，请输入 help
                    </div>
                ) : (
                    history.map((item, index) => (
                        <div key={index} className="mb-2">
                            {item.type === 'command' ? (
                                <div className="flex items-start">
                                    <span className="text-green-400 mr-2">$</span>
                                    <span>{item.text}</span>
                                </div>
                            ) : (
                                <div className={`pl-4 border-l-2 ${item.success ? 'border-green-500 text-gray-300' : 'border-red-500 text-red-300'} whitespace-pre-wrap`}>
                                    {item.text}
                                </div>
                            )}
                        </div>
                    ))
                )}
                <div ref={bottomRef}></div>
            </div>

            <form onSubmit={handleSubmit} className="flex items-center p-2 bg-gray-800 dark:bg-gray-800 border-t border-gray-700">
                <div className="text-green-400 mr-2">$</div>
                <input
                    type="text"
                    value={command}
                    onChange={(e) => setCommand(e.target.value)}
                    placeholder={isOnline ? "输入命令..." : "代理离线，无法执行命令"}
                    disabled={!isOnline || loading}
                    className="flex-1 bg-transparent border-none outline-none text-white placeholder-gray-500"
                />
                <button
                    type="submit"
                    disabled={!command.trim() || !isOnline || loading}
                    className={`ml-2 p-1 rounded ${(!command.trim() || !isOnline || loading) ? 'text-gray-500' : 'text-blue-500 hover:text-blue-400'}`}
                >
                    <Send size={16} />
                </button>
            </form>
        </div>
    );
}
