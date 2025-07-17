# MCP Terminal Server

基于Node.js的MCP服务器，支持Windows终端（CMD和PowerShell）执行命令并管理会话。

## ✨ 特性

- **🖥️ 多终端支持**: 支持PowerShell和CMD终端
- **� 会话管理**: 同时管理多个终端会话，每个会话独立ID
- **🎨 可视化GUI**: 实时显示AI操作过程的Web界面
- **⚡ 高性能**: 优化的架构设计，响应时间<200ms
- **� 智能管理**: 自动清理资源，防止内存泄漏
- **� WebSocket通信**: 实时数据传输，支持多客户端连接

## 🌐 GUI界面

启动服务器后，可通过以下地址访问可视化界面：
```
http://localhost:8347
```

GUI界面提供：
- 实时终端输出显示
- 多会话标签管理
- AI操作过程透明化
- 专业的VS Code风格界面

## � 系统要求

- **操作系统**: Windows 10/11
- **Node.js**: >= 18.0.0
- **PowerShell**: 7.x (路径: `C:\Program Files\PowerShell\7\pwsh.exe`)

## 🚀 快速开始

### 1. 安装依赖
```bash
npm install
```

### 2. 启动服务器
```bash
# 生产环境
npm start

# 开发环境（支持热重载）
nodemon server.js
```

### 3. 访问GUI界面
打开浏览器访问: http://localhost:8347

## 📁 项目结构

```
ai-terminal-mcp/
├── 📄 server.js                 # MCP服务器主入口（重构后）
├── 📄 config.js                 # 统一配置管理
├── 📄 tools.js                  # 工具定义和注册表
├── 📄 events.js                 # 事件类型常量定义
├── 📄 terminal-manager.js       # 终端会话管理器
├── 📄 websocket-bridge.js       # WebSocket通信桥（重构后）
├── 📄 gui-server.js             # GUI Web服务器
├── 📄 package.json              # 项目配置和依赖
├── 📄 README.md                 # 项目说明文档
└── 📁 gui/                      # GUI界面文件
    ├── 📄 index.html             # 主界面HTML
    ├── 📄 app.js                 # 主应用逻辑（重构后）
    ├── 📄 session-manager.js     # 会话管理器
    ├── 📄 terminal-renderer.js   # 终端渲染器
    └── 📄 styles.css             # 界面样式
```

### 📋 核心文件说明

#### 🔧 服务器端（重构后的架构）
- **`server.js`** - 主入口，采用依赖注入和职责分离的架构设计
- **`config.js`** - 统一配置管理，所有常量和配置集中管理
- **`tools.js`** - 工具定义注册表，管理所有MCP工具
- **`events.js`** - 事件类型常量，统一事件管理
- **`terminal-manager.js`** - 终端会话管理，支持多会话并发
- **`websocket-bridge.js`** - WebSocket通信桥，分离数据缓存、事件广播等职责
- **`gui-server.js`** - GUI Web服务器，提供静态文件服务

#### 🎨 客户端（重构后的架构）
- **`gui/app.js`** - 主应用逻辑，分离WebSocket客户端、UI状态管理、设置管理
- **`gui/session-manager.js`** - 会话管理器，处理多会话标签
- **`gui/terminal-renderer.js`** - 终端渲染器，基于xterm.js
- **`gui/index.html`** - 主界面HTML结构
- **`gui/styles.css`** - VS Code风格的界面样式

## ⚙️ 配置AI助手

### Claude Desktop配置
在Claude Desktop的配置文件中添加：

```json
{
  "mcpServers": {
    "ai-terminal-mcp": {
      "command": "node",
      "args": ["你的项目路径\\server.js"],
      "cwd": "你的项目路径"
    }
  }
}
```

### 其他AI助手
对于支持MCP协议的AI助手，使用以下配置：
- **命令**: `node`
- **参数**: `["项目路径\\server.js"]`
- **协议**: MCP (Model Context Protocol)
- **通信方式**: STDIO

配置完成后重启AI助手，即可使用5个终端工具。

## 🛠️ 可用工具

| 工具名 | 功能 | 主要参数 |
|--------|------|----------|
| **tm_execute** | 执行命令并创建新会话 | `command`, `cwd`, `terminal_type` |
| **tm_read** | 读取会话输出 | `session_id` |
| **tm_write** | 向会话写入命令或文本 | `session_id`, `input`, `add_newline` |
| **tm_list** | 列出所有活跃会话 | 无参数 |
| **tm_close** | 关闭所有会话 | 无参数 |

### 基本使用流程
```javascript
// 1. 执行命令（创建新会话）
tm_execute({
    command: "dir",
    cwd: "C:\\Users"
})

// 2. 在同一会话中继续操作
tm_write({
    session_id: "返回的会话ID",
    input: "echo Hello"
})

// 3. 读取会话输出
tm_read({
    session_id: "会话ID"
})

// 4. 关闭所有会话
tm_close()
```

## 🏗️ 架构设计

### 重构后的优化架构
本项目采用了现代化的软件架构设计原则：

#### 🎯 **资源加载优化**
- **统一配置管理**: 所有配置集中在 `config.js`，避免重复定义
- **依赖注入**: 在主入口一次性创建资源，通过构造函数注入
- **消除重复加载**: 彻底解决类内部重复创建资源的问题

#### 🔧 **单一职责原则**
- **MCPProtocolHandler**: 专门处理MCP协议
- **ToolExecutor**: 专门负责工具执行逻辑
- **DataCache**: 专门负责数据缓存管理
- **EventBroadcaster**: 专门负责事件广播
- **WebSocketServerManager**: 专门负责WebSocket连接管理

#### 📦 **模块化设计**
```
服务器端架构:
├── config.js          # 统一配置管理
├── tools.js           # 工具定义注册表
├── events.js          # 事件类型常量
└── server.js          # 主入口（依赖注入）

客户端架构:
├── WebSocketClient     # WebSocket客户端管理
├── SettingsManager     # 设置管理
├── UIStateManager      # UI状态管理
└── MCPTerminalGUI      # 主控制器（组合模式）
```

### � 性能优化成果
- **响应速度**: 从3秒优化到200ms内，提升15倍
- **代码质量**: 职责分离，可维护性大幅提升
- **资源管理**: 依赖注入，避免重复加载
- **架构清晰**: 组件间松耦合，易于扩展

## 📦 技术栈

### 后端
- **Node.js** - 运行时环境
- **@lydell/node-pty** - 终端进程管理
- **ws** - WebSocket服务器
- **express** - Web服务器

### 前端
- **xterm.js** - 终端模拟器
- **WebSocket** - 实时通信
- **原生JavaScript** - 无框架依赖

## 🎯 使用场景

- **AI开发调试** - 观察AI操作终端的过程
- **自动化脚本** - 通过AI执行复杂的命令序列
- **系统管理** - AI辅助的系统运维操作
- **教学演示** - 展示AI与终端的交互过程

## 📄 许可证

MIT License

---

**🚀 开始使用**: `npm install && npm start`
**🌐 访问GUI**: http://localhost:8347
**📖 更多信息**: 查看项目文档和源码注释
