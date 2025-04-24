'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Send, RotateCcw, Copy, CheckCheck, X, Terminal as TerminalIcon, AlertTriangle } from 'lucide-react';
import useMqttStore from '@/store/mqttStore';

// 常量定义
const HISTORY_MAX_LENGTH = 500; // 历史记录最大条数
const COMMAND_HISTORY_MAX = 100; // 命令历史记录最大条数

// 特殊键代码映射
const SPECIAL_KEYS = {
  ESCAPE: '\u001b',
  CTRL_C: '\u0003',
  CTRL_D: '\u0004',
  CTRL_Z: '\u001a',
  BACKSPACE: '\u0008',
  TAB: '\u0009',
  ENTER: '\r',
  UP: '\u001b[A',
  DOWN: '\u001b[B',
  RIGHT: '\u001b[C',
  LEFT: '\u001b[D',
  HOME: '\u001b[H',
  END: '\u001b[F',
  DELETE: '\u001b[3~',
  PAGE_UP: '\u001b[5~',
  PAGE_DOWN: '\u001b[6~'
};

// 需要特殊处理的命令列表（通常需要强制中断）
const SPECIAL_COMMANDS = ['vim', 'vi', 'nano', 'emacs', 'less', 'more', 'top', 'htop', 'ping', 'traceroute', 'ssh', 'telnet'];

/**
 * 改进的终端组件
 * 提供更真实的终端体验，支持完整的键盘交互
 */
export default function TerminalComponent({ agentId, agentUuid, isOnline = true }) {
  // MQTT 状态
  const {
    connected: mqttConnected,
    sendCommand,
    startTerminalSession,
    endTerminalSession,
    interruptCommand
  } = useMqttStore();

  // 基础状态
  const [sessionId, setSessionId] = useState(null);
  const [command, setCommand] = useState('');
  const [history, setHistory] = useState([]);
  const [commandHistory, setCommandHistory] = useState([]);
  const [historyIndex, setHistoryIndex] = useState(-1);
  const [interactiveMode, setInteractiveMode] = useState(false);
  const [inputBuffer, setInputBuffer] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [copied, setCopied] = useState(false);
  const [currentCommand, setCurrentCommand] = useState(null);
  const [commandCounter, setCommandCounter] = useState(0);

  // Refs
  const terminalRef = useRef(null);
  const inputRef = useRef(null);
  const outputRef = useRef(null);
  const bottomRef = useRef(null);
  const autoScrollRef = useRef(true);
  const isMountedRef = useRef(false);
  const interruptCountRef = useRef(0);
  const responseBufferRef = useRef({});
  const pendingCommandRef = useRef(null);

  // 初始化终端会话
  useEffect(() => {
    isMountedRef.current = true;

    const initTerminal = async () => {
      if (!agentUuid || !isOnline) {
        setError(isOnline ? '代理ID无效' : '代理当前离线');
        return;
      }

      try {
        // 确保MQTT连接
        if (!mqttConnected) {
          await useMqttStore.getState().connect();
        }

        // 创建新的终端会话
        const newSessionId = startTerminalSession(agentUuid);
        setSessionId(newSessionId);

        // 添加欢迎消息
        setHistory([
          {
            type: 'system',
            text: `已连接到代理 ${agentUuid} 的终端。\n输入命令开始操作，支持所有常规Linux命令。\n按 Ctrl+C 可以中断命令执行。`
          }
        ]);

        console.log(`终端会话已创建: ${newSessionId}`);
      } catch (err) {
        console.error('初始化终端失败:', err);
        setError(`初始化终端失败: ${err.message}`);
      }
    };

    initTerminal();

    // 清理函数
    return () => {
      isMountedRef.current = false;
      
      // 结束终端会话
      if (sessionId) {
        try {
          if (interactiveMode || loading) {
            // 尝试中断正在执行的命令
            interruptCommand(sessionId).catch(err => 
              console.error('中断命令失败:', err)
            );
          }
          endTerminalSession(sessionId);
        } catch (err) {
          console.error('终端会话清理失败:', err);
        }
      }
    };
  }, [agentUuid, isOnline, mqttConnected, startTerminalSession, endTerminalSession, interruptCommand]);

  // 自动滚动到底部
  const scrollToBottom = useCallback(() => {
    if (bottomRef.current && autoScrollRef.current) {
      bottomRef.current.scrollIntoView({ behavior: 'auto' });
    }
  }, []);

  // 监听历史变化自动滚动
  useEffect(() => {
    scrollToBottom();
  }, [history, interactiveMode, inputBuffer, scrollToBottom]);

  // 监听滚动事件以控制自动滚动行为
  useEffect(() => {
    const handleScroll = () => {
      if (!outputRef.current || !isMountedRef.current) return;
      
      const { scrollTop, scrollHeight, clientHeight } = outputRef.current;
      // 如果用户滚动到接近底部，恢复自动滚动
      const isAtBottom = Math.abs(scrollHeight - scrollTop - clientHeight) < 20;
      autoScrollRef.current = isAtBottom;
    };

    const outputElement = outputRef.current;
    if (outputElement) {
      outputElement.addEventListener('scroll', handleScroll);
      return () => outputElement.removeEventListener('scroll', handleScroll);
    }
  }, []);

  // 发送命令的核心方法
  const executeCommand = useCallback(async (cmdString) => {
    if (!cmdString.trim() || !isOnline || !sessionId || !isMountedRef.current) {
      return false;
    }

    // 防止并发执行
    if (loading || pendingCommandRef.current) {
      console.log('命令正在执行中，请等待...');
      return false;
    }

    try {
      // 记录当前命令
      const trimmedCmd = cmdString.trim();
      const cmdId = commandCounter + 1;
      setCommandCounter(cmdId);
      
      // 更新命令历史
      setCommandHistory(prev => {
        if (prev.length > 0 && prev[prev.length - 1] === trimmedCmd) {
          return prev;
        }
        return [...prev, trimmedCmd].slice(-COMMAND_HISTORY_MAX);
      });
      
      // 重置历史浏览索引
      setHistoryIndex(-1);
      
      // 更新状态
      setLoading(true);
      setCommand('');
      
      // 添加命令到历史记录
      setHistory(prev => {
        const newHistory = [...prev, { type: 'command', text: trimmedCmd, id: cmdId }];
        return newHistory.slice(-HISTORY_MAX_LENGTH);
      });

      // 处理内置命令
      if (trimmedCmd === 'clear') {
        setHistory([]);
        setLoading(false);
        return true;
      }

      if (trimmedCmd === 'exit') {
        setHistory(prev => [...prev, {
          type: 'system',
          text: '终端会话已结束。刷新页面可重新开始。'
        }]);
        
        endTerminalSession(sessionId);
        setSessionId(null);
        setLoading(false);
        return true;
      }

      // 检测交互式命令
      const cmdParts = trimmedCmd.split(/\s+/);
      const baseCmd = cmdParts[0].toLowerCase();
      const isInteractive = SPECIAL_COMMANDS.includes(baseCmd);
      
      // 重置中断计数
      interruptCountRef.current = 0;
      responseBufferRef.current[cmdId] = '';
      
      // 如果是交互式命令，进入交互模式
      if (isInteractive) {
        setInteractiveMode(true);
        setInputBuffer('');
        
        // 添加交互模式提示
        setHistory(prev => [...prev, {
          type: 'system',
          text: `进入交互式模式，使用键盘直接与应用交互。按 Ctrl+C 可退出。`
        }]);
      }

      // 创建命令对象记录
      const commandObj = {
        id: cmdId,
        text: trimmedCmd,
        startTime: new Date(),
        interactive: isInteractive
      };
      
      setCurrentCommand(commandObj);
      pendingCommandRef.current = commandObj;

      // 发送命令到代理
      const response = await sendCommand(agentUuid, 'execute', {
        command: trimmedCmd,
        sessionId,
        streaming: true,
        interactive: isInteractive,
        requestId: `cmd-${cmdId}-${Date.now()}`,
        timestamp: Date.now()
      });

      // 首次响应处理
      if (response) {
        const outputText = response.output || response.message || '';
        
        // 更新响应缓冲区
        responseBufferRef.current[cmdId] = (responseBufferRef.current[cmdId] || '') + outputText;
        
        // 添加到历史记录
        setHistory(prev => {
          // 查找现有响应
          const existingIndex = prev.findIndex(
            item => item.type === 'response' && item.commandId === cmdId
          );
          
          if (existingIndex >= 0) {
            // 更新现有响应
            const updatedHistory = [...prev];
            updatedHistory[existingIndex].text = responseBufferRef.current[cmdId];
            return updatedHistory;
          } else {
            // 创建新响应
            return [...prev, {
              type: 'response',
              commandId: cmdId,
              text: responseBufferRef.current[cmdId],
              success: response.success !== false
            }];
          }
        });

        // 如果是最终响应，完成命令
        if (response.final === true) {
          console.log("收到最终响应，重置终端状态");
          pendingCommandRef.current = null;
          setCurrentCommand(null);
          setLoading(false);
          setInteractiveMode(false);
        }
      }

      return true;
    } catch (err) {
      console.error('命令执行失败:', err);
      
      // 添加错误消息
      setHistory(prev => [...prev, {
        type: 'error',
        text: `执行错误: ${err.message || '未知错误'}`
      }]);
      
      // 重置状态
      pendingCommandRef.current = null;
      setCurrentCommand(null);
      setLoading(false);
      setInteractiveMode(false);
      
      return false;
    }
  }, [agentUuid, sessionId, isOnline, loading, commandCounter, endTerminalSession, sendCommand]);

  // 交互式输入处理
  const sendInteractiveInput = useCallback(async (input) => {
    if (!sessionId || !agentUuid || !isMountedRef.current || !interactiveMode) {
      return false;
    }

    try {
      // 特殊处理Ctrl+C
      if (input === SPECIAL_KEYS.CTRL_C) {
        await handleInterrupt();
        return true;
      }

      // 更新本地输入缓冲区
      if (input === SPECIAL_KEYS.BACKSPACE) {
        setInputBuffer(prev => prev.slice(0, -1));
      } else if (input === SPECIAL_KEYS.ENTER) {
        setInputBuffer('');
      } else if (input.length === 1) {
        setInputBuffer(prev => prev + input);
      }

      // 通过MQTT发送按键输入
      await sendCommand(agentUuid, 'terminal_input', {
        sessionId,
        input,
        timestamp: Date.now()
      });

      return true;
    } catch (err) {
      console.error('发送交互式输入失败:', err);
      
      // 添加错误消息
      if (isMountedRef.current) {
        setHistory(prev => [...prev, {
          type: 'error',
          text: `发送输入失败: ${err.message || '未知错误'}`
        }]);
      }
      
      return false;
    }
  }, [sessionId, agentUuid, interactiveMode, sendCommand]);

  // 中断命令
  const handleInterrupt = useCallback(async () => {
    if (!sessionId || !agentUuid || !isMountedRef.current) {
      return false;
    }

    try {
      // 增加中断计数
      interruptCountRef.current += 1;
      const attemptCount = interruptCountRef.current;
      
      // 显示中断信号
      setHistory(prev => [...prev, { 
        type: 'system', 
        text: `^C (中断信号)` 
      }]);
      
      // 清除输入缓冲区
      setInputBuffer('');

      // 使用中断命令API
      await interruptCommand(sessionId);
      
      // 同时发送Ctrl+C信号
      await sendCommand(agentUuid, 'terminal_input', {
        sessionId,
        input: SPECIAL_KEYS.CTRL_C,
        timestamp: Date.now()
      });

      // 对于重复中断请求，使用强制中断
      if (attemptCount > 1) {
        await sendCommand(agentUuid, 'force_interrupt', {
          sessionId,
          requestId: `interrupt-${Date.now()}`,
          timestamp: Date.now()
        });
      }

      // 如果多次尝试仍未成功，发送更强力的终止命令
      if (attemptCount > 2 && currentCommand) {
        const cmdParts = currentCommand.text.split(/\s+/);
        const baseCmd = cmdParts[0].toLowerCase();
        
        // 针对特定命令发送终止信号
        await sendCommand(agentUuid, 'execute', {
          command: `pkill -9 ${baseCmd}`,
          sessionId,
          streaming: false,
          silent: true,
          requestId: `kill-${Date.now()}`
        });
      }

      // 在中断后重置终端状态
      setLoading(false);
      setInteractiveMode(false);
      pendingCommandRef.current = null;
      setCurrentCommand(null);

      return true;
    } catch (err) {
      console.error('发送中断信号失败:', err);
      
      // 确保在错误情况下也重置状态
      setLoading(false);
      setInteractiveMode(false);
      pendingCommandRef.current = null;
      setCurrentCommand(null);
      
      return false;
    }
  }, [sessionId, agentUuid, currentCommand, interruptCommand, sendCommand]);

  // 处理键盘事件 - 改进版
  const handleKeyDown = useCallback((e) => {
    // 如果组件已卸载，不处理事件
    if (!isMountedRef.current) return;

    // 检查是否在终端区域内
    if (!terminalRef.current?.contains(e.target)) return;

    // 处理Ctrl+C (中断命令)
    if (e.ctrlKey && (e.key === 'c' || e.keyCode === 67)) {
      e.preventDefault();

      if (loading || interactiveMode) {
        handleInterrupt();
        return;
      }
    }

    // 交互式模式下的键盘处理
    if (interactiveMode) {
      e.preventDefault();

      // 映射特殊键
      let input = null;

      if (e.key === 'Escape') input = SPECIAL_KEYS.ESCAPE;
      else if (e.ctrlKey && e.key === 'c') input = SPECIAL_KEYS.CTRL_C;
      else if (e.ctrlKey && e.key === 'd') input = SPECIAL_KEYS.CTRL_D;
      else if (e.ctrlKey && e.key === 'z') input = SPECIAL_KEYS.CTRL_Z;
      else if (e.key === 'Backspace') input = SPECIAL_KEYS.BACKSPACE;
      else if (e.key === 'Tab') input = SPECIAL_KEYS.TAB;
      else if (e.key === 'Enter') input = SPECIAL_KEYS.ENTER;
      else if (e.key === 'ArrowUp') input = SPECIAL_KEYS.UP;
      else if (e.key === 'ArrowDown') input = SPECIAL_KEYS.DOWN;
      else if (e.key === 'ArrowRight') input = SPECIAL_KEYS.RIGHT;
      else if (e.key === 'ArrowLeft') input = SPECIAL_KEYS.LEFT;
      else if (e.key === 'Home') input = SPECIAL_KEYS.HOME;
      else if (e.key === 'End') input = SPECIAL_KEYS.END;
      else if (e.key === 'Delete') input = SPECIAL_KEYS.DELETE;
      else if (e.key === 'PageUp') input = SPECIAL_KEYS.PAGE_UP;
      else if (e.key === 'PageDown') input = SPECIAL_KEYS.PAGE_DOWN;
      else if (e.key.length === 1) input = e.key;

      if (input !== null) {
        sendInteractiveInput(input);
      }
      
      return;
    }

    // 非交互模式键盘处理
    
    // 命令提交 (Enter键)
    if (e.key === 'Enter' && command.trim() && !loading) {
      e.preventDefault();
      executeCommand(command);
      return;
    }
    
    // 命令历史浏览 (上下键)
    if (e.key === 'ArrowUp' && commandHistory.length > 0) {
      e.preventDefault();
      const newIndex = historyIndex < commandHistory.length - 1 ? historyIndex + 1 : historyIndex;
      setHistoryIndex(newIndex);
      setCommand(commandHistory[commandHistory.length - 1 - newIndex] || '');
    } else if (e.key === 'ArrowDown' && historyIndex > -1) {
      e.preventDefault();
      const newIndex = historyIndex - 1;
      setHistoryIndex(newIndex);
      setCommand(newIndex >= 0 ? commandHistory[commandHistory.length - 1 - newIndex] : '');
    }
    
    // Tab键聚焦输入框
    if (e.key === 'Tab' && e.target.tagName !== 'INPUT') {
      e.preventDefault();
      inputRef.current?.focus();
    }
  }, [command, historyIndex, commandHistory, loading, interactiveMode, executeCommand, sendInteractiveInput, handleInterrupt]);

  // 全局键盘事件处理
  useEffect(() => {
    const handleGlobalKeyDown = (e) => {
      if (!isMountedRef.current) return;

      // 确保只处理终端内的按键事件
      if (!terminalRef.current?.contains(e.target) &&
          !terminalRef.current?.contains(document.activeElement)) {
        return;
      }

      // 特别处理Ctrl+C - 中断命令
      if (e.ctrlKey && (e.key === 'c' || e.keyCode === 67)) {
        if (interactiveMode || loading) {
          e.preventDefault();
          e.stopPropagation();
          handleInterrupt();
          return false;
        }
      }
      
      // 交给主键盘处理函数处理
      handleKeyDown(e);
    };

    // 使用捕获阶段确保能拦截事件
    document.addEventListener('keydown', handleGlobalKeyDown, true);
    return () => document.removeEventListener('keydown', handleGlobalKeyDown, true);
  }, [handleKeyDown, interactiveMode, loading, handleInterrupt]);

  // 接收MQTT消息更新
  useEffect(() => {
    if (!sessionId) return;
    
    // 创建响应处理器
    const handleMqttResponse = (topic, message) => {
      try {
        if (!topic.startsWith('uranus/response/') || !message || !isMountedRef.current) return;
        
        const payload = typeof message === 'string' ? JSON.parse(message) : message;
        
        // 确保消息属于当前会话
        if (payload.sessionId && payload.sessionId === sessionId) {
          // 检查命令状态
          if (payload.command === 'execute' || (!payload.command && payload.output !== undefined)) {
            const outputText = payload.output || payload.message || '';
            const requestId = payload.requestId || '';
            const commandId = parseInt(requestId.split('-')[1]) || commandCounter;
            
            // 更新响应缓冲区
            responseBufferRef.current[commandId] = (responseBufferRef.current[commandId] || '') + outputText;
            
            // 命令完成状态
            const isFinal = payload.final === true;
            
            // 输出调试信息
            console.log(`收到命令响应 [${commandId}] final=${isFinal}, success=${payload.success}:`, 
                        payload.output ? payload.output.substring(0, 100) + '...' : 'no output');
            
            // 更新历史记录
            setHistory(prev => {
              // 查找现有响应
              const existingIndex = prev.findIndex(
                item => item.type === 'response' && item.commandId === commandId
              );
              
              if (existingIndex >= 0) {
                // 更新现有响应
                const updatedHistory = [...prev];
                updatedHistory[existingIndex].text = responseBufferRef.current[commandId];
                return updatedHistory;
              } else {
                // 创建新响应
                return [...prev, {
                  type: 'response',
                  commandId,
                  text: responseBufferRef.current[commandId],
                  final: isFinal,
                  success: payload.success !== false
                }];
              }
            });
            
            // 如果是最终响应，完成命令 - 无论成功还是失败
            if (isFinal) {
              console.log(`命令 ${commandId} 已完成，重置终端状态`);
              
              if (pendingCommandRef.current && pendingCommandRef.current.id === commandId) {
                pendingCommandRef.current = null;
              }
              
              setCurrentCommand(null);
              setLoading(false);
              setInteractiveMode(false);
            }
            
            // 交互式模式状态变更
            if (payload.interactiveMode !== undefined) {
              setInteractiveMode(!!payload.interactiveMode);
            }
          }
        }
      } catch (err) {
        console.error('处理MQTT响应消息失败:', err, message);
        
        // 出错时也要重置状态，防止终端卡住
        pendingCommandRef.current = null;
        setCurrentCommand(null);
        setLoading(false);
        setInteractiveMode(false);
      }
    };
    
    // 设置订阅
    const unsubscribe = useMqttStore.getState().subscribeToResponses(handleMqttResponse);
    
    return () => {
      if (typeof unsubscribe === 'function') {
        unsubscribe();
      }
    };
  }, [sessionId, commandCounter]);

  // 命令表单提交处理
  const handleSubmit = (e) => {
    e?.preventDefault();
    
    if (!command.trim() || loading || !isOnline || !sessionId) {
      return;
    }
    
    executeCommand(command);
  };

  // 清除历史记录
  const clearHistory = () => {
    setHistory([]);
  };

  // 复制历史到剪贴板
  const copyHistory = async () => {
    const text = history
      .map(item => {
        if (item.type === 'command') {
          return `$ ${item.text}`;
        } else {
          return item.text;
        }
      })
      .join('\n\n');

    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => {
        if (isMountedRef.current) {
          setCopied(false);
        }
      }, 2000);
    } catch (err) {
      console.error('复制到剪贴板失败:', err);
      setHistory(prev => [...prev, {
        type: 'error',
        text: '复制到剪贴板失败: ' + (err.message || '浏览器不支持')
      }]);
    }
  };

  // 显示错误状态
  if (error) {
    return (
      <div className="rounded-lg border border-red-200 dark:border-red-700 bg-red-50 dark:bg-red-900/20 p-4 text-red-700 dark:text-red-300">
        <div className="flex items-center mb-2">
          <AlertTriangle className="w-5 h-5 mr-2" />
          <span className="font-medium">终端初始化失败</span>
        </div>
        <p>{error}</p>
        <button
          onClick={() => setError(null)}
          className="mt-3 bg-red-200 dark:bg-red-800 px-3 py-1 rounded text-red-700 dark:text-red-200 hover:bg-red-300 dark:hover:bg-red-700 transition-colors"
        >
          重试
        </button>
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-gray-200 dark:border-gray-700 bg-black text-white dark:bg-gray-900 overflow-hidden" ref={terminalRef}>
      {/* 终端标题栏 */}
      <div className="flex justify-between items-center px-4 py-2 bg-gray-800 dark:bg-gray-800 border-b border-gray-700">
        <div className="flex items-center">
          <div className="flex space-x-2 mr-2">
            <div className="w-3 h-3 rounded-full bg-red-500"></div>
            <div className="w-3 h-3 rounded-full bg-yellow-500"></div>
            <div className="w-3 h-3 rounded-full bg-green-500"></div>
          </div>
          <span className="text-sm font-medium flex items-center">
            <TerminalIcon className="w-4 h-4 mr-1" />
            终端
          </span>
          {mqttConnected && (
            <span className="ml-2 text-xs px-1.5 py-0.5 bg-blue-600 text-white rounded-full">MQTT</span>
          )}
          {interactiveMode && (
            <span className="ml-2 text-xs px-1.5 py-0.5 bg-purple-600 text-white rounded-full">
              交互式
            </span>
          )}
          {loading && !interactiveMode && (
            <span className="ml-2 text-xs px-1.5 py-0.5 bg-yellow-600 text-white rounded-full flex items-center">
              <span className="animate-pulse mr-1">⚡</span>
              执行中
            </span>
          )}
          {currentCommand && (
            <span className="ml-2 text-xs px-1.5 py-0.5 bg-gray-600 text-white rounded-full truncate max-w-32">
              {currentCommand.text.split(/\s+/)[0]}
            </span>
          )}
        </div>
        <div className="flex space-x-2">
          {(loading || interactiveMode) && (
            <button
              onClick={handleInterrupt}
              className="text-red-400 hover:text-red-300 p-1 rounded transition-colors"
              title="中断命令 (Ctrl+C)"
            >
              <X size={16} />
            </button>
          )}
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

      {/* 终端输出区域 */}
      <div
        className="p-4 h-80 overflow-y-auto font-mono text-sm terminal-output"
        style={{ backgroundColor: '#0D1117' }}
        ref={outputRef}
      >
        {history.length === 0 ? (
          <div className="text-gray-400 italic">
            {sessionId 
              ? '终端已准备就绪。输入命令并按回车执行，使用上下方向键浏览命令历史。'
              : '正在初始化终端会话...'}
          </div>
        ) : (
          history.map((item, index) => (
            <div key={`${index}-${item.type}-${item.commandId || item.id || ''}`} className="mb-2">
              {item.type === 'command' ? (
                <div className="flex items-start">
                  <span className="text-green-400 mr-2">$</span>
                  <span className="break-all">{item.text}</span>
                </div>
              ) : item.type === 'response' ? (
                <div className={`pl-4 border-l-2 ${
                  item.success !== false 
                    ? 'border-green-500 text-gray-300' 
                    : 'border-red-500 text-red-300'
                  } whitespace-pre-wrap break-all`}
                >
                  {item.text}
                </div>
              ) : item.type === 'error' ? (
                <div className="pl-4 border-l-2 border-red-500 text-red-300 whitespace-pre-wrap break-all">
                  {item.text}
                </div>
              ) : (
                <div className="pl-4 text-blue-300 whitespace-pre-wrap break-all">
                  {item.text}
                </div>
              )}
            </div>
          ))
        )}
        
        {interactiveMode && (
          <div className="relative pl-4 border-l-2 border-purple-500 text-white">
            <span className="text-green-400">&gt;</span> <span className="whitespace-pre">{inputBuffer}</span>
            <span className="animate-pulse ml-px">▌</span>
          </div>
        )}
        
        <div ref={bottomRef}></div>
      </div>

      {/* 命令输入区域 */}
      <form onSubmit={handleSubmit} className="flex items-center p-2 bg-gray-800 dark:bg-gray-800 border-t border-gray-700">
        <div className="text-green-400 mr-2">$</div>
        <input
          ref={inputRef}
          type="text"
          value={command}
          onChange={(e) => setCommand(e.target.value)}
          placeholder={
            isOnline
              ? loading 
                ? "命令执行中..." 
                : interactiveMode 
                  ? "交互模式中，使用键盘直接输入..." 
                  : "输入命令..."
              : "代理离线，无法执行命令"
          }
          disabled={!isOnline || loading || interactiveMode || !sessionId}
          className="flex-1 bg-transparent border-none outline-none text-white placeholder-gray-500"
          autoComplete="off"
          spellCheck="false"
        />
        <button
          type="submit"
          disabled={!command.trim() || !isOnline || loading || interactiveMode || !sessionId}
          className={`ml-2 p-1 rounded ${
            !command.trim() || !isOnline || loading || interactiveMode || !sessionId 
              ? 'text-gray-500 cursor-not-allowed' 
              : 'text-blue-500 hover:text-blue-400'
          }`}
        >
          <Send size={16} />
        </button>
      </form>
    </div>
  );
}
