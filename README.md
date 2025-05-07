# Uranus Control

本项目是Uranus系统的控制前端，使用Next.js实现。

## MQTT终端实现说明

本项目中实现了基于MQTT的远程终端功能，类似于GoTTY，但使用MQTT代替WebSocket进行通信。

### 实现原理

1. **前端**:
   - 使用xterm.js创建终端界面
   - 通过MQTT协议发送终端命令和接收输出
   - 管理终端会话的生命周期

2. **后端**:
   - MQTT服务处理终端命令
   - 创建终端会话并执行命令
   - 将命令输出通过MQTT发送回前端

3. **通信流程**:
   - 客户端建立MQTT连接并创建会话
   - 客户端将终端输入通过MQTT发送到服务器
   - 服务器执行命令并将输出通过MQTT发送回客户端
   - 客户端在终端中显示输出

### MQTT主题设计

- `uranus/command/{代理UUID}`: 发送命令到指定代理
- `uranus/response/{代理UUID}`: 接收来自代理的响应
- `uranus/heartbeat`: 心跳主题
- `uranus/status`: 状态主题

### 终端会话命令

1. **创建会话**:
   ```json
   {
     "command": "terminal",
     "type": "create",
     "sessionId": "唯一会话ID", 
     "requestId": "请求ID"
   }
   ```

2. **发送输入**:
   ```json
   {
     "command": "terminal",
     "type": "input",
     "sessionId": "对应会话ID",
     "data": "终端输入内容",
     "requestId": "请求ID"
   }
   ```

3. **调整大小**:
   ```json
   {
     "command": "terminal",
     "type": "resize",
     "sessionId": "对应会话ID",
     "data": {
       "cols": 80,
       "rows": 24
     },
     "requestId": "请求ID"
   }
   ```

### 响应格式

```json
{
  "success": true,
  "requestId": "对应请求ID",
  "sessionId": "对应会话ID",
  "type": "操作类型", // created, output, error
  "data": "输出内容", // 当type为output时
  "message": "消息说明" // 可选
}
```

## 安装依赖

```bash
# 安装依赖
pnpm install

# 启动开发服务器
pnpm dev
```
