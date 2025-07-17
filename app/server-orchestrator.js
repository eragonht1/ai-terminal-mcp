/**
 * 服务器协调器模块
 *
 * 该模块作为整个服务器的核心协调器，负责管理各个组件之间的交互，
 * 处理输入输出、事件监听、资源清理等核心服务器功能。
 *
 * @author MCP Terminal Server Team
 * @version 1.1.0
 */

import { serverLog } from '../utils/logger.js';

/**
 * 服务器协调器 - 协调各个组件，处理主要的服务器逻辑
 *
 * 该类作为整个服务器的核心协调器，负责管理各个组件之间的交互，
 * 处理输入输出、事件监听、资源清理等核心服务器功能。
 * 作为应用层的核心组件，它协调所有业务层和核心层的服务。
 */
export class ServerOrchestrator {
    /**
     * 构造函数
     * @param {AppConfig} config - 应用配置对象
     * @param {TerminalManager} terminalManager - 终端管理器
     * @param {WebSocketBridge} webSocketBridge - WebSocket桥接器
     * @param {MCPProtocolHandler} protocolHandler - MCP协议处理器
     * @param {ToolExecutor} toolExecutor - 工具执行器
     */
    constructor(config, terminalManager, webSocketBridge, protocolHandler, toolExecutor) {
        this.config = config;
        this.terminalManager = terminalManager;
        this.webSocketBridge = webSocketBridge;
        this.protocolHandler = protocolHandler;
        this.toolExecutor = toolExecutor;

        // 设置事件监听
        this.setupEventListeners();

        // 初始化GUI服务器
        this.initializeGUI();
    }

    // ========================================================================
    // 服务器生命周期管理
    // ========================================================================

    /**
     * 启动服务器 - 设置输入监听和信号处理
     */
    start() {
        // 设置标准输入处理
        process.stdin.setEncoding('utf8').resume();
        process.stdin.on('data', this._handleStdinData.bind(this));

        // 设置进程信号处理
        this._setupSignalHandlers();
    }

    /**
     * 清理资源 - 优雅关闭所有服务和连接
     *
     * 按照依赖关系的逆序清理各个组件，确保资源得到正确释放，
     * 避免内存泄漏和端口占用问题。
     */
    async cleanup() {
        serverLog('正在清理资源...');

        // 1. 清理终端管理器
        try {
            this.terminalManager.cleanup();
            serverLog('终端管理器已清理');
        } catch (error) {
            console.error('清理终端管理器失败:', error);
        }

        // 2. 清理WebSocket服务器
        try {
            this.webSocketBridge.cleanup();
            serverLog('WebSocket服务器已清理');
        } catch (error) {
            console.error('清理WebSocket服务器失败:', error);
        }

        // 3. 清理GUI Web服务器
        try {
            const { stopGUIServer } = await import('./gui-server.js');
            stopGUIServer();
            serverLog('GUI Web服务器已清理');
        } catch (error) {
            console.error('清理GUI Web服务器失败:', error);
        }
    }

    // ========================================================================
    // 输入处理和请求路由
    // ========================================================================

    /**
     * 处理输入数据 - 解析JSON并分发到请求处理器
     * @param {string} input - 输入的JSON字符串
     */
    handleInput(input) {
        try {
            const request = JSON.parse(input);
            this.handleRequest(request);
        } catch (error) {
            this.protocolHandler.sendError(
                null,
                this.config.errorCodes.PARSE_ERROR,
                'Parse error'
            );
        }
    }

    /**
     * 处理MCP协议请求 - 根据方法类型分发到对应处理器
     * @param {Object} request - MCP请求对象
     * @param {string|number} request.id - 请求ID
     * @param {string} request.method - 请求方法
     * @param {Object} [request.params] - 请求参数
     */
    async handleRequest({ id, method, params }) {
        // 请求处理映射表
        const requestHandlers = {
            'initialize': () => {
                const result = this.protocolHandler.handleInitialize();
                this.protocolHandler.sendResponse(id, result);
            },
            'tools/list': () => {
                const result = this.protocolHandler.handleToolsList();
                this.protocolHandler.sendResponse(id, result);
            },
            'tools/call': async () => {
                const result = await this.toolExecutor.executeTool(params.name, params.arguments);
                const response = {
                    content: [{ type: 'text', text: JSON.stringify(result, null, 2) }]
                };
                this.protocolHandler.sendResponse(id, response);
            }
        };

        try {
            const handler = requestHandlers[method];
            if (!handler) {
                this.protocolHandler.sendError(
                    id,
                    this.config.errorCodes.METHOD_NOT_FOUND,
                    'Method not found'
                );
                return;
            }

            await handler();
        } catch (error) {
            this.protocolHandler.sendError(
                id,
                this.config.errorCodes.INTERNAL_ERROR,
                'Internal error'
            );
        }
    }

    // ========================================================================
    // 事件系统管理
    // ========================================================================

    /**
     * 设置事件监听器 - 将终端事件广播到GUI
     *
     * 建立终端管理器与WebSocket桥接器之间的事件连接，
     * 确保终端状态变化能够实时传递到GUI界面。
     */
    setupEventListeners() {
        // 事件监听器映射表
        const eventListeners = {
            'sessionCreated': (sessionData) => {
                this.webSocketBridge.broadcastSessionCreated(sessionData);
            },
            'outputReceived': (sessionId, output) => {
                this.webSocketBridge.broadcastTerminalOutput(sessionId, output);
            },
            'sessionClosed': (sessionId, exitCode) => {
                this.webSocketBridge.broadcastSessionClosed(sessionId, exitCode);
            },
            'errorOccurred': (sessionId, error, context) => {
                this.webSocketBridge.broadcastError(sessionId, error, context);
            }
        };

        // 批量注册事件监听器
        Object.entries(eventListeners).forEach(([event, handler]) => {
            this.terminalManager.on(event, handler);
        });
    }

    // ========================================================================
    // GUI服务器管理
    // ========================================================================

    /**
     * 初始化GUI服务器 - 检测状态，避免重复启动
     *
     * 智能检测WebSocket服务器运行状态，只在必要时启动GUI相关服务，
     * 避免重复启动导致的端口冲突问题。
     */
    async initializeGUI() {
        try {
            if (this.webSocketBridge.isRunning) {
                serverLog('GUI服务器已在运行，跳过启动');
                return;
            }

            // 启动WebSocket服务器
            serverLog('启动WebSocket服务器...');
            this.webSocketBridge.start();

            // 启动GUI Web服务器
            serverLog('启动GUI Web服务器...');
            const { startGUIServer } = await import('./gui-server.js');
            await startGUIServer();

            serverLog('GUI服务器启动完成');
        } catch (error) {
            console.error('初始化GUI服务器失败:', error);
        }
    }

    // ========================================================================
    // 私有辅助方法
    // ========================================================================

    /**
     * 处理标准输入数据
     * @param {string} data - 输入数据
     * @private
     */
    _handleStdinData(data) {
        const lines = data.trim().split('\n');
        lines.forEach(line => {
            const trimmedLine = line.trim();
            if (trimmedLine) {
                this.handleInput(trimmedLine);
            }
        });
    }

    /**
     * 设置进程信号处理器
     * @private
     */
    _setupSignalHandlers() {
        const signals = ['SIGINT', 'SIGTERM', 'exit'];
        signals.forEach(signal => {
            process.on(signal, async () => {
                await this.cleanup();
                process.exit(0);
            });
        });
    }

    // ========================================================================
    // 工具方法
    // ========================================================================

    /**
     * 获取服务器状态
     * @returns {Object} 服务器状态信息
     */
    getServerStatus() {
        return {
            isRunning: true,
            webSocketRunning: this.webSocketBridge.isRunning,
            terminalSessions: this.terminalManager.getAllSessions().length,
            configSummary: this.config.getConfigSummary()
        };
    }

    /**
     * 检查服务器健康状态
     * @returns {boolean} 服务器是否健康
     */
    isHealthy() {
        return this.webSocketBridge.isRunning && 
               this.terminalManager && 
               this.protocolHandler && 
               this.toolExecutor;
    }
}
