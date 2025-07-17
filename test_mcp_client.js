#!/usr/bin/env node

/**
 * MCP Terminal 测试客户端
 * 通过MCP协议连接server.js并测试工具调用功能
 */

import { spawn } from 'child_process';
import { randomUUID } from 'crypto';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// 常量定义
const DELAY_BEFORE_START = 10000; // 10秒延迟
const COMMAND_INTERVAL = 3000; // 命令间隔3秒
const TEST_COMMANDS = [
    'echo "Hello from PowerShell Terminal 1"',
    'Get-Date',
    'Get-Location'
];

const TEST_COMMANDS_2 = [
    'echo "Hello from PowerShell Terminal 2"', 
    'dir',
    'echo "Test completed"'
];

class MCPTestClient {
    constructor() {
        this.serverProcess = null;
        this.requestId = 0;
        this.sessions = [];
        this.isConnected = false;
    }

    /**
     * 生成请求ID
     */
    generateRequestId() {
        return ++this.requestId;
    }

    /**
     * 发送MCP请求
     */
    sendRequest(method, params = {}) {
        const request = {
            jsonrpc: '2.0',
            id: this.generateRequestId(),
            method,
            params
        };

        console.log(`📤 发送请求: ${method}`, params);
        this.serverProcess.stdin.write(JSON.stringify(request) + '\n');
        return request.id;
    }

    /**
     * 处理服务器响应
     */
    handleResponse(data) {
        try {
            const response = JSON.parse(data);
            console.log(`📥 收到响应:`, response);

            // 处理工具调用结果
            if (response.result && response.result.content) {
                const content = response.result.content[0];
                if (content && content.text) {
                    const result = JSON.parse(content.text);
                    if (result.sessionId) {
                        this.sessions.push(result.sessionId);
                        console.log(`✅ 会话已创建: ${result.sessionId}`);
                    }
                }
            }
        } catch (error) {
            console.error('❌ 解析响应失败:', error);
        }
    }

    /**
     * 启动服务器进程
     */
    startServer() {
        console.log('🚀 启动MCP服务器...');
        
        this.serverProcess = spawn('node', ['server.js'], {
            cwd: __dirname,
            stdio: ['pipe', 'pipe', 'pipe']
        });

        // 处理服务器输出
        this.serverProcess.stdout.on('data', (data) => {
            const lines = data.toString().split('\n').filter(line => line.trim());
            lines.forEach(line => {
                if (line.trim()) {
                    this.handleResponse(line);
                }
            });
        });

        // 处理服务器日志
        this.serverProcess.stderr.on('data', (data) => {
            console.log('� 服务器日志:', data.toString().trim());
        });

        // 处理服务器退出
        this.serverProcess.on('close', (code) => {
            console.log(`🛑 服务器进程退出，代码: ${code}`);
        });

        console.log('✅ 服务器进程已启动');
    }

    /**
     * 初始化MCP连接
     */
    async initializeConnection() {
        console.log('🔗 初始化MCP连接...');
        
        // 发送初始化请求
        this.sendRequest('initialize', {
            protocolVersion: '2024-11-05',
            capabilities: {},
            clientInfo: {
                name: 'mcp-test-client',
                version: '1.0.0'
            }
        });

        // 等待一下再获取工具列表
        await this.sleep(1000);
        this.sendRequest('tools/list');
        
        this.isConnected = true;
        console.log('✅ MCP连接已建立');
    }

    /**
     * 创建终端会话并执行命令
     */
    async createTerminalAndExecuteCommands(terminalNumber, commands) {
        console.log(`\n🖥️ 创建终端 ${terminalNumber}...`);
        
        // 创建终端会话
        const sessionId = await this.createTerminalSession(terminalNumber);
        
        if (sessionId) {
            console.log(`✅ 终端 ${terminalNumber} 创建成功: ${sessionId}`);
            
            // 执行命令序列
            for (let i = 0; i < commands.length; i++) {
                await this.sleep(COMMAND_INTERVAL);
                console.log(`📝 终端 ${terminalNumber} 执行命令: ${commands[i]}`);
                this.executeCommand(sessionId, commands[i]);
            }
        }
        
        return sessionId;
    }

    /**
     * 创建终端会话
     */
    async createTerminalSession(terminalNumber) {
        const workingDir = process.cwd();
        
        this.sendRequest('tools/call', {
            name: 'tm_execute',
            arguments: {
                command: `echo "Terminal ${terminalNumber} initialized"`,
                cwd: workingDir,
                terminal_type: 'powershell',
                timeout: 5000
            }
        });

        // 等待会话创建
        await this.sleep(2000);
        return this.sessions[this.sessions.length - 1];
    }

    /**
     * 执行命令
     */
    executeCommand(sessionId, command) {
        this.sendRequest('tools/call', {
            name: 'tm_write',
            arguments: {
                session_id: sessionId,
                input: command,
                add_newline: true
            }
        });
    }

    /**
     * 读取会话输出
     */
    readSessionOutput(sessionId) {
        this.sendRequest('tools/call', {
            name: 'tm_read',
            arguments: {
                session_id: sessionId
            }
        });
    }

    /**
     * 列出所有会话
     */
    listSessions() {
        this.sendRequest('tools/call', {
            name: 'tm_list',
            arguments: {}
        });
    }

    /**
     * 睡眠函数
     */
    sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    /**
     * 运行测试
     */
    async runTest() {
        console.log('🧪 MCP Terminal 测试客户端启动');
        console.log('='.repeat(50));

        // 启动服务器
        this.startServer();

        // 延迟10秒后开始测试
        console.log(`⏰ 等待 ${DELAY_BEFORE_START / 1000} 秒后开始测试...`);
        await this.sleep(DELAY_BEFORE_START);

        // 初始化连接
        await this.initializeConnection();
        await this.sleep(2000);

        // 创建第一个终端并执行命令
        const session1 = await this.createTerminalAndExecuteCommands(1, TEST_COMMANDS);
        
        // 等待一下再创建第二个终端
        await this.sleep(3000);
        
        // 创建第二个终端并执行命令
        const session2 = await this.createTerminalAndExecuteCommands(2, TEST_COMMANDS_2);

        // 等待命令执行完成
        await this.sleep(5000);

        // 读取两个会话的输出
        console.log('\n📖 读取会话输出...');
        if (session1) {
            console.log('📋 读取终端1输出:');
            this.readSessionOutput(session1);
        }
        
        await this.sleep(1000);
        
        if (session2) {
            console.log('📋 读取终端2输出:');
            this.readSessionOutput(session2);
        }

        // 列出所有会话
        await this.sleep(2000);
        console.log('\n📝 列出所有会话:');
        this.listSessions();

        console.log('\n✅ 测试完成！服务器保持运行状态，可以通过GUI查看结果。');
        console.log('💡 提示：访问 http://localhost:8347 查看GUI界面');
        console.log('🔗 或者检查WebSocket连接状态：ws://localhost:8573');
    }

    /**
     * 清理资源
     */
    cleanup() {
        if (this.serverProcess) {
            console.log('🧹 清理服务器进程...');
            this.serverProcess.kill();
        }
    }
}

// 主函数
async function main() {
    const client = new MCPTestClient();
    
    // 处理进程退出
    process.on('SIGINT', () => {
        console.log('\n⚠️ 收到中断信号，正在清理...');
        client.cleanup();
        process.exit(0);
    });

    process.on('SIGTERM', () => {
        console.log('\n⚠️ 收到终止信号，正在清理...');
        client.cleanup();
        process.exit(0);
    });

    try {
        await client.runTest();
    } catch (error) {
        console.error('❌ 测试失败:', error);
        client.cleanup();
        process.exit(1);
    }
}

// 运行测试
if (process.argv[1] && process.argv[1].endsWith('test_mcp_client.js')) {
    main().catch(console.error);
}

export { MCPTestClient };
