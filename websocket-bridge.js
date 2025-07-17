import { WebSocketServer } from 'ws';
import { EventEmitter } from 'events';
import { WEBSOCKET_EVENTS, EventManager } from './events.js';

// 专用日志函数 - 输出到stderr但不显示为错误
function wsLog(message) {
    process.stderr.write(`[WebSocket] ${message}\n`);
}

/**
 * 数据缓存管理器 - 专门负责会话数据和事件历史的缓存
 */
class DataCache {
    constructor(config) {
        this.config = config;
        this.sessionCache = new Map();
        this.eventHistory = [];
        this.maxHistorySize = config.websocketConfig.MAX_HISTORY_SIZE;
        this.maxSessionOutput = config.websocketConfig.MAX_SESSION_OUTPUT;
    }

    /**
     * 添加会话到缓存
     */
    addSession(sessionId, sessionData) {
        this.sessionCache.set(sessionId, {
            ...sessionData,
            createdAt: new Date().toISOString(),
            output: [],
            status: 'active'
        });
    }

    /**
     * 更新会话状态
     */
    updateSessionStatus(sessionId, status, exitCode = null) {
        if (this.sessionCache.has(sessionId)) {
            const sessionData = this.sessionCache.get(sessionId);
            sessionData.status = status;
            if (exitCode !== null) {
                sessionData.exitCode = exitCode;
            }
            if (status === 'closed') {
                sessionData.closedAt = new Date().toISOString();
            }
        }
    }

    /**
     * 添加会话输出
     */
    addSessionOutput(sessionId, output) {
        if (this.sessionCache.has(sessionId)) {
            const sessionData = this.sessionCache.get(sessionId);
            sessionData.output = sessionData.output || [];
            sessionData.output.push(...output);

            // 限制输出历史长度
            if (sessionData.output.length > this.maxSessionOutput) {
                sessionData.output = sessionData.output.slice(-this.maxSessionOutput);
            }

            sessionData.lastActivity = new Date().toISOString();
        }
    }

    /**
     * 获取会话数据
     */
    getSession(sessionId) {
        return this.sessionCache.get(sessionId);
    }

    /**
     * 获取所有活跃会话
     */
    getActiveSessions() {
        const activeSessions = new Map();
        for (const [sessionId, sessionData] of this.sessionCache) {
            if (sessionData.status === 'active') {
                activeSessions.set(sessionId, sessionData);
            }
        }
        return activeSessions;
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
     * 获取最近的事件历史
     */
    getRecentHistory(count = null) {
        const requestCount = Math.min(
            count || this.config.websocketConfig.RECENT_HISTORY_COUNT,
            this.config.websocketConfig.MAX_HISTORY_REQUEST
        );
        return this.eventHistory.slice(-requestCount);
    }

    /**
     * 清理缓存
     */
    clear() {
        this.sessionCache.clear();
        this.eventHistory = [];
    }

    /**
     * 获取缓存状态
     */
    getStatus() {
        return {
            sessionCount: this.sessionCache.size,
            historyCount: this.eventHistory.length
        };
    }
}

/**
 * 事件广播器 - 专门负责事件的创建和广播
 */
class EventBroadcaster {
    constructor(config, dataCache) {
        this.config = config;
        this.dataCache = dataCache;
        this.eventManager = new EventManager();
    }

    /**
     * 创建并广播事件
     */
    createAndBroadcastEvent(type, sessionId, data, broadcastFn) {
        const event = this.eventManager.createEvent(type, sessionId, data);
        broadcastFn(event);
        this.dataCache.addToHistory(event);
        return event;
    }

    /**
     * 广播工具调用事件
     */
    broadcastToolCall(toolName, args, sessionId, status, broadcastFn) {
        const data = this.eventManager.createToolCallEventData(toolName, args, status);
        return this.createAndBroadcastEvent(WEBSOCKET_EVENTS.TOOL_CALL, sessionId, data, broadcastFn);
    }

    /**
     * 广播会话创建事件
     */
    broadcastSessionCreated(sessionData, broadcastFn) {
        const { sessionId } = sessionData;
        this.dataCache.addSession(sessionId, sessionData);
        return this.createAndBroadcastEvent(WEBSOCKET_EVENTS.SESSION_CREATED, sessionId, sessionData, broadcastFn);
    }

    /**
     * 广播终端输出事件
     */
    broadcastTerminalOutput(sessionId, output, broadcastFn) {
        this.dataCache.addSessionOutput(sessionId, output);
        const data = this.eventManager.createTerminalOutputEventData(output);
        return this.createAndBroadcastEvent(WEBSOCKET_EVENTS.TERMINAL_OUTPUT, sessionId, data, broadcastFn);
    }

    /**
     * 广播会话关闭事件
     */
    broadcastSessionClosed(sessionId, exitCode, broadcastFn) {
        this.dataCache.updateSessionStatus(sessionId, 'closed', exitCode);
        return this.createAndBroadcastEvent(WEBSOCKET_EVENTS.SESSION_CLOSED, sessionId, { exitCode }, broadcastFn);
    }

    /**
     * 广播错误事件
     */
    broadcastError(sessionId, error, context, broadcastFn) {
        const data = this.eventManager.createErrorEventData(error, context);
        return this.createAndBroadcastEvent(WEBSOCKET_EVENTS.ERROR_OCCURRED, sessionId, data, broadcastFn);
    }
}

/**
 * WebSocket服务器管理器 - 专门负责WebSocket连接管理
 */
class WebSocketServerManager extends EventEmitter {
    constructor(config) {
        super();
        this.config = config;
        this.port = config.serverPorts.WEBSOCKET;
        this.host = config.networkConfig.HOST;
        this.wss = null;
        this.clients = new Set();
        this.isRunning = false;
    }

    /**
     * 安全发送消息到客户端
     */
    _sendSafeMessage(ws, message) {
        try {
            if (ws.readyState === ws.OPEN) {
                ws.send(typeof message === 'string' ? message : JSON.stringify(message));
                return true;
            }
        } catch (error) {
            console.error('发送消息到客户端失败:', error);
        }
        return false;
    }

    /**
     * 清理断开的客户端连接
     */
    _cleanupDeadClients(deadClients) {
        deadClients.forEach(ws => {
            this.clients.delete(ws);
        });
    }

    /**
     * 启动WebSocket服务器
     */
    start() {
        if (this.isRunning) {
            wsLog('WebSocket服务器已在运行');
            return;
        }

        this.wss = new WebSocketServer({
            port: this.port,
            host: this.host
        });

        this.wss.on('connection', (ws, req) => {
            wsLog(`GUI客户端已连接: ${req.socket.remoteAddress}`);
            this.clients.add(ws);
            this.emit('client_connected', ws, req);

            // 处理客户端断开连接
            ws.on('close', () => {
                wsLog('GUI客户端已断开连接');
                this.clients.delete(ws);
                this.emit('client_disconnected', ws);
            });

            // 处理客户端错误
            ws.on('error', (error) => {
                console.error('WebSocket客户端错误:', error);
                this.clients.delete(ws);
                this.emit('client_error', ws, error);
            });

            // 处理客户端消息
            ws.on('message', (data) => {
                try {
                    const message = JSON.parse(data.toString());
                    this.emit('client_message', ws, message);
                } catch (error) {
                    console.error('解析客户端消息失败:', error);
                }
            });
        });

        this.wss.on('error', (error) => {
            console.error('WebSocket服务器错误:', error);
            this.emit('server_error', error);
        });

        this.isRunning = true;
        wsLog(`WebSocket服务器已启动，端口: ${this.port}`);
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
        wsLog('WebSocket服务器已停止');
        this.emit('server_stopped');
    }

    /**
     * 向所有连接的客户端广播消息
     */
    broadcastToAll(message) {
        if (this.clients.size === 0) {
            return; // 没有连接的客户端
        }

        const messageStr = JSON.stringify(message);
        const deadClients = new Set();

        this.clients.forEach(ws => {
            if (!this._sendSafeMessage(ws, messageStr)) {
                deadClients.add(ws);
            }
        });

        // 清理断开的连接
        this._cleanupDeadClients(deadClients);
    }

    /**
     * 向特定客户端发送消息
     */
    sendToClient(ws, message) {
        if (!this._sendSafeMessage(ws, message)) {
            this.clients.delete(ws);
        }
    }

    /**
     * 获取连接状态
     */
    getStatus() {
        return {
            isRunning: this.isRunning,
            port: this.port,
            clientCount: this.clients.size
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
     * 清理资源
     */
    cleanup() {
        this.stop();
        this.removeAllListeners();
    }
}

/**
 * WebSocket通信桥 - 重构后的主类，组合各个职责明确的组件
 * 负责协调WebSocket服务器、数据缓存和事件广播
 */
export class WebSocketBridge extends EventEmitter {
    constructor(config) {
        super();
        this.config = config;

        // 注入的依赖组件
        this.dataCache = new DataCache(config);
        this.wsServer = new WebSocketServerManager(config);
        this.eventBroadcaster = new EventBroadcaster(config, this.dataCache);

        // 设置事件监听
        this.setupEventListeners();
    }

    /**
     * 设置事件监听器
     */
    setupEventListeners() {
        // 监听WebSocket服务器事件
        this.wsServer.on('client_connected', (ws, req) => {
            this.handleClientConnected(ws, req);
        });

        this.wsServer.on('client_message', (ws, message) => {
            this.handleClientMessage(ws, message);
        });

        this.wsServer.on('server_started', (data) => {
            this.emit('server_started', data);
        });

        this.wsServer.on('server_stopped', () => {
            this.emit('server_stopped');
        });
    }

    /**
     * 处理客户端连接
     */
    handleClientConnected(ws, req) {
        // 发送欢迎消息
        const cacheStatus = this.dataCache.getStatus();
        this.wsServer.sendToClient(ws, {
            type: WEBSOCKET_EVENTS.CONNECTION_ESTABLISHED,
            timestamp: new Date().toISOString(),
            data: {
                message: 'WebSocket连接已建立',
                sessionCount: cacheStatus.sessionCount,
                historyCount: cacheStatus.historyCount
            }
        });

        // 发送活跃会话数据
        const activeSessions = this.dataCache.getActiveSessions();
        for (const [sessionId, sessionData] of activeSessions) {
            this.wsServer.sendToClient(ws, {
                type: WEBSOCKET_EVENTS.SESSION_SYNC,
                timestamp: new Date().toISOString(),
                sessionId,
                data: sessionData
            });
        }

        // 发送最近的事件历史
        const recentHistory = this.dataCache.getRecentHistory();
        recentHistory.forEach(event => {
            this.wsServer.sendToClient(ws, event);
        });
    }

    /**
     * 处理客户端消息
     */
    handleClientMessage(ws, message) {
        const { type, data } = message;

        switch (type) {
            case WEBSOCKET_EVENTS.REQUEST_SESSION_DATA:
                const sessionId = data?.sessionId;
                if (sessionId) {
                    const sessionData = this.dataCache.getSession(sessionId);
                    if (sessionData) {
                        this.wsServer.sendToClient(ws, {
                            type: WEBSOCKET_EVENTS.SESSION_DATA,
                            timestamp: new Date().toISOString(),
                            sessionId,
                            data: sessionData
                        });
                    }
                }
                break;

            case WEBSOCKET_EVENTS.REQUEST_HISTORY:
                const count = data?.count;
                const history = this.dataCache.getRecentHistory(count);
                this.wsServer.sendToClient(ws, {
                    type: WEBSOCKET_EVENTS.HISTORY_DATA,
                    timestamp: new Date().toISOString(),
                    data: history
                });
                break;

            default:
                wsLog('收到未知类型的客户端消息:' + type);
        }
    }

    // 公共API方法 - 委托给事件广播器

    /**
     * 广播工具调用事件
     */
    broadcastToolCall(toolName, args, sessionId, status = 'executing') {
        return this.eventBroadcaster.broadcastToolCall(
            toolName, args, sessionId, status,
            (event) => this.wsServer.broadcastToAll(event)
        );
    }

    /**
     * 广播会话创建事件
     */
    broadcastSessionCreated(sessionData) {
        return this.eventBroadcaster.broadcastSessionCreated(
            sessionData,
            (event) => this.wsServer.broadcastToAll(event)
        );
    }

    /**
     * 广播终端输出事件
     */
    broadcastTerminalOutput(sessionId, output) {
        return this.eventBroadcaster.broadcastTerminalOutput(
            sessionId, output,
            (event) => this.wsServer.broadcastToAll(event)
        );
    }

    /**
     * 广播会话关闭事件
     */
    broadcastSessionClosed(sessionId, exitCode = null) {
        return this.eventBroadcaster.broadcastSessionClosed(
            sessionId, exitCode,
            (event) => this.wsServer.broadcastToAll(event)
        );
    }

    /**
     * 广播错误事件
     */
    broadcastError(sessionId, error, context = null) {
        return this.eventBroadcaster.broadcastError(
            sessionId, error, context,
            (event) => this.wsServer.broadcastToAll(event)
        );
    }

    // 委托给WebSocket服务器管理器的方法

    /**
     * 启动WebSocket服务器
     */
    start() {
        this.wsServer.start();
    }

    /**
     * 停止WebSocket服务器
     */
    stop() {
        this.wsServer.stop();
    }

    /**
     * 获取运行状态
     */
    get isRunning() {
        return this.wsServer.isRunning;
    }

    /**
     * 获取连接状态
     */
    getStatus() {
        const wsStatus = this.wsServer.getStatus();
        const cacheStatus = this.dataCache.getStatus();
        return {
            ...wsStatus,
            ...cacheStatus
        };
    }

    /**
     * 检查是否有活跃的WebSocket连接
     */
    hasActiveConnections() {
        return this.wsServer.hasActiveConnections();
    }

    /**
     * 获取活跃连接数
     */
    getActiveConnectionCount() {
        return this.wsServer.getActiveConnectionCount();
    }

    /**
     * 清理资源
     */
    cleanup() {
        this.wsServer.cleanup();
        this.dataCache.clear();
        this.removeAllListeners();
    }
}


