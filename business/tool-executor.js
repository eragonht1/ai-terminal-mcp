/**
 * 工具执行器模块
 *
 * 该模块负责执行各种终端相关的工具操作，包括命令执行、会话读写、
 * 会话管理等功能，并提供统一的错误处理和事件广播机制。
 *
 * @author MCP Terminal Server Team
 * @version 1.1.0
 */

/**
 * 工具执行器 - 专门负责工具的执行逻辑
 *
 * 该类负责执行各种终端相关的工具操作，包括命令执行、会话读写、
 * 会话管理等功能，并提供统一的错误处理和事件广播机制。
 * 作为业务层的核心组件，它协调终端管理器和事件系统。
 */
export class ToolExecutor {
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

    // ========================================================================
    // 私有工具方法
    // ========================================================================

    /**
     * 创建ISO格式的时间戳
     * @returns {string} ISO格式的时间戳字符串
     * @private
     */
    _createTimestamp() {
        return new Date().toISOString();
    }

    /**
     * 验证必需参数是否存在
     * @param {Object} args - 参数对象
     * @param {string[]} requiredParams - 必需参数名称数组
     * @throws {Error} 当缺少必需参数时抛出错误
     * @private
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
     * @private
     */
    _createToolResult(success, data, timestamp) {
        return { success, ...data, timestamp };
    }

    // ========================================================================
    // 工具执行方法
    // ========================================================================

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

    // ========================================================================
    // 工具路由和执行
    // ========================================================================

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

    // ========================================================================
    // 工具方法
    // ========================================================================

    /**
     * 获取支持的工具列表
     * @returns {string[]} 支持的工具名称数组
     */
    getSupportedTools() {
        return ['tm_execute', 'tm_read', 'tm_write', 'tm_list', 'tm_close'];
    }

    /**
     * 检查工具是否受支持
     * @param {string} toolName - 要检查的工具名称
     * @returns {boolean} 工具是否受支持
     */
    isToolSupported(toolName) {
        return this.getSupportedTools().includes(toolName);
    }
}
