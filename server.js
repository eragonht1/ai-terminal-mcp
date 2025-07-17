#!/usr/bin/env node

/**
 * MCP Terminal Server - 主入口文件
 * 
 * 采用分层架构设计：
 * - utils/: 工具层 - 配置、事件、日志、验证等基础工具
 * - core/: 核心层 - MCP协议处理、接口定义
 * - business/: 业务层 - 终端管理、工具执行、WebSocket通信
 * - app/: 应用层 - 服务器协调、GUI服务
 * 
 * @author MCP Terminal Server Team
 * @version 1.1.0
 */

// ============================================================================
// 导入依赖 - 按分层架构组织
// ============================================================================

// 配置层
import { AppConfig } from './config/app-config.js';

// 工具层
import { serverLog } from './utils/logger.js';

// 核心层
import { MCPProtocolHandler } from './core/protocol-handler.js';

// 业务层
import { TerminalManager } from './business/terminal-manager.js';
import { ToolRegistry } from './business/tool-registry.js';
import { ToolExecutor } from './business/tool-executor.js';
import { WebSocketBridge } from './business/websocket-bridge.js';

// 应用层
import { ServerOrchestrator } from './app/server-orchestrator.js';

// ============================================================================
// 事件广播器工厂函数
// ============================================================================

/**
 * 创建事件广播器函数
 * @param {WebSocketBridge} webSocketBridge - WebSocket桥接器实例
 * @returns {Function} 事件广播器函数
 */
function createEventBroadcaster(webSocketBridge) {
    return (name, args, sessionId, status, error = null) => {
        if (status === 'error') {
            webSocketBridge.broadcastError(sessionId, error, { tool: name, args });
        } else {
            webSocketBridge.broadcastToolCall(name, args, sessionId, status);
        }
    };
}

// ============================================================================
// 主入口函数 - 依赖注入和服务器启动
// ============================================================================

/**
 * 主入口函数 - 负责创建所有资源并进行依赖注入
 *
 * 采用依赖注入模式，确保各组件之间的松耦合，
 * 便于测试和维护。所有资源在此处统一创建和配置。
 */
function main() {
    try {
        // 1. 创建核心配置对象
        const config = new AppConfig();

        // 2. 创建工具注册表
        const toolRegistry = new ToolRegistry(config);

        // 3. 创建终端管理器
        const terminalManager = new TerminalManager(config);

        // 4. 创建WebSocket桥接器
        const webSocketBridge = new WebSocketBridge(config);

        // 5. 创建MCP协议处理器
        const protocolHandler = new MCPProtocolHandler(config, toolRegistry);

        // 6. 创建事件广播器
        const eventBroadcaster = createEventBroadcaster(webSocketBridge);

        // 7. 创建工具执行器
        const toolExecutor = new ToolExecutor(config, terminalManager, eventBroadcaster);

        // 8. 创建服务器协调器（注入所有依赖）
        const server = new ServerOrchestrator(
            config,
            terminalManager,
            webSocketBridge,
            protocolHandler,
            toolExecutor
        );

        // 9. 启动服务器
        server.start();

        serverLog('MCP Terminal Server 已启动，采用分层架构设计');
        serverLog(`配置摘要: ${JSON.stringify(config.getConfigSummary(), null, 2)}`);

    } catch (error) {
        console.error('服务器启动失败:', error);
        process.exit(1);
    }
}

// ============================================================================
// 程序入口点检查
// ============================================================================

/**
 * 程序入口点检查 - 只有在直接运行此文件时才执行主函数
 * 这样设计便于模块化测试和引用
 */
if (import.meta.url.endsWith('server.js')) {
    main();
}

// ============================================================================
// 导出接口（用于测试和模块化）
// ============================================================================

export {
    main,
    createEventBroadcaster
};
