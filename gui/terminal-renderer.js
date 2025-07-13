/**
 * 终端渲染器 - 使用xterm.js处理终端显示
 * 负责创建、管理和渲染终端实例
 */

class TerminalRenderer {
    constructor() {
        this.terminals = new Map(); // sessionId -> terminal instance
        this.fitAddons = new Map(); // sessionId -> fit addon
        this.isXtermLoaded = false;
        
        this.init();
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
            setTimeout(() => this.checkXtermAvailability(), 100);
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
            const terminal = new Terminal({
                cursorBlink: true,
                cursorStyle: 'block',
                fontFamily: 'Consolas, Monaco, "Courier New", monospace',
                fontSize: window.mcpGUI?.settings?.fontSize || 14,
                lineHeight: 1.2,
                theme: this.getTerminalTheme(),
                allowTransparency: true,
                convertEol: true,
                scrollback: 1000,
                tabStopWidth: 4
            });

            // 创建并加载插件
            const fitAddon = new FitAddon.FitAddon();
            const webLinksAddon = new WebLinksAddon.WebLinksAddon();
            
            terminal.loadAddon(fitAddon);
            terminal.loadAddon(webLinksAddon);

            // 存储引用
            this.terminals.set(sessionId, terminal);
            this.fitAddons.set(sessionId, fitAddon);

            // 写入欢迎信息
            this.writeWelcomeMessage(terminal, sessionData);

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
            setTimeout(() => {
                fitAddon.fit();
            }, 100);

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
            console.warn(`终端 ${sessionId} 不存在，无法写入输出`);
            return;
        }

        try {
            if (Array.isArray(output)) {
                output.forEach(line => {
                    if (line.trim()) {
                        // 添加时间戳（如果启用）
                        const timestamp = window.mcpGUI?.settings?.showTimestamps ? 
                            `\x1b[90m[${new Date().toLocaleTimeString()}]\x1b[0m ` : '';
                        
                        terminal.writeln(timestamp + this.processLine(line));
                    }
                });
            } else if (typeof output === 'string') {
                const timestamp = window.mcpGUI?.settings?.showTimestamps ? 
                    `\x1b[90m[${new Date().toLocaleTimeString()}]\x1b[0m ` : '';
                
                terminal.writeln(timestamp + this.processLine(output));
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
                terminal.options.theme = this.getTerminalTheme();
            } catch (error) {
                console.error(`更新终端 ${sessionId} 主题失败:`, error);
            }
        }
    }

    /**
     * 更新所有终端的主题
     */
    updateAllThemes() {
        this.terminals.forEach((terminal, sessionId) => {
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
                setTimeout(() => fitAddon.fit(), 100);
            } catch (error) {
                console.error(`更新终端 ${sessionId} 字体大小失败:`, error);
            }
        }
    }

    /**
     * 更新所有终端的字体大小
     */
    updateAllFontSizes(fontSize) {
        this.terminals.forEach((terminal, sessionId) => {
            this.updateFontSize(sessionId, fontSize);
        });
    }

    /**
     * 获取终端主题配置
     */
    getTerminalTheme() {
        const isDark = window.mcpGUI?.settings?.theme === 'dark';
        
        return {
            background: isDark ? '#1e1e1e' : '#ffffff',
            foreground: isDark ? '#cccccc' : '#333333',
            cursor: isDark ? '#d4d4d4' : '#333333',
            selection: isDark ? '#264f78' : '#add6ff',
            black: isDark ? '#000000' : '#000000',
            red: isDark ? '#cd3131' : '#cd3131',
            green: isDark ? '#0dbc79' : '#00bc00',
            yellow: isDark ? '#e5e510' : '#949800',
            blue: isDark ? '#2472c8' : '#0451a5',
            magenta: isDark ? '#bc3fbc' : '#bc05bc',
            cyan: isDark ? '#11a8cd' : '#0598bc',
            white: isDark ? '#e5e5e5' : '#555555',
            brightBlack: isDark ? '#666666' : '#666666',
            brightRed: isDark ? '#f14c4c' : '#cd3131',
            brightGreen: isDark ? '#23d18b' : '#14ce14',
            brightYellow: isDark ? '#f5f543' : '#b5ba00',
            brightBlue: isDark ? '#3b8eea' : '#0451a5',
            brightMagenta: isDark ? '#d670d6' : '#bc05bc',
            brightCyan: isDark ? '#29b8db' : '#0598bc',
            brightWhite: isDark ? '#e5e5e5' : '#a5a5a5'
        };
    }

    /**
     * 处理输出行，添加颜色和格式
     */
    processLine(line) {
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
     * 清理所有资源
     */
    cleanup() {
        this.terminals.forEach((terminal, sessionId) => {
            this.destroyTerminal(sessionId);
        });
        
        this.terminals.clear();
        this.fitAddons.clear();
        
        console.log('终端渲染器已清理');
    }
}

// 初始化终端渲染器
document.addEventListener('DOMContentLoaded', () => {
    window.terminalRenderer = new TerminalRenderer();
});
