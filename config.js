/**
 * 应用配置管理 - 统一管理所有常量、配置和路径
 * 确保资源只在主入口加载一次
 */

// 服务器端口配置
export const SERVER_PORTS = {
    WEBSOCKET: 8573,
    GUI: 8347
};

// 网络配置
export const NETWORK_CONFIG = {
    HOST: 'localhost',
    WEBSOCKET_URL: `ws://localhost:${SERVER_PORTS.WEBSOCKET}`,
    MAX_RECONNECT_ATTEMPTS: 5,
    RECONNECT_DELAY: 2000
};

// MCP协议配置
export const MCP_CONFIG = {
    PROTOCOL_VERSION: '2024-11-05',
    SERVER_VERSION: '1.1.0',
    SERVER_NAME: 'mcp-terminal-server'
};

// 终端配置
export const TERMINAL_CONFIG = {
    DEFAULT_TYPE: 'powershell',
    DEFAULT_TIMEOUT: 5000,
    DEFAULT_COLS: 80,
    DEFAULT_ROWS: 30,
    TERMINAL_NAME: 'xterm-color',
    MAX_OUTPUT_LINES: 1000,
    SESSION_TIMEOUT: 3600000, // 1小时
    CLEANUP_INTERVAL: 600000   // 10分钟
};

// 终端路径配置
export const TERMINAL_PATHS = {
    POWERSHELL: 'C:\\Program Files\\PowerShell\\7\\pwsh.exe',
    CMD: 'cmd.exe'
};

// 正则表达式配置
export const TERMINAL_REGEX = {
    PS_PROMPT: /PS\s+[A-Z]:\\[^>]*>\s*$/i,
    CMD_PROMPT: /[A-Za-z]:\\[^>]*>\s*$/i,
    GENERIC_PROMPT: />\s*$/
};

// WebSocket配置
export const WEBSOCKET_CONFIG = {
    MAX_HISTORY_SIZE: 1000,
    MAX_SESSION_OUTPUT: 1000,
    RECENT_HISTORY_COUNT: 50,
    MAX_HISTORY_REQUEST: 200
};

// GUI配置
export const GUI_CONFIG = {
    TIME_UPDATE_INTERVAL: 1000,
    DEFAULT_SETTINGS: {
        theme: 'dark',
        fontSize: 14,
        autoScroll: true,
        showTimestamps: true
    }
};

// 错误代码常量
export const ERROR_CODES = {
    PARSE_ERROR: -32700,
    METHOD_NOT_FOUND: -32601,
    INTERNAL_ERROR: -32603
};

// 工具执行状态常量
export const TOOL_STATUS = {
    EXECUTING: 'executing',
    SESSION_CREATED: 'session_created',
    COMPLETED: 'completed'
};

/**
 * 应用配置类 - 提供配置访问接口
 */
export class AppConfig {
    constructor() {
        this.serverPorts = SERVER_PORTS;
        this.networkConfig = NETWORK_CONFIG;
        this.mcpConfig = MCP_CONFIG;
        this.terminalConfig = TERMINAL_CONFIG;
        this.terminalPaths = TERMINAL_PATHS;
        this.terminalRegex = TERMINAL_REGEX;
        this.websocketConfig = WEBSOCKET_CONFIG;
        this.guiConfig = GUI_CONFIG;
        this.errorCodes = ERROR_CODES;
        this.toolStatus = TOOL_STATUS;
    }

    /**
     * 获取终端可执行文件路径
     */
    getShellPath(type) {
        return type === 'powershell' ? this.terminalPaths.POWERSHELL : this.terminalPaths.CMD;
    }

    /**
     * 获取WebSocket URL
     */
    getWebSocketUrl() {
        return this.networkConfig.WEBSOCKET_URL;
    }

    /**
     * 获取GUI服务器URL
     */
    getGUIServerUrl() {
        return `http://${this.networkConfig.HOST}:${this.serverPorts.GUI}`;
    }
}
