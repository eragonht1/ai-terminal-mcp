/**
 * 应用配置管理模块
 *
 * 该模块统一管理整个应用的所有配置常量、路径设置和参数，
 * 采用集中化配置管理模式，确保配置的一致性和可维护性。
 *
 * 主要功能：
 * - 服务器端口和网络配置
 * - MCP协议相关设置
 * - 终端管理配置
 * - WebSocket通信配置
 * - GUI界面配置
 * - 错误代码和状态常量
 *
 * @author MCP Terminal Server Team
 * @version 1.1.0
 */

// ============================================================================
// 服务器配置
// ============================================================================

/**
 * 服务器端口配置
 * @readonly
 * @enum {number}
 */
export const SERVER_PORTS = {
    /** WebSocket服务器端口 */
    WEBSOCKET: 8573,
    /** GUI Web服务器端口 */
    GUI: 8347
};

/**
 * 网络连接配置
 * @readonly
 * @type {Object}
 */
export const NETWORK_CONFIG = {
    /** 服务器主机地址 */
    HOST: 'localhost',
    /** WebSocket连接URL */
    WEBSOCKET_URL: `ws://localhost:${SERVER_PORTS.WEBSOCKET}`,
    /** 最大重连尝试次数 */
    MAX_RECONNECT_ATTEMPTS: 5,
    /** 重连延迟时间（毫秒） */
    RECONNECT_DELAY: 2000
};

// ============================================================================
// MCP协议配置
// ============================================================================

/**
 * MCP（Model Context Protocol）协议配置
 * @readonly
 * @type {Object}
 */
export const MCP_CONFIG = {
    /** MCP协议版本 */
    PROTOCOL_VERSION: '2024-11-05',
    /** 服务器版本 */
    SERVER_VERSION: '1.1.0',
    /** 服务器名称 */
    SERVER_NAME: 'mcp-terminal-server'
};

// ============================================================================
// 终端配置
// ============================================================================

/**
 * 终端管理配置
 * @readonly
 * @type {Object}
 */
export const TERMINAL_CONFIG = {
    /** 默认终端类型 */
    DEFAULT_TYPE: 'powershell',
    /** 默认命令超时时间（毫秒） */
    DEFAULT_TIMEOUT: 5000,
    /** 默认终端列数 */
    DEFAULT_COLS: 80,
    /** 默认终端行数 */
    DEFAULT_ROWS: 30,
    /** 终端名称标识 */
    TERMINAL_NAME: 'xterm-color',
    /** 最大输出行数限制 */
    MAX_OUTPUT_LINES: 1000,
    /** 会话超时时间（毫秒） - 1小时 */
    SESSION_TIMEOUT: 3600000,
    /** 清理检查间隔（毫秒） - 10分钟 */
    CLEANUP_INTERVAL: 600000
};

/**
 * 终端可执行文件路径配置
 * @readonly
 * @type {Object}
 */
export const TERMINAL_PATHS = {
    /** PowerShell 7+ 路径 */
    POWERSHELL: 'C:\\Program Files\\PowerShell\\7\\pwsh.exe',
    /** 命令提示符路径 */
    CMD: 'cmd.exe'
};

/**
 * 终端提示符识别正则表达式
 * @readonly
 * @type {Object}
 */
export const TERMINAL_REGEX = {
    /** PowerShell提示符模式 */
    PS_PROMPT: /PS\s+[A-Z]:\\[^>]*>\s*$/i,
    /** CMD提示符模式 */
    CMD_PROMPT: /[A-Za-z]:\\[^>]*>\s*$/i,
    /** 通用提示符模式 */
    GENERIC_PROMPT: />\s*$/
};

// ============================================================================
// WebSocket配置
// ============================================================================

/**
 * WebSocket通信配置
 * @readonly
 * @type {Object}
 */
export const WEBSOCKET_CONFIG = {
    /** 最大历史记录数量 */
    MAX_HISTORY_SIZE: 1000,
    /** 单个会话最大输出行数 */
    MAX_SESSION_OUTPUT: 1000,
    /** 默认返回的最近历史数量 */
    RECENT_HISTORY_COUNT: 50,
    /** 单次历史请求的最大数量 */
    MAX_HISTORY_REQUEST: 200
};

// ============================================================================
// GUI配置
// ============================================================================

/**
 * GUI界面配置
 * @readonly
 * @type {Object}
 */
export const GUI_CONFIG = {
    /** 时间更新间隔（毫秒） */
    TIME_UPDATE_INTERVAL: 1000,
    /** 默认界面设置 */
    DEFAULT_SETTINGS: {
        /** 默认主题 */
        theme: 'dark',
        /** 默认字体大小 */
        fontSize: 14,
        /** 是否自动滚动 */
        autoScroll: true,
        /** 是否显示时间戳 */
        showTimestamps: true
    }
};

// ============================================================================
// 常量定义
// ============================================================================

/**
 * JSON-RPC错误代码常量
 * @readonly
 * @enum {number}
 */
export const ERROR_CODES = {
    /** 解析错误 */
    PARSE_ERROR: -32700,
    /** 方法未找到 */
    METHOD_NOT_FOUND: -32601,
    /** 内部错误 */
    INTERNAL_ERROR: -32603
};

/**
 * 工具执行状态常量
 * @readonly
 * @enum {string}
 */
export const TOOL_STATUS = {
    /** 执行中 */
    EXECUTING: 'executing',
    /** 会话已创建 */
    SESSION_CREATED: 'session_created',
    /** 执行完成 */
    COMPLETED: 'completed'
};

// ============================================================================
// 配置管理类
// ============================================================================

/**
 * 应用配置管理类
 *
 * 该类提供统一的配置访问接口，封装所有配置常量，
 * 并提供便捷的配置获取方法。采用单例模式确保配置的一致性。
 *
 * 主要功能：
 * - 统一配置访问接口
 * - 配置验证和默认值处理
 * - 动态配置计算
 * - 配置相关的工具方法
 */
export class AppConfig {
    /**
     * 构造函数 - 初始化所有配置模块
     */
    constructor() {
        // 服务器相关配置
        this.serverPorts = SERVER_PORTS;
        this.networkConfig = NETWORK_CONFIG;

        // 协议相关配置
        this.mcpConfig = MCP_CONFIG;

        // 终端相关配置
        this.terminalConfig = TERMINAL_CONFIG;
        this.terminalPaths = TERMINAL_PATHS;
        this.terminalRegex = TERMINAL_REGEX;

        // 通信相关配置
        this.websocketConfig = WEBSOCKET_CONFIG;

        // 界面相关配置
        this.guiConfig = GUI_CONFIG;

        // 常量定义
        this.errorCodes = ERROR_CODES;
        this.toolStatus = TOOL_STATUS;
    }

    // ========================================================================
    // 路径获取方法
    // ========================================================================

    /**
     * 获取指定类型的终端可执行文件路径
     * @param {string} type - 终端类型 ('powershell' | 'cmd')
     * @returns {string} 终端可执行文件的完整路径
     * @throws {Error} 当终端类型不支持时抛出错误
     */
    getShellPath(type) {
        const shellPaths = {
            'powershell': this.terminalPaths.POWERSHELL,
            'cmd': this.terminalPaths.CMD
        };

        const path = shellPaths[type];
        if (!path) {
            throw new Error(`不支持的终端类型: ${type}`);
        }

        return path;
    }

    // ========================================================================
    // URL生成方法
    // ========================================================================

    /**
     * 获取WebSocket连接URL
     * @returns {string} WebSocket服务器的完整URL
     */
    getWebSocketUrl() {
        return this.networkConfig.WEBSOCKET_URL;
    }

    /**
     * 获取GUI Web服务器URL
     * @returns {string} GUI服务器的完整URL
     */
    getGUIServerUrl() {
        return `http://${this.networkConfig.HOST}:${this.serverPorts.GUI}`;
    }

    // ========================================================================
    // 配置验证和工具方法
    // ========================================================================

    /**
     * 验证终端类型是否有效
     * @param {string} type - 要验证的终端类型
     * @returns {boolean} 是否为有效的终端类型
     */
    isValidTerminalType(type) {
        return type === 'powershell' || type === 'cmd';
    }

    /**
     * 获取默认终端类型
     * @returns {string} 默认终端类型
     */
    getDefaultTerminalType() {
        return this.terminalConfig.DEFAULT_TYPE;
    }

    /**
     * 获取配置摘要信息
     * @returns {Object} 包含主要配置信息的摘要对象
     */
    getConfigSummary() {
        return {
            serverVersion: this.mcpConfig.SERVER_VERSION,
            protocolVersion: this.mcpConfig.PROTOCOL_VERSION,
            websocketPort: this.serverPorts.WEBSOCKET,
            guiPort: this.serverPorts.GUI,
            defaultTerminal: this.terminalConfig.DEFAULT_TYPE,
            maxOutputLines: this.terminalConfig.MAX_OUTPUT_LINES,
            sessionTimeout: this.terminalConfig.SESSION_TIMEOUT
        };
    }
}
