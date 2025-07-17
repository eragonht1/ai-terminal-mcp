import { WebSocketServer } from 'ws';
import { EventEmitter } from 'events';
import { WEBSOCKET_EVENTS, EventManager } from './events.js';

/**
 * WebSocket专用日志函数 - 输出到stderr但不显示为错误
 * @param {string} message - 要记录的消息
 */
function wsLog(message) {
    process.stderr.write(`[WebSocket] ${message}\n`);
}

/**
 * 数据缓存管理器 - 专门负责会话数据和事件历史的缓存
 *
 * 该类负责管理WebSocket服务器的数据缓存，包括会话信息、
 * 输出历史和事件记录，提供高效的数据存储和检索功能。
 */
class DataCache {
    /**
     * 构造函数
     * @param {AppConfig} config - 应用配置对象
     */
    constructor(config) {
        this.config = config;
        this.sessionCache = new Map();
        this.eventHistory = [];
        this.maxHistorySize = config.websocketConfig.MAX_HISTORY_SIZE;
        this.maxSessionOutput = config.websocketConfig.MAX_SESSION_OUTPUT;
    }

    /**
     * 添加会话到缓存
     * @param {string} sessionId - 会话ID
     * @param {Object} sessionData - 会话数据
     */
    addSession(sessionId, sessionData) {
        const cachedSession = {
            ...sessionData,
            createdAt: new Date().toISOString(),
            output: [],
            status: 'active'
        };
        this.sessionCache.set(sessionId, cachedSession);
    }

    /**
     * 更新会话状态
     * @param {string} sessionId - 会话ID
     * @param {string} status - 新状态
     * @param {number|null} [exitCode=null] - 退出代码
     */
    updateSessionStatus(sessionId, status, exitCode = null) {
        const sessionData = this.sessionCache.get(sessionId);
        if (!sessionData) return;

        sessionData.status = status;

        if (exitCode !== null) {
            sessionData.exitCode = exitCode;
        }

        if (status === 'closed') {
            sessionData.closedAt = new Date().toISOString();
        }
    }

    /**
     * 添加会话输出并维护历史长度限制
     * @param {string} sessionId - 会话ID
     * @param {string[]} output - 输出行数组
     */
    addSessionOutput(sessionId, output) {
        const sessionData = this.sessionCache.get(sessionId);
        if (!sessionData) return;

        this._ensureOutputArray(sessionData);
        this._appendOutput(sessionData, output);
        this._trimOutputHistory(sessionData);
        this._updateLastActivity(sessionData);
    }

    /**
     * 确保输出数组存在
     * @param {Object} sessionData - 会话数据
     * @private
     */
    _ensureOutputArray(sessionData) {
        sessionData.output = sessionData.output || [];
    }

    /**
     * 追加输出到会话
     * @param {Object} sessionData - 会话数据
     * @param {string[]} output - 输出行数组
     * @private
     */
    _appendOutput(sessionData, output) {
        sessionData.output.push(...output);
    }

    /**
     * 修剪输出历史以保持在限制范围内
     * @param {Object} sessionData - 会话数据
     * @private
     */
    _trimOutputHistory(sessionData) {
        if (sessionData.output.length > this.maxSessionOutput) {
            sessionData.output = sessionData.output.slice(-this.maxSessionOutput);
        }
    }

    /**
     * 更新最后活动时间
     * @param {Object} sessionData - 会话数据
     * @private
     */
    _updateLastActivity(sessionData) {
        sessionData.lastActivity = new Date().toISOString();
    }

    /**
     * 获取指定会话的数据
     * @param {string} sessionId - 会话ID
     * @returns {Object|undefined} 会话数据或undefined
     */
    getSession(sessionId) {
        return this.sessionCache.get(sessionId);
    }

    /**
     * 获取所有活跃会话
     * @returns {Map<string, Object>} 活跃会话的Map
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
     * 添加事件到历史记录并维护大小限制
     * @param {Object} event - 事件对象
     */
    addToHistory(event) {
        this.eventHistory.push(event);
        this._trimEventHistory();
    }

    /**
     * 修剪事件历史以保持在限制范围内
     * @private
     */
    _trimEventHistory() {
        if (this.eventHistory.length > this.maxHistorySize) {
            this.eventHistory = this.eventHistory.slice(-this.maxHistorySize);
        }
    }

    /**
     * 获取最近的事件历史
     * @param {number|null} [count=null] - 请求的事件数量，null时使用默认值
     * @returns {Object[]} 最近的事件数组
     */
    getRecentHistory(count = null) {
        const requestCount = this._calculateRequestCount(count);
        return this.eventHistory.slice(-requestCount);
    }

    /**
     * 计算实际请求的事件数量
     * @param {number|null} count - 请求的数量
     * @returns {number} 实际请求数量
     * @private
     */
    _calculateRequestCount(count) {
        const defaultCount = this.config.websocketConfig.RECENT_HISTORY_COUNT;
        const maxRequest = this.config.websocketConfig.MAX_HISTORY_REQUEST;

        return Math.min(count || defaultCount, maxRequest);
    }

    /**
     * 清理所有缓存数据
     */
    clear() {
        this.sessionCache.clear();
        this.eventHistory = [];
    }

    /**
     * 获取缓存状态统计信息
     * @returns {Object} 包含会话数量和历史数量的状态对象
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
 *
 * 该类封装了所有事件广播逻辑，提供统一的事件创建、
 * 缓存更新和广播功能，确保事件处理的一致性。
 */
class EventBroadcaster {
    /**
     * 构造函数
     * @param {AppConfig} config - 应用配置对象
     * @param {DataCache} dataCache - 数据缓存实例
     */
    constructor(config, dataCache) {
        this.config = config;
        this.dataCache = dataCache;
        this.eventManager = new EventManager();
    }

    /**
     * 创建并广播事件的通用方法
     * @param {string} type - 事件类型
     * @param {string} sessionId - 会话ID
     * @param {Object} data - 事件数据
     * @param {Function} broadcastFn - 广播函数
     * @returns {Object} 创建的事件对象
     */
    createAndBroadcastEvent(type, sessionId, data, broadcastFn) {
        const event = this.eventManager.createEvent(type, sessionId, data);
        broadcastFn(event);
        this.dataCache.addToHistory(event);
        return event;
    }

    /**
     * 广播工具调用事件
     * @param {string} toolName - 工具名称
     * @param {Object} args - 工具参数
     * @param {string} sessionId - 会话ID
     * @param {string} status - 执行状态
     * @param {Function} broadcastFn - 广播函数
     * @returns {Object} 创建的事件对象
     */
    broadcastToolCall(toolName, args, sessionId, status, broadcastFn) {
        const data = this.eventManager.createToolCallEventData(toolName, args, status);
        return this.createAndBroadcastEvent(WEBSOCKET_EVENTS.TOOL_CALL, sessionId, data, broadcastFn);
    }

    /**
     * 广播会话创建事件
     * @param {Object} sessionData - 会话数据
     * @param {Function} broadcastFn - 广播函数
     * @returns {Object} 创建的事件对象
     */
    broadcastSessionCreated(sessionData, broadcastFn) {
        const { sessionId } = sessionData;
        this.dataCache.addSession(sessionId, sessionData);
        return this.createAndBroadcastEvent(WEBSOCKET_EVENTS.SESSION_CREATED, sessionId, sessionData, broadcastFn);
    }

    /**
     * 广播终端输出事件
     * @param {string} sessionId - 会话ID
     * @param {string[]} output - 输出行数组
     * @param {Function} broadcastFn - 广播函数
     * @returns {Object} 创建的事件对象
     */
    broadcastTerminalOutput(sessionId, output, broadcastFn) {
        this.dataCache.addSessionOutput(sessionId, output);
        const data = this.eventManager.createTerminalOutputEventData(output);
        return this.createAndBroadcastEvent(WEBSOCKET_EVENTS.TERMINAL_OUTPUT, sessionId, data, broadcastFn);
    }

    /**
     * 广播会话关闭事件
     * @param {string} sessionId - 会话ID
     * @param {number} exitCode - 退出代码
     * @param {Function} broadcastFn - 广播函数
     * @returns {Object} 创建的事件对象
     */
    broadcastSessionClosed(sessionId, exitCode, broadcastFn) {
        this.dataCache.updateSessionStatus(sessionId, 'closed', exitCode);
        const eventData = { exitCode };
        return this.createAndBroadcastEvent(WEBSOCKET_EVENTS.SESSION_CLOSED, sessionId, eventData, broadcastFn);
    }

    /**
     * 广播错误事件
     * @param {string} sessionId - 会话ID
     * @param {Error} error - 错误对象
     * @param {Object} context - 错误上下文
     * @param {Function} broadcastFn - 广播函数
     * @returns {Object} 创建的事件对象
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
     * @param {WebSocket} ws - WebSocket连接对象
     * @param {IncomingMessage} _req - HTTP请求对象（未使用，但保留以符合接口）
     */
    handleClientConnected(ws, _req) {
        this._sendWelcomeMessage(ws);
        this._syncActiveSessions(ws);
        this._sendRecentHistory(ws);
    }

    /**
     * 发送欢迎消息
     * @param {WebSocket} ws - WebSocket连接对象
     * @private
     */
    _sendWelcomeMessage(ws) {
        const cacheStatus = this.dataCache.getStatus();
        const welcomeMessage = {
            type: WEBSOCKET_EVENTS.CONNECTION_ESTABLISHED,
            timestamp: new Date().toISOString(),
            data: {
                message: 'WebSocket连接已建立',
                sessionCount: cacheStatus.sessionCount,
                historyCount: cacheStatus.historyCount
            }
        };
        this.wsServer.sendToClient(ws, welcomeMessage);
    }

    /**
     * 同步活跃会话数据到新连接的客户端
     * @param {WebSocket} ws - WebSocket连接对象
     * @private
     */
    _syncActiveSessions(ws) {
        const activeSessions = this.dataCache.getActiveSessions();

        for (const [sessionId, sessionData] of activeSessions) {
            const syncMessage = {
                type: WEBSOCKET_EVENTS.SESSION_SYNC,
                timestamp: new Date().toISOString(),
                sessionId,
                data: sessionData
            };
            this.wsServer.sendToClient(ws, syncMessage);
        }
    }

    /**
     * 发送最近的事件历史到新连接的客户端
     * @param {WebSocket} ws - WebSocket连接对象
     * @private
     */
    _sendRecentHistory(ws) {
        const recentHistory = this.dataCache.getRecentHistory();
        recentHistory.forEach(event => {
            this.wsServer.sendToClient(ws, event);
        });
    }

    /**
     * 处理客户端消息
     * @param {WebSocket} ws - WebSocket连接对象
     * @param {Object} message - 客户端消息对象
     */
    handleClientMessage(ws, message) {
        const { type, data } = message;

        // 消息处理器映射表
        const messageHandlers = {
            [WEBSOCKET_EVENTS.REQUEST_SESSION_DATA]: () => this._handleSessionDataRequest(ws, data),
            [WEBSOCKET_EVENTS.REQUEST_HISTORY]: () => this._handleHistoryRequest(ws, data)
        };

        const handler = messageHandlers[type];
        if (handler) {
            handler();
        } else {
            wsLog(`收到未知类型的客户端消息: ${type}`);
        }
    }

    /**
     * 处理会话数据请求
     * @param {WebSocket} ws - WebSocket连接对象
     * @param {Object} data - 请求数据
     * @private
     */
    _handleSessionDataRequest(ws, data) {
        const sessionId = data?.sessionId;
        if (!sessionId) return;

        const sessionData = this.dataCache.getSession(sessionId);
        if (!sessionData) return;

        const response = {
            type: WEBSOCKET_EVENTS.SESSION_DATA,
            timestamp: new Date().toISOString(),
            sessionId,
            data: sessionData
        };
        this.wsServer.sendToClient(ws, response);
    }

    /**
     * 处理历史记录请求
     * @param {WebSocket} ws - WebSocket连接对象
     * @param {Object} data - 请求数据
     * @private
     */
    _handleHistoryRequest(ws, data) {
        const count = data?.count;
        const history = this.dataCache.getRecentHistory(count);

        const response = {
            type: WEBSOCKET_EVENTS.HISTORY_DATA,
            timestamp: new Date().toISOString(),
            data: history
        };
        this.wsServer.sendToClient(ws, response);
    }

    // ========================================================================
    // 公共API方法 - 事件广播接口
    // ========================================================================

    /**
     * 广播工具调用事件
     * @param {string} toolName - 工具名称
     * @param {Object} args - 工具参数
     * @param {string} sessionId - 会话ID
     * @param {string} [status='executing'] - 执行状态
     * @returns {Object} 创建的事件对象
     */
    broadcastToolCall(toolName, args, sessionId, status = 'executing') {
        return this.eventBroadcaster.broadcastToolCall(
            toolName,
            args,
            sessionId,
            status,
            (event) => this.wsServer.broadcastToAll(event)
        );
    }

    /**
     * 广播会话创建事件
     * @param {Object} sessionData - 会话数据
     * @returns {Object} 创建的事件对象
     */
    broadcastSessionCreated(sessionData) {
        return this.eventBroadcaster.broadcastSessionCreated(
            sessionData,
            (event) => this.wsServer.broadcastToAll(event)
        );
    }

    /**
     * 广播终端输出事件
     * @param {string} sessionId - 会话ID
     * @param {string[]} output - 输出行数组
     * @returns {Object} 创建的事件对象
     */
    broadcastTerminalOutput(sessionId, output) {
        return this.eventBroadcaster.broadcastTerminalOutput(
            sessionId,
            output,
            (event) => this.wsServer.broadcastToAll(event)
        );
    }

    /**
     * 广播会话关闭事件
     * @param {string} sessionId - 会话ID
     * @param {number|null} [exitCode=null] - 退出代码
     * @returns {Object} 创建的事件对象
     */
    broadcastSessionClosed(sessionId, exitCode = null) {
        return this.eventBroadcaster.broadcastSessionClosed(
            sessionId,
            exitCode,
            (event) => this.wsServer.broadcastToAll(event)
        );
    }

    /**
     * 广播错误事件
     * @param {string} sessionId - 会话ID
     * @param {Error} error - 错误对象
     * @param {Object|null} [context=null] - 错误上下文
     * @returns {Object} 创建的事件对象
     */
    broadcastError(sessionId, error, context = null) {
        return this.eventBroadcaster.broadcastError(
            sessionId,
            error,
            context,
            (event) => this.wsServer.broadcastToAll(event)
        );
    }

    // ========================================================================
    // 服务器控制接口 - 委托给WebSocket服务器管理器
    // ========================================================================

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
     * 获取服务器运行状态
     * @returns {boolean} 是否正在运行
     */
    get isRunning() {
        return this.wsServer.isRunning;
    }

    /**
     * 获取综合状态信息
     * @returns {Object} 包含WebSocket服务器状态和缓存状态的对象
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
     * @returns {boolean} 是否有活跃连接
     */
    hasActiveConnections() {
        return this.wsServer.hasActiveConnections();
    }

    /**
     * 获取活跃连接数量
     * @returns {number} 活跃连接数
     */
    getActiveConnectionCount() {
        return this.wsServer.getActiveConnectionCount();
    }

    /**
     * 清理所有资源
     *
     * 按照依赖关系的逆序清理各个组件，确保资源得到正确释放。
     */
    cleanup() {
        this.wsServer.cleanup();
        this.dataCache.clear();
        this.removeAllListeners();
    }
}


