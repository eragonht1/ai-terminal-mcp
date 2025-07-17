/**
 * MCP工具定义 - 统一管理所有工具的定义和元数据
 */

import { TERMINAL_CONFIG } from './config.js';

/**
 * 工具定义注册表
 */
export class ToolRegistry {
    constructor(config) {
        this.config = config;
        this.tools = this.createToolDefinitions();
    }

    /**
     * 创建工具定义
     */
    createToolDefinitions() {
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
                            default: TERMINAL_CONFIG.DEFAULT_TIMEOUT,
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

    /**
     * 获取所有工具定义
     */
    getTools() {
        return this.tools;
    }

    /**
     * 根据名称获取工具定义
     */
    getTool(name) {
        return this.tools.find(tool => tool.name === name);
    }

    /**
     * 验证工具是否存在
     */
    hasToolName(name) {
        return this.tools.some(tool => tool.name === name);
    }

    /**
     * 获取工具名称列表
     */
    getToolNames() {
        return this.tools.map(tool => tool.name);
    }
}
