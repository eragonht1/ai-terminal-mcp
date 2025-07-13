import { spawn } from 'child_process';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import open from 'open';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

/**
 * 自动启动器 - 管理GUI界面的自动启动
 * 负责检测AI调用、启动服务器和打开浏览器
 */
export class Launcher {
    constructor() {
        this.guiProcess = null;
        this.isGUIRunning = false;
        this.guiPort = 8347;
        this.wsPort = 8573;
        this.startupDelay = 1000; // 启动延迟
        this.maxRetries = 3;
        this.retryCount = 0;
    }

    /**
     * 启动GUI界面
     */
    async startGUI() {
        if (this.isGUIRunning) {
            console.log('GUI界面已在运行');
            return true;
        }

        try {
            console.log('正在启动GUI界面...');
            
            // 启动GUI服务器进程
            await this.startGUIProcess();
            
            // 等待服务器启动
            await this.waitForServer();
            
            // 打开浏览器
            await this.openBrowser();
            
            this.isGUIRunning = true;
            this.retryCount = 0;
            
            console.log('GUI界面启动成功');
            return true;

        } catch (error) {
            console.error('启动GUI界面失败:', error);
            
            if (this.retryCount < this.maxRetries) {
                this.retryCount++;
                console.log(`尝试重新启动 (${this.retryCount}/${this.maxRetries})`);
                
                // 清理失败的进程
                await this.cleanup();
                
                // 延迟后重试
                await this.delay(2000);
                return this.startGUI();
            }
            
            return false;
        }
    }

    /**
     * 启动GUI服务器进程
     */
    async startGUIProcess() {
        return new Promise((resolve, reject) => {
            try {
                // 启动GUI服务器
                this.guiProcess = spawn('node', [join(__dirname, 'gui-server.js')], {
                    cwd: __dirname,
                    stdio: ['pipe', 'pipe', 'pipe'],
                    env: {
                        ...process.env,
                        GUI_PORT: this.guiPort.toString(),
                        WS_PORT: this.wsPort.toString()
                    }
                });

                // 监听进程输出
                this.guiProcess.stdout.on('data', (data) => {
                    const output = data.toString();
                    console.log('[GUI Server]', output.trim());
                    
                    // 检测服务器启动成功
                    if (output.includes('GUI Web服务器已启动')) {
                        resolve();
                    }
                });

                this.guiProcess.stderr.on('data', (data) => {
                    console.error('[GUI Server Error]', data.toString().trim());
                });

                this.guiProcess.on('error', (error) => {
                    console.error('GUI进程错误:', error);
                    reject(error);
                });

                this.guiProcess.on('exit', (code, signal) => {
                    console.log(`GUI进程退出: code=${code}, signal=${signal}`);
                    this.isGUIRunning = false;
                    this.guiProcess = null;
                });

                // 设置超时
                setTimeout(() => {
                    if (!this.isGUIRunning) {
                        reject(new Error('GUI服务器启动超时'));
                    }
                }, 10000);

            } catch (error) {
                reject(error);
            }
        });
    }

    /**
     * 等待服务器就绪
     */
    async waitForServer() {
        const maxWait = 10000; // 最大等待时间
        const checkInterval = 500; // 检查间隔
        let waited = 0;

        while (waited < maxWait) {
            try {
                // 检查HTTP服务器
                const response = await fetch(`http://localhost:${this.guiPort}/health`);
                if (response.ok) {
                    console.log('GUI服务器已就绪');
                    return true;
                }
            } catch (error) {
                // 服务器还未就绪，继续等待
            }

            await this.delay(checkInterval);
            waited += checkInterval;
        }

        throw new Error('等待GUI服务器就绪超时');
    }

    /**
     * 打开浏览器
     */
    async openBrowser() {
        try {
            const url = `http://localhost:${this.guiPort}`;
            console.log(`正在打开浏览器: ${url}`);
            
            await open(url, {
                wait: false,
                app: {
                    name: open.apps.chrome,
                    arguments: [
                        '--new-window',
                        '--disable-web-security',
                        '--disable-features=VizDisplayCompositor'
                    ]
                }
            });
            
            console.log('浏览器已打开');
            
        } catch (error) {
            console.warn('自动打开浏览器失败:', error);
            console.log(`请手动打开浏览器访问: http://localhost:${this.guiPort}`);
        }
    }

    /**
     * 停止GUI界面
     */
    async stopGUI() {
        if (!this.isGUIRunning) {
            console.log('GUI界面未运行');
            return;
        }

        try {
            console.log('正在停止GUI界面...');
            
            if (this.guiProcess) {
                // 优雅关闭
                this.guiProcess.kill('SIGTERM');
                
                // 等待进程退出
                await this.waitForProcessExit();
                
                // 如果进程仍在运行，强制杀死
                if (this.guiProcess && !this.guiProcess.killed) {
                    console.log('强制终止GUI进程');
                    this.guiProcess.kill('SIGKILL');
                }
            }
            
            this.isGUIRunning = false;
            this.guiProcess = null;
            
            console.log('GUI界面已停止');
            
        } catch (error) {
            console.error('停止GUI界面失败:', error);
        }
    }

    /**
     * 等待进程退出
     */
    async waitForProcessExit() {
        return new Promise((resolve) => {
            if (!this.guiProcess) {
                resolve();
                return;
            }

            const timeout = setTimeout(() => {
                resolve();
            }, 5000);

            this.guiProcess.on('exit', () => {
                clearTimeout(timeout);
                resolve();
            });
        });
    }

    /**
     * 重启GUI界面
     */
    async restartGUI() {
        console.log('正在重启GUI界面...');
        
        await this.stopGUI();
        await this.delay(1000);
        return this.startGUI();
    }

    /**
     * 检查GUI状态
     */
    async checkGUIStatus() {
        try {
            const response = await fetch(`http://localhost:${this.guiPort}/api/status`);
            if (response.ok) {
                const status = await response.json();
                return {
                    running: true,
                    ...status
                };
            }
        } catch (error) {
            // GUI未运行或无法访问
        }

        return {
            running: false,
            error: 'GUI服务器无法访问'
        };
    }

    /**
     * 获取GUI URL
     */
    getGUIUrl() {
        return `http://localhost:${this.guiPort}`;
    }

    /**
     * 设置端口
     */
    setPorts(guiPort, wsPort) {
        this.guiPort = guiPort;
        this.wsPort = wsPort;
    }

    /**
     * 延迟函数
     */
    delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    /**
     * 清理资源
     */
    async cleanup() {
        await this.stopGUI();
    }

    /**
     * 获取状态信息
     */
    getStatus() {
        return {
            isRunning: this.isGUIRunning,
            guiPort: this.guiPort,
            wsPort: this.wsPort,
            processId: this.guiProcess?.pid || null,
            retryCount: this.retryCount,
            maxRetries: this.maxRetries
        };
    }
}

/**
 * 创建全局启动器实例
 */
export const launcher = new Launcher();

/**
 * 快速启动函数
 */
export async function quickStart() {
    return launcher.startGUI();
}

/**
 * 快速停止函数
 */
export async function quickStop() {
    return launcher.stopGUI();
}

/**
 * 进程退出时清理
 */
process.on('exit', () => {
    launcher.cleanup();
});

process.on('SIGINT', async () => {
    await launcher.cleanup();
    process.exit(0);
});

process.on('SIGTERM', async () => {
    await launcher.cleanup();
    process.exit(0);
});
