/**
 * 事件类型常量定义 - 统一管理所有事件类型
 */

// WebSocket事件类型
export const WEBSOCKET_EVENTS = {
    CONNECTION_ESTABLISHED: 'connection_established',
    SESSION_CREATED: 'session_created',
    SESSION_CLOSED: 'session_closed',
    SESSION_SYNC: 'session_sync',
    TERMINAL_OUTPUT: 'terminal_output',
    TOOL_CALL: 'tool_call',
    ERROR_OCCURRED: 'error_occurred',
    PING: 'ping',
    PONG: 'pong',
    REQUEST_SESSION_DATA: 'request_session_data',
    REQUEST_HISTORY: 'request_history',
    SESSION_DATA: 'session_data',
    HISTORY_DATA: 'history_data'
};

// 终端管理器事件类型
export const TERMINAL_EVENTS = {
    SESSION_CREATED: 'sessionCreated',
    OUTPUT_RECEIVED: 'outputReceived',
    SESSION_CLOSED: 'sessionClosed',
    ERROR_OCCURRED: 'errorOccurred'
};

// WebSocket服务器事件类型
export const WS_SERVER_EVENTS = {
    SERVER_STARTED: 'server_started',
    SERVER_STOPPED: 'server_stopped',
    CLIENT_CONNECTED: 'client_connected',
    CLIENT_DISCONNECTED: 'client_disconnected'
};

/**
 * 事件管理器 - 提供事件类型验证和管理
 */
export class EventManager {
    constructor() {
        this.websocketEvents = WEBSOCKET_EVENTS;
        this.terminalEvents = TERMINAL_EVENTS;
        this.wsServerEvents = WS_SERVER_EVENTS;
    }

    /**
     * 验证WebSocket事件类型
     */
    isValidWebSocketEvent(eventType) {
        return Object.values(this.websocketEvents).includes(eventType);
    }

    /**
     * 验证终端事件类型
     */
    isValidTerminalEvent(eventType) {
        return Object.values(this.terminalEvents).includes(eventType);
    }

    /**
     * 验证WebSocket服务器事件类型
     */
    isValidWSServerEvent(eventType) {
        return Object.values(this.wsServerEvents).includes(eventType);
    }

    /**
     * 创建标准事件对象
     */
    createEvent(type, sessionId = null, data = null) {
        return {
            type,
            timestamp: new Date().toISOString(),
            sessionId,
            data
        };
    }

    /**
     * 创建工具调用事件数据
     */
    createToolCallEventData(toolName, args, status) {
        return {
            tool: toolName,
            args,
            status
        };
    }

    /**
     * 创建错误事件数据
     */
    createErrorEventData(error, context = null) {
        return {
            error: error.message || error,
            context
        };
    }

    /**
     * 创建终端输出事件数据
     */
    createTerminalOutputEventData(output) {
        return {
            output: Array.isArray(output) ? output.filter(line => line.trim()) : [output].filter(line => line.trim())
        };
    }
}
