import * as pty from '@lydell/node-pty';
import { randomUUID } from 'crypto';
import path from 'path';

export class TerminalManager {
    constructor() {
        this.sessions = new Map();
        this.maxLines = 1000;
        this.timeout = 3600000; // 1小时
        this.psRegex = /PS\s+[A-Z]:\\[^>]*>\s*$/i;
        this.cmdRegex = /[A-Z]:\\[^>]*>\s*$/i;

        setInterval(() => this.cleanup(), 600000); // 10分钟清理
    }

    createSession(type = 'powershell', cwd, id = null) {
        if (!cwd || !path.isAbsolute(cwd)) throw new Error('需要绝对路径');

        const sessionId = id || randomUUID();
        const shell = type === 'powershell' ? 'powershell.exe' : 'cmd.exe';

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
            }
        });

        this.sessions.set(sessionId, session);
        return { sessionId, type, cwd, status: 'active', pid: ptyProcess.pid };
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

    closeSession(sessionId) {
        const session = this.sessions.get(sessionId);
        if (!session) throw new Error(`会话不存在: ${sessionId}`);

        session.ptyProcess.kill();
        session.status = 'closed';
        setTimeout(() => this.sessions.delete(sessionId), 5000);
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

        session.output.push(...data.split(/\r?\n/));
        if (session.output.length > this.maxLines) {
            session.output.splice(0, session.output.length - this.maxLines);
        }
        session.lastActivity = new Date();
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
