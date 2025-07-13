/**
 * MCP Terminal GUI - 主应用逻辑
 * 负责WebSocket连接、事件处理和界面状态管理
 */

class MCPTerminalGUI {
    constructor() {
        this.ws = null;
        this.isConnected = false;
        this.reconnectAttempts = 0;
        this.maxReconnectAttempts = 5;
        this.reconnectDelay = 2000;
        
        // 状态管理
        this.sessions = new Map();
        this.eventHistory = [];
        this.settings = this.loadSettings();
        
        // DOM元素
        this.elements = {};
        
        // 初始化
        this.init();
    }

    /**
     * 初始化应用
     */
    init() {
        this.initElements();
        this.initEventListeners();
        this.initWebSocket();
        this.updateTime();
        this.applySettings();
        
        console.log('MCP Terminal GUI 已初始化');
    }

    /**
     * 初始化DOM元素引用
     */
    initElements() {
        this.elements = {
            connectionStatus: document.getElementById('connection-status'),
            sessionCount: document.getElementById('session-count'),
            currentTime: document.getElementById('current-time'),
            tabBar: document.getElementById('tab-bar'),
            newTabBtn: document.getElementById('new-tab-btn'),
            terminalContent: document.getElementById('terminal-content'),
            emptyState: document.getElementById('empty-state'),
            websocketStatus: document.getElementById('websocket-status'),
            lastActivity: document.getElementById('last-activity'),
            totalEvents: document.getElementById('total-events'),
            clearHistory: document.getElementById('clear-history'),
            settingsBtn: document.getElementById('settings-btn'),
            settingsPanel: document.getElementById('settings-panel'),
            closeSettings: document.getElementById('close-settings')
        };
    }

    /**
     * 初始化事件监听器
     */
    initEventListeners() {
        // 设置按钮
        this.elements.settingsBtn.addEventListener('click', () => {
            this.toggleSettings();
        });

        this.elements.closeSettings.addEventListener('click', () => {
            this.toggleSettings();
        });

        // 清除历史按钮
        this.elements.clearHistory.addEventListener('click', () => {
            this.clearHistory();
        });

        // 新建标签按钮
        this.elements.newTabBtn.addEventListener('click', () => {
            this.createNewTab();
        });

        // 设置面板事件
        this.initSettingsEvents();

        // 窗口事件
        window.addEventListener('beforeunload', () => {
            this.cleanup();
        });

        // 键盘快捷键
        document.addEventListener('keydown', (e) => {
            this.handleKeyboard(e);
        });
    }

    /**
     * 初始化设置面板事件
     */
    initSettingsEvents() {
        const terminalTheme = document.getElementById('terminal-theme');
        const fontSize = document.getElementById('font-size');
        const fontSizeValue = document.getElementById('font-size-value');
        const autoScroll = document.getElementById('auto-scroll');
        const showTimestamps = document.getElementById('show-timestamps');

        terminalTheme.addEventListener('change', (e) => {
            this.settings.theme = e.target.value;
            this.saveSettings();
            this.applySettings();
        });

        fontSize.addEventListener('input', (e) => {
            this.settings.fontSize = parseInt(e.target.value);
            fontSizeValue.textContent = `${e.target.value}px`;
            this.saveSettings();
            this.applySettings();
        });

        autoScroll.addEventListener('change', (e) => {
            this.settings.autoScroll = e.target.checked;
            this.saveSettings();
        });

        showTimestamps.addEventListener('change', (e) => {
            this.settings.showTimestamps = e.target.checked;
            this.saveSettings();
        });
    }

    /**
     * 初始化WebSocket连接
     */
    initWebSocket() {
        const wsUrl = 'ws://localhost:8573';
        
        try {
            this.ws = new WebSocket(wsUrl);
            
            this.ws.onopen = () => {
                console.log('WebSocket连接已建立');
                this.isConnected = true;
                this.reconnectAttempts = 0;
                this.updateConnectionStatus('已连接', true);
                this.updateWebSocketStatus('已连接');
            };

            this.ws.onmessage = (event) => {
                try {
                    const data = JSON.parse(event.data);
                    this.handleWebSocketMessage(data);
                } catch (error) {
                    console.error('解析WebSocket消息失败:', error);
                }
            };

            this.ws.onclose = () => {
                console.log('WebSocket连接已关闭');
                this.isConnected = false;
                this.updateConnectionStatus('连接断开', false);
                this.updateWebSocketStatus('连接断开');
                this.attemptReconnect();
            };

            this.ws.onerror = (error) => {
                console.error('WebSocket错误:', error);
                this.updateConnectionStatus('连接错误', false);
                this.updateWebSocketStatus('连接错误');
            };

        } catch (error) {
            console.error('创建WebSocket连接失败:', error);
            this.updateConnectionStatus('连接失败', false);
            this.updateWebSocketStatus('连接失败');
        }
    }

    /**
     * 处理WebSocket消息
     */
    handleWebSocketMessage(data) {
        const { type, timestamp, sessionId, data: eventData } = data;
        
        // 添加到事件历史
        this.eventHistory.push(data);
        this.updateEventCount();
        this.updateLastActivity();

        console.log('收到WebSocket消息:', type, data);

        switch (type) {
            case 'connection_established':
                this.handleConnectionEstablished(eventData);
                break;

            case 'session_created':
                this.handleSessionCreated(sessionId, eventData);
                break;

            case 'terminal_output':
                this.handleTerminalOutput(sessionId, eventData);
                break;

            case 'session_closed':
                this.handleSessionClosed(sessionId, eventData);
                break;

            case 'tool_call':
                this.handleToolCall(sessionId, eventData);
                break;

            case 'error_occurred':
                this.handleError(sessionId, eventData);
                break;

            case 'session_sync':
                this.handleSessionSync(sessionId, eventData);
                break;

            default:
                console.log('未知消息类型:', type);
        }
    }

    /**
     * 处理连接建立事件
     */
    handleConnectionEstablished(data) {
        console.log('连接已建立:', data);
        this.showNotification('GUI界面已连接到MCP服务器', 'success');
    }

    /**
     * 处理会话创建事件
     */
    handleSessionCreated(sessionId, data) {
        console.log('会话已创建:', sessionId, data);
        
        // 创建新的终端标签
        if (window.sessionManager) {
            window.sessionManager.createSession(sessionId, data);
        }
        
        this.updateSessionCount();
        this.hideEmptyState();
    }

    /**
     * 处理终端输出事件
     */
    handleTerminalOutput(sessionId, data) {
        if (window.terminalRenderer) {
            window.terminalRenderer.writeOutput(sessionId, data.output);
        }
    }

    /**
     * 处理会话关闭事件
     */
    handleSessionClosed(sessionId, data) {
        console.log('会话已关闭:', sessionId, data);
        
        if (window.sessionManager) {
            window.sessionManager.closeSession(sessionId);
        }
        
        this.updateSessionCount();
    }

    /**
     * 处理工具调用事件
     */
    handleToolCall(sessionId, data) {
        console.log('工具调用:', data);
        this.showNotification(`AI调用工具: ${data.tool}`, 'info');
    }

    /**
     * 处理错误事件
     */
    handleError(sessionId, data) {
        console.error('收到错误事件:', data);
        this.showNotification(`错误: ${data.error}`, 'error');
    }

    /**
     * 处理会话同步事件
     */
    handleSessionSync(sessionId, data) {
        console.log('会话同步:', sessionId, data);
        
        if (window.sessionManager) {
            window.sessionManager.syncSession(sessionId, data);
        }
    }

    /**
     * 尝试重新连接
     */
    attemptReconnect() {
        if (this.reconnectAttempts >= this.maxReconnectAttempts) {
            console.log('达到最大重连次数，停止重连');
            this.updateConnectionStatus('连接失败', false);
            return;
        }

        this.reconnectAttempts++;
        this.updateConnectionStatus(`重连中 (${this.reconnectAttempts}/${this.maxReconnectAttempts})`, false);

        setTimeout(() => {
            console.log(`尝试重连 (${this.reconnectAttempts}/${this.maxReconnectAttempts})`);
            this.initWebSocket();
        }, this.reconnectDelay);
    }

    /**
     * 更新连接状态显示
     */
    updateConnectionStatus(text, connected) {
        const indicator = this.elements.connectionStatus.querySelector('.indicator-dot');
        const textElement = this.elements.connectionStatus.querySelector('.indicator-text');
        
        textElement.textContent = text;
        
        if (connected) {
            indicator.classList.add('connected');
        } else {
            indicator.classList.remove('connected');
        }
    }

    /**
     * 更新WebSocket状态
     */
    updateWebSocketStatus(status) {
        this.elements.websocketStatus.textContent = `WebSocket: ${status}`;
    }

    /**
     * 更新会话计数
     */
    updateSessionCount() {
        const count = this.sessions.size;
        this.elements.sessionCount.textContent = `会话: ${count}`;
    }

    /**
     * 更新事件计数
     */
    updateEventCount() {
        this.elements.totalEvents.textContent = `事件: ${this.eventHistory.length}`;
    }

    /**
     * 更新最后活动时间
     */
    updateLastActivity() {
        const now = new Date();
        this.elements.lastActivity.textContent = `最后活动: ${now.toLocaleTimeString()}`;
    }

    /**
     * 更新当前时间
     */
    updateTime() {
        const now = new Date();
        this.elements.currentTime.textContent = now.toLocaleTimeString();
        
        setTimeout(() => this.updateTime(), 1000);
    }

    /**
     * 隐藏空白状态
     */
    hideEmptyState() {
        this.elements.emptyState.style.display = 'none';
    }

    /**
     * 显示空白状态
     */
    showEmptyState() {
        this.elements.emptyState.style.display = 'flex';
    }

    /**
     * 切换设置面板
     */
    toggleSettings() {
        this.elements.settingsPanel.classList.toggle('open');
    }

    /**
     * 清除历史记录
     */
    clearHistory() {
        this.eventHistory = [];
        this.updateEventCount();
        this.showNotification('历史记录已清除', 'success');
    }

    /**
     * 创建新标签
     */
    createNewTab() {
        // 这个功能暂时不实现，因为会话是由AI自动创建的
        this.showNotification('会话由AI自动创建', 'info');
    }

    /**
     * 处理键盘快捷键
     */
    handleKeyboard(e) {
        if (e.ctrlKey) {
            switch (e.key) {
                case ',':
                    e.preventDefault();
                    this.toggleSettings();
                    break;
                case 'l':
                    e.preventDefault();
                    this.clearHistory();
                    break;
            }
        }
    }

    /**
     * 显示通知
     */
    showNotification(message, type = 'info') {
        // 简单的控制台通知，后续可以实现更好的UI通知
        console.log(`[${type.toUpperCase()}] ${message}`);
    }

    /**
     * 加载设置
     */
    loadSettings() {
        const defaultSettings = {
            theme: 'dark',
            fontSize: 14,
            autoScroll: true,
            showTimestamps: true
        };

        try {
            const saved = localStorage.getItem('mcp-terminal-settings');
            return saved ? { ...defaultSettings, ...JSON.parse(saved) } : defaultSettings;
        } catch (error) {
            console.error('加载设置失败:', error);
            return defaultSettings;
        }
    }

    /**
     * 保存设置
     */
    saveSettings() {
        try {
            localStorage.setItem('mcp-terminal-settings', JSON.stringify(this.settings));
        } catch (error) {
            console.error('保存设置失败:', error);
        }
    }

    /**
     * 应用设置
     */
    applySettings() {
        // 应用主题
        document.body.className = `theme-${this.settings.theme}`;
        
        // 更新设置面板的值
        document.getElementById('terminal-theme').value = this.settings.theme;
        document.getElementById('font-size').value = this.settings.fontSize;
        document.getElementById('font-size-value').textContent = `${this.settings.fontSize}px`;
        document.getElementById('auto-scroll').checked = this.settings.autoScroll;
        document.getElementById('show-timestamps').checked = this.settings.showTimestamps;
    }

    /**
     * 清理资源
     */
    cleanup() {
        if (this.ws) {
            this.ws.close();
        }
    }
}

// 初始化应用
document.addEventListener('DOMContentLoaded', () => {
    window.mcpGUI = new MCPTerminalGUI();
});
