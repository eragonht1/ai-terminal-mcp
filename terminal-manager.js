import * as pty from '@lydell/node-pty';
import { randomUUID } from 'crypto';
import path from 'path';
import { EventEmitter } from 'events';

export class TerminalManager extends EventEmitter {
    constructor() {
        super();
        this.sessions = new Map();
        this.maxLines = 1000;
        this.timeout = 3600000; // 1小时
        this.psRegex = /PS\s+[A-Z]:\\[^>]*>\s*$/i;
        this.cmdRegex = /[A-Za-z]:\\[^>]*>\s*$/i;

        setInterval(() => this.cleanup(), 600000); // 10分钟清理
    }

    createSession(type = 'powershell', cwd, id = null) {
        if (!cwd || !path.isAbsolute(cwd)) throw new Error('需要绝对路径');

        const sessionId = id || randomUUID();
        const shell = type === 'powershell' ? 'C:\\Program Files\\PowerShell\\7\\pwsh.exe' : 'cmd.exe';

        const ptyProcess = pty.spawn(shell, [], {
            name: 'xterm-color',
            cols: 80,
            rows: 30,
            cwd,
            env: process.env
        });

        const session = {
            id: sessionId,
            ptyProcess,
            output: [],
            status: 'active',
            type,
            cwd,
            createdAt: new Date(),
            lastActivity: new Date()
        };

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
        const sessionData = { sessionId, type, cwd, status: 'active', pid: ptyProcess.pid };
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

    getAllSessions() {
        return Array.from(this.sessions.values()).map(session => ({
            sessionId: session.id,
            type: session.type,
            cwd: session.cwd,
            status: session.status,
            pid: session.ptyProcess.pid,
            createdAt: session.createdAt,
            lastActivity: session.lastActivity,
            outputLines: session.output.length
        }));
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
                        : this.cmdRegex.test(lastLines) || />\s*$/.test(lastLines);

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
