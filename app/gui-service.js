/**
 * GUI服务管理器模块
 *
 * 该模块负责启动和管理GUI Web服务器，为MCP终端管理器提供
 * 基于Web的用户界面。服务器提供静态文件服务、API接口和
 * 健康检查功能。
 *
 * @author MCP Terminal Server Team
 * @version 1.1.0
 */

import express from 'express';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

// ============================================================================
// 模块级变量
// ============================================================================

/** 当前文件路径 */
const __filename = fileURLToPath(import.meta.url);

/** 当前目录路径 */
const __dirname = dirname(__filename);

/** 项目根目录路径 */
const PROJECT_ROOT = join(__dirname, '..');

/**
 * GUI服务管理器 - 负责GUI Web服务器的生命周期管理
 *
 * 该类封装了GUI Web服务器的所有功能，包括启动、停止、
 * 路由配置和状态管理。作为应用层的服务组件，它为用户
 * 提供Web界面访问终端管理功能。
 */
export class GUIService {
    /**
     * 构造函数
     * @param {AppConfig} config - 应用配置对象
     */
    constructor(config) {
        this.config = config;
        this.server = null;
        this.isRunning = false;
        this.app = null;
    }

    // ========================================================================
    // 服务器生命周期管理
    // ========================================================================

    /**
     * 启动GUI Web服务器
     *
     * 创建Express应用实例，配置路由和中间件，然后启动HTTP服务器。
     * 如果服务器已在运行，则跳过启动过程。
     *
     * @param {number} [port] - 服务器端口号，默认使用配置中的端口
     * @returns {Promise<void>} 启动完成的Promise
     */
    async start(port = null) {
        if (this.isRunning) {
            this._log('GUI Web服务器已在运行');
            return;
        }

        const serverPort = port || this.config.serverPorts.GUI;
        
        this.app = this._createExpressApp();
        this._configureRoutes(this.app);
        await this._startServer(this.app, serverPort);
    }

    /**
     * 停止GUI Web服务器
     *
     * 优雅地关闭HTTP服务器，清理资源并重置状态变量。
     * 如果服务器未运行，则忽略停止请求。
     *
     * @returns {Promise<void>} 停止完成的Promise
     */
    async stop() {
        return new Promise((resolve) => {
            if (!this.server || !this.isRunning) {
                this._log('GUI Web服务器未运行，无需停止');
                resolve();
                return;
            }

            this.server.close(() => {
                this._log('GUI Web服务器已停止');
                this._resetServerState();
                resolve();
            });
        });
    }

    // ========================================================================
    // Express应用配置
    // ========================================================================

    /**
     * 创建Express应用实例并配置中间件
     * @returns {express.Application} 配置好的Express应用
     * @private
     */
    _createExpressApp() {
        const app = express();

        // 配置静态文件服务
        this._configureStaticFiles(app);

        return app;
    }

    /**
     * 配置静态文件服务
     * @param {express.Application} app - Express应用实例
     * @private
     */
    _configureStaticFiles(app) {
        // GUI静态文件目录
        app.use(express.static(join(__dirname, 'gui')));

        // Node modules目录（用于前端依赖）
        app.use('/node_modules', express.static(join(PROJECT_ROOT, 'node_modules')));
    }

    /**
     * 配置应用路由
     * @param {express.Application} app - Express应用实例
     * @private
     */
    _configureRoutes(app) {
        // 主页路由
        app.get('/', (_req, res) => {
            res.sendFile(join(__dirname, 'gui', 'index.html'));
        });

        // API路由 - 获取服务器状态
        app.get('/api/status', (_req, res) => {
            const statusData = {
                status: 'running',
                timestamp: new Date().toISOString(),
                websocketPort: this.config.serverPorts.WEBSOCKET,
                version: this.config.mcpConfig.SERVER_VERSION
            };
            res.json(statusData);
        });

        // 健康检查路由
        app.get('/health', (_req, res) => {
            res.json({
                status: 'ok',
                timestamp: new Date().toISOString(),
                isRunning: this.isRunning
            });
        });

        // 配置信息路由
        app.get('/api/config', (_req, res) => {
            res.json(this.config.getConfigSummary());
        });
    }

    // ========================================================================
    // 服务器启动和状态管理
    // ========================================================================

    /**
     * 启动HTTP服务器
     * @param {express.Application} app - Express应用实例
     * @param {number} port - 端口号
     * @returns {Promise<void>} 启动完成的Promise
     * @private
     */
    _startServer(app, port) {
        return new Promise((resolve, reject) => {
            this.server = app.listen(port, this.config.networkConfig.HOST, () => {
                this._log(`GUI Web服务器已启动: ${this.getServerUrl()}`);
                this.isRunning = true;
                resolve();
            });

            this.server.on('error', (error) => {
                console.error('GUI Web服务器启动失败:', error);
                this.isRunning = false;
                reject(error);
            });
        });
    }

    /**
     * 重置服务器状态
     * @private
     */
    _resetServerState() {
        this.isRunning = false;
        this.server = null;
        this.app = null;
    }

    /**
     * GUI服务器专用日志函数
     * @param {string} message - 要记录的消息
     * @private
     */
    _log(message) {
        process.stderr.write(`[GUI服务器] ${message}\n`);
    }

    // ========================================================================
    // 状态查询接口
    // ========================================================================

    /**
     * 获取服务器详细状态信息
     * @returns {Object} 包含服务器状态的对象
     */
    getStatus() {
        const baseStatus = {
            isRunning: this.isRunning,
            port: this.server?.address()?.port || null,
            host: this.config.networkConfig.HOST
        };

        if (this.isRunning && this.server) {
            return {
                ...baseStatus,
                uptime: process.uptime(),
                timestamp: new Date().toISOString(),
                connections: this.server.listening ? 'active' : 'inactive',
                url: this.getServerUrl()
            };
        }

        return baseStatus;
    }

    /**
     * 检查服务器是否正在运行
     * @returns {boolean} 服务器运行状态
     */
    isServerRunning() {
        return this.isRunning;
    }

    /**
     * 获取服务器URL
     * @returns {string|null} 服务器URL，如果未运行则返回null
     */
    getServerUrl() {
        if (!this.isRunning || !this.server) {
            return null;
        }

        const port = this.server.address()?.port;
        return port ? `http://${this.config.networkConfig.HOST}:${port}` : null;
    }

    /**
     * 获取服务器端口
     * @returns {number|null} 服务器端口，如果未运行则返回null
     */
    getServerPort() {
        return this.server?.address()?.port || null;
    }

    // ========================================================================
    // 工具方法
    // ========================================================================

    /**
     * 检查服务器健康状态
     * @returns {boolean} 服务器是否健康
     */
    isHealthy() {
        return this.isRunning && this.server && this.server.listening;
    }

    /**
     * 重启服务器
     * @param {number} [port] - 新的端口号（可选）
     * @returns {Promise<void>} 重启完成的Promise
     */
    async restart(port = null) {
        await this.stop();
        await this.start(port);
    }
}
