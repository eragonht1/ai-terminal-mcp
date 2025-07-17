/**
 * 终端管理接口定义
 *
 * 该模块定义了终端管理相关的核心接口，确保不同实现之间的一致性。
 * 这些接口作为核心层的组件，为业务层提供标准化的契约。
 *
 * @author MCP Terminal Server Team
 * @version 1.1.0
 */

// ============================================================================
// 终端会话接口
// ============================================================================

/**
 * 终端会话接口
 * 
 * 定义了终端会话对象应该具备的基本属性和方法。
 * 
 * @interface ITerminalSession
 */
export const ITerminalSession = {
    /**
     * 会话ID
     * @type {string}
     */
    sessionId: '',

    /**
     * 终端类型
     * @type {string}
     */
    terminalType: '',

    /**
     * 工作目录
     * @type {string}
     */
    cwd: '',

    /**
     * 创建时间
     * @type {string}
     */
    createdAt: '',

    /**
     * 会话状态
     * @type {string}
     */
    status: '',

    /**
     * 进程ID
     * @type {number}
     */
    pid: 0,

    /**
     * 最后活动时间
     * @type {string}
     */
    lastActivity: ''
};

// ============================================================================
// 终端管理器接口
// ============================================================================

/**
 * 终端管理器接口
 * 
 * 定义了终端管理器应该实现的核心方法。
 * 
 * @interface ITerminalManager
 */
export const ITerminalManager = {
    /**
     * 创建新的终端会话
     * @param {string} terminalType - 终端类型
     * @param {string} cwd - 工作目录
     * @returns {Object} 会话创建结果
     */
    createSession(terminalType, cwd) {
        throw new Error('Method must be implemented');
    },

    /**
     * 执行命令
     * @param {string} sessionId - 会话ID
     * @param {string} command - 要执行的命令
     * @param {number} timeout - 超时时间
     * @returns {Promise<string[]>} 命令输出
     */
    async executeCommand(sessionId, command, timeout) {
        throw new Error('Method must be implemented');
    },

    /**
     * 读取会话输出
     * @param {string} sessionId - 会话ID
     * @returns {string[]} 输出内容
     */
    readSessionOutput(sessionId) {
        throw new Error('Method must be implemented');
    },

    /**
     * 写入会话输入
     * @param {string} sessionId - 会话ID
     * @param {string} input - 输入内容
     * @param {boolean} addNewline - 是否添加换行符
     */
    writeToSession(sessionId, input, addNewline) {
        throw new Error('Method must be implemented');
    },

    /**
     * 获取会话信息
     * @param {string} sessionId - 会话ID
     * @returns {Object} 会话信息
     */
    getSessionInfo(sessionId) {
        throw new Error('Method must be implemented');
    },

    /**
     * 获取所有会话
     * @returns {Object[]} 所有会话信息
     */
    getAllSessions() {
        throw new Error('Method must be implemented');
    },

    /**
     * 关闭所有会话
     * @returns {Object} 关闭结果
     */
    closeAllSessions() {
        throw new Error('Method must be implemented');
    },

    /**
     * 清理资源
     */
    cleanup() {
        throw new Error('Method must be implemented');
    }
};

// ============================================================================
// 终端配置接口
// ============================================================================

/**
 * 终端配置接口
 * 
 * 定义了终端配置对象的结构。
 * 
 * @interface ITerminalConfig
 */
export const ITerminalConfig = {
    /**
     * 默认终端类型
     * @type {string}
     */
    DEFAULT_TYPE: '',

    /**
     * 默认超时时间
     * @type {number}
     */
    DEFAULT_TIMEOUT: 0,

    /**
     * 默认列数
     * @type {number}
     */
    DEFAULT_COLS: 0,

    /**
     * 默认行数
     * @type {number}
     */
    DEFAULT_ROWS: 0,

    /**
     * 最大输出行数
     * @type {number}
     */
    MAX_OUTPUT_LINES: 0,

    /**
     * 会话超时时间
     * @type {number}
     */
    SESSION_TIMEOUT: 0,

    /**
     * 清理间隔
     * @type {number}
     */
    CLEANUP_INTERVAL: 0
};

// ============================================================================
// 工具方法
// ============================================================================

/**
 * 验证终端会话对象
 * @param {Object} session - 要验证的会话对象
 * @returns {boolean} 是否为有效的会话对象
 */
export function isValidSession(session) {
    return session &&
           typeof session === 'object' &&
           typeof session.sessionId === 'string' &&
           typeof session.terminalType === 'string' &&
           typeof session.cwd === 'string' &&
           typeof session.createdAt === 'string' &&
           typeof session.status === 'string';
}

/**
 * 验证终端类型
 * @param {string} terminalType - 要验证的终端类型
 * @returns {boolean} 是否为有效的终端类型
 */
export function isValidTerminalType(terminalType) {
    const validTypes = ['powershell', 'cmd'];
    return typeof terminalType === 'string' && validTypes.includes(terminalType);
}

/**
 * 创建默认会话对象
 * @param {string} sessionId - 会话ID
 * @param {string} terminalType - 终端类型
 * @param {string} cwd - 工作目录
 * @returns {Object} 默认会话对象
 */
export function createDefaultSession(sessionId, terminalType, cwd) {
    return {
        sessionId,
        terminalType,
        cwd,
        createdAt: new Date().toISOString(),
        status: 'active',
        pid: 0,
        lastActivity: new Date().toISOString()
    };
}
