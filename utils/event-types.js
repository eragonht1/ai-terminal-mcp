/**
 * 事件类型常量定义 - 统一管理所有事件类型
 *
 * 该模块定义了系统中使用的所有事件类型常量，
 * 确保事件类型的一致性和可维护性。
 *
 * @author MCP Terminal Server Team
 * @version 1.1.0
 */

// ============================================================================
// WebSocket事件类型
// ============================================================================

/**
 * WebSocket通信相关事件类型
 * @readonly
 * @enum {string}
 */
export const WEBSOCKET_EVENTS = {
    /** 连接已建立 */
    CONNECTION_ESTABLISHED: 'connection_established',
    /** 会话已创建 */
    SESSION_CREATED: 'session_created',
    /** 会话已关闭 */
    SESSION_CLOSED: 'session_closed',
    /** 会话同步 */
    SESSION_SYNC: 'session_sync',
    /** 终端输出 */
    TERMINAL_OUTPUT: 'terminal_output',
    /** 工具调用 */
    TOOL_CALL: 'tool_call',
    /** 错误发生 */
    ERROR_OCCURRED: 'error_occurred',
    /** 心跳检测 */
    PING: 'ping',
    /** 心跳响应 */
    PONG: 'pong',
    /** 请求会话数据 */
    REQUEST_SESSION_DATA: 'request_session_data',
    /** 请求历史记录 */
    REQUEST_HISTORY: 'request_history',
    /** 会话数据 */
    SESSION_DATA: 'session_data',
    /** 历史数据 */
    HISTORY_DATA: 'history_data'
};

// ============================================================================
// 终端管理器事件类型
// ============================================================================

/**
 * 终端管理器相关事件类型
 * @readonly
 * @enum {string}
 */
export const TERMINAL_EVENTS = {
    /** 会话已创建 */
    SESSION_CREATED: 'sessionCreated',
    /** 输出已接收 */
    OUTPUT_RECEIVED: 'outputReceived',
    /** 会话已关闭 */
    SESSION_CLOSED: 'sessionClosed',
    /** 错误发生 */
    ERROR_OCCURRED: 'errorOccurred'
};

// ============================================================================
// WebSocket服务器事件类型
// ============================================================================

/**
 * WebSocket服务器相关事件类型
 * @readonly
 * @enum {string}
 */
export const WS_SERVER_EVENTS = {
    /** 服务器已启动 */
    SERVER_STARTED: 'server_started',
    /** 服务器已停止 */
    SERVER_STOPPED: 'server_stopped',
    /** 客户端已连接 */
    CLIENT_CONNECTED: 'client_connected',
    /** 客户端已断开连接 */
    CLIENT_DISCONNECTED: 'client_disconnected'
};

// ============================================================================
// 事件类型集合
// ============================================================================

/**
 * 所有事件类型的集合
 * @readonly
 * @type {Object}
 */
export const ALL_EVENTS = {
    WEBSOCKET: WEBSOCKET_EVENTS,
    TERMINAL: TERMINAL_EVENTS,
    WS_SERVER: WS_SERVER_EVENTS
};
