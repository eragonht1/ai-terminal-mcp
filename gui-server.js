/**
 * GUI Web服务器模块
 *
 * 该模块负责启动和管理GUI Web服务器，为MCP终端管理器提供
 * 基于Web的用户界面。服务器提供静态文件服务、API接口和
 * 健康检查功能。
 *
 * 主要功能：
 * - 静态文件服务（HTML、CSS、JS）
 * - API接口提供
 * - 服务器状态管理
 * - 健康检查和监控
 *
 * @author MCP Terminal Server Team
 * @version 1.1.0
 */

import express from 'express';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

// ============================================================================
// 配置常量
// ============================================================================

/** 默认GUI服务器端口 */
const DEFAULT_GUI_PORT = 8347;

/** WebSocket服务器端口 */
const WEBSOCKET_PORT = 8573;

/** 服务器主机地址 */
const SERVER_HOST = 'localhost';

// ============================================================================
// 模块级变量
// ============================================================================

/** 当前文件路径 */
const __filename = fileURLToPath(import.meta.url);

/** 当前目录路径 */
const __dirname = dirname(__filename);

/** Express服务器实例 */
let server = null;

/** 服务器运行状态 */
let isRunning = false;

// ============================================================================
// 工具函数
// ============================================================================

/**
 * GUI服务器专用日志函数 - 输出到stderr但不显示为错误
 * @param {string} message - 要记录的消息
 */
function guiLog(message) {
    process.stderr.write(`[GUI服务器] ${message}\n`);
}

// ============================================================================
// 服务器管理函数
// ============================================================================

/**
 * 启动GUI Web服务器
 *
 * 创建Express应用实例，配置路由和中间件，然后启动HTTP服务器。
 * 如果服务器已在运行，则跳过启动过程。
 *
 * @param {number} [port=DEFAULT_GUI_PORT] - 服务器端口号
 * @returns {Promise<void>} 启动完成的Promise
 */
export async function startGUIServer(port = DEFAULT_GUI_PORT) {
    if (isRunning) {
        guiLog('GUI Web服务器已在运行');
        return;
    }

    const app = _createExpressApp();
    _configureRoutes(app);
    await _startServer(app, port);
}

/**
 * 创建Express应用实例并配置中间件
 * @returns {express.Application} 配置好的Express应用
 * @private
 */
function _createExpressApp() {
    const app = express();

    // 配置静态文件服务
    _configureStaticFiles(app);

    return app;
}

/**
 * 配置静态文件服务
 * @param {express.Application} app - Express应用实例
 * @private
 */
function _configureStaticFiles(app) {
    // GUI静态文件目录
    app.use(express.static(join(__dirname, 'gui')));

    // Node modules目录（用于前端依赖）
    app.use('/node_modules', express.static(join(__dirname, 'node_modules')));
}

/**
 * 配置应用路由
 * @param {express.Application} app - Express应用实例
 * @private
 */
function _configureRoutes(app) {
    // 主页路由
    app.get('/', (_req, res) => {
        res.sendFile(join(__dirname, 'gui', 'index.html'));
    });

    // API路由 - 获取服务器状态
    app.get('/api/status', (_req, res) => {
        const statusData = {
            status: 'running',
            timestamp: new Date().toISOString(),
            websocketPort: WEBSOCKET_PORT,
            version: '1.1.0'
        };
        res.json(statusData);
    });

    // 健康检查路由
    app.get('/health', (_req, res) => {
        res.json({
            status: 'ok',
            timestamp: new Date().toISOString()
        });
    });
}

/**
 * 启动HTTP服务器
 * @param {express.Application} app - Express应用实例
 * @param {number} port - 端口号
 * @returns {Promise<void>} 启动完成的Promise
 * @private
 */
function _startServer(app, port) {
    return new Promise((resolve, reject) => {
        server = app.listen(port, SERVER_HOST, () => {
            guiLog(`GUI Web服务器已启动: http://${SERVER_HOST}:${port}`);
            isRunning = true;
            resolve();
        });

        server.on('error', (error) => {
            console.error('GUI Web服务器启动失败:', error);
            isRunning = false;
            reject(error);
        });
    });
}

/**
 * 停止GUI Web服务器
 *
 * 优雅地关闭HTTP服务器，清理资源并重置状态变量。
 * 如果服务器未运行，则忽略停止请求。
 *
 * @returns {Promise<void>} 停止完成的Promise
 */
export function stopGUIServer() {
    return new Promise((resolve) => {
        if (!server || !isRunning) {
            guiLog('GUI Web服务器未运行，无需停止');
            resolve();
            return;
        }

        server.close(() => {
            guiLog('GUI Web服务器已停止');
            _resetServerState();
            resolve();
        });
    });
}

/**
 * 重置服务器状态
 * @private
 */
function _resetServerState() {
    isRunning = false;
    server = null;
}

// ============================================================================
// 状态查询接口
// ============================================================================

/**
 * 获取服务器详细状态信息
 * @returns {Object} 包含服务器状态的对象
 */
export function getServerStatus() {
    const baseStatus = {
        isRunning,
        port: server?.address()?.port || null,
        host: SERVER_HOST
    };

    if (isRunning && server) {
        return {
            ...baseStatus,
            uptime: process.uptime(),
            timestamp: new Date().toISOString(),
            connections: server.listening ? 'active' : 'inactive'
        };
    }

    return baseStatus;
}

/**
 * 检查服务器是否正在运行
 * @returns {boolean} 服务器运行状态
 */
export function isServerRunning() {
    return isRunning;
}

/**
 * 获取服务器URL
 * @returns {string|null} 服务器URL，如果未运行则返回null
 */
export function getServerUrl() {
    if (!isRunning || !server) {
        return null;
    }

    const port = server.address()?.port;
    return port ? `http://${SERVER_HOST}:${port}` : null;
}

// ============================================================================
// 程序入口点
// ============================================================================

/**
 * 程序入口点检查 - 如果直接运行此文件，启动服务器
 * 支持通过环境变量GUI_PORT自定义端口
 */
if (import.meta.url === `file://${process.argv[1]}`) {
    const port = parseInt(process.env.GUI_PORT) || DEFAULT_GUI_PORT;

    guiLog(`正在启动GUI Web服务器，端口: ${port}`);

    startGUIServer(port)
        .then(() => {
            guiLog('GUI Web服务器启动成功');
        })
        .catch((error) => {
            console.error('GUI Web服务器启动失败:', error);
            process.exit(1);
        });
}
