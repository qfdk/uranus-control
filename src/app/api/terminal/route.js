// src/app/api/terminal/route.js
import { NextResponse } from 'next/server';

export async function GET(request) {
    const { searchParams } = new URL(request.url);
    const uuid = searchParams.get('uuid');

    const html = `<!DOCTYPE html>
    <html>
    <head>
      <title>终端</title>
      <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/xterm@5.3.0/css/xterm.css" />
      <script src="https://cdn.jsdelivr.net/npm/xterm@5.3.0/lib/xterm.js"></script>
      <script src="https://cdn.jsdelivr.net/npm/xterm-addon-fit@0.7.0/lib/xterm-addon-fit.js"></script>
      <script src="https://cdn.jsdelivr.net/npm/mqtt/dist/mqtt.min.js"></script>
      <style>
        body { margin: 0; padding: 16px; background: #0D1117; height: calc(100vh - 32px); }
        #terminal { width: 100%; height: 100%; border-radius: 6px; }
        .status-bar { position: absolute; bottom: 0; left: 0; right: 0; background: rgba(0,0,0,0.7); 
                     padding: 5px 10px; font-size: 12px; display: flex; justify-content: space-between; 
                     z-index: 10; color: #ddd; }
      </style>
    </head>
    <body>
      <div id="terminal"></div>
      <div class="status-bar">
        <span id="status-indicator">未连接</span>
        <div>
          <button onclick="sendInterrupt()">Ctrl+C</button>
          <button onclick="clearTerminal()">清屏</button>
          <button onclick="reconnect()">重连</button>
        </div>
      </div>
      <script>
        const agentUuid = "${uuid}";
        let term, fitAddon;
        let mqttClient = null;
        let sessionId = null;
        
        function init() {
          term = new Terminal({
            cursorBlink: true,
            fontSize: 14,
            fontFamily: 'Menlo, Monaco, "Courier New", monospace',
            theme: { background: '#0D1117', foreground: '#E5E9F0' }
          });
          
          fitAddon = new FitAddon.FitAddon();
          term.loadAddon(fitAddon);
          
          term.open(document.getElementById('terminal'));
          fitAddon.fit();
          
          term.writeln('\\x1b[1;34m欢迎使用终端\\x1b[0m');
          
          connectMqtt();
          
          window.addEventListener('resize', () => {
            try { fitAddon.fit(); } catch(e) {}
          });
        }
        
        function connectMqtt() {
          mqttClient = mqtt.connect('wss://mqtt.qfdk.me/mqtt', {
            clientId: 'term-' + Math.random().toString(36).substring(2, 15),
            clean: true
          });
          
          mqttClient.on('connect', () => {
            mqttClient.subscribe('uranus/response/' + agentUuid);
            
            sessionId = 'term-' + Date.now() + '-' + Math.random().toString(36).substring(2, 8);
            
            term.writeln('\\x1b[33m正在创建终端会话...\\x1b[0m');
            sendCommand('interactiveShell', {
              sessionId,
              cols: term.cols,
              rows: term.rows
            });
            
            term.onData(data => {
              sendCommand('terminal_input', {
                sessionId,
                input: data
              });
            });
          });
          
          mqttClient.on('message', (topic, message) => {
            try {
              const data = JSON.parse(message.toString());
              const output = data.output || data.message || '';
              if (output) term.write(output);
            } catch(e) {}
          });
        }
        
        function sendCommand(command, params) {
          if (!mqttClient || !mqttClient.connected) return;
          
          const payload = {
            ...params,
            command,
            requestId: 'cmd-' + Date.now() + '-' + Math.random().toString(36).substring(2, 8),
            timestamp: Date.now()
          };
          
          mqttClient.publish('uranus/command/' + agentUuid, JSON.stringify(payload));
        }
        
        function sendInterrupt() {
          if (sessionId) sendCommand('terminal_input', { sessionId, input: '\\u0003' });
        }
        
        function clearTerminal() {
          if (term) term.clear();
        }
        
        function reconnect() {
          if (mqttClient) mqttClient.end();
          if (term) term.dispose();
          init();
        }
        
        window.onload = init;
        
        window.onunload = () => {
          if (mqttClient && sessionId) {
            sendCommand('closeTerminal', { sessionId });
            mqttClient.end();
          }
        };
      </script>
    </body>
    </html>`;

    return new NextResponse(html, {
        headers: {'Content-Type': 'text/html'}
    });
}
