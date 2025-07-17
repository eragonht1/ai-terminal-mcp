/**
 * 终端渲染器模块
 *
 * 该模块使用xterm.js库处理终端的显示和渲染，提供高性能的
 * 终端模拟器功能，包括文本渲染、主题管理、尺寸调整等。
 *
 * 主要功能：
 * - 终端实例创建和管理
 * - 文本渲染和显示
 * - 主题和样式管理
 * - 终端尺寸自适应
 * - 用户交互处理
 *
 * @author MCP Terminal Server Team
 * @version 1.1.0
 */

// ============================================================================
// 配置常量
// ============================================================================

/** 默认字体大小 */
const DEFAULT_FONT_SIZE = 14;

/** 默认行高 */
const DEFAULT_LINE_HEIGHT = 1.2;

/** 默认滚动缓冲区大小 */
const DEFAULT_SCROLLBACK = 1000;

/** 默认制表符宽度 */
const DEFAULT_TAB_STOP_WIDTH = 4;

/** xterm.js检查间隔（毫秒） */
const XTERM_CHECK_INTERVAL = 100;

/** 终端调整大小延迟（毫秒） */
const TERMINAL_RESIZE_DELAY = 100;

/** 终端字体族 */
const FONT_FAMILY = 'Consolas, Monaco, "Courier New", monospace';

// 终端主题配置
const TERMINAL_THEMES = {
    dark: {
        background: '#1e1e1e',
        foreground: '#cccccc',
        cursor: '#d4d4d4',
        selection: '#264f78',
        black: '#000000',
        red: '#cd3131',
        green: '#0dbc79',
        yellow: '#e5e510',
        blue: '#2472c8',
        magenta: '#bc3fbc',
        cyan: '#11a8cd',
        white: '#e5e5e5',
        brightBlack: '#666666',
        brightRed: '#f14c4c',
        brightGreen: '#23d18b',
        brightYellow: '#f5f543',
        brightBlue: '#3b8eea',
        brightMagenta: '#d670d6',
        brightCyan: '#29b8db',
        brightWhite: '#e5e5e5'
    },
    light: {
        background: '#ffffff',
        foreground: '#d4d4d4',
        cursor: '#d4d4d4',
        selection: '#add6ff',
        black: '#000000',
        red: '#cd3131',
        green: '#00bc00',
        yellow: '#949800',
        blue: '#0451a5',
        magenta: '#bc05bc',
        cyan: '#0598bc',
        white: '#555555',
        brightBlack: '#666666',
        brightRed: '#cd3131',
        brightGreen: '#14ce14',
        brightYellow: '#b5ba00',
        brightBlue: '#0451a5',
        brightMagenta: '#bc05bc',
        brightCyan: '#0598bc',
        brightWhite: '#a5a5a5'
    }
};

class TerminalRenderer {
    constructor() {
        this.terminals = new Map(); // sessionId -> terminal instance
        this.fitAddons = new Map(); // sessionId -> fit addon
        this.pendingOutputs = new Map(); // sessionId -> array of pending outputs
        this.isXtermLoaded = false;

        this.init();
    }

    /**
     * 获取终端配置
     */
    _getTerminalConfig() {
        return {
            cursorBlink: true,
            cursorStyle: 'block',
            fontFamily: FONT_FAMILY,
            fontSize: window.mcpGUI?.settings?.fontSize || DEFAULT_FONT_SIZE,
            lineHeight: DEFAULT_LINE_HEIGHT,
            theme: this._getTerminalTheme(),
            allowTransparency: true,
            convertEol: true,
            scrollback: DEFAULT_SCROLLBACK,
            tabStopWidth: DEFAULT_TAB_STOP_WIDTH
        };
    }

    /**
     * 获取终端主题配置
     */
    _getTerminalTheme() {
        const isDark = window.mcpGUI?.settings?.theme === 'dark';
        return TERMINAL_THEMES[isDark ? 'dark' : 'light'];
    }

    /**
     * 创建并加载终端插件
     */
    _createAndLoadAddons(terminal) {
        const fitAddon = new FitAddon.FitAddon();
        const webLinksAddon = new WebLinksAddon.WebLinksAddon();

        terminal.loadAddon(fitAddon);
        terminal.loadAddon(webLinksAddon);

        return { fitAddon, webLinksAddon };
    }

    /**
     * 写入带时间戳的内容
     */
    _writeWithTimestamp(terminal, content) {
        const timestamp = window.mcpGUI?.settings?.showTimestamps ?
            `\x1b[90m[${new Date().toLocaleTimeString()}]\x1b[0m ` : '';

        terminal.writeln(timestamp + this._processLine(content));
    }

    /**
     * 延迟调整终端尺寸
     */
    _delayedFit(fitAddon) {
        setTimeout(() => {
            fitAddon.fit();
        }, TERMINAL_RESIZE_DELAY);
    }

    /**
     * 初始化渲染器
     */
    init() {
        this.checkXtermAvailability();
        console.log('终端渲染器已初始化');
    }

    /**
     * 检查xterm.js是否可用
     */
    checkXtermAvailability() {
        if (typeof Terminal !== 'undefined') {
            this.isXtermLoaded = true;
            console.log('xterm.js已加载');
        } else {
            console.error('xterm.js未加载');
            setTimeout(() => this.checkXtermAvailability(), XTERM_CHECK_INTERVAL);
        }
    }

    /**
     * 创建新的终端实例
     */
    createTerminal(sessionId, sessionData) {
        if (!this.isXtermLoaded) {
            console.error('xterm.js未加载，无法创建终端');
            return null;
        }

        if (this.terminals.has(sessionId)) {
            console.warn(`终端 ${sessionId} 已存在`);
            return this.terminals.get(sessionId);
        }

        try {
            // 创建终端实例
            const terminal = new Terminal(this._getTerminalConfig());

            // 创建并加载插件
            const { fitAddon } = this._createAndLoadAddons(terminal);

            // 存储引用
            this.terminals.set(sessionId, terminal);
            this.fitAddons.set(sessionId, fitAddon);

            // 写入欢迎信息
            this.writeWelcomeMessage(terminal, sessionData);

            // 处理缓存的输出
            this._processPendingOutputs(sessionId);

            console.log(`终端 ${sessionId} 已创建`);
            return terminal;

        } catch (error) {
            console.error(`创建终端 ${sessionId} 失败:`, error);
            return null;
        }
    }

    /**
     * 将终端挂载到DOM元素
     */
    mountTerminal(sessionId, container) {
        const terminal = this.terminals.get(sessionId);
        const fitAddon = this.fitAddons.get(sessionId);

        if (!terminal || !fitAddon) {
            console.error(`终端 ${sessionId} 不存在`);
            return false;
        }

        try {
            // 清空容器
            container.innerHTML = '';
            
            // 挂载终端
            terminal.open(container);
            
            // 调整尺寸
            this._delayedFit(fitAddon);

            // 监听窗口大小变化
            const resizeObserver = new ResizeObserver(() => {
                fitAddon.fit();
            });
            resizeObserver.observe(container);

            console.log(`终端 ${sessionId} 已挂载到DOM`);
            return true;

        } catch (error) {
            console.error(`挂载终端 ${sessionId} 失败:`, error);
            return false;
        }
    }

    /**
     * 写入输出到终端
     */
    writeOutput(sessionId, output) {
        const terminal = this.terminals.get(sessionId);

        if (!terminal) {
            // 终端还未创建，缓存输出
            if (!this.pendingOutputs.has(sessionId)) {
                this.pendingOutputs.set(sessionId, []);
            }
            this.pendingOutputs.get(sessionId).push(output);
            console.log(`终端 ${sessionId} 尚未创建，输出已缓存`);
            return;
        }

        try {
            if (Array.isArray(output)) {
                output.forEach(line => {
                    if (line.trim()) {
                        this._writeWithTimestamp(terminal, line);
                    }
                });
            } else if (typeof output === 'string') {
                this._writeWithTimestamp(terminal, output);
            }

            // 自动滚动到底部
            if (window.mcpGUI?.settings?.autoScroll) {
                terminal.scrollToBottom();
            }

        } catch (error) {
            console.error(`写入终端 ${sessionId} 失败:`, error);
        }
    }

    /**
     * 写入命令到终端
     */
    writeCommand(sessionId, command) {
        const terminal = this.terminals.get(sessionId);
        
        if (!terminal) {
            console.warn(`终端 ${sessionId} 不存在，无法写入命令`);
            return;
        }

        try {
            // 显示命令提示符和命令
            terminal.writeln(`\x1b[32m$\x1b[0m ${command}`);
            
        } catch (error) {
            console.error(`写入命令到终端 ${sessionId} 失败:`, error);
        }
    }

    /**
     * 写入错误信息到终端
     */
    writeError(sessionId, error) {
        const terminal = this.terminals.get(sessionId);
        
        if (!terminal) {
            console.warn(`终端 ${sessionId} 不存在，无法写入错误`);
            return;
        }

        try {
            terminal.writeln(`\x1b[31m错误: ${error}\x1b[0m`);
            
        } catch (error) {
            console.error(`写入错误到终端 ${sessionId} 失败:`, error);
        }
    }

    /**
     * 清空终端
     */
    clearTerminal(sessionId) {
        const terminal = this.terminals.get(sessionId);
        
        if (!terminal) {
            console.warn(`终端 ${sessionId} 不存在，无法清空`);
            return;
        }

        try {
            terminal.clear();
            console.log(`终端 ${sessionId} 已清空`);
            
        } catch (error) {
            console.error(`清空终端 ${sessionId} 失败:`, error);
        }
    }

    /**
     * 销毁终端实例
     */
    destroyTerminal(sessionId) {
        const terminal = this.terminals.get(sessionId);
        const fitAddon = this.fitAddons.get(sessionId);

        if (terminal) {
            try {
                terminal.dispose();
                this.terminals.delete(sessionId);
                console.log(`终端 ${sessionId} 已销毁`);
            } catch (error) {
                console.error(`销毁终端 ${sessionId} 失败:`, error);
            }
        }

        if (fitAddon) {
            this.fitAddons.delete(sessionId);
        }
    }

    /**
     * 调整终端尺寸
     */
    resizeTerminal(sessionId) {
        const fitAddon = this.fitAddons.get(sessionId);
        
        if (fitAddon) {
            try {
                fitAddon.fit();
            } catch (error) {
                console.error(`调整终端 ${sessionId} 尺寸失败:`, error);
            }
        }
    }

    /**
     * 更新终端主题
     */
    updateTheme(sessionId) {
        const terminal = this.terminals.get(sessionId);
        
        if (terminal) {
            try {
                terminal.options.theme = this._getTerminalTheme();
            } catch (error) {
                console.error(`更新终端 ${sessionId} 主题失败:`, error);
            }
        }
    }

    /**
     * 更新所有终端的主题
     */
    updateAllThemes() {
        this.terminals.forEach((_, sessionId) => {
            this.updateTheme(sessionId);
        });
    }

    /**
     * 更新终端字体大小
     */
    updateFontSize(sessionId, fontSize) {
        const terminal = this.terminals.get(sessionId);
        const fitAddon = this.fitAddons.get(sessionId);
        
        if (terminal && fitAddon) {
            try {
                terminal.options.fontSize = fontSize;
                this._delayedFit(fitAddon);
            } catch (error) {
                console.error(`更新终端 ${sessionId} 字体大小失败:`, error);
            }
        }
    }

    /**
     * 更新所有终端的字体大小
     */
    updateAllFontSizes(fontSize) {
        this.terminals.forEach((_, sessionId) => {
            this.updateFontSize(sessionId, fontSize);
        });
    }



    /**
     * 处理输出行，添加颜色和格式
     */
    _processLine(line) {
        // 移除ANSI转义序列（如果需要）
        // line = line.replace(/\x1b\[[0-9;]*m/g, '');

        // 这里可以添加更多的处理逻辑，比如高亮关键词等
        return line;
    }

    /**
     * 写入欢迎信息
     */
    writeWelcomeMessage(terminal, sessionData) {
        const { sessionId, type, cwd, pid } = sessionData;
        
        terminal.writeln('\x1b[36m╭─────────────────────────────────────────────────────────────╮\x1b[0m');
        terminal.writeln('\x1b[36m│\x1b[0m \x1b[1;33mMCP Terminal Session\x1b[0m                                   \x1b[36m│\x1b[0m');
        terminal.writeln('\x1b[36m├─────────────────────────────────────────────────────────────┤\x1b[0m');
        terminal.writeln(`\x1b[36m│\x1b[0m \x1b[32mSession ID:\x1b[0m ${sessionId.substring(0, 8)}...                     \x1b[36m│\x1b[0m`);
        terminal.writeln(`\x1b[36m│\x1b[0m \x1b[32mTerminal Type:\x1b[0m ${type.toUpperCase()}                           \x1b[36m│\x1b[0m`);
        terminal.writeln(`\x1b[36m│\x1b[0m \x1b[32mWorking Directory:\x1b[0m ${cwd}                    \x1b[36m│\x1b[0m`);
        terminal.writeln(`\x1b[36m│\x1b[0m \x1b[32mProcess ID:\x1b[0m ${pid}                                      \x1b[36m│\x1b[0m`);
        terminal.writeln('\x1b[36m╰─────────────────────────────────────────────────────────────╯\x1b[0m');
        terminal.writeln('');
        terminal.writeln('\x1b[90m等待AI命令执行...\x1b[0m');
        terminal.writeln('');
    }

    /**
     * 获取所有终端实例
     */
    getAllTerminals() {
        return Array.from(this.terminals.keys());
    }

    /**
     * 获取终端数量
     */
    getTerminalCount() {
        return this.terminals.size;
    }

    /**
     * 处理缓存的输出
     */
    _processPendingOutputs(sessionId) {
        const pendingOutputs = this.pendingOutputs.get(sessionId);
        if (pendingOutputs && pendingOutputs.length > 0) {
            console.log(`处理终端 ${sessionId} 的 ${pendingOutputs.length} 个缓存输出`);
            pendingOutputs.forEach(output => {
                this.writeOutput(sessionId, output);
            });
            this.pendingOutputs.delete(sessionId);
        }
    }

    /**
     * 清理所有资源
     */
    cleanup() {
        this.terminals.forEach((_, sessionId) => {
            this.destroyTerminal(sessionId);
        });

        this.terminals.clear();
        this.fitAddons.clear();
        this.pendingOutputs.clear();

        console.log('终端渲染器已清理');
    }
}

// 初始化终端渲染器
document.addEventListener('DOMContentLoaded', () => {
    window.terminalRenderer = new TerminalRenderer();
});
