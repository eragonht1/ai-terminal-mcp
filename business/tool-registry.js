/**
 * MCP工具定义模块
 *
 * 该模块负责定义和管理所有MCP工具的元数据、输入模式和验证规则。
 * 提供统一的工具注册表，确保工具定义的一致性和可维护性。
 *
 * 主要功能：
 * - 工具定义和元数据管理
 * - 输入参数模式验证
 * - 工具查询和检索接口
 * - 工具注册表管理
 *
 * @author MCP Terminal Server Team
 * @version 1.1.0
 */

import { TERMINAL_CONFIG } from '../config/app-config.js';

/**
 * 工具定义注册表
 *
 * 该类负责管理所有MCP工具的定义，包括工具的名称、描述、
 * 输入参数模式等元数据，并提供便捷的查询和验证接口。
 */
export class ToolRegistry {
    /**
     * 构造函数
     * @param {AppConfig} config - 应用配置对象
     */
    constructor(config) {
        this.config = config;
        this.tools = this._createToolDefinitions();
    }

    // ========================================================================
    // 工具定义创建
    // ========================================================================

    /**
     * 创建所有工具定义
     * @returns {Object[]} 工具定义数组
     * @private
     */
    _createToolDefinitions() {
        return [
            this._createExecuteToolDefinition(),
            this._createReadToolDefinition(),
            this._createWriteToolDefinition(),
            this._createListToolDefinition(),
            this._createCloseToolDefinition()
        ];
    }

    /**
     * 创建命令执行工具定义
     * @returns {Object} tm_execute工具定义
     * @private
     */
    _createExecuteToolDefinition() {
        return {
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
        };
    }
    /**
     * 创建会话读取工具定义
     * @returns {Object} tm_read工具定义
     * @private
     */
    _createReadToolDefinition() {
        return {
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
        };
    }

    /**
     * 创建会话写入工具定义
     * @returns {Object} tm_write工具定义
     * @private
     */
    _createWriteToolDefinition() {
        return {
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
        };
    }

    /**
     * 创建会话列表工具定义
     * @returns {Object} tm_list工具定义
     * @private
     */
    _createListToolDefinition() {
        return {
            name: 'tm_list',
            description: '列出所有活跃的终端会话',
            inputSchema: {
                type: 'object',
                properties: {},
                required: []
            }
        };
    }

    /**
     * 创建会话关闭工具定义
     * @returns {Object} tm_close工具定义
     * @private
     */
    _createCloseToolDefinition() {
        return {
            name: 'tm_close',
            description: '一键关闭所有活跃的终端会话',
            inputSchema: {
                type: 'object',
                properties: {},
                required: []
            }
        };
    }

    // ========================================================================
    // 公共查询接口
    // ========================================================================

    /**
     * 获取所有工具定义
     * @returns {Object[]} 所有工具定义的数组
     */
    getTools() {
        return [...this.tools]; // 返回副本以防止外部修改
    }

    /**
     * 根据名称获取特定工具定义
     * @param {string} name - 工具名称
     * @returns {Object|undefined} 工具定义对象，如果不存在则返回undefined
     */
    getTool(name) {
        return this.tools.find(tool => tool.name === name);
    }

    /**
     * 验证指定名称的工具是否存在
     * @param {string} name - 工具名称
     * @returns {boolean} 工具是否存在
     */
    hasToolName(name) {
        return this.tools.some(tool => tool.name === name);
    }

    /**
     * 获取所有工具名称列表
     * @returns {string[]} 工具名称数组
     */
    getToolNames() {
        return this.tools.map(tool => tool.name);
    }

    // ========================================================================
    // 工具统计和信息方法
    // ========================================================================

    /**
     * 获取工具总数
     * @returns {number} 注册的工具总数
     */
    getToolCount() {
        return this.tools.length;
    }

    /**
     * 获取工具注册表摘要信息
     * @returns {Object} 包含工具统计信息的对象
     */
    getRegistrySummary() {
        return {
            totalTools: this.getToolCount(),
            toolNames: this.getToolNames(),
            registryVersion: '1.1.0',
            lastUpdated: new Date().toISOString()
        };
    }

    /**
     * 验证工具定义的完整性
     * @returns {Object} 验证结果对象
     */
    validateToolDefinitions() {
        const validationResults = {
            isValid: true,
            errors: [],
            warnings: []
        };

        this.tools.forEach((tool, index) => {
            // 检查必需字段
            if (!tool.name) {
                validationResults.errors.push(`工具 ${index}: 缺少名称`);
                validationResults.isValid = false;
            }

            if (!tool.description) {
                validationResults.warnings.push(`工具 ${tool.name || index}: 缺少描述`);
            }

            if (!tool.inputSchema) {
                validationResults.errors.push(`工具 ${tool.name || index}: 缺少输入模式`);
                validationResults.isValid = false;
            }
        });

        return validationResults;
    }
}
