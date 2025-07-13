import * as pty from '@lydell/node-pty';
import { randomUUID } from 'crypto';
import path from 'path';
import fs from 'fs';

/**
 * 终端管理器 - 管理多个终端会话
 */
export class TerminalManager {
    constructor() {
        this.sessions = new Map(); // sessionId -> session对象
        this.maxOutputLines = 1000; // 最大输出缓存行数
        this.sessionTimeout = 60 * 60 * 1000; // 1小时会话超时时间
        this.cleanupInterval = 10 * 60 * 1000; // 10分钟清理间隔
        this.cachedPowershellPath = null; // 缓存PowerShell路径

        // 预编译正则表达式，避免重复编译
        this.psPromptRegex = /PS\s+[A-Z]:\\[^>]*>\s*$/i;
        this.cmdPromptRegex = /[A-Z]:\\[^>]*>\s*$/i;

        // 启动定期清理任务
        this.startCleanupTask();
    }

    /**
     * 创建新的终端会话
     * @param {string} terminalType - 终端类型 ('powershell' | 'cmd')
     * @param {string} cwd - 工作目录绝对路径
     * @param {string} sessionId - 可选的会话ID，如果不提供则自动生成
     * @returns {Object} 会话信息
     */
    createSession(terminalType = 'powershell', cwd, sessionId = null) {
        if (!cwd || !path.isAbsolute(cwd)) {
            throw new Error('必须提供工作目录的绝对路径');
        }

        const id = sessionId || randomUUID();
        
        // 确定终端可执行文件路径
        let shell, args = [];
        if (terminalType === 'powershell') {
            // 使用缓存的PowerShell路径，避免重复检测
            if (!this.cachedPowershellPath) {
                const powershellPaths = [
                    'C:\\Program Files\\PowerShell\\7\\pwsh.exe',
                    'pwsh.exe',
                    'powershell.exe'
                ];

                this.cachedPowershellPath = 'powershell.exe'; // 默认
                for (const psPath of powershellPaths) {
                    try {
                        if (psPath.includes('\\')) {
                            fs.accessSync(psPath);
                        }
                        this.cachedPowershellPath = psPath;
                        break;
                    } catch {
                        continue;
                    }
                }
            }
            shell = this.cachedPowershellPath;
        } else if (terminalType === 'cmd') {
            shell = 'cmd.exe';
        } else {
            throw new Error(`不支持的终端类型: ${terminalType}`);
        }

        try {
            // 创建pty进程
            const ptyProcess = pty.spawn(shell, args, {
                name: 'xterm-color',
                cols: 80,
                rows: 30,
                cwd: cwd,
                env: process.env
            });

            // 创建会话对象
            const session = {
                id,
                ptyProcess,
                output: [],
                status: 'active',
                type: terminalType,
                cwd,
                createdAt: new Date(),
                lastActivity: new Date()
            };

            // 监听数据输出
            ptyProcess.onData((data) => {
                this.appendOutput(id, data);
            });

            // 监听进程退出
            ptyProcess.onExit((exitCode) => {
                const session = this.sessions.get(id);
                if (session) {
                    session.status = 'closed';
                    session.exitCode = exitCode;
                }
            });

            // 存储会话
            this.sessions.set(id, session);

            return {
                sessionId: id,
                type: terminalType,
                cwd,
                status: 'active',
                pid: ptyProcess.pid
            };

        } catch (error) {
            throw new Error(`创建终端会话失败: ${error.message}`);
        }
    }

    /**
     * 向会话写入命令
     * @param {string} sessionId - 会话ID
     * @param {string} input - 输入内容
     * @param {boolean} addNewline - 是否添加换行符
     */
    writeToSession(sessionId, input, addNewline = true) {
        const session = this.sessions.get(sessionId);
        if (!session) {
            throw new Error(`会话不存在: ${sessionId}`);
        }

        if (session.status !== 'active') {
            throw new Error(`会话已关闭: ${sessionId}`);
        }

        try {
            const data = addNewline ? input + '\r' : input;
            session.ptyProcess.write(data);
            session.lastActivity = new Date();
        } catch (error) {
            throw new Error(`写入会话失败: ${error.message}`);
        }
    }

    /**
     * 读取会话输出
     * @param {string} sessionId - 会话ID
     * @param {number} lines - 读取行数，-1表示全部
     * @returns {Array} 输出行数组
     */
    readSessionOutput(sessionId, lines = -1) {
        const session = this.sessions.get(sessionId);
        if (!session) {
            throw new Error(`会话不存在: ${sessionId}`);
        }

        if (lines === -1) {
            return [...session.output];
        } else {
            return session.output.slice(-lines);
        }
    }

    /**
     * 关闭会话
     * @param {string} sessionId - 会话ID
     * @param {boolean} force - 是否强制关闭
     */
    closeSession(sessionId, force = false) {
        const session = this.sessions.get(sessionId);
        if (!session) {
            throw new Error(`会话不存在: ${sessionId}`);
        }

        try {
            // Windows上直接使用kill()方法
            session.ptyProcess.kill();
            session.status = 'closed';

            // 延迟删除会话，保留输出一段时间
            setTimeout(() => {
                this.sessions.delete(sessionId);
            }, 5000);

        } catch (error) {
            throw new Error(`关闭会话失败: ${error.message}`);
        }
    }

    /**
     * 获取会话信息
     * @param {string} sessionId - 会话ID
     * @returns {Object} 会话信息
     */
    getSessionInfo(sessionId) {
        const session = this.sessions.get(sessionId);
        if (!session) {
            throw new Error(`会话不存在: ${sessionId}`);
        }

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
     * 获取所有会话列表
     * @returns {Array} 会话信息数组
     */
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

    /**
     * 追加输出到会话缓存
     * @private
     * @param {string} sessionId - 会话ID
     * @param {string} data - 输出数据
     */
    appendOutput(sessionId, data) {
        const session = this.sessions.get(sessionId);
        if (!session) return;

        // 直接使用splice优化数组操作，避免创建新数组
        const lines = data.split(/\r?\n/);
        session.output.push(...lines);

        // 使用splice直接修改数组，比slice更高效
        if (session.output.length > this.maxOutputLines) {
            session.output.splice(0, session.output.length - this.maxOutputLines);
        }

        session.lastActivity = new Date();
    }

    /**
     * 执行命令并等待结果（带超时）
     * @param {string} sessionId - 会话ID
     * @param {string} command - 要执行的命令
     * @param {number} timeout - 超时时间（毫秒）
     * @returns {Promise<Array>} 命令输出
     */
    async executeCommand(sessionId, command, timeout = 30000) {
        const session = this.sessions.get(sessionId);
        if (!session) {
            throw new Error(`会话不存在: ${sessionId}`);
        }

        if (session.status !== 'active') {
            throw new Error(`会话已关闭: ${sessionId}`);
        }

        return new Promise((resolve, reject) => {
            const startOutputLength = session.output.length;
            const startTime = Date.now();
            let timeoutId;
            let lastOutputLength = startOutputLength;
            let stableOutputCount = 0;

            // 设置超时
            timeoutId = setTimeout(() => {
                reject(new Error(`命令执行超时: ${command}`));
            }, timeout);

            // 智能命令完成检测
            const checkOutput = () => {
                const currentOutput = session.output.slice(startOutputLength);
                const currentLength = session.output.length;

                // 检查输出是否稳定（连续3次检查输出长度没变化）
                if (currentLength === lastOutputLength) {
                    stableOutputCount++;
                } else {
                    stableOutputCount = 0;
                    lastOutputLength = currentLength;
                }

                // 如果输出稳定且有内容，进行提示符检测
                if (stableOutputCount >= 3 && currentOutput.length > 0) {
                    // 只检查最后2行，减少字符串处理
                    const lastFewLines = currentOutput.slice(-2).join('');
                    const cleanedOutput = lastFewLines.replace(/\u001b\[[0-9;]*[mGKH]/g, '');

                    // 根据会话类型使用不同的检测策略
                    let hasPrompt = false;

                    if (session.type === 'powershell') {
                        // 使用预编译的正则表达式
                        hasPrompt = this.psPromptRegex.test(cleanedOutput) ||
                                   /PS\s+[A-Z]:\\[^>]*>\s*\u001b/i.test(cleanedOutput);
                    } else if (session.type === 'cmd') {
                        // 使用预编译的正则表达式和简化检测
                        hasPrompt = this.cmdPromptRegex.test(cleanedOutput) ||
                                   />\s*$/.test(cleanedOutput);

                        // CMD特殊检测：如果最后几行包含目录路径和>符号
                        if (!hasPrompt) {
                            const lines = cleanedOutput.split(/\r?\n/).filter(line => line.trim());
                            const lastLine = lines[lines.length - 1] || '';
                            hasPrompt = /[A-Z]:\\.*>\s*$/i.test(lastLine) ||
                                       (lastLine.includes('>') && lastLine.length < 50);
                        }
                    }

                    if (hasPrompt) {
                        clearTimeout(timeoutId);
                        resolve(currentOutput);
                        return;
                    }
                }

                // 特殊情况处理
                const runTime = Date.now() - startTime;

                // 如果运行时间很短且没有输出，可能是快速命令
                if (runTime > 500 && currentOutput.length === 0) {
                    clearTimeout(timeoutId);
                    resolve(currentOutput);
                    return;
                }

                // CMD特殊处理：如果运行时间较长且输出稳定，可能已经完成
                if (session.type === 'cmd' && runTime > 2000 && stableOutputCount >= 5) {
                    const lastOutput = currentOutput[currentOutput.length - 1] || '';
                    // 如果最后一行看起来像提示符或者包含路径
                    if (lastOutput.includes('\\') || lastOutput.includes('>') || lastOutput.length < 20) {
                        clearTimeout(timeoutId);
                        resolve(currentOutput);
                        return;
                    }
                }

                // 继续检查，但间隔稍长一些以减少CPU使用
                setTimeout(checkOutput, 150);
            };

            // 执行命令
            try {
                this.writeToSession(sessionId, command, true);
                // 稍微延迟开始检查，给命令执行一些时间
                setTimeout(checkOutput, 200);
            } catch (error) {
                clearTimeout(timeoutId);
                reject(error);
            }
        });
    }

    /**
     * 启动定期清理任务
     * @private
     */
    startCleanupTask() {
        setInterval(() => {
            this.cleanupInactiveSessions();
        }, this.cleanupInterval);
    }

    /**
     * 清理不活跃的会话
     * @private
     */
    cleanupInactiveSessions() {
        const now = new Date();
        const sessionsToDelete = [];

        for (const [sessionId, session] of this.sessions) {
            const timeSinceLastActivity = now - session.lastActivity;

            // 如果会话超时且已关闭，或者活跃会话超过超时时间
            if (session.status === 'closed' || timeSinceLastActivity > this.sessionTimeout) {
                sessionsToDelete.push(sessionId);

                // 如果进程还在运行，强制关闭
                if (session.status === 'active') {
                    try {
                        session.ptyProcess.kill();
                    } catch (error) {
                        // 忽略关闭错误
                    }
                }
            }
        }

        // 删除超时的会话
        for (const sessionId of sessionsToDelete) {
            this.sessions.delete(sessionId);
        }

        if (sessionsToDelete.length > 0) {
            console.error(`清理了 ${sessionsToDelete.length} 个不活跃的会话`);
        }
    }

    /**
     * 手动清理所有会话（用于优雅关闭）
     */
    cleanup() {
        for (const [sessionId, session] of this.sessions) {
            if (session.status === 'active') {
                try {
                    session.ptyProcess.kill();
                } catch (error) {
                    // 忽略关闭错误
                }
            }
        }
        this.sessions.clear();
    }
}
