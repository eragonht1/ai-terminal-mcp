#!/usr/bin/env node
import { TerminalManager } from './terminal-manager.js';
import { WebSocketBridge } from './websocket-bridge.js';
import { AppConfig } from './config.js';
import { ToolRegistry } from './tools.js';

/**
 * 专用日志函数 - 输出到stderr但不显示为错误
 * @param {string} message - 要记录的消息
 */
function serverLog(message) {
    process.stderr.write(`[MCP服务器] ${message}\n`);
}

/**
 * MCP协议处理器 - 专门负责MCP协议的请求和响应
 *
 * 该类封装了所有与MCP协议相关的操作，包括初始化、工具列表获取
 * 以及响应的发送等功能。
 */
class MCPProtocolHandler {
    /**
     * 构造函数
     * @param {AppConfig} config - 应用配置对象
     * @param {ToolRegistry} toolRegistry - 工具注册表对象
     */
    constructor(config, toolRegistry) {
        this.config = config;
        this.toolRegistry = toolRegistry;
    }

    /**
     * 处理初始化请求
     * @returns {Object} 初始化响应对象
     */
    handleInitialize() {
        return {
            protocolVersion: this.config.mcpConfig.PROTOCOL_VERSION,
            capabilities: { tools: {} },
            serverInfo: {
                name: this.config.mcpConfig.SERVER_NAME,
                version: this.config.mcpConfig.SERVER_VERSION
            }
        };
    }

    /**
     * 处理工具列表请求
     * @returns {Object} 包含工具列表的响应对象
     */
    handleToolsList() {
        return { tools: this.toolRegistry.getTools() };
    }

    /**
     * 发送成功响应
     * @param {string|number} id - 请求ID
     * @param {Object} result - 响应结果
     */
    sendResponse(id, result) {
        const response = { jsonrpc: '2.0', id, result };
        console.log(JSON.stringify(response));
    }

    /**
     * 发送错误响应
     * @param {string|number} id - 请求ID
     * @param {number} code - 错误代码
     * @param {string} message - 错误消息
     */
    sendError(id, code, message) {
        const errorResponse = {
            jsonrpc: '2.0',
            id,
            error: { code, message }
        };
        console.log(JSON.stringify(errorResponse));
    }
}

/**
 * 工具执行器 - 专门负责工具的执行逻辑
 *
 * 该类负责执行各种终端相关的工具操作，包括命令执行、会话读写、
 * 会话管理等功能，并提供统一的错误处理和事件广播机制。
 */
class ToolExecutor {
    /**
     * 构造函数
     * @param {AppConfig} config - 应用配置对象
     * @param {TerminalManager} terminalManager - 终端管理器
     * @param {Function} eventBroadcaster - 事件广播函数
     */
    constructor(config, terminalManager, eventBroadcaster) {
        this.config = config;
        this.terminalManager = terminalManager;
        this.eventBroadcaster = eventBroadcaster;
    }

    /**
     * 创建ISO格式的时间戳
     * @returns {string} ISO格式的时间戳字符串
     */
    _createTimestamp() {
        return new Date().toISOString();
    }

    /**
     * 验证必需参数是否存在
     * @param {Object} args - 参数对象
     * @param {string[]} requiredParams - 必需参数名称数组
     * @throws {Error} 当缺少必需参数时抛出错误
     */
    _validateRequiredParams(args, requiredParams) {
        const missingParams = requiredParams.filter(param => !args[param]);
        if (missingParams.length > 0) {
            throw new Error(`缺少必需参数: ${missingParams.join(', ')}`);
        }
    }

    /**
     * 创建标准化的工具执行结果
     * @param {boolean} success - 执行是否成功
     * @param {Object} data - 结果数据
     * @param {string} timestamp - 时间戳
     * @returns {Object} 标准化的结果对象
     */
    _createToolResult(success, data, timestamp) {
        return { success, ...data, timestamp };
    }

    /**
     * 执行终端命令工具 (tm_execute)
     * @param {Object} args - 工具参数
     * @param {string} args.command - 要执行的命令
     * @param {string} args.cwd - 工作目录
     * @param {string} [args.terminal_type] - 终端类型
     * @param {number} [args.timeout] - 超时时间
     * @returns {Promise<Object>} 执行结果
     */
    async executeTerminalCommand(args) {
        const {
            command,
            terminal_type = this.config.terminalConfig.DEFAULT_TYPE,
            cwd,
            timeout = this.config.terminalConfig.DEFAULT_TIMEOUT
        } = args;

        this._validateRequiredParams(args, ['command', 'cwd']);

        const sessionResult = this.terminalManager.createSession(terminal_type, cwd);
        const { sessionId } = sessionResult;

        // 广播会话创建状态
        this.eventBroadcaster('tm_execute', args, sessionId, this.config.toolStatus.SESSION_CREATED);

        const output = await this.terminalManager.executeCommand(sessionId, command, timeout);

        // 广播执行完成
        this.eventBroadcaster('tm_execute', args, sessionId, this.config.toolStatus.COMPLETED);

        return this._createToolResult(true, {
            sessionId,
            command,
            output: output.filter(line => line.trim())
        }, this._createTimestamp());
    }

    /**
     * 执行会话读取工具 (tm_read)
     * @param {Object} args - 工具参数
     * @param {string} args.session_id - 会话ID
     * @returns {Promise<Object>} 读取结果
     */
    async executeReadSession(args) {
        const { session_id: sessionId } = args;
        this._validateRequiredParams(args, ['session_id']);

        this.eventBroadcaster('tm_read', args, sessionId, this.config.toolStatus.EXECUTING);

        const output = this.terminalManager.readSessionOutput(sessionId);
        const sessionInfo = this.terminalManager.getSessionInfo(sessionId);

        this.eventBroadcaster('tm_read', args, sessionId, this.config.toolStatus.COMPLETED);

        return this._createToolResult(true, {
            sessionId,
            output: output.filter(line => line.trim()),
            sessionInfo
        }, this._createTimestamp());
    }

    /**
     * 执行会话写入工具 (tm_write)
     * @param {Object} args - 工具参数
     * @param {string} args.session_id - 会话ID
     * @param {string} args.input - 要写入的内容
     * @param {boolean} [args.add_newline=true] - 是否添加换行符
     * @returns {Promise<Object>} 写入结果
     */
    async executeWriteSession(args) {
        const { session_id: sessionId, input, add_newline = true } = args;

        this._validateRequiredParams(args, ['session_id']);
        if (input === undefined) {
            throw new Error('缺少必需参数: input');
        }

        this.eventBroadcaster('tm_write', args, sessionId, this.config.toolStatus.EXECUTING);

        this.terminalManager.writeToSession(sessionId, input, add_newline);

        this.eventBroadcaster('tm_write', args, sessionId, this.config.toolStatus.COMPLETED);

        return this._createToolResult(true, {
            sessionId,
            input
        }, this._createTimestamp());
    }

    /**
     * 执行会话列表工具 (tm_list)
     * @param {Object} args - 工具参数
     * @returns {Promise<Object>} 会话列表结果
     */
    async executeListSessions(args) {
        this.eventBroadcaster('tm_list', args, null, this.config.toolStatus.EXECUTING);

        const sessions = this.terminalManager.getAllSessions();

        this.eventBroadcaster('tm_list', args, null, this.config.toolStatus.COMPLETED);

        return this._createToolResult(true, {
            sessions,
            totalSessions: sessions.length
        }, this._createTimestamp());
    }

    /**
     * 执行关闭所有会话工具 (tm_close)
     * @param {Object} args - 工具参数
     * @returns {Promise<Object>} 关闭结果
     */
    async executeCloseSessions(args) {
        this.eventBroadcaster('tm_close', args, null, this.config.toolStatus.EXECUTING);

        const closeResult = this.terminalManager.closeAllSessions();

        this.eventBroadcaster('tm_close', args, null, this.config.toolStatus.COMPLETED);

        return this._createToolResult(closeResult.success, {
            message: closeResult.message,
            closedSessions: closeResult.closedSessions,
            failedSessions: closeResult.failedSessions,
            totalClosed: closeResult.totalClosed,
            totalFailed: closeResult.totalFailed
        }, this._createTimestamp());
    }

    /**
     * 工具执行路由器 - 根据工具名称分发到对应的执行方法
     * @param {string} name - 工具名称
     * @param {Object} args - 工具参数
     * @returns {Promise<Object>} 执行结果
     */
    async executeTool(name, args) {
        // 工具执行映射表 - 使用对象映射替代switch语句
        const toolExecutors = {
            'tm_execute': () => this.executeTerminalCommand(args),
            'tm_read': () => this.executeReadSession(args),
            'tm_write': () => this.executeWriteSession(args),
            'tm_list': () => this.executeListSessions(args),
            'tm_close': () => this.executeCloseSessions(args)
        };

        try {
            // 广播工具调用开始
            this.eventBroadcaster(name, args, null, this.config.toolStatus.EXECUTING);

            const executor = toolExecutors[name];
            if (!executor) {
                throw new Error(`未知工具: ${name}`);
            }

            return await executor();
        } catch (error) {
            // 广播错误事件
            this.eventBroadcaster(name, args, null, 'error', error);
            return this._createToolResult(false, { error: error.message }, this._createTimestamp());
        }
    }
}

/**
 * 服务器协调器 - 协调各个组件，处理主要的服务器逻辑
 *
 * 该类作为整个服务器的核心协调器，负责管理各个组件之间的交互，
 * 处理输入输出、事件监听、资源清理等核心服务器功能。
 */
class ServerOrchestrator {
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
}

// ============================================================================
// 主入口 - 依赖注入和服务器启动
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

/**
 * 主入口函数 - 负责创建所有资源并进行依赖注入
 *
 * 采用依赖注入模式，确保各组件之间的松耦合，
 * 便于测试和维护。所有资源在此处统一创建和配置。
 */
function main() {
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

    serverLog('MCP Terminal Server 已启动，所有资源已完成依赖注入');
}

/**
 * 程序入口点检查 - 只有在直接运行此文件时才执行主函数
 * 这样设计便于模块化测试和引用
 */
if (import.meta.url.endsWith('server.js')) {
    main();
}
