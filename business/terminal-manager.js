import * as pty from '@lydell/node-pty';
import { randomUUID } from 'crypto';
import path from 'path';
import { EventEmitter } from 'events';

/**
 * 终端管理器 - 负责管理所有终端会话的生命周期
 *
 * 该类继承自EventEmitter，提供终端会话的创建、管理、执行命令、
 * 输出处理等功能，并通过事件机制与其他组件进行通信。
 *
 * 主要功能：
 * - 创建和管理多个终端会话
 * - 执行命令并处理输出
 * - 会话状态监控和清理
 * - 事件驱动的状态通知
 */
export class TerminalManager extends EventEmitter {
    /**
     * 构造函数
     * @param {AppConfig} config - 应用配置对象
     */
    constructor(config) {
        super();
        this.config = config;
        this.sessions = new Map();

        // 从配置中获取设置，避免硬编码
        this.maxLines = config.terminalConfig.MAX_OUTPUT_LINES;
        this.timeout = config.terminalConfig.SESSION_TIMEOUT;
        this.psRegex = config.terminalRegex.PS_PROMPT;
        this.cmdRegex = config.terminalRegex.CMD_PROMPT;
        this.genericRegex = config.terminalRegex.GENERIC_PROMPT;

        // 启动定期清理定时器
        this._startCleanupTimer();
    }

    /**
     * 启动清理定时器
     * @private
     */
    _startCleanupTimer() {
        setInterval(() => this.cleanup(), this.config.terminalConfig.CLEANUP_INTERVAL);
    }

    /**
     * 获取指定类型的终端可执行文件路径
     * @param {string} type - 终端类型 (powershell/cmd)
     * @returns {string} 终端可执行文件路径
     * @private
     */
    _getShellPath(type) {
        return this.config.getShellPath(type);
    }

    /**
     * 创建会话数据对象
     * @param {string} sessionId - 会话ID
     * @param {Object} ptyProcess - PTY进程对象
     * @param {string} type - 终端类型
     * @param {string} cwd - 工作目录
     * @returns {Object} 会话数据对象
     * @private
     */
    _createSessionData(sessionId, ptyProcess, type, cwd) {
        return {
            id: sessionId,
            ptyProcess,
            output: [],
            status: 'active',
            type,
            cwd,
            createdAt: new Date(),
            lastActivity: new Date()
        };
    }

    /**
     * 创建会话返回结果对象
     * @param {string} sessionId - 会话ID
     * @param {string} type - 终端类型
     * @param {string} cwd - 工作目录
     * @param {number} pid - 进程ID
     * @returns {Object} 会话结果对象
     * @private
     */
    _createSessionResult(sessionId, type, cwd, pid) {
        return { sessionId, type, cwd, status: 'active', pid };
    }

    /**
     * 构建会话信息对象 - 用于外部查询
     * @param {Object} session - 内部会话对象
     * @returns {Object} 格式化的会话信息
     * @private
     */
    _buildSessionInfo(session) {
        return {
            sessionId: session.id,
            type: session.type,
            cwd: session.cwd,
            status: session.status,
            pid: session.ptyProcess.pid,
            createdAt: session.createdAt,
            lastActivity: session.lastActivity,
            outputLines: session.output.length
        };
    }

    /**
     * 创建新的终端会话
     * @param {string|null} type - 终端类型 (powershell/cmd)，null时使用默认类型
     * @param {string} cwd - 工作目录的绝对路径
     * @param {string|null} id - 指定的会话ID，null时自动生成
     * @returns {Object} 会话创建结果
     * @throws {Error} 当工作目录不是绝对路径时抛出错误
     */
    createSession(type = null, cwd, id = null) {
        this._validateWorkingDirectory(cwd);

        const terminalType = type || this.config.terminalConfig.DEFAULT_TYPE;
        const sessionId = id || randomUUID();
        const shell = this._getShellPath(terminalType);

        const ptyProcess = this._createPtyProcess(shell, cwd);
        const session = this._createSessionData(sessionId, ptyProcess, terminalType, cwd);

        this._setupPtyEventHandlers(ptyProcess, sessionId);
        this.sessions.set(sessionId, session);

        const sessionResult = this._createSessionResult(sessionId, terminalType, cwd, ptyProcess.pid);
        this.emit('sessionCreated', sessionResult);

        return sessionResult;
    }

    /**
     * 验证工作目录是否为绝对路径
     * @param {string} cwd - 工作目录路径
     * @throws {Error} 当路径无效时抛出错误
     * @private
     */
    _validateWorkingDirectory(cwd) {
        if (!cwd || !path.isAbsolute(cwd)) {
            throw new Error('需要绝对路径');
        }
    }

    /**
     * 创建PTY进程
     * @param {string} shell - Shell可执行文件路径
     * @param {string} cwd - 工作目录
     * @returns {Object} PTY进程对象
     * @private
     */
    _createPtyProcess(shell, cwd) {
        return pty.spawn(shell, [], {
            name: this.config.terminalConfig.TERMINAL_NAME,
            cols: this.config.terminalConfig.DEFAULT_COLS,
            rows: this.config.terminalConfig.DEFAULT_ROWS,
            cwd,
            env: process.env
        });
    }

    /**
     * 设置PTY进程事件处理器
     * @param {Object} ptyProcess - PTY进程对象
     * @param {string} sessionId - 会话ID
     * @private
     */
    _setupPtyEventHandlers(ptyProcess, sessionId) {
        ptyProcess.onData(data => this.appendOutput(sessionId, data));
        ptyProcess.onExit(code => this._handleSessionExit(sessionId, code));
    }

    /**
     * 处理会话退出事件
     * @param {string} sessionId - 会话ID
     * @param {number} code - 退出代码
     * @private
     */
    _handleSessionExit(sessionId, code) {
        const session = this.sessions.get(sessionId);
        if (session) {
            session.status = 'closed';
            session.exitCode = code;
            this.emit('sessionClosed', sessionId, code);
        }
    }

    /**
     * 向指定会话写入数据
     * @param {string} sessionId - 会话ID
     * @param {string} input - 要写入的数据
     * @param {boolean} [addNewline=true] - 是否添加换行符
     * @throws {Error} 当会话不存在或已关闭时抛出错误
     */
    writeToSession(sessionId, input, addNewline = true) {
        const session = this._getActiveSession(sessionId);

        const dataToWrite = addNewline ? input + '\r' : input;
        session.ptyProcess.write(dataToWrite);
        session.lastActivity = new Date();
    }

    /**
     * 读取指定会话的输出
     * @param {string} sessionId - 会话ID
     * @returns {string[]} 会话输出行数组的副本
     * @throws {Error} 当会话不存在时抛出错误
     */
    readSessionOutput(sessionId) {
        const session = this._getSession(sessionId);
        return [...session.output];
    }

    /**
     * 获取会话对象（内部使用）
     * @param {string} sessionId - 会话ID
     * @returns {Object} 会话对象
     * @throws {Error} 当会话不存在时抛出错误
     * @private
     */
    _getSession(sessionId) {
        const session = this.sessions.get(sessionId);
        if (!session) {
            throw new Error(`会话不存在: ${sessionId}`);
        }
        return session;
    }

    /**
     * 获取活跃的会话对象
     * @param {string} sessionId - 会话ID
     * @returns {Object} 活跃的会话对象
     * @throws {Error} 当会话不存在或已关闭时抛出错误
     * @private
     */
    _getActiveSession(sessionId) {
        const session = this._getSession(sessionId);
        if (session.status !== 'active') {
            throw new Error(`会话已关闭: ${sessionId}`);
        }
        return session;
    }

    /**
     * 关闭所有活跃的终端会话 - 一键关闭功能
     * @returns {Object} 包含关闭结果的详细信息
     */
    closeAllSessions() {
        const activeSessions = this._getActiveSessions();

        if (activeSessions.length === 0) {
            return this._createCloseResult(true, '没有活跃的会话需要关闭', [], []);
        }

        const { closedSessions, failedSessions } = this._closeSessionsBatch(activeSessions);

        return this._createCloseResult(
            failedSessions.length === 0,
            this._generateCloseMessage(closedSessions.length, failedSessions.length),
            closedSessions,
            failedSessions
        );
    }

    /**
     * 获取所有活跃的会话
     * @returns {Object[]} 活跃会话数组
     * @private
     */
    _getActiveSessions() {
        return Array.from(this.sessions.values()).filter(session => session.status === 'active');
    }

    /**
     * 批量关闭会话
     * @param {Object[]} sessions - 要关闭的会话数组
     * @returns {Object} 包含成功和失败会话的对象
     * @private
     */
    _closeSessionsBatch(sessions) {
        const closedSessions = [];
        const failedSessions = [];

        sessions.forEach(session => {
            try {
                this._closeSingleSession(session);
                closedSessions.push(this._createClosedSessionInfo(session));
                this._scheduleSessionDeletion(session.id);
            } catch (error) {
                failedSessions.push(this._createFailedSessionInfo(session, error));
                this.emit('errorOccurred', session.id, error, { action: 'closeAllSessions' });
            }
        });

        return { closedSessions, failedSessions };
    }

    /**
     * 关闭单个会话
     * @param {Object} session - 会话对象
     * @private
     */
    _closeSingleSession(session) {
        session.ptyProcess.kill();
        session.status = 'closed';
        this.emit('sessionClosed', session.id, 0);
    }

    /**
     * 创建已关闭会话信息
     * @param {Object} session - 会话对象
     * @returns {Object} 已关闭会话信息
     * @private
     */
    _createClosedSessionInfo(session) {
        return {
            sessionId: session.id,
            type: session.type,
            cwd: session.cwd
        };
    }

    /**
     * 创建失败会话信息
     * @param {Object} session - 会话对象
     * @param {Error} error - 错误对象
     * @returns {Object} 失败会话信息
     * @private
     */
    _createFailedSessionInfo(session, error) {
        return {
            sessionId: session.id,
            error: error.message
        };
    }

    /**
     * 安排会话删除
     * @param {string} sessionId - 会话ID
     * @private
     */
    _scheduleSessionDeletion(sessionId) {
        setTimeout(() => this.sessions.delete(sessionId), 5000);
    }

    /**
     * 创建关闭结果对象
     * @param {boolean} success - 是否成功
     * @param {string} message - 结果消息
     * @param {Object[]} closedSessions - 成功关闭的会话
     * @param {Object[]} failedSessions - 失败的会话
     * @returns {Object} 关闭结果对象
     * @private
     */
    _createCloseResult(success, message, closedSessions, failedSessions) {
        return {
            success,
            message,
            closedSessions,
            failedSessions,
            totalClosed: closedSessions.length,
            totalFailed: failedSessions.length
        };
    }

    /**
     * 生成关闭操作的消息
     * @param {number} closedCount - 成功关闭的数量
     * @param {number} failedCount - 失败的数量
     * @returns {string} 消息字符串
     * @private
     */
    _generateCloseMessage(closedCount, failedCount) {
        const baseMessage = `成功关闭 ${closedCount} 个会话`;
        return failedCount > 0 ? `${baseMessage}，${failedCount} 个失败` : baseMessage;
    }

    /**
     * 获取指定会话的详细信息
     * @param {string} sessionId - 会话ID
     * @returns {Object} 会话详细信息
     * @throws {Error} 当会话不存在时抛出错误
     */
    getSessionInfo(sessionId) {
        const session = this._getSession(sessionId);
        return this._buildSessionInfo(session);
    }

    /**
     * 获取所有会话的信息列表
     * @returns {Object[]} 所有会话信息的数组
     */
    getAllSessions() {
        return Array.from(this.sessions.values()).map(session => this._buildSessionInfo(session));
    }

    /**
     * 向会话追加输出数据
     * @param {string} sessionId - 会话ID
     * @param {string} data - 输出数据
     */
    appendOutput(sessionId, data) {
        const session = this.sessions.get(sessionId);
        if (!session) return;

        const newLines = data.split(/\r?\n/);
        this._addOutputLines(session, newLines);
        this._updateSessionActivity(session);

        this.emit('outputReceived', sessionId, newLines);
    }

    /**
     * 添加输出行到会话，并维护最大行数限制
     * @param {Object} session - 会话对象
     * @param {string[]} newLines - 新的输出行
     * @private
     */
    _addOutputLines(session, newLines) {
        session.output.push(...newLines);
        if (session.output.length > this.maxLines) {
            const excessLines = session.output.length - this.maxLines;
            session.output.splice(0, excessLines);
        }
    }

    /**
     * 更新会话活动时间
     * @param {Object} session - 会话对象
     * @private
     */
    _updateSessionActivity(session) {
        session.lastActivity = new Date();
    }

    /**
     * 执行命令并等待完成
     * @param {string} sessionId - 会话ID
     * @param {string} command - 要执行的命令
     * @param {number} [timeout=5000] - 超时时间（毫秒）
     * @returns {Promise<string[]>} 命令输出行数组
     * @throws {Error} 当会话不存在、已关闭或超时时抛出错误
     */
    async executeCommand(sessionId, command, timeout = 5000) {
        const session = this._getActiveSession(sessionId);

        return new Promise((resolve, reject) => {
            const executionContext = this._createExecutionContext(session, command, timeout, resolve, reject);
            this._startCommandExecution(sessionId, command, executionContext);
        });
    }

    /**
     * 创建命令执行上下文
     * @param {Object} session - 会话对象
     * @param {string} command - 命令
     * @param {number} timeout - 超时时间
     * @param {Function} resolve - Promise resolve函数
     * @param {Function} reject - Promise reject函数
     * @returns {Object} 执行上下文
     * @private
     */
    _createExecutionContext(session, command, timeout, resolve, reject) {
        const startLength = session.output.length;
        const timeoutId = setTimeout(() => reject(new Error(`超时: ${command}`)), timeout);

        return {
            startLength,
            lastLength: startLength,
            stableCount: 0,
            timeoutId,
            resolve,
            reject,
            session
        };
    }

    /**
     * 开始命令执行
     * @param {string} sessionId - 会话ID
     * @param {string} command - 命令
     * @param {Object} context - 执行上下文
     * @private
     */
    _startCommandExecution(sessionId, command, context) {
        const checkCompletion = () => this._checkCommandCompletion(context, checkCompletion);

        this.writeToSession(sessionId, command, true);
        setTimeout(checkCompletion, 100);
    }

    /**
     * 检查命令是否完成
     * @param {Object} context - 执行上下文
     * @param {Function} checkCompletion - 检查函数（递归调用）
     * @private
     */
    _checkCommandCompletion(context, checkCompletion) {
        const { session, startLength, timeoutId, resolve } = context;
        const currentOutput = session.output.slice(startLength);
        const currentLength = session.output.length;

        this._updateStabilityCounter(context, currentLength);

        if (this._isCommandComplete(context, currentOutput)) {
            clearTimeout(timeoutId);
            resolve(currentOutput);
            return;
        }

        setTimeout(checkCompletion, 50);
    }

    /**
     * 更新稳定性计数器
     * @param {Object} context - 执行上下文
     * @param {number} currentLength - 当前输出长度
     * @private
     */
    _updateStabilityCounter(context, currentLength) {
        if (currentLength === context.lastLength) {
            context.stableCount++;
        } else {
            context.stableCount = 0;
            context.lastLength = currentLength;
        }
    }

    /**
     * 检查命令是否完成（通过提示符检测）
     * @param {Object} context - 执行上下文
     * @param {string[]} currentOutput - 当前输出
     * @returns {boolean} 是否完成
     * @private
     */
    _isCommandComplete(context, currentOutput) {
        if (context.stableCount < 1 || currentOutput.length === 0) {
            return false;
        }

        const lastLines = currentOutput.slice(-2).join('').replace(/\u001b\[[0-9;]*[mGKH]/g, '');
        return this._hasPrompt(context.session.type, lastLines);
    }

    /**
     * 检查是否包含提示符
     * @param {string} terminalType - 终端类型
     * @param {string} text - 要检查的文本
     * @returns {boolean} 是否包含提示符
     * @private
     */
    _hasPrompt(terminalType, text) {
        if (terminalType === 'powershell') {
            return this.psRegex.test(text);
        }
        return this.cmdRegex.test(text) || this.genericRegex.test(text);
    }

    /**
     * 清理过期和已关闭的会话
     *
     * 定期清理机制，移除已关闭的会话和超时的会话，
     * 释放系统资源，防止内存泄漏。
     */
    cleanup() {
        const now = new Date();
        const sessionsToDelete = this._identifySessionsForCleanup(now);

        this._cleanupSessions(sessionsToDelete);
    }

    /**
     * 识别需要清理的会话
     * @param {Date} now - 当前时间
     * @returns {string[]} 需要删除的会话ID数组
     * @private
     */
    _identifySessionsForCleanup(now) {
        const toDelete = [];

        for (const [id, session] of this.sessions) {
            if (this._shouldCleanupSession(session, now)) {
                toDelete.push(id);
                this._killActiveSession(session);
            }
        }

        return toDelete;
    }

    /**
     * 判断会话是否应该被清理
     * @param {Object} session - 会话对象
     * @param {Date} now - 当前时间
     * @returns {boolean} 是否应该清理
     * @private
     */
    _shouldCleanupSession(session, now) {
        return session.status === 'closed' || (now - session.lastActivity) > this.timeout;
    }

    /**
     * 终止活跃会话
     * @param {Object} session - 会话对象
     * @private
     */
    _killActiveSession(session) {
        if (session.status === 'active') {
            try {
                session.ptyProcess.kill();
            } catch (error) {
                // 忽略终止进程时的错误
            }
        }
    }

    /**
     * 清理会话列表
     * @param {string[]} sessionIds - 要删除的会话ID数组
     * @private
     */
    _cleanupSessions(sessionIds) {
        sessionIds.forEach(id => this.sessions.delete(id));
    }
}
