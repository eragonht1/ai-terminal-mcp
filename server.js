#!/usr/bin/env node
import { TerminalManager } from './terminal-manager.js';
import { WebSocketBridge } from './websocket-bridge.js';

class MCPTerminalServer {
    constructor() {
        this.tm = new TerminalManager();
        this.wsBridge = new WebSocketBridge(8573);

        // 监听终端管理器事件并广播到GUI
        this.setupEventListeners();

        // 初始化GUI服务器
        this.initializeGUI();
    }

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

    handleInput(input) {
        try {
            this.handleRequest(JSON.parse(input));
        } catch (e) {
            this.sendError(null, -32700, 'Parse error');
        }
    }

    async handleRequest({ id, method, params }) {
        try {
            switch (method) {
                case 'initialize':
                    this.send(id, {
                        protocolVersion: '2024-11-05',
                        capabilities: { tools: {} },
                        serverInfo: { name: 'mcp-terminal-server', version: '1.1.0' }
                    });
                    break;
                case 'tools/list':
                    this.send(id, { tools: this.getTools() });
                    break;
                case 'tools/call':
                    this.send(id, { content: [{ type: 'text', text: JSON.stringify(await this.callTool(params), null, 2) }] });
                    break;
                default:
                    this.sendError(id, -32601, 'Method not found');
            }
        } catch (e) {
            this.sendError(id, -32603, 'Internal error');
        }
    }

    getTools() {
        return [
            {
                name: 'tm_execute',
                description: '执行命令（支持PowerShell和CMD终端，必须指定工作目录的绝对路径）',
                inputSchema: {
                    type: 'object',
                    properties: {
                        command: {
                            type: 'string',
                            description: '要执行的命令'
                        },
                        cwd: {
                            type: 'string',
                            description: '工作目录的绝对路径'
                        },
                        terminal_type: {
                            type: 'string',
                            enum: ['powershell', 'cmd'],
                            default: 'powershell',
                            description: '终端类型（powershell=Windows PowerShell，cmd=命令提示符）'
                        },

                        timeout: {
                            type: 'number',
                            default: 5000,
                            description: '超时时间（毫秒），默认5秒'
                        }
                    },
                    required: ['command', 'cwd']
                }
            },
            {
                name: 'tm_read',
                description: '获取会话的所有输出结果',
                inputSchema: {
                    type: 'object',
                    properties: {
                        session_id: {
                            type: 'string',
                            description: '要读取的会话ID'
                        }
                    },
                    required: ['session_id']
                }
            },
            {
                name: 'tm_write',
                description: '向终端会话追加命令或编写文本内容',
                inputSchema: {
                    type: 'object',
                    properties: {
                        session_id: {
                            type: 'string',
                            description: '目标会话ID'
                        },
                        input: {
                            type: 'string',
                            description: '要输入的命令或文本内容'
                        },
                        add_newline: {
                            type: 'boolean',
                            default: true,
                            description: '是否添加换行符执行命令（true=追加命令并执行，false=仅编写文本内容）'
                        }
                    },
                    required: ['session_id', 'input']
                }
            },
            {
                name: 'tm_list',
                description: '列出所有活跃的终端会话',
                inputSchema: {
                    type: 'object',
                    properties: {},
                    required: []
                }
            },
            {
                name: 'tm_close',
                description: '一键关闭所有活跃的终端会话',
                inputSchema: {
                    type: 'object',
                    properties: {},
                    required: []
                }
            }
        ];
    }

    async callTool({ name, arguments: args }) {
        const timestamp = new Date().toISOString();

        // 智能浏览器管理
        await this.manageBrowser();

        try {
            // 广播工具调用开始
            this.wsBridge.broadcastToolCall(name, args, null, 'executing');

            switch (name) {
                case 'tm_execute':
                    const { command, terminal_type = 'powershell', cwd, timeout = 5000 } = args;
                    if (!command || !cwd) throw new Error('缺少必需参数');

                    const sessionResult = this.tm.createSession(terminal_type, cwd);
                    const sessionId = sessionResult.sessionId;

                    // 广播工具调用状态更新
                    this.wsBridge.broadcastToolCall(name, args, sessionId, 'session_created');

                    const output = await this.tm.executeCommand(sessionId, command, timeout);

                    // 广播工具调用完成
                    this.wsBridge.broadcastToolCall(name, args, sessionId, 'completed');

                    return { success: true, sessionId, command, output: output.filter(l => l.trim()), timestamp };

                case 'tm_read':
                    const { session_id: readSid } = args;
                    if (!readSid) throw new Error('缺少session_id');

                    // 广播工具调用状态
                    this.wsBridge.broadcastToolCall(name, args, readSid, 'executing');

                    const readOutput = this.tm.readSessionOutput(readSid);
                    const sessionInfo = this.tm.getSessionInfo(readSid);

                    // 广播工具调用完成
                    this.wsBridge.broadcastToolCall(name, args, readSid, 'completed');

                    return { success: true, sessionId: readSid, output: readOutput.filter(l => l.trim()), sessionInfo, timestamp };

                case 'tm_write':
                    const { session_id: writeSid, input, add_newline = true } = args;
                    if (!writeSid || input === undefined) throw new Error('缺少必需参数');

                    // 广播工具调用状态
                    this.wsBridge.broadcastToolCall(name, args, writeSid, 'executing');

                    this.tm.writeToSession(writeSid, input, add_newline);

                    // 广播工具调用完成
                    this.wsBridge.broadcastToolCall(name, args, writeSid, 'completed');

                    return { success: true, sessionId: writeSid, input, timestamp };

                case 'tm_list':
                    // 广播工具调用状态
                    this.wsBridge.broadcastToolCall(name, args, null, 'executing');

                    const sessions = this.tm.getAllSessions();

                    // 广播工具调用完成
                    this.wsBridge.broadcastToolCall(name, args, null, 'completed');

                    return { success: true, sessions, totalSessions: sessions.length, timestamp };

                case 'tm_close':
                    // 广播工具调用状态
                    this.wsBridge.broadcastToolCall(name, args, null, 'executing');

                    const closeResult = this.tm.closeAllSessions();

                    // 广播工具调用完成
                    this.wsBridge.broadcastToolCall(name, args, null, 'completed');

                    return {
                        success: closeResult.success,
                        message: closeResult.message,
                        closedSessions: closeResult.closedSessions,
                        failedSessions: closeResult.failedSessions,
                        totalClosed: closeResult.totalClosed,
                        totalFailed: closeResult.totalFailed,
                        timestamp
                    };

                default:
                    throw new Error(`未知工具: ${name}`);
            }
        } catch (e) {
            // 广播错误事件
            this.wsBridge.broadcastError(null, e, { tool: name, args });
            return { success: false, error: e.message, timestamp };
        }
    }

    send(id, result) {
        console.log(JSON.stringify({ jsonrpc: '2.0', id, result }));
    }

    sendError(id, code, message) {
        console.log(JSON.stringify({ jsonrpc: '2.0', id, error: { code, message } }));
    }

    /**
     * 设置事件监听器，将终端事件广播到GUI
     */
    setupEventListeners() {
        // 监听终端管理器的事件（需要在terminal-manager.js中添加事件发射）
        this.tm.on('sessionCreated', (sessionData) => {
            this.wsBridge.broadcastSessionCreated(sessionData);
        });

        this.tm.on('outputReceived', (sessionId, output) => {
            this.wsBridge.broadcastTerminalOutput(sessionId, output);
        });

        this.tm.on('sessionClosed', (sessionId, exitCode) => {
            this.wsBridge.broadcastSessionClosed(sessionId, exitCode);
        });

        this.tm.on('errorOccurred', (sessionId, error, context) => {
            this.wsBridge.broadcastError(sessionId, error, context);
        });
    }

    /**
     * 初始化GUI服务器（检测状态，避免重复启动）
     */
    async initializeGUI() {
        try {
            // 检测WebSocket服务器是否已启动
            if (!this.wsBridge.isRunning) {
                // 只有WebSocket服务器未启动时，才启动两个服务器
                console.log('启动WebSocket服务器...');
                this.wsBridge.start();

                console.log('启动GUI Web服务器...');
                const { startGUIServer } = await import('./gui-server.js');
                await startGUIServer();

                console.log('GUI服务器启动完成');
            } else {
                console.log('GUI服务器已在运行，跳过启动');
            }
        } catch (error) {
            console.error('初始化GUI服务器失败:', error);
        }
    }

    /**
     * 智能浏览器管理
     */
    async manageBrowser() {
        try {
            // 检测WebSocket连接状态
            const hasConnections = this.wsBridge.hasActiveConnections();
            if (!hasConnections) {
                console.log('检测到浏览器已关闭，重新打开浏览器...');
                await this.openBrowser();
            }
        } catch (error) {
            console.error('浏览器管理失败:', error);
        }
    }



    /**
     * 打开浏览器显示GUI界面
     */
    async openBrowser() {
        try {
            const open = (await import('open')).default;
            await open('http://localhost:8347');
            console.log('浏览器已打开GUI界面');
        } catch (error) {
            console.error('打开浏览器失败:', error);
        }
    }

    /**
     * 清理资源
     */
    async cleanup() {
        console.log('正在清理资源...');

        // 清理终端管理器
        this.tm.cleanup();

        // 清理WebSocket服务器
        this.wsBridge.cleanup();

        // 清理GUI Web服务器
        try {
            const { stopGUIServer } = await import('./gui-server.js');
            stopGUIServer();
            console.log('GUI Web服务器已清理');
        } catch (error) {
            console.error('清理GUI Web服务器失败:', error);
        }
    }
}

new MCPTerminalServer().start();
