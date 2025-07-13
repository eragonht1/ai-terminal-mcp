# MCP Terminal Server

基于Node.js的MCP服务器，支持Windows终端（CMD和PowerShell）执行命令并管理会话。

## 🎉 新功能：AI操作可视化GUI界面

**重大更新！** 现在包含完整的Web GUI界面，让AI操作终端的过程完全透明化！

### 🚀 GUI特性
- **🔄 智能启动**: AI调用MCP工具时自动弹出GUI界面
- **🧠 智能检测**: 检测浏览器关闭状态，自动重新打开GUI界面
- **👁️ 操作透明化**: 实时显示AI的每个操作步骤
- **⚡ 实时数据流**: WebSocket实时传输，延迟<200ms
- **📊 多会话管理**: 标签式界面，支持并发会话
- **🎨 专业设计**: VS Code风格的深色主题
- **⚙️ 个性化设置**: 字体大小、主题、时间戳等可配置

### 🌐 GUI访问
当AI调用MCP工具时，GUI界面会自动在浏览器中打开：
```
http://localhost:8347
```

### 🔍 智能检测机制
- **自动检测**: 系统会检测WebSocket连接状态
- **智能重启**: 浏览器关闭后，下次工具调用时自动重新打开
- **服务器保持**: GUI服务器保持运行，避免重复启动
- **简化逻辑**: 移除复杂心跳检测，采用简单高效的连接检测

## 核心功能特性

### 🖥️ 终端功能
- ✅ **多终端支持**: 支持PowerShell和CMD终端
- ✅ **会话管理**: 能够同时管理多个终端会话，每个会话有独立的ID
- ✅ **智能内存管理**: 自动清理不活跃会话，防止内存泄漏
- ✅ **快速响应**: 优化的提示符识别算法，响应时间从3秒降至200ms内
- ✅ **错误处理**: 当命令执行失败时能够返回清晰的错误信息
- ✅ **灵活输入**: 支持命令执行和文本编写两种模式
- ✅ **输出缓存**: 能够保存命令的历史输出，方便后续查看

### 🎨 GUI可视化功能
- ✅ **AI操作透明化**: 完整显示AI操作终端的过程
- ✅ **实时流式显示**: 使用xterm.js实现专业终端体验
- ✅ **智能界面管理**: AI调用时自动启动GUI，浏览器关闭后智能重启
- ✅ **多会话可视化**: 标签式管理，支持多个会话并发显示
- ✅ **WebSocket通信**: 实时数据传输，延迟极低
- ✅ **专业界面设计**: VS Code风格，深色主题，用户体验优秀

### 🔧 技术优化
- ✅ **代码优化**: 移除复杂心跳检测，采用简化WebSocket连接检测
- ✅ **智能检测**: 简单高效的连接状态检测，性能提升显著
- ✅ **最小文件实现**: 核心功能仅使用2个文件实现
- ✅ **模块化架构**: GUI系统采用模块化设计，易于维护和扩展

## 系统要求

- Windows 10系统
- Node.js >= 18.0.0
- PowerShell 7终端支持（路径：`C:\Program Files\PowerShell\7`）

## 安装

```bash
npm install
```

## 启动服务器

```bash
npm start
```

## 配置AI助手

1. 在配置文件中添加以下内容：

```json
{
  "mcpServers": {
    "ai-terminal-mcp": {
      "command": "node",
      "args": ["G:\\docker\\McpApi\\ai-terminal-mcp\\server.js"],
      "cwd": "G:\\docker\\McpApi\\ai-terminal-mcp",
      "env": {}
    }
  }
}
```

2. 重启VSCode

### 其他AI助手配置

对于支持MCP协议的其他AI助手，请参考以下通用配置：

- **命令**: `node`
- **参数**: `["G:\\docker\\McpApi\\ai-terminal-mcp\\server.js"]`
- **工作目录**: `G:\\docker\\McpApi\\ai-terminal-mcp`
- **协议**: MCP (Model Context Protocol)
- **通信方式**: STDIO

### 配置验证

配置完成后，可使用5个工具：`tm_execute`、`tm_read`、`tm_write`、`tm_list`、`tm_close`

## 提供的工具

### 1. tm_execute - 执行命令
执行命令（支持PowerShell和CMD终端，必须指定工作目录的绝对路径）

**参数:**
- `command` (string, 必需): 要执行的命令
- `cwd` (string, 必需): 工作目录的绝对路径
- `terminal_type` (string, 可选): 终端类型（powershell=Windows PowerShell，cmd=命令提示符），默认 'powershell'
- `timeout` (number, 可选): 超时时间（毫秒），默认 5000

**说明:** 总是创建新会话并返回sessionId，用于后续操作

### 2. tm_read - 获取结果
获取会话的所有输出结果

**参数:**
- `session_id` (string, 必需): 要读取的会话ID

**说明:** 返回指定会话的完整输出内容

### 3. tm_write - 追加命令或编写文本
向终端会话追加命令或编写文本内容

**参数:**
- `session_id` (string, 必需): 目标会话ID
- `input` (string, 必需): 要输入的命令或文本内容
- `add_newline` (boolean, 可选): 是否添加换行符执行命令（true=追加命令并执行，false=仅编写文本内容），默认 true

**说明:** 支持两种模式 - 执行命令或构建文本

### 4. tm_list - 列出所有会话
列出所有活跃的终端会话

**参数:**
- 无需参数

**说明:** 返回所有会话的详细信息，包括ID、类型、状态等

### 5. tm_close - 关闭终端
关闭指定的终端会话

**参数:**
- `session_id` (string, 必需): 要关闭的会话ID

**说明:** 安全关闭指定会话并清理资源

## 使用示例

### 基本工作流程

```javascript
// 1. 执行命令，创建新会话
tm_execute({
    command: "dir",
    cwd: "C:\\Users"
})
// 返回: { sessionId: "session-123", ... }

// 2. 在同一会话中追加命令
tm_write({
    session_id: "session-123",
    input: "echo 'Hello World'",
    add_newline: true
})

// 3. 读取会话输出
tm_read({
    session_id: "session-123"
})

// 4. 关闭会话
tm_close({
    session_id: "session-123"
})
```

### 高级用法

```javascript
// 构建复杂命令
tm_write({
    session_id: "session-123",
    input: "python -c \"",
    add_newline: false  // 不执行，继续输入
})

tm_write({
    session_id: "session-123",
    input: "print('Hello')\"",
    add_newline: true   // 执行完整命令
})

// 切换终端类型
tm_execute({
    command: "dir",
    cwd: "C:\\",
    terminal_type: "cmd"  // 使用CMD而非PowerShell
})
```


## 技术架构

### 🔧 核心文件
- `server.js`: MCP服务器主文件（已扩展WebSocket功能）
- `terminal-manager.js`: 终端管理模块（已添加事件广播）

### 🎨 GUI系统文件
- `websocket-bridge.js`: WebSocket通信桥，实现实时数据传输
- `gui-server.js`: GUI Web服务器，提供界面访问
- `launcher.js`: 自动启动器，管理GUI生命周期
- `gui/`: GUI界面目录
  - `index.html`: 主界面文件
  - `app.js`: 应用核心逻辑
  - `terminal-renderer.js`: xterm.js终端渲染器
  - `session-manager.js`: 会话管理器
  - `styles.css`: 界面样式

### 📦 依赖库
- `@lydell/node-pty`: 预编译的node-pty库
- `ws`: WebSocket服务器
- `express`: Web服务器框架
- `open`: 自动打开浏览器
- `@xterm/xterm`: 终端模拟器
- `@xterm/addon-fit`: 终端自适应插件
- `@xterm/addon-web-links`: 链接识别插件

### 🏗️ 系统架构图
```
AI Assistant
     ↓
MCP Server (server.js)
     ↓
WebSocket Bridge (websocket-bridge.js)
     ↓
GUI Interface (gui/)
     ↓
xterm.js Terminal Renderer
```

## 性能优化

### 代码优化成果
- **代码量减少**: 从878行优化到359行，减少**59.1%**
- **文件大小减少**: 从27.79KB减少到13.26KB，减少**52.3%**
- **响应速度提升**: 从平均3秒降低到200ms内，提升**15倍**

### 技术优化
- **快速响应**: 优化提示符检测，稳定性检测从3次降为1次，检查间隔从150ms降为50ms
- **内存管理**: 自动清理不活跃会话，防止内存泄漏
- **智能检测**: 优化命令完成判断，支持多种提示符格式
- **简化逻辑**: 移除冗余参数和复杂逻辑，提高可维护性

### 用户体验提升
- **工具描述完善**: 每个工具和参数都有详细说明
- **参数顺序优化**: 必需参数优先，逻辑更清晰
- **功能简化**: 移除无效参数，使用更简洁
- **GUI可视化**: AI操作完全透明，用户体验大幅提升

## 🎨 GUI界面使用指南

### 自动启动
当AI助手调用任何MCP工具时，GUI界面会自动：
1. 启动WebSocket服务器（端口8573）
2. 启动Web服务器（端口8347）
3. 自动打开浏览器显示GUI界面

### 界面功能
- **📊 状态栏**: 显示连接状态、会话数量、当前时间
- **📑 标签栏**: 多会话标签管理，支持切换和关闭
- **💻 终端区域**: xterm.js实现的专业终端显示
- **📈 信息栏**: WebSocket状态、最后活动时间、事件计数
- **⚙️ 设置面板**: 主题、字体大小、时间戳等个性化配置

### 实时功能
- **🔄 自动更新**: 终端输出实时流式显示
- **⚡ 低延迟**: WebSocket通信，响应时间<200ms
- **📝 完整记录**: 保存所有命令和输出历史
- **🎨 彩色显示**: 支持ANSI颜色代码，完整终端体验

### 快捷键
- `Ctrl + ,`: 打开设置面板
- `Ctrl + L`: 清除历史记录

## 🧠 智能检测机制详解

### 工作原理
系统采用简化的WebSocket连接检测机制，替代了复杂的心跳检测：

1. **首次启动**: AI首次调用工具时，启动所有服务器并打开浏览器
2. **连接检测**: 每次工具调用都检查WebSocket连接状态
3. **智能重启**: 检测到浏览器关闭时，自动重新打开浏览器
4. **服务器保持**: GUI服务器和WebSocket服务器保持运行，避免重复启动

### 检测逻辑
```javascript
// 简单高效的连接检测
hasActiveConnections() {
    return this.clients.size > 0;
}

// 智能判断是否需要重开浏览器
if (!hasConnections) {
    console.log('检测到浏览器已关闭，重新打开浏览器...');
    await this.openBrowser();
}
```

### 优势特点
- **🚀 高性能**: 无网络延迟，即时响应
- **🔧 简单可靠**: 逻辑清晰，易于维护
- **💡 智能化**: 自动检测并处理浏览器状态
- **⚡ 零配置**: 用户无需任何配置，完全自动化

## 📚 相关文档

- **GUI架构设计**: `GUI-ARCHITECTURE.md`
- **GUI使用说明**: `README-GUI.md`
- **Playwright测试报告**: `PLAYWRIGHT-TEST-REPORT.md`

## 🎯 使用场景

### 开发调试
- 观察AI如何操作终端
- 验证命令执行结果
- 调试MCP工具调用

### 系统监控
- 实时监控终端会话
- 跟踪系统操作历史
- 分析性能指标

### 教学演示
- 展示AI操作过程
- 教学终端使用
- 演示自动化流程

## 许可证

MIT License
