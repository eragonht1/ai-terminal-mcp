/**
 * 日志工具模块
 *
 * 该模块提供统一的日志记录功能，支持不同级别的日志输出，
 * 确保日志格式的一致性和可维护性。
 *
 * @author MCP Terminal Server Team
 * @version 1.1.0
 */

// ============================================================================
// 日志级别常量
// ============================================================================

/**
 * 日志级别枚举
 * @readonly
 * @enum {string}
 */
export const LOG_LEVELS = {
    /** 调试信息 */
    DEBUG: 'DEBUG',
    /** 一般信息 */
    INFO: 'INFO',
    /** 警告信息 */
    WARN: 'WARN',
    /** 错误信息 */
    ERROR: 'ERROR'
};

// ============================================================================
// 日志工具类
// ============================================================================

/**
 * 日志记录器类
 *
 * 提供统一的日志记录接口，支持不同级别的日志输出，
 * 并提供格式化和时间戳功能。
 */
export class Logger {
    /**
     * 构造函数
     * @param {string} name - 日志记录器名称
     * @param {string} level - 日志级别
     */
    constructor(name = 'MCP-Server', level = LOG_LEVELS.INFO) {
        this.name = name;
        this.level = level;
        this.levelPriority = {
            [LOG_LEVELS.DEBUG]: 0,
            [LOG_LEVELS.INFO]: 1,
            [LOG_LEVELS.WARN]: 2,
            [LOG_LEVELS.ERROR]: 3
        };
    }

    /**
     * 创建时间戳
     * @returns {string} ISO格式的时间戳
     * @private
     */
    _createTimestamp() {
        return new Date().toISOString();
    }

    /**
     * 格式化日志消息
     * @param {string} level - 日志级别
     * @param {string} message - 日志消息
     * @returns {string} 格式化后的日志消息
     * @private
     */
    _formatMessage(level, message) {
        const timestamp = this._createTimestamp();
        return `[${timestamp}] [${this.name}] [${level}] ${message}`;
    }

    /**
     * 检查是否应该输出指定级别的日志
     * @param {string} level - 要检查的日志级别
     * @returns {boolean} 是否应该输出
     * @private
     */
    _shouldLog(level) {
        return this.levelPriority[level] >= this.levelPriority[this.level];
    }

    /**
     * 输出调试信息
     * @param {string} message - 调试消息
     */
    debug(message) {
        if (this._shouldLog(LOG_LEVELS.DEBUG)) {
            console.log(this._formatMessage(LOG_LEVELS.DEBUG, message));
        }
    }

    /**
     * 输出一般信息
     * @param {string} message - 信息消息
     */
    info(message) {
        if (this._shouldLog(LOG_LEVELS.INFO)) {
            console.log(this._formatMessage(LOG_LEVELS.INFO, message));
        }
    }

    /**
     * 输出警告信息
     * @param {string} message - 警告消息
     */
    warn(message) {
        if (this._shouldLog(LOG_LEVELS.WARN)) {
            console.warn(this._formatMessage(LOG_LEVELS.WARN, message));
        }
    }

    /**
     * 输出错误信息
     * @param {string} message - 错误消息
     */
    error(message) {
        if (this._shouldLog(LOG_LEVELS.ERROR)) {
            console.error(this._formatMessage(LOG_LEVELS.ERROR, message));
        }
    }

    /**
     * 输出服务器专用日志（输出到stderr但不显示为错误）
     * @param {string} message - 服务器消息
     */
    serverLog(message) {
        const formattedMessage = this._formatMessage(LOG_LEVELS.INFO, message);
        process.stderr.write(`${formattedMessage}\n`);
    }

    /**
     * 输出WebSocket专用日志
     * @param {string} message - WebSocket消息
     */
    wsLog(message) {
        const formattedMessage = this._formatMessage(LOG_LEVELS.INFO, `[WebSocket] ${message}`);
        process.stderr.write(`${formattedMessage}\n`);
    }
}

// ============================================================================
// 默认日志记录器实例
// ============================================================================

/**
 * 默认日志记录器实例
 * @type {Logger}
 */
export const defaultLogger = new Logger();

// ============================================================================
// 便捷函数
// ============================================================================

/**
 * 创建专用日志记录器
 * @param {string} name - 日志记录器名称
 * @param {string} level - 日志级别
 * @returns {Logger} 日志记录器实例
 */
export function createLogger(name, level = LOG_LEVELS.INFO) {
    return new Logger(name, level);
}

/**
 * 服务器专用日志函数 - 输出到stderr但不显示为错误
 * @param {string} message - 要记录的消息
 */
export function serverLog(message) {
    defaultLogger.serverLog(message);
}

/**
 * WebSocket专用日志函数
 * @param {string} message - 要记录的消息
 */
export function wsLog(message) {
    defaultLogger.wsLog(message);
}
