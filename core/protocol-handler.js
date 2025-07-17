/**
 * MCP协议处理器模块
 *
 * 该模块负责处理MCP（Model Context Protocol）协议的所有相关操作，
 * 包括初始化、工具列表获取、响应发送等核心功能。
 *
 * @author MCP Terminal Server Team
 * @version 1.1.0
 */

/**
 * MCP协议处理器 - 专门负责MCP协议的请求和响应
 *
 * 该类封装了所有与MCP协议相关的操作，包括初始化、工具列表获取
 * 以及响应的发送等功能。作为核心层的组件，它提供了MCP协议的
 * 标准实现，确保协议的一致性和可靠性。
 */
export class MCPProtocolHandler {
    /**
     * 构造函数
     * @param {AppConfig} config - 应用配置对象
     * @param {ToolRegistry} toolRegistry - 工具注册表对象
     */
    constructor(config, toolRegistry) {
        this.config = config;
        this.toolRegistry = toolRegistry;
    }

    // ========================================================================
    // 请求处理方法
    // ========================================================================

    /**
     * 处理初始化请求
     * 
     * 根据MCP协议规范，返回服务器的基本信息和能力声明。
     * 这是MCP协议握手过程的关键步骤。
     * 
     * @returns {Object} 初始化响应对象
     */
    handleInitialize() {
        return {
            protocolVersion: this.config.mcpConfig.PROTOCOL_VERSION,
            capabilities: { 
                tools: {} 
            },
            serverInfo: {
                name: this.config.mcpConfig.SERVER_NAME,
                version: this.config.mcpConfig.SERVER_VERSION
            }
        };
    }

    /**
     * 处理工具列表请求
     * 
     * 返回服务器支持的所有工具的定义和元数据。
     * 客户端通过此接口了解可用的工具及其参数要求。
     * 
     * @returns {Object} 包含工具列表的响应对象
     */
    handleToolsList() {
        return { 
            tools: this.toolRegistry.getTools() 
        };
    }

    // ========================================================================
    // 响应发送方法
    // ========================================================================

    /**
     * 发送成功响应
     * 
     * 按照JSON-RPC 2.0规范格式化并发送成功响应。
     * 
     * @param {string|number} id - 请求ID
     * @param {Object} result - 响应结果
     */
    sendResponse(id, result) {
        const response = { 
            jsonrpc: '2.0', 
            id, 
            result 
        };
        console.log(JSON.stringify(response));
    }

    /**
     * 发送错误响应
     * 
     * 按照JSON-RPC 2.0规范格式化并发送错误响应。
     * 
     * @param {string|number} id - 请求ID
     * @param {number} code - 错误代码
     * @param {string} message - 错误消息
     */
    sendError(id, code, message) {
        const errorResponse = {
            jsonrpc: '2.0',
            id,
            error: { 
                code, 
                message 
            }
        };
        console.log(JSON.stringify(errorResponse));
    }

    // ========================================================================
    // 工具方法
    // ========================================================================

    /**
     * 验证MCP请求格式
     * 
     * 检查请求是否符合MCP协议规范。
     * 
     * @param {Object} request - MCP请求对象
     * @returns {boolean} 请求格式是否有效
     */
    isValidRequest(request) {
        return request && 
               typeof request === 'object' &&
               request.jsonrpc === '2.0' &&
               typeof request.method === 'string' &&
               (request.id !== undefined);
    }

    /**
     * 获取支持的方法列表
     * 
     * 返回此协议处理器支持的所有MCP方法。
     * 
     * @returns {string[]} 支持的方法名称数组
     */
    getSupportedMethods() {
        return [
            'initialize',
            'tools/list',
            'tools/call'
        ];
    }

    /**
     * 检查方法是否受支持
     * 
     * @param {string} method - 要检查的方法名称
     * @returns {boolean} 方法是否受支持
     */
    isMethodSupported(method) {
        return this.getSupportedMethods().includes(method);
    }
}
