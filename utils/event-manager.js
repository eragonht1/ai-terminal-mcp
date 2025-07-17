/**
 * 事件管理器模块
 *
 * 该模块提供事件类型验证、事件对象创建和事件管理功能，
 * 确保事件处理的一致性和可靠性。
 *
 * @author MCP Terminal Server Team
 * @version 1.1.0
 */

import { WEBSOCKET_EVENTS, TERMINAL_EVENTS, WS_SERVER_EVENTS } from './event-types.js';

/**
 * 事件管理器 - 提供事件类型验证和管理
 *
 * 该类负责管理系统中的所有事件类型，提供事件验证、
 * 事件对象创建和事件数据格式化等功能。
 */
export class EventManager {
    /**
     * 构造函数
     */
    constructor() {
        this.websocketEvents = WEBSOCKET_EVENTS;
        this.terminalEvents = TERMINAL_EVENTS;
        this.wsServerEvents = WS_SERVER_EVENTS;
    }

    // ========================================================================
    // 事件类型验证方法
    // ========================================================================

    /**
     * 验证WebSocket事件类型
     * @param {string} eventType - 要验证的事件类型
     * @returns {boolean} 是否为有效的WebSocket事件类型
     */
    isValidWebSocketEvent(eventType) {
        return Object.values(this.websocketEvents).includes(eventType);
    }

    /**
     * 验证终端事件类型
     * @param {string} eventType - 要验证的事件类型
     * @returns {boolean} 是否为有效的终端事件类型
     */
    isValidTerminalEvent(eventType) {
        return Object.values(this.terminalEvents).includes(eventType);
    }

    /**
     * 验证WebSocket服务器事件类型
     * @param {string} eventType - 要验证的事件类型
     * @returns {boolean} 是否为有效的WebSocket服务器事件类型
     */
    isValidWSServerEvent(eventType) {
        return Object.values(this.wsServerEvents).includes(eventType);
    }

    // ========================================================================
    // 事件对象创建方法
    // ========================================================================

    /**
     * 创建标准事件对象
     * @param {string} type - 事件类型
     * @param {string|null} sessionId - 会话ID（可选）
     * @param {Object|null} data - 事件数据（可选）
     * @returns {Object} 标准化的事件对象
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
     * @param {string} toolName - 工具名称
     * @param {Object} args - 工具参数
     * @param {string} status - 执行状态
     * @returns {Object} 工具调用事件数据
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
     * @param {Error|string} error - 错误对象或错误消息
     * @param {Object|null} context - 错误上下文（可选）
     * @returns {Object} 错误事件数据
     */
    createErrorEventData(error, context = null) {
        return {
            error: error.message || error,
            context
        };
    }

    /**
     * 创建终端输出事件数据
     * @param {string|string[]} output - 终端输出内容
     * @returns {Object} 终端输出事件数据
     */
    createTerminalOutputEventData(output) {
        return {
            output: Array.isArray(output) 
                ? output.filter(line => line.trim()) 
                : [output].filter(line => line.trim())
        };
    }

    // ========================================================================
    // 工具方法
    // ========================================================================

    /**
     * 获取所有事件类型
     * @returns {Object} 包含所有事件类型的对象
     */
    getAllEventTypes() {
        return {
            websocket: this.websocketEvents,
            terminal: this.terminalEvents,
            wsServer: this.wsServerEvents
        };
    }

    /**
     * 验证事件对象格式
     * @param {Object} event - 要验证的事件对象
     * @returns {boolean} 事件对象格式是否有效
     */
    isValidEventObject(event) {
        return event && 
               typeof event === 'object' &&
               typeof event.type === 'string' &&
               typeof event.timestamp === 'string';
    }
}
