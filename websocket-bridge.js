import { WebSocketServer } from 'ws';
import { EventEmitter } from 'events';

/**
 * WebSocket通信桥 - 连接MCP服务器与GUI界面
 * 负责实时广播AI操作数据和终端会话状态
 */
export class WebSocketBridge extends EventEmitter {
    constructor(port = 8080) {
        super();
        this.port = port;
        this.wss = null;
        this.clients = new Set();
        this.isRunning = false;
        
        // 数据缓存，用于新连接的客户端获取历史数据
        this.sessionCache = new Map();
        this.eventHistory = [];
        this.maxHistorySize = 1000;
    }

    /**
     * 启动WebSocket服务器
     */
    start() {
        if (this.isRunning) {
            console.log('WebSocket服务器已在运行');
            return;
        }

        this.wss = new WebSocketServer({ 
            port: this.port,
            host: 'localhost' // 仅允许本地连接
        });

        this.wss.on('connection', (ws, req) => {
            console.log(`GUI客户端已连接: ${req.socket.remoteAddress}`);
            this.clients.add(ws);

            // 发送欢迎消息和历史数据
            this.sendToClient(ws, {
                type: 'connection_established',
                timestamp: new Date().toISOString(),
                data: {
                    message: 'WebSocket连接已建立',
                    sessionCount: this.sessionCache.size,
                    historyCount: this.eventHistory.length
                }
            });

            // 发送会话缓存数据（只发送活跃的会话）
            for (const [sessionId, sessionData] of this.sessionCache) {
                // 只同步状态为活跃的会话
                if (sessionData.status === 'active') {
                    this.sendToClient(ws, {
                        type: 'session_sync',
                        timestamp: new Date().toISOString(),
                        sessionId,
                        data: sessionData
                    });
                }
            }

            // 发送最近的事件历史
            const recentHistory = this.eventHistory.slice(-50); // 最近50个事件
            recentHistory.forEach(event => {
                this.sendToClient(ws, event);
            });

            // 处理客户端断开连接
            ws.on('close', () => {
                console.log('GUI客户端已断开连接');
                this.clients.delete(ws);
            });

            // 处理客户端错误
            ws.on('error', (error) => {
                console.error('WebSocket客户端错误:', error);
                this.clients.delete(ws);
            });

            // 处理客户端消息
            ws.on('message', (data) => {
                try {
                    const message = JSON.parse(data.toString());
                    this.handleClientMessage(ws, message);
                } catch (error) {
                    console.error('解析客户端消息失败:', error);
                }
            });
        });

        this.wss.on('error', (error) => {
            console.error('WebSocket服务器错误:', error);
        });

        this.isRunning = true;
        console.log(`WebSocket服务器已启动，端口: ${this.port}`);
        this.emit('server_started', { port: this.port });
    }

    /**
     * 停止WebSocket服务器
     */
    stop() {
        if (!this.isRunning) {
            return;
        }

        // 关闭所有客户端连接
        this.clients.forEach(ws => {
            ws.close();
        });
        this.clients.clear();

        // 关闭服务器
        if (this.wss) {
            this.wss.close();
            this.wss = null;
        }

        this.isRunning = false;
        console.log('WebSocket服务器已停止');
        this.emit('server_stopped');
    }

    /**
     * 处理客户端消息
     */
    handleClientMessage(ws, message) {
        const { type, data } = message;

        switch (type) {
            case 'ping':
                this.sendToClient(ws, {
                    type: 'pong',
                    timestamp: new Date().toISOString()
                });
                break;

            case 'request_session_data':
                const sessionId = data?.sessionId;
                if (sessionId && this.sessionCache.has(sessionId)) {
                    this.sendToClient(ws, {
                        type: 'session_data',
                        timestamp: new Date().toISOString(),
                        sessionId,
                        data: this.sessionCache.get(sessionId)
                    });
                }
                break;

            case 'request_history':
                const count = Math.min(data?.count || 50, 200);
                const history = this.eventHistory.slice(-count);
                this.sendToClient(ws, {
                    type: 'history_data',
                    timestamp: new Date().toISOString(),
                    data: history
                });
                break;

            default:
                console.log('收到未知类型的客户端消息:', type);
        }
    }

    /**
     * 广播MCP工具调用事件
     */
    broadcastToolCall(toolName, args, sessionId, status = 'executing') {
        const event = {
            type: 'tool_call',
            timestamp: new Date().toISOString(),
            sessionId,
            data: {
                tool: toolName,
                args,
                status
            }
        };

        this.broadcastEvent(event);
        this.addToHistory(event);
    }

    /**
     * 广播会话创建事件
     */
    broadcastSessionCreated(sessionData) {
        const { sessionId } = sessionData;
        
        // 更新会话缓存
        this.sessionCache.set(sessionId, {
            ...sessionData,
            createdAt: new Date().toISOString(),
            output: [],
            status: 'active'
        });

        const event = {
            type: 'session_created',
            timestamp: new Date().toISOString(),
            sessionId,
            data: sessionData
        };

        this.broadcastEvent(event);
        this.addToHistory(event);
    }

    /**
     * 广播终端输出事件
     */
    broadcastTerminalOutput(sessionId, output) {
        // 更新会话缓存中的输出
        if (this.sessionCache.has(sessionId)) {
            const sessionData = this.sessionCache.get(sessionId);
            sessionData.output = sessionData.output || [];
            sessionData.output.push(...output);
            
            // 限制输出历史长度
            if (sessionData.output.length > 1000) {
                sessionData.output = sessionData.output.slice(-1000);
            }
            
            sessionData.lastActivity = new Date().toISOString();
        }

        const event = {
            type: 'terminal_output',
            timestamp: new Date().toISOString(),
            sessionId,
            data: {
                output: output.filter(line => line.trim()) // 过滤空行
            }
        };

        this.broadcastEvent(event);
        this.addToHistory(event);
    }

    /**
     * 广播会话关闭事件
     */
    broadcastSessionClosed(sessionId, exitCode = null) {
        // 更新会话缓存状态
        if (this.sessionCache.has(sessionId)) {
            const sessionData = this.sessionCache.get(sessionId);
            sessionData.status = 'closed';
            sessionData.exitCode = exitCode;
            sessionData.closedAt = new Date().toISOString();
        }

        const event = {
            type: 'session_closed',
            timestamp: new Date().toISOString(),
            sessionId,
            data: { exitCode }
        };

        this.broadcastEvent(event);
        this.addToHistory(event);
    }

    /**
     * 广播错误事件
     */
    broadcastError(sessionId, error, context = null) {
        const event = {
            type: 'error_occurred',
            timestamp: new Date().toISOString(),
            sessionId,
            data: {
                error: error.message || error,
                context
            }
        };

        this.broadcastEvent(event);
        this.addToHistory(event);
    }

    /**
     * 向所有连接的客户端广播事件
     */
    broadcastEvent(event) {
        if (this.clients.size === 0) {
            return; // 没有连接的客户端
        }

        const message = JSON.stringify(event);
        const deadClients = new Set();

        this.clients.forEach(ws => {
            try {
                if (ws.readyState === ws.OPEN) {
                    ws.send(message);
                } else {
                    deadClients.add(ws);
                }
            } catch (error) {
                console.error('发送消息到客户端失败:', error);
                deadClients.add(ws);
            }
        });

        // 清理断开的连接
        deadClients.forEach(ws => {
            this.clients.delete(ws);
        });
    }

    /**
     * 向特定客户端发送消息
     */
    sendToClient(ws, event) {
        try {
            if (ws.readyState === ws.OPEN) {
                ws.send(JSON.stringify(event));
            }
        } catch (error) {
            console.error('发送消息到客户端失败:', error);
            this.clients.delete(ws);
        }
    }

    /**
     * 添加事件到历史记录
     */
    addToHistory(event) {
        this.eventHistory.push(event);
        
        // 限制历史记录大小
        if (this.eventHistory.length > this.maxHistorySize) {
            this.eventHistory = this.eventHistory.slice(-this.maxHistorySize);
        }
    }

    /**
     * 获取连接状态
     */
    getStatus() {
        return {
            isRunning: this.isRunning,
            port: this.port,
            clientCount: this.clients.size,
            sessionCount: this.sessionCache.size,
            historyCount: this.eventHistory.length
        };
    }

    /**
     * 检查是否有活跃的WebSocket连接
     */
    hasActiveConnections() {
        return this.clients.size > 0;
    }

    /**
     * 获取活跃连接数
     */
    getActiveConnectionCount() {
        return this.clients.size;
    }

    /**
     * 向所有客户端发送ping，检查真正活跃的连接数
     * 这个方法已经通过独立测试程序验证成功
     */
    async pingAllClients() {
        console.log(`🏓 开始ping测试 (客户端数: ${this.clients.size})`);

        if (this.clients.size === 0) {
            console.log('⚠️ 没有客户端连接');
            return 0;
        }

        const pingPromises = [];
        const deadClients = new Set();

        this.clients.forEach(ws => {
            if (ws.readyState === ws.OPEN) {
                const pingPromise = new Promise((resolve) => {
                    const pingTimestamp = new Date().toISOString();
                    let pongReceived = false;

                    const timeout = setTimeout(() => {
                        if (!pongReceived) {
                            console.log(`⏰ Ping超时: ${pingTimestamp}`);
                            deadClients.add(ws);
                            resolve(false);
                        }
                    }, 2000);

                    // 临时存储pong处理器
                    const pongHandler = (data) => {
                        try {
                            const message = JSON.parse(data.toString());
                            if (message.type === 'pong' && message.originalTimestamp === pingTimestamp) {
                                pongReceived = true;
                                clearTimeout(timeout);
                                ws.removeListener('message', pongHandler);
                                console.log(`✅ 收到pong响应: ${pingTimestamp}`);
                                resolve(true);
                            }
                        } catch (e) {
                            // 忽略解析错误
                        }
                    };

                    try {
                        const pingMessage = {
                            type: 'ping',
                            timestamp: pingTimestamp
                        };

                        ws.send(JSON.stringify(pingMessage));
                        console.log(`📤 发送ping: ${pingTimestamp}`);

                        // 监听pong响应
                        ws.on('message', pongHandler);

                    } catch (error) {
                        console.error(`❌ 发送ping失败: ${error}`);
                        clearTimeout(timeout);
                        deadClients.add(ws);
                        resolve(false);
                    }
                });

                pingPromises.push(pingPromise);
            } else {
                console.log(`❌ 连接状态不是OPEN: ${ws.readyState}`);
                deadClients.add(ws);
            }
        });

        const results = await Promise.all(pingPromises);
        const activeCount = results.filter(result => result === true).length;

        console.log(`📊 Ping测试结果: ${activeCount}/${this.clients.size} 个连接活跃`);

        // 清理断开的连接
        deadClients.forEach(ws => {
            this.clients.delete(ws);
        });

        return activeCount;
    }

    /**
     * 清理资源
     */
    cleanup() {
        this.stop();
        this.sessionCache.clear();
        this.eventHistory = [];
        this.removeAllListeners();
    }
}
