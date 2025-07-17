import express from 'express';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

// 常量定义
const DEFAULT_GUI_PORT = 8347;
const WEBSOCKET_PORT = 8573;
const SERVER_HOST = 'localhost';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// 专用日志函数 - 输出到stderr但不显示为错误
function guiLog(message) {
    process.stderr.write(`[GUI服务器] ${message}\n`);
}

let server = null;
let isRunning = false;

/**
 * 启动GUI Web服务器
 */
export async function startGUIServer(port = DEFAULT_GUI_PORT) {
    if (isRunning) {
        guiLog('GUI Web服务器已在运行');
        return;
    }

    const app = express();
    
    // 设置静态文件目录
    app.use(express.static(join(__dirname, 'gui')));
    app.use('/node_modules', express.static(join(__dirname, 'node_modules')));
    
    // 主页路由
    app.get('/', (req, res) => {
        res.sendFile(join(__dirname, 'gui', 'index.html'));
    });
    
    // API路由 - 获取服务器状态
    app.get('/api/status', (req, res) => {
        res.json({
            status: 'running',
            timestamp: new Date().toISOString(),
            websocketPort: WEBSOCKET_PORT
        });
    });
    
    // 健康检查路由
    app.get('/health', (req, res) => {
        res.json({ status: 'ok' });
    });
    
    // 启动服务器
    server = app.listen(port, SERVER_HOST, () => {
        guiLog(`GUI Web服务器已启动: http://localhost:${port}`);
        isRunning = true;
    });
    
    server.on('error', (error) => {
        console.error('GUI Web服务器错误:', error);
        isRunning = false;
    });
}

/**
 * 停止GUI Web服务器
 */
export function stopGUIServer() {
    if (server && isRunning) {
        server.close(() => {
            guiLog('GUI Web服务器已停止');
            isRunning = false;
            server = null;
        });
    }
}

/**
 * 获取服务器状态
 */
export function getServerStatus() {
    return {
        isRunning,
        port: server?.address()?.port || null
    };
}

// 如果直接运行此文件，启动服务器
if (import.meta.url === `file://${process.argv[1]}`) {
    const port = process.env.GUI_PORT || DEFAULT_GUI_PORT;
    startGUIServer(port).catch(console.error);
}
