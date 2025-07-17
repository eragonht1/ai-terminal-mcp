/**
 * 事件管理接口定义
 *
 * 该模块定义了事件管理相关的核心接口，确保事件系统的一致性。
 * 这些接口作为核心层的组件，为业务层提供标准化的事件处理契约。
 *
 * @author MCP Terminal Server Team
 * @version 1.1.0
 */

// ============================================================================
// 事件对象接口
// ============================================================================

/**
 * 标准事件对象接口
 * 
 * 定义了系统中所有事件对象应该具备的基本结构。
 * 
 * @interface IEvent
 */
export const IEvent = {
    /**
     * 事件类型
     * @type {string}
     */
    type: '',

    /**
     * 事件时间戳
     * @type {string}
     */
    timestamp: '',

    /**
     * 会话ID（可选）
     * @type {string|null}
     */
    sessionId: null,

    /**
     * 事件数据（可选）
     * @type {Object|null}
     */
    data: null
};

// ============================================================================
// 事件发射器接口
// ============================================================================

/**
 * 事件发射器接口
 * 
 * 定义了事件发射器应该实现的核心方法。
 * 
 * @interface IEventEmitter
 */
export const IEventEmitter = {
    /**
     * 注册事件监听器
     * @param {string} event - 事件名称
     * @param {Function} listener - 监听器函数
     */
    on(event, listener) {
        throw new Error('Method must be implemented');
    },

    /**
     * 注册一次性事件监听器
     * @param {string} event - 事件名称
     * @param {Function} listener - 监听器函数
     */
    once(event, listener) {
        throw new Error('Method must be implemented');
    },

    /**
     * 移除事件监听器
     * @param {string} event - 事件名称
     * @param {Function} listener - 监听器函数
     */
    off(event, listener) {
        throw new Error('Method must be implemented');
    },

    /**
     * 发射事件
     * @param {string} event - 事件名称
     * @param {...*} args - 事件参数
     */
    emit(event, ...args) {
        throw new Error('Method must be implemented');
    },

    /**
     * 移除所有监听器
     * @param {string} event - 事件名称（可选）
     */
    removeAllListeners(event) {
        throw new Error('Method must be implemented');
    }
};

// ============================================================================
// 事件管理器接口
// ============================================================================

/**
 * 事件管理器接口
 * 
 * 定义了事件管理器应该实现的核心功能。
 * 
 * @interface IEventManager
 */
export const IEventManager = {
    /**
     * 验证事件类型
     * @param {string} eventType - 要验证的事件类型
     * @param {string} category - 事件类别
     * @returns {boolean} 是否为有效的事件类型
     */
    isValidEventType(eventType, category) {
        throw new Error('Method must be implemented');
    },

    /**
     * 创建标准事件对象
     * @param {string} type - 事件类型
     * @param {string|null} sessionId - 会话ID
     * @param {Object|null} data - 事件数据
     * @returns {Object} 标准事件对象
     */
    createEvent(type, sessionId, data) {
        throw new Error('Method must be implemented');
    },

    /**
     * 创建事件数据
     * @param {string} dataType - 数据类型
     * @param {...*} args - 数据参数
     * @returns {Object} 事件数据对象
     */
    createEventData(dataType, ...args) {
        throw new Error('Method must be implemented');
    },

    /**
     * 获取所有事件类型
     * @returns {Object} 所有事件类型的集合
     */
    getAllEventTypes() {
        throw new Error('Method must be implemented');
    }
};

// ============================================================================
// 事件广播器接口
// ============================================================================

/**
 * 事件广播器接口
 * 
 * 定义了事件广播器的功能规范。
 * 
 * @interface IEventBroadcaster
 */
export const IEventBroadcaster = {
    /**
     * 广播事件
     * @param {string} eventType - 事件类型
     * @param {Object} eventData - 事件数据
     * @param {string|null} sessionId - 会话ID
     */
    broadcast(eventType, eventData, sessionId) {
        throw new Error('Method must be implemented');
    },

    /**
     * 广播到指定客户端
     * @param {string} clientId - 客户端ID
     * @param {string} eventType - 事件类型
     * @param {Object} eventData - 事件数据
     */
    broadcastToClient(clientId, eventType, eventData) {
        throw new Error('Method must be implemented');
    },

    /**
     * 获取连接的客户端数量
     * @returns {number} 客户端数量
     */
    getClientCount() {
        throw new Error('Method must be implemented');
    }
};

// ============================================================================
// 工具方法
// ============================================================================

/**
 * 验证事件对象格式
 * @param {Object} event - 要验证的事件对象
 * @returns {boolean} 是否为有效的事件对象
 */
export function isValidEvent(event) {
    return event &&
           typeof event === 'object' &&
           typeof event.type === 'string' &&
           typeof event.timestamp === 'string' &&
           event.type.length > 0 &&
           event.timestamp.length > 0;
}

/**
 * 验证事件监听器函数
 * @param {*} listener - 要验证的监听器
 * @returns {boolean} 是否为有效的监听器函数
 */
export function isValidListener(listener) {
    return typeof listener === 'function';
}

/**
 * 创建默认事件对象
 * @param {string} type - 事件类型
 * @param {string|null} sessionId - 会话ID
 * @param {Object|null} data - 事件数据
 * @returns {Object} 默认事件对象
 */
export function createDefaultEvent(type, sessionId = null, data = null) {
    return {
        type,
        timestamp: new Date().toISOString(),
        sessionId,
        data
    };
}

/**
 * 验证事件类型字符串
 * @param {string} eventType - 要验证的事件类型
 * @returns {boolean} 是否为有效的事件类型字符串
 */
export function isValidEventTypeString(eventType) {
    return typeof eventType === 'string' && 
           eventType.length > 0 && 
           /^[a-zA-Z_][a-zA-Z0-9_]*$/.test(eventType);
}
