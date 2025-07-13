#!/usr/bin/env node
import { TerminalManager } from './terminal-manager.js';

class MCPTerminalServer {
    constructor() {
        this.tm = new TerminalManager();
    }

    start() {
        process.stdin.setEncoding('utf8').resume();
        process.stdin.on('data', data => {
            data.trim().split('\n').forEach(line => {
                if (line.trim()) this.handleInput(line.trim());
            });
        });
        ['SIGINT', 'SIGTERM', 'exit'].forEach(sig =>
            process.on(sig, () => { this.tm.cleanup(); process.exit(0); })
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
                description: '关闭指定的终端会话',
                inputSchema: {
                    type: 'object',
                    properties: {
                        session_id: {
                            type: 'string',
                            description: '要关闭的会话ID'
                        }
                    },
                    required: ['session_id']
                }
            }
        ];
    }

    async callTool({ name, arguments: args }) {
        const timestamp = new Date().toISOString();
        try {
            switch (name) {
                case 'tm_execute':
                    const { command, terminal_type = 'powershell', cwd, timeout = 5000 } = args;
                    if (!command || !cwd) throw new Error('缺少必需参数');

                    const sessionId = this.tm.createSession(terminal_type, cwd).sessionId;
                    const output = await this.tm.executeCommand(sessionId, command, timeout);
                    return { success: true, sessionId, command, output: output.filter(l => l.trim()), timestamp };

                case 'tm_read':
                    const { session_id: readSid } = args;
                    if (!readSid) throw new Error('缺少session_id');

                    const readOutput = this.tm.readSessionOutput(readSid);
                    const sessionInfo = this.tm.getSessionInfo(readSid);
                    return { success: true, sessionId: readSid, output: readOutput.filter(l => l.trim()), sessionInfo, timestamp };

                case 'tm_write':
                    const { session_id: writeSid, input, add_newline = true } = args;
                    if (!writeSid || input === undefined) throw new Error('缺少必需参数');

                    this.tm.writeToSession(writeSid, input, add_newline);
                    return { success: true, sessionId: writeSid, input, timestamp };

                case 'tm_list':
                    const sessions = this.tm.getAllSessions();
                    return { success: true, sessions, totalSessions: sessions.length, timestamp };

                case 'tm_close':
                    const { session_id: closeSid } = args;
                    if (!closeSid) throw new Error('缺少session_id');

                    this.tm.closeSession(closeSid);
                    return { success: true, sessionId: closeSid, timestamp };

                default:
                    throw new Error(`未知工具: ${name}`);
            }
        } catch (e) {
            return { success: false, error: e.message, timestamp };
        }
    }

    send(id, result) {
        console.log(JSON.stringify({ jsonrpc: '2.0', id, result }));
    }

    sendError(id, code, message) {
        console.log(JSON.stringify({ jsonrpc: '2.0', id, error: { code, message } }));
    }
}

new MCPTerminalServer().start();
