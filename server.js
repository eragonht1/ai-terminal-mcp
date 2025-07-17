#!/usr/bin/env node
import { TerminalManager } from './terminal-manager.js';
import { WebSocketBridge } from './websocket-bridge.js';
import { AppConfig } from './config.js';
import { ToolRegistry } from './tools.js';

// 专用日志函数 - 输出到stderr但不显示为错误
function serverLog(message) {
    process.stderr.write(`[MCP服务器] ${message}\n`);
}

/**
 * MCP协议处理器 - 专门负责MCP协议的请求和响应
 */
class MCPProtocolHandler {
    constructor(config, toolRegistry) {
        this.config = config;
        this.toolRegistry = toolRegistry;
    }

    /**
     * 处理初始化请求
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
     */
    handleToolsList() {
        return { tools: this.toolRegistry.getTools() };
    }

    /**
     * 发送成功响应
     */
    sendResponse(id, result) {
        console.log(JSON.stringify({ jsonrpc: '2.0', id, result }));
    }

    /**
     * 发送错误响应
     */
    sendError(id, code, message) {
        console.log(JSON.stringify({ jsonrpc: '2.0', id, error: { code, message } }));
    }
}

/**
 * 工具执行器 - 专门负责工具的执行逻辑
 */
class ToolExecutor {
    constructor(config, terminalManager, eventBroadcaster) {
        this.config = config;
        this.terminalManager = terminalManager;
        this.eventBroadcaster = eventBroadcaster;
    }

    /**
     * 创建时间戳
     */
    _createTimestamp() {
        return new Date().toISOString();
    }

    /**
     * 验证必需参数
     */
    _validateRequiredParams(args, requiredParams) {
        for (const param of requiredParams) {
            if (!args[param]) {
                throw new Error(`缺少必需参数: ${param}`);
            }
        }
    }

    /**
     * 创建工具执行结果
     */
    _createToolResult(success, data, timestamp) {
        return { success, ...data, timestamp };
    }

    /**
     * 执行tm_execute工具
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
        const sessionId = sessionResult.sessionId;

        // 广播会话创建状态
        this.eventBroadcaster('tm_execute', args, sessionId, this.config.toolStatus.SESSION_CREATED);

        const output = await this.terminalManager.executeCommand(sessionId, command, timeout);

        // 广播执行完成
        this.eventBroadcaster('tm_execute', args, sessionId, this.config.toolStatus.COMPLETED);

        return this._createToolResult(true, {
            sessionId,
            command,
            output: output.filter(l => l.trim())
        }, this._createTimestamp());
    }

    /**
     * 执行tm_read工具
     */
    async executeReadSession(args) {
        const { session_id: readSid } = args;
        this._validateRequiredParams(args, ['session_id']);

        this.eventBroadcaster('tm_read', args, readSid, this.config.toolStatus.EXECUTING);

        const readOutput = this.terminalManager.readSessionOutput(readSid);
        const sessionInfo = this.terminalManager.getSessionInfo(readSid);

        this.eventBroadcaster('tm_read', args, readSid, this.config.toolStatus.COMPLETED);

        return this._createToolResult(true, {
            sessionId: readSid,
            output: readOutput.filter(l => l.trim()),
            sessionInfo
        }, this._createTimestamp());
    }

    /**
     * 执行tm_write工具
     */
    async executeWriteSession(args) {
        const { session_id: writeSid, input, add_newline = true } = args;
        this._validateRequiredParams(args, ['session_id']);
        if (input === undefined) throw new Error('缺少必需参数: input');

        this.eventBroadcaster('tm_write', args, writeSid, this.config.toolStatus.EXECUTING);

        this.terminalManager.writeToSession(writeSid, input, add_newline);

        this.eventBroadcaster('tm_write', args, writeSid, this.config.toolStatus.COMPLETED);

        return this._createToolResult(true, {
            sessionId: writeSid,
            input
        }, this._createTimestamp());
    }

    /**
     * 执行tm_list工具
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
     * 执行tm_close工具
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
     * 执行工具
     */
    async executeTool(name, args) {
        try {
            // 广播工具调用开始
            this.eventBroadcaster(name, args, null, this.config.toolStatus.EXECUTING);

            switch (name) {
                case 'tm_execute':
                    return await this.executeTerminalCommand(args);
                case 'tm_read':
                    return await this.executeReadSession(args);
                case 'tm_write':
                    return await this.executeWriteSession(args);
                case 'tm_list':
                    return await this.executeListSessions(args);
                case 'tm_close':
                    return await this.executeCloseSessions(args);
                default:
                    throw new Error(`未知工具: ${name}`);
            }
        } catch (e) {
            // 广播错误事件
            this.eventBroadcaster(name, args, null, 'error', e);
            return this._createToolResult(false, { error: e.message }, this._createTimestamp());
        }
    }
}

/**
 * 服务器协调器 - 协调各个组件，处理主要的服务器逻辑
 */
class ServerOrchestrator {
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
     * 启动服务器
     */
    start() {
        process.stdin.setEncoding('utf8').resume();
        process.stdin.on('data', data => {
            data.trim().split('\n').forEach(line => {
                if (line.trim()) this.handleInput(line.trim());
            });
        });
        ['SIGINT', 'SIGTERM', 'exit'].forEach(sig =>
            process.on(sig, async () => {
                await this.cleanup();
                process.exit(0);
            })
        );
    }

    /**
     * 处理输入
     */
    handleInput(input) {
        try {
            this.handleRequest(JSON.parse(input));
        } catch (e) {
            this.protocolHandler.sendError(null, this.config.errorCodes.PARSE_ERROR, 'Parse error');
        }
    }

    /**
     * 处理请求
     */
    async handleRequest({ id, method, params }) {
        try {
            switch (method) {
                case 'initialize':
                    this.protocolHandler.sendResponse(id, this.protocolHandler.handleInitialize());
                    break;
                case 'tools/list':
                    this.protocolHandler.sendResponse(id, this.protocolHandler.handleToolsList());
                    break;
                case 'tools/call':
                    const result = await this.toolExecutor.executeTool(params.name, params.arguments);
                    this.protocolHandler.sendResponse(id, {
                        content: [{ type: 'text', text: JSON.stringify(result, null, 2) }]
                    });
                    break;
                default:
                    this.protocolHandler.sendError(id, this.config.errorCodes.METHOD_NOT_FOUND, 'Method not found');
            }
        } catch (e) {
            this.protocolHandler.sendError(id, this.config.errorCodes.INTERNAL_ERROR, 'Internal error');
        }
    }

    /**
     * 设置事件监听器，将终端事件广播到GUI
     */
    setupEventListeners() {
        // 监听终端管理器的事件
        this.terminalManager.on('sessionCreated', (sessionData) => {
            this.webSocketBridge.broadcastSessionCreated(sessionData);
        });

        this.terminalManager.on('outputReceived', (sessionId, output) => {
            this.webSocketBridge.broadcastTerminalOutput(sessionId, output);
        });

        this.terminalManager.on('sessionClosed', (sessionId, exitCode) => {
            this.webSocketBridge.broadcastSessionClosed(sessionId, exitCode);
        });

        this.terminalManager.on('errorOccurred', (sessionId, error, context) => {
            this.webSocketBridge.broadcastError(sessionId, error, context);
        });
    }

    /**
     * 初始化GUI服务器（检测状态，避免重复启动）
     */
    async initializeGUI() {
        try {
            // 检测WebSocket服务器是否已启动
            if (!this.webSocketBridge.isRunning) {
                // 只有WebSocket服务器未启动时，才启动两个服务器
                serverLog('启动WebSocket服务器...');
                this.webSocketBridge.start();

                serverLog('启动GUI Web服务器...');
                const { startGUIServer } = await import('./gui-server.js');
                await startGUIServer();

                serverLog('GUI服务器启动完成');
            } else {
                serverLog('GUI服务器已在运行，跳过启动');
            }
        } catch (error) {
            console.error('初始化GUI服务器失败:', error);
        }
    }

    /**
     * 清理资源
     */
    async cleanup() {
        serverLog('正在清理资源...');

        // 清理终端管理器
        this.terminalManager.cleanup();

        // 清理WebSocket服务器
        this.webSocketBridge.cleanup();

        // 清理GUI Web服务器
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
// 主入口 - 在这里进行资源的一次性加载和依赖注入
// ============================================================================

/**
 * 主入口函数 - 负责创建所有资源并进行依赖注入
 */
function main() {
    // 1. 创建配置对象（只加载一次）
    const config = new AppConfig();

    // 2. 创建工具注册表（只加载一次）
    const toolRegistry = new ToolRegistry(config);

    // 3. 创建终端管理器（注入配置）
    const terminalManager = new TerminalManager(config);

    // 4. 创建WebSocket桥接器（注入配置）
    const webSocketBridge = new WebSocketBridge(config);

    // 5. 创建MCP协议处理器（注入配置和工具注册表）
    const protocolHandler = new MCPProtocolHandler(config, toolRegistry);

    // 6. 创建工具执行器（注入依赖）
    const toolExecutor = new ToolExecutor(
        config,
        terminalManager,
        (name, args, sessionId, status, error = null) => {
            if (status === 'error') {
                webSocketBridge.broadcastError(sessionId, error, { tool: name, args });
            } else {
                webSocketBridge.broadcastToolCall(name, args, sessionId, status);
            }
        }
    );

    // 7. 创建服务器协调器（注入所有依赖）
    const server = new ServerOrchestrator(
        config,
        terminalManager,
        webSocketBridge,
        protocolHandler,
        toolExecutor
    );

    // 8. 启动服务器
    server.start();

    serverLog('MCP Terminal Server 已启动，所有资源已完成依赖注入');
}

// 只有在直接运行此文件时才执行主函数
if (import.meta.url.endsWith('server.js')) {
    main();
}
