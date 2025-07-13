#!/usr/bin/env node

import { TerminalManager } from './terminal-manager.js';

/**
 * MCP终端服务器 - 基于Node.js的MCP服务器，支持Windows终端管理
 */
class MCPTerminalServer {
    constructor() {
        this.terminalManager = new TerminalManager();
        this.requestId = 0;
    }

    /**
     * 启动MCP服务器
     */
    start() {
        // 监听stdin输入
        process.stdin.setEncoding('utf8');
        process.stdin.resume(); // 确保stdin处于流动模式

        process.stdin.on('data', (data) => {
            const lines = data.toString().trim().split('\n');
            for (const line of lines) {
                if (line.trim()) {
                    this.handleInput(line.trim());
                }
            }
        });

        // 处理进程退出信号，优雅关闭
        process.on('SIGINT', () => this.shutdown());
        process.on('SIGTERM', () => this.shutdown());
        process.on('exit', () => this.shutdown());

        // MCP服务器已启动，等待JSON-RPC请求
    }

    /**
     * 优雅关闭服务器
     */
    shutdown() {
        if (this.terminalManager) {
            this.terminalManager.cleanup();
        }
        process.exit(0);
    }

    /**
     * 处理输入的JSON-RPC请求
     * @param {string} input - 输入的JSON字符串
     */
    handleInput(input) {
        if (!input) return;

        try {
            const request = JSON.parse(input);
            this.handleRequest(request);
        } catch (error) {
            this.sendError(null, -32700, 'Parse error', error.message);
        }
    }

    /**
     * 处理JSON-RPC请求
     * @param {Object} request - JSON-RPC请求对象
     */
    async handleRequest(request) {
        const { id, method, params } = request;

        try {
            switch (method) {
                case 'initialize':
                    this.handleInitialize(id, params);
                    break;
                case 'tools/list':
                    this.handleToolsList(id);
                    break;
                case 'tools/call':
                    await this.handleToolCall(id, params);
                    break;
                default:
                    this.sendError(id, -32601, 'Method not found', `未知方法: ${method}`);
            }
        } catch (error) {
            this.sendError(id, -32603, 'Internal error', error.message);
        }
    }

    /**
     * 处理初始化请求
     */
    handleInitialize(id, params) {
        this.sendResponse({
            jsonrpc: '2.0',
            id,
            result: {
                protocolVersion: '2024-11-05',
                capabilities: {
                    tools: {}
                },
                serverInfo: {
                    name: 'mcp-terminal-server',
                    version: '1.0.0'
                }
            }
        });
    }

    /**
     * 处理工具列表请求
     */
    handleToolsList(id) {
        const tools = [
            {
                name: 'tm_execute',
                description: '执行命令（可以切换使用PowerShell或CMD终端，必须指定工作目录的绝对路径）',
                inputSchema: {
                    type: 'object',
                    properties: {
                        command: {
                            type: 'string',
                            description: '要执行的命令'
                        },
                        terminal_type: {
                            type: 'string',
                            enum: ['powershell', 'cmd'],
                            default: 'powershell',
                            description: '终端类型'
                        },
                        cwd: {
                            type: 'string',
                            description: '工作目录的绝对路径'
                        },
                        session_id: {
                            type: 'string',
                            description: '可选的会话ID，如果不提供则创建新会话'
                        },
                        timeout: {
                            type: 'number',
                            default: 30000,
                            description: '超时时间（毫秒）'
                        }
                    },
                    required: ['command', 'cwd']
                }
            },
            {
                name: 'tm_read',
                description: '获取结果',
                inputSchema: {
                    type: 'object',
                    properties: {
                        session_id: {
                            type: 'string',
                            description: '会话ID'
                        },
                        lines: {
                            type: 'number',
                            default: -1,
                            description: '读取行数，-1表示全部'
                        }
                    },
                    required: ['session_id']
                }
            },
            {
                name: 'tm_write',
                description: '追加命令',
                inputSchema: {
                    type: 'object',
                    properties: {
                        session_id: {
                            type: 'string',
                            description: '会话ID'
                        },
                        input: {
                            type: 'string',
                            description: '要写入的内容'
                        },
                        add_newline: {
                            type: 'boolean',
                            default: true,
                            description: '是否添加换行符'
                        }
                    },
                    required: ['session_id', 'input']
                }
            },
            {
                name: 'tm_list',
                description: '列出所有会话',
                inputSchema: {
                    type: 'object',
                    properties: {},
                    required: []
                }
            },
            {
                name: 'tm_close',
                description: '关闭终端',
                inputSchema: {
                    type: 'object',
                    properties: {
                        session_id: {
                            type: 'string',
                            description: '会话ID'
                        },
                        force: {
                            type: 'boolean',
                            default: false,
                            description: '是否强制关闭'
                        }
                    },
                    required: ['session_id']
                }
            }
        ];

        this.sendResponse({
            jsonrpc: '2.0',
            id,
            result: {
                tools
            }
        });
    }

    /**
     * 处理工具调用请求
     */
    async handleToolCall(id, params) {
        const { name, arguments: args } = params;

        try {
            let result;
            switch (name) {
                case 'tm_execute':
                    result = await this.handleExecute(args);
                    break;
                case 'tm_read':
                    result = this.handleRead(args);
                    break;
                case 'tm_write':
                    result = this.handleWrite(args);
                    break;
                case 'tm_list':
                    result = this.handleList(args);
                    break;
                case 'tm_close':
                    result = this.handleClose(args);
                    break;
                default:
                    throw new Error(`未知工具: ${name}`);
            }

            this.sendResponse({
                jsonrpc: '2.0',
                id,
                result: {
                    content: [
                        {
                            type: 'text',
                            text: JSON.stringify(result, null, 2)
                        }
                    ]
                }
            });
        } catch (error) {
            this.sendError(id, -32603, 'Tool execution error', error.message);
        }
    }

    /**
     * 处理tm_execute工具调用
     */
    async handleExecute(args) {
        const { command, terminal_type = 'powershell', cwd, session_id, timeout = 30000 } = args;

        if (!command || !cwd) {
            throw new Error('缺少必需参数: command 和 cwd');
        }

        try {
            let sessionId = session_id;
            
            // 如果没有提供会话ID，创建新会话
            if (!sessionId) {
                const sessionInfo = this.terminalManager.createSession(terminal_type, cwd);
                sessionId = sessionInfo.sessionId;
            }

            // 执行命令
            const output = await this.terminalManager.executeCommand(sessionId, command, timeout);

            return {
                success: true,
                sessionId,
                command,
                output: output.filter(line => line.trim() !== ''),
                timestamp: new Date().toISOString()
            };
        } catch (error) {
            return {
                success: false,
                error: error.message,
                command,
                timestamp: new Date().toISOString()
            };
        }
    }

    /**
     * 处理tm_read工具调用
     */
    handleRead(args) {
        const { session_id, lines = -1 } = args;

        if (!session_id) {
            throw new Error('缺少必需参数: session_id');
        }

        try {
            const output = this.terminalManager.readSessionOutput(session_id, lines);
            const sessionInfo = this.terminalManager.getSessionInfo(session_id);

            return {
                success: true,
                sessionId: session_id,
                output: output.filter(line => line.trim() !== ''),
                sessionInfo,
                timestamp: new Date().toISOString()
            };
        } catch (error) {
            return {
                success: false,
                error: error.message,
                sessionId: session_id,
                timestamp: new Date().toISOString()
            };
        }
    }

    /**
     * 处理tm_write工具调用
     */
    handleWrite(args) {
        const { session_id, input, add_newline = true } = args;

        if (!session_id || input === undefined) {
            throw new Error('缺少必需参数: session_id 和 input');
        }

        try {
            this.terminalManager.writeToSession(session_id, input, add_newline);

            return {
                success: true,
                sessionId: session_id,
                input,
                timestamp: new Date().toISOString()
            };
        } catch (error) {
            return {
                success: false,
                error: error.message,
                sessionId: session_id,
                timestamp: new Date().toISOString()
            };
        }
    }

    /**
     * 处理tm_list工具调用
     */
    handleList(args) {
        try {
            const sessions = this.terminalManager.getAllSessions();

            return {
                success: true,
                sessions,
                totalSessions: sessions.length,
                timestamp: new Date().toISOString()
            };
        } catch (error) {
            return {
                success: false,
                error: error.message,
                timestamp: new Date().toISOString()
            };
        }
    }

    /**
     * 处理tm_close工具调用
     */
    handleClose(args) {
        const { session_id, force = false } = args;

        if (!session_id) {
            throw new Error('缺少必需参数: session_id');
        }

        try {
            this.terminalManager.closeSession(session_id, force);

            return {
                success: true,
                sessionId: session_id,
                force,
                timestamp: new Date().toISOString()
            };
        } catch (error) {
            return {
                success: false,
                error: error.message,
                sessionId: session_id,
                timestamp: new Date().toISOString()
            };
        }
    }

    /**
     * 发送响应
     */
    sendResponse(response) {
        console.log(JSON.stringify(response));
    }

    /**
     * 发送错误响应
     */
    sendError(id, code, message, data = null) {
        const error = { code, message };
        if (data) error.data = data;

        this.sendResponse({
            jsonrpc: '2.0',
            id,
            error
        });
    }
}

// 启动服务器
const server = new MCPTerminalServer();
server.start();
