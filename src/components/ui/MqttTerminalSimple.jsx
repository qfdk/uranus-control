'use client';

import React, { useEffect, useRef, useState } from 'react';
import { AlertCircle, XCircle } from 'lucide-react';
import useMqttStore from '@/store/mqttStore';
import { v4 as uuidv4 } from 'uuid';
import toast from 'react-hot-toast';

/**
 * 简易版MQTT终端组件，不依赖xterm
 * 用作临时替代，直到xterm相关包安装完成
 */
const MqttTerminalSimple = ({ agentUuid, isActive = true }) => {
  // 状态管理
  const [error, setError] = useState(null);
  const [isConnecting, setIsConnecting] = useState(false);
  const [sessionId, setSessionId] = useState(null);
  const [terminal, setTerminal] = useState([]);
  const terminalRef = useRef(null);
  const inputRef = useRef(null);
  
  // 用于防止重复处理消息
  const processedMessagesRef = useRef(new Set());

  // MQTT连接状态
  const { connected: mqttConnected, connect } = useMqttStore();

  // 初始化MQTT连接
  useEffect(() => {
    // 只有在组件激活的情况下才连接
    if (isActive && agentUuid && !isConnecting && !sessionId) {
      initializeConnection();
    }
  }, [isActive, agentUuid, mqttConnected]);

  // 处理终端输出滚动
  useEffect(() => {
    if (terminalRef.current) {
      terminalRef.current.scrollTop = terminalRef.current.scrollHeight;
    }
  }, [terminal]);

  // 处理MQTT终端消息
  useEffect(() => {
    if (!sessionId) return;
    
    // 设置终端消息处理回调
    const unsubscribe = useMqttStore.getState().setTerminalCallback(sessionId, (message) => {
      // 生成消息唯一标识（使用类型、时间戳和内容的前20个字符组合）
      const messageContent = typeof message.data === 'string' ? message.data : JSON.stringify(message.data);
      const messageId = `${message.type}-${message.timestamp}-${messageContent.substring(0, 20)}`;
      
      // 检查是否是重复消息
      if (processedMessagesRef.current.has(messageId)) {
        console.log('忽略重复消息:', messageId);
        return;
      }
      
      // 添加到已处理消息集合
      processedMessagesRef.current.add(messageId);
      
      // 设置一个定时器，一段时间后从已处理集合中删除，避免集合无限增长
      setTimeout(() => {
        processedMessagesRef.current.delete(messageId);
      }, 5000);
      
      if (message.type === 'output' && message.data) {
        // 添加输出数据
        setTerminal(prev => [...prev, { type: 'output', content: message.data }]);
      } else if (message.type === 'error') {
        // 添加错误信息
        setTerminal(prev => [...prev, { type: 'error', content: message.data || '未知错误' }]);
        setError(message.data || '终端错误');
      } else if (message.type === 'closed') {
        // 会话已关闭
        setTerminal(prev => [...prev, { type: 'system', content: '会话已关闭' }]);
        setSessionId(null);
      }
    });
    
    // 组件卸载时清除回调
    return () => {
      unsubscribe();
      // 清理处理过的消息集合
      processedMessagesRef.current.clear();
    };
  }, [sessionId]);

  // 初始化连接
  const initializeConnection = async () => {
    if (isConnecting || !agentUuid) return;

    setIsConnecting(true);
    setError(null);
    setTerminal([{ type: 'system', content: '正在连接到代理...' }]);

    try {
      // 确保MQTT已连接
      if (!mqttConnected) {
        await connect();
      }

      // 创建唯一会话ID
      const newSessionId = `term-${uuidv4()}`;
      setSessionId(newSessionId);

      // 添加连接信息
      setTerminal(prev => [...prev, { type: 'system', content: '正在创建终端会话...' }]);

      // 发送创建会话命令
      const result = await useMqttStore.getState().createTerminalSession(agentUuid, newSessionId);

      if (result && result.success) {
        setTerminal(prev => [...prev, { type: 'success', content: '终端会话已创建！' }]);
        
        // 聚焦输入框
        if (inputRef.current) {
          inputRef.current.focus();
        }
        
        toast.success('终端会话已创建');
      } else {
        throw new Error(result?.message || '创建终端会话失败');
      }
    } catch (error) {
      console.error('初始化终端连接失败:', error);
      setError(error.message || '连接失败');
      setTerminal(prev => [...prev, { type: 'error', content: `错误: ${error.message || '连接失败'}` }]);
      toast.error(`连接失败: ${error.message || '未知错误'}`);
      setSessionId(null);
    } finally {
      setIsConnecting(false);
    }
  };

  // 发送终端命令
  const sendCommand = async (e) => {
    e.preventDefault();
    
    if (!inputRef.current || !inputRef.current.value.trim() || !sessionId || !mqttConnected) return;

    const command = inputRef.current.value;
    
    // 添加命令到终端显示
    setTerminal(prev => [...prev, { type: 'command', content: `$ ${command}` }]);
    
    // 清空输入框
    inputRef.current.value = '';
    
    try {
      // 发送命令到服务器
      await useMqttStore.getState().sendTerminalInput(agentUuid, sessionId, command + '\n');
    } catch (error) {
      // 忽略会话ID已存在的错误，因为可能是重复发送
      if (!error.message.includes('会话ID已存在')) {
        console.error('发送命令失败:', error);
        setTerminal(prev => [...prev, { type: 'error', content: `发送命令失败: ${error.message || '未知错误'}` }]);
      }
    }
  };

  // 关闭终端会话
  const closeTerminalSession = async () => {
    if (!sessionId || !mqttConnected || !agentUuid) return;
    
    try {
      setTerminal(prev => [...prev, { type: 'system', content: '正在关闭会话...' }]);
      await useMqttStore.getState().closeTerminalSession(agentUuid, sessionId);
      
      console.log('终端会话已关闭:', sessionId);
      toast.success('终端会话已关闭');
    } catch (error) {
      console.error('关闭终端会话失败:', error);
      toast.error(`关闭会话失败: ${error.message || '未知错误'}`);
    }
  };

  // 重新连接
  const reconnect = () => {
    if (sessionId) {
      closeTerminalSession();
    }
    
    // 清理处理过的消息集合
    processedMessagesRef.current.clear();
    
    setTerminal([]);
    setError(null);
    initializeConnection();
  };

  // 只有在组件激活时渲染
  if (!isActive) return null;

  return (
    <div className="relative w-full h-full bg-gray-900 rounded-lg overflow-hidden flex flex-col">
      {/* 错误提示 */}
      {error && (
        <div className="absolute top-0 left-0 right-0 bg-red-500 text-white px-4 py-2 flex items-center justify-between z-10">
          <div className="flex items-center">
            <AlertCircle className="w-4 h-4 mr-2" />
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
      
      {/* 终端输出区域 */}
      <div 
        ref={terminalRef}
        className={`flex-grow ${error ? 'pt-10' : ''} overflow-auto p-4 font-mono text-sm`}
      >
        {terminal.map((line, index) => {
          let className = "text-gray-200";
          
          if (line.type === 'error') className = "text-red-400";
          else if (line.type === 'success') className = "text-green-400";
          else if (line.type === 'system') className = "text-yellow-400";
          else if (line.type === 'command') className = "text-blue-400";
          
          return (
            <div key={index} className={className}>
              {line.content}
            </div>
          );
        })}
      </div>
      
      {/* 命令输入区域 */}
      {sessionId && (
        <form onSubmit={sendCommand} className="border-t border-gray-700 p-2">
          <div className="flex items-center">
            <span className="text-green-400 mr-2">$</span>
            <input
              ref={inputRef}
              type="text"
              className="flex-grow bg-transparent border-none outline-none text-white font-mono"
              placeholder="输入命令..."
              disabled={isConnecting || !mqttConnected}
            />
          </div>
        </form>
      )}
      
      {/* 关闭按钮 */}
      <div className="absolute top-2 right-2 z-20">
        <button
          onClick={closeTerminalSession}
          className="text-gray-400 hover:text-white bg-gray-700 hover:bg-gray-600 rounded-full p-1"
          title="关闭终端会话"
        >
          <XCircle className="w-5 h-5" />
        </button>
      </div>
    </div>
  );
};

export default MqttTerminalSimple;