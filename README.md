# MCP Terminal Server

基于Node.js的MCP服务器，支持Windows终端（CMD和PowerShell）执行命令并管理会话。

## ✨ 特性

- **🖥️ 多终端支持**: 支持PowerShell和CMD终端
- **📋 会话管理**: 同时管理多个终端会话，每个会话独立ID
- **🎨 可视化GUI**: 实时显示AI操作过程的Web界面
- **⚡ 高性能**: 优化的架构设计，响应时间<200ms
- **🧹 智能管理**: 自动清理资源，防止内存泄漏
- **🌐 WebSocket通信**: 实时数据传输，支持多客户端连接

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

## 💻 系统要求

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

采用分层架构设计，清晰的职责分离：

```
ai-terminal-mcp/
├── 📄 server.js                 # MCP服务器主入口
├── 📄 test_mcp_client.js        # 测试客户端
├── 📄 package.json              # 项目配置和依赖
├── 📄 README.md                 # 项目说明文档
├── 📁 config/                   # 配置层
│   └── 📄 app-config.js         # 统一配置管理
├── 📁 utils/                    # 工具层
│   ├── 📄 event-types.js        # 事件类型定义
│   ├── 📄 event-manager.js      # 事件管理器
│   ├── 📄 logger.js             # 日志工具
│   └── 📄 validators.js         # 验证工具
├── 📁 core/                     # 核心层
│   ├── 📄 protocol-handler.js   # MCP协议处理器
│   ├── 📄 terminal-interface.js # 终端接口定义
│   └── 📄 event-interface.js    # 事件接口定义
├── 📁 business/                 # 业务层
│   ├── 📄 terminal-manager.js   # 终端会话管理器
│   ├── 📄 tool-registry.js      # 工具定义注册表
│   ├── 📄 tool-executor.js      # 工具执行器
│   ├── 📄 websocket-bridge.js   # WebSocket通信桥
│   └── 📄 data-cache.js         # 数据缓存管理
└── 📁 app/                      # 应用层
    ├── 📄 server-orchestrator.js # 服务器协调器
    ├── 📄 gui-service.js        # GUI服务管理
    ├── 📄 gui-server.js         # GUI Web服务器
    └── 📁 gui/                  # GUI界面文件
        ├── 📄 index.html         # 主界面HTML
        ├── 📄 app.js             # 主应用逻辑
        ├── 📄 session-manager.js # 会话管理器
        ├── 📄 terminal-renderer.js # 终端渲染器
        └── 📄 styles.css         # 界面样式
```

### 📋 分层架构说明

#### 🏗️ **配置层 (config/)**
- **`app-config.js`** - 统一配置管理，所有常量和配置集中管理

#### 🛠️ **工具层 (utils/)**
- **`event-types.js`** - 事件类型常量定义
- **`event-manager.js`** - 事件管理器，提供事件验证和创建
- **`logger.js`** - 统一日志工具，支持不同级别输出
- **`validators.js`** - 参数验证工具，确保数据有效性

#### ⚡ **核心层 (core/)**
- **`protocol-handler.js`** - MCP协议处理器，处理协议请求和响应
- **`terminal-interface.js`** - 终端管理接口定义
- **`event-interface.js`** - 事件管理接口定义

#### 💼 **业务层 (business/)**
- **`terminal-manager.js`** - 终端会话管理，支持多会话并发
- **`tool-registry.js`** - 工具定义注册表，管理所有MCP工具
- **`tool-executor.js`** - 工具执行器，处理工具调用逻辑
- **`websocket-bridge.js`** - WebSocket通信桥，处理实时通信
- **`data-cache.js`** - 数据缓存管理，优化性能

#### 🎯 **应用层 (app/)**
- **`server-orchestrator.js`** - 服务器协调器，统一管理各组件
- **`gui-service.js`** - GUI服务管理，封装GUI服务器功能
- **`gui-server.js`** - GUI Web服务器，提供静态文件服务
- **`gui/`** - GUI界面文件，提供可视化操作界面

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

## 🏗️ 分层架构设计

### 架构设计原则
本项目采用现代化的分层架构设计，遵循以下原则：

#### 🎯 **分层职责**
- **配置层 (config/)**: 统一管理所有配置常量，避免硬编码
- **工具层 (utils/)**: 提供基础工具函数，支撑上层业务
- **核心层 (core/)**: 定义核心接口和协议处理，确保标准化
- **业务层 (business/)**: 实现具体业务逻辑，处理核心功能
- **应用层 (app/)**: 协调各层组件，提供对外服务

#### 🔧 **设计原则**
- **单一职责**: 每个模块只负责一个明确的功能
- **依赖注入**: 通过构造函数注入依赖，降低耦合
- **接口隔离**: 定义清晰的接口，便于测试和扩展
- **开闭原则**: 对扩展开放，对修改封闭

#### 📦 **依赖关系**
```
应用层 (app/)
    ↓ 依赖
业务层 (business/)
    ↓ 依赖  
核心层 (core/)
    ↓ 依赖
工具层 (utils/) + 配置层 (config/)
```

### ⚡ 架构优势
- **可维护性**: 清晰的分层结构，易于理解和维护
- **可扩展性**: 松耦合设计，便于添加新功能
- **可测试性**: 依赖注入，便于单元测试
- **性能优化**: 避免重复加载，提升响应速度

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
