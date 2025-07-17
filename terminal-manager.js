import * as pty from '@lydell/node-pty';
import { randomUUID } from 'crypto';
import path from 'path';
import { EventEmitter } from 'events';

export class TerminalManager extends EventEmitter {
    constructor(config) {
        super();
        this.config = config;
        this.sessions = new Map();

        // 从配置中获取设置，而不是硬编码常量
        this.maxLines = config.terminalConfig.MAX_OUTPUT_LINES;
        this.timeout = config.terminalConfig.SESSION_TIMEOUT;
        this.psRegex = config.terminalRegex.PS_PROMPT;
        this.cmdRegex = config.terminalRegex.CMD_PROMPT;
        this.genericRegex = config.terminalRegex.GENERIC_PROMPT;

        // 启动清理定时器
        setInterval(() => this.cleanup(), config.terminalConfig.CLEANUP_INTERVAL);
    }

    /**
     * 获取终端可执行文件路径
     */
    _getShellPath(type) {
        return this.config.getShellPath(type);
    }

    /**
     * 创建会话数据对象
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
     * 创建会话返回数据
     */
    _createSessionResult(sessionId, type, cwd, pid) {
        return { sessionId, type, cwd, status: 'active', pid };
    }

    /**
     * 构建会话信息对象
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

    createSession(type = null, cwd, id = null) {
        if (!cwd || !path.isAbsolute(cwd)) throw new Error('需要绝对路径');

        // 使用配置中的默认终端类型
        const terminalType = type || this.config.terminalConfig.DEFAULT_TYPE;
        const sessionId = id || randomUUID();
        const shell = this._getShellPath(terminalType);

        const ptyProcess = pty.spawn(shell, [], {
            name: this.config.terminalConfig.TERMINAL_NAME,
            cols: this.config.terminalConfig.DEFAULT_COLS,
            rows: this.config.terminalConfig.DEFAULT_ROWS,
            cwd,
            env: process.env
        });

        const session = this._createSessionData(sessionId, ptyProcess, terminalType, cwd);

        ptyProcess.onData(data => this.appendOutput(sessionId, data));
        ptyProcess.onExit(code => {
            const s = this.sessions.get(sessionId);
            if (s) {
                s.status = 'closed';
                s.exitCode = code;
                // 发射会话关闭事件
                this.emit('sessionClosed', sessionId, code);
            }
        });

        this.sessions.set(sessionId, session);

        // 发射会话创建事件
        const sessionData = this._createSessionResult(sessionId, terminalType, cwd, ptyProcess.pid);
        this.emit('sessionCreated', sessionData);

        return sessionData;
    }

    writeToSession(sessionId, input, addNewline = true) {
        const session = this.sessions.get(sessionId);
        if (!session) throw new Error(`会话不存在: ${sessionId}`);
        if (session.status !== 'active') throw new Error(`会话已关闭: ${sessionId}`);

        session.ptyProcess.write(addNewline ? input + '\r' : input);
        session.lastActivity = new Date();
    }

    readSessionOutput(sessionId) {
        const session = this.sessions.get(sessionId);
        if (!session) throw new Error(`会话不存在: ${sessionId}`);

        return [...session.output];
    }

    /**
     * 关闭所有活跃的终端会话（一键关闭功能）
     * @returns {Object} 包含关闭结果的对象
     */
    closeAllSessions() {
        const activeSessions = Array.from(this.sessions.values()).filter(session => session.status === 'active');

        if (activeSessions.length === 0) {
            return {
                success: true,
                message: '没有活跃的会话需要关闭',
                closedSessions: [],
                totalClosed: 0
            };
        }

        const closedSessions = [];
        const failedSessions = [];

        // 遍历所有活跃会话并关闭
        for (const session of activeSessions) {
            try {
                session.ptyProcess.kill();
                session.status = 'closed';

                // 发射会话关闭事件
                this.emit('sessionClosed', session.id, 0);

                closedSessions.push({
                    sessionId: session.id,
                    type: session.type,
                    cwd: session.cwd
                });

                // 延迟删除会话
                setTimeout(() => this.sessions.delete(session.id), 5000);

            } catch (error) {
                failedSessions.push({
                    sessionId: session.id,
                    error: error.message
                });

                // 发射错误事件
                this.emit('errorOccurred', session.id, error, { action: 'closeAllSessions' });
            }
        }

        return {
            success: failedSessions.length === 0,
            message: `成功关闭 ${closedSessions.length} 个会话${failedSessions.length > 0 ? `，${failedSessions.length} 个失败` : ''}`,
            closedSessions,
            failedSessions,
            totalClosed: closedSessions.length,
            totalFailed: failedSessions.length
        };
    }

    getSessionInfo(sessionId) {
        const session = this.sessions.get(sessionId);
        if (!session) throw new Error(`会话不存在: ${sessionId}`);

        return this._buildSessionInfo(session);
    }

    getAllSessions() {
        return Array.from(this.sessions.values()).map(session => this._buildSessionInfo(session));
    }

    appendOutput(sessionId, data) {
        const session = this.sessions.get(sessionId);
        if (!session) return;

        const newLines = data.split(/\r?\n/);
        session.output.push(...newLines);
        if (session.output.length > this.maxLines) {
            session.output.splice(0, session.output.length - this.maxLines);
        }
        session.lastActivity = new Date();

        // 发射输出接收事件
        this.emit('outputReceived', sessionId, newLines);
    }

    async executeCommand(sessionId, command, timeout = 5000) {
        const session = this.sessions.get(sessionId);
        if (!session) throw new Error(`会话不存在: ${sessionId}`);
        if (session.status !== 'active') throw new Error(`会话已关闭: ${sessionId}`);

        return new Promise((resolve, reject) => {
            const startLength = session.output.length;
            let lastLength = startLength;
            let stableCount = 0;

            const timeoutId = setTimeout(() => reject(new Error(`超时: ${command}`)), timeout);

            const check = () => {
                const current = session.output.slice(startLength);
                const currentLength = session.output.length;

                if (currentLength === lastLength) {
                    stableCount++;
                } else {
                    stableCount = 0;
                    lastLength = currentLength;
                }

                if (stableCount >= 1 && current.length > 0) {
                    const lastLines = current.slice(-2).join('').replace(/\u001b\[[0-9;]*[mGKH]/g, '');

                    const hasPrompt = session.type === 'powershell'
                        ? this.psRegex.test(lastLines)
                        : this.cmdRegex.test(lastLines) || this.genericRegex.test(lastLines);

                    if (hasPrompt) {
                        clearTimeout(timeoutId);
                        resolve(current);
                        return;
                    }
                }

                setTimeout(check, 50);
            };

            this.writeToSession(sessionId, command, true);
            setTimeout(check, 100);
        });
    }

    cleanup() {
        const now = new Date();
        const toDelete = [];

        for (const [id, session] of this.sessions) {
            if (session.status === 'closed' || (now - session.lastActivity) > this.timeout) {
                toDelete.push(id);
                if (session.status === 'active') {
                    try { session.ptyProcess.kill(); } catch {}
                }
            }
        }

        toDelete.forEach(id => this.sessions.delete(id));
    }
}
