/**
 * 数据缓存管理器模块
 *
 * 该模块负责管理WebSocket服务器的数据缓存，包括会话信息、
 * 输出历史和事件记录，提供高效的数据存储和检索功能。
 *
 * @author MCP Terminal Server Team
 * @version 1.1.0
 */

/**
 * 数据缓存管理器 - 专门负责会话数据和事件历史的缓存
 *
 * 该类负责管理WebSocket服务器的数据缓存，包括会话信息、
 * 输出历史和事件记录，提供高效的数据存储和检索功能。
 * 作为业务层的组件，它为通信层提供数据持久化支持。
 */
export class DataCache {
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

    // ========================================================================
    // 会话缓存管理
    // ========================================================================

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

    // ========================================================================
    // 事件历史管理
    // ========================================================================

    /**
     * 添加事件到历史记录并维护大小限制
     * @param {Object} event - 事件对象
     */
    addToHistory(event) {
        this.eventHistory.push(event);
        this._trimEventHistory();
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

    // ========================================================================
    // 缓存管理
    // ========================================================================

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

    // ========================================================================
    // 私有辅助方法
    // ========================================================================

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
     * 修剪事件历史以保持在限制范围内
     * @private
     */
    _trimEventHistory() {
        if (this.eventHistory.length > this.maxHistorySize) {
            this.eventHistory = this.eventHistory.slice(-this.maxHistorySize);
        }
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

    // ========================================================================
    // 工具方法
    // ========================================================================

    /**
     * 检查会话是否存在
     * @param {string} sessionId - 会话ID
     * @returns {boolean} 会话是否存在
     */
    hasSession(sessionId) {
        return this.sessionCache.has(sessionId);
    }

    /**
     * 获取所有会话ID
     * @returns {string[]} 所有会话ID的数组
     */
    getAllSessionIds() {
        return Array.from(this.sessionCache.keys());
    }

    /**
     * 获取活跃会话数量
     * @returns {number} 活跃会话数量
     */
    getActiveSessionCount() {
        let count = 0;
        for (const sessionData of this.sessionCache.values()) {
            if (sessionData.status === 'active') {
                count++;
            }
        }
        return count;
    }

    /**
     * 移除指定会话
     * @param {string} sessionId - 要移除的会话ID
     * @returns {boolean} 是否成功移除
     */
    removeSession(sessionId) {
        return this.sessionCache.delete(sessionId);
    }
}
