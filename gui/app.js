/**
 * MCP Terminal GUI - 主应用程序
 *
 * 该文件是MCP终端管理器的前端主应用程序，负责协调各个组件
 * 之间的交互，包括WebSocket通信、UI状态管理、设置管理等。
 *
 * 架构设计：
 * - WebSocket客户端：负责与后端通信
 * - UI状态管理器：管理界面状态和用户交互
 * - 设置管理器：处理用户偏好设置
 * - 会话管理器：管理终端会话
 * - 终端渲染器：处理终端输出显示
 *
 * @author MCP Terminal Server Team
 * @version 1.1.0
 */

// ============================================================================
// 配置常量
// ============================================================================

/**
 * GUI应用配置
 * @readonly
 * @type {Object}
 */
const GUI_CONFIG = {
    /** WebSocket服务器URL */
    WEBSOCKET_URL: 'ws://localhost:8573',
    /** 最大重连尝试次数 */
    MAX_RECONNECT_ATTEMPTS: 5,
    /** 重连延迟时间（毫秒） */
    RECONNECT_DELAY: 2000,
    /** 时间更新间隔（毫秒） */
    TIME_UPDATE_INTERVAL: 1000,
    /** 默认用户设置 */
    DEFAULT_SETTINGS: {
        theme: 'dark',
        fontSize: 14,
        autoScroll: true,
        showTimestamps: true
    }
};

// ============================================================================
// WebSocket客户端管理器
// ============================================================================

/**
 * WebSocket客户端管理器
 *
 * 专门负责WebSocket连接的建立、维护、重连和消息处理。
 * 提供可靠的通信机制，包括自动重连和错误处理。
 */
class WebSocketClient {
    /**
     * 构造函数
     * @param {Object} config - 配置对象
     * @param {Object} messageHandler - 消息处理器对象
     */
    constructor(config, messageHandler) {
        this.config = config;
        this.messageHandler = messageHandler;
        this.ws = null;
        this.isConnected = false;
        this.reconnectAttempts = 0;
    }

    /**
     * 建立WebSocket连接
     *
     * 创建WebSocket实例并设置事件处理器，包括连接建立、
     * 消息接收、连接关闭和错误处理。
     */
    connect() {
        try {
            this.ws = new WebSocket(this.config.WEBSOCKET_URL);
            this._setupEventHandlers();
        } catch (error) {
            console.error('创建WebSocket连接失败:', error);
            this.messageHandler.onConnectionChange('连接失败', false);
        }
    }

    /**
     * 设置WebSocket事件处理器
     * @private
     */
    _setupEventHandlers() {
        this.ws.onopen = () => this._handleOpen();
        this.ws.onmessage = (event) => this._handleMessage(event);
        this.ws.onclose = () => this._handleClose();
        this.ws.onerror = (error) => this._handleError(error);
    }

    /**
     * 处理连接建立事件
     * @private
     */
    _handleOpen() {
        console.log('WebSocket连接已建立');
        this.isConnected = true;
        this.reconnectAttempts = 0;
        this.messageHandler.onConnectionChange('已连接', true);
    }

    /**
     * 处理消息接收事件
     * @param {MessageEvent} event - 消息事件
     * @private
     */
    _handleMessage(event) {
        try {
            const data = JSON.parse(event.data);
            this.messageHandler.onMessage(data);
        } catch (error) {
            console.error('解析WebSocket消息失败:', error);
        }
    }

    /**
     * 处理连接关闭事件
     * @private
     */
    _handleClose() {
        console.log('WebSocket连接已关闭');
        this.isConnected = false;
        this.messageHandler.onConnectionChange('连接断开', false);
        this.attemptReconnect();
    }

    /**
     * 处理连接错误事件
     * @param {Event} error - 错误事件
     * @private
     */
    _handleError(error) {
        console.error('WebSocket错误:', error);
        this.messageHandler.onConnectionChange('连接错误', false);
    }

    /**
     * 尝试重新连接
     *
     * 实现指数退避重连策略，在达到最大重连次数前持续尝试重连。
     * 每次重连都会更新UI状态以通知用户当前的重连进度。
     */
    attemptReconnect() {
        if (this._shouldStopReconnecting()) {
            this._handleReconnectFailure();
            return;
        }

        this._incrementReconnectAttempts();
        this._scheduleReconnect();
    }

    /**
     * 检查是否应该停止重连
     * @returns {boolean} 是否应该停止重连
     * @private
     */
    _shouldStopReconnecting() {
        return this.reconnectAttempts >= this.config.MAX_RECONNECT_ATTEMPTS;
    }

    /**
     * 处理重连失败
     * @private
     */
    _handleReconnectFailure() {
        console.log('达到最大重连次数，停止重连');
        this.messageHandler.onConnectionChange('连接失败', false);
    }

    /**
     * 增加重连尝试次数并更新状态
     * @private
     */
    _incrementReconnectAttempts() {
        this.reconnectAttempts++;
        const statusMessage = `重连中 (${this.reconnectAttempts}/${this.config.MAX_RECONNECT_ATTEMPTS})`;
        this.messageHandler.onConnectionChange(statusMessage, false);
    }

    /**
     * 安排下次重连
     * @private
     */
    _scheduleReconnect() {
        setTimeout(() => {
            console.log(`尝试重连 (${this.reconnectAttempts}/${this.config.MAX_RECONNECT_ATTEMPTS})`);
            this.connect();
        }, this.config.RECONNECT_DELAY);
    }

    /**
     * 发送消息到WebSocket服务器
     * @param {Object} message - 要发送的消息对象
     * @returns {boolean} 是否成功发送
     */
    send(message) {
        if (this._isConnectionReady()) {
            this.ws.send(JSON.stringify(message));
            return true;
        }
        console.warn('WebSocket连接未就绪，无法发送消息');
        return false;
    }

    /**
     * 检查连接是否就绪
     * @returns {boolean} 连接是否就绪
     * @private
     */
    _isConnectionReady() {
        return this.ws && this.ws.readyState === WebSocket.OPEN;
    }

    /**
     * 关闭WebSocket连接
     *
     * 优雅地关闭WebSocket连接，清理资源并重置状态。
     */
    close() {
        if (this.ws) {
            this.ws.close();
            this.ws = null;
            this.isConnected = false;
        }
    }
}

/**
 * 设置管理器 - 专门负责设置的加载、保存和应用
 */
class SettingsManager {
    constructor(config) {
        this.config = config;
        this.settings = this.loadSettings();
    }

    /**
     * 加载设置
     */
    loadSettings() {
        try {
            const saved = localStorage.getItem('mcp-terminal-settings');
            return saved ? { ...this.config.DEFAULT_SETTINGS, ...JSON.parse(saved) } : this.config.DEFAULT_SETTINGS;
        } catch (error) {
            console.error('加载设置失败:', error);
            return this.config.DEFAULT_SETTINGS;
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
     * 更新设置
     */
    updateSetting(key, value) {
        this.settings[key] = value;
        this.saveSettings();
    }

    /**
     * 获取设置
     */
    getSetting(key) {
        return this.settings[key];
    }

    /**
     * 获取所有设置
     */
    getAllSettings() {
        return { ...this.settings };
    }

    /**
     * 应用设置到DOM
     */
    applySettings() {
        // 应用主题
        document.body.className = `theme-${this.settings.theme}`;

        // 更新设置面板的值
        const themeSelect = document.getElementById('terminal-theme');
        const fontSizeInput = document.getElementById('font-size');
        const fontSizeValue = document.getElementById('font-size-value');
        const autoScrollCheck = document.getElementById('auto-scroll');
        const showTimestampsCheck = document.getElementById('show-timestamps');

        if (themeSelect) themeSelect.value = this.settings.theme;
        if (fontSizeInput) fontSizeInput.value = this.settings.fontSize;
        if (fontSizeValue) fontSizeValue.textContent = `${this.settings.fontSize}px`;
        if (autoScrollCheck) autoScrollCheck.checked = this.settings.autoScroll;
        if (showTimestampsCheck) showTimestampsCheck.checked = this.settings.showTimestamps;
    }
}

/**
 * UI状态管理器 - 专门负责UI状态和DOM操作
 */
class UIStateManager {
    constructor(config) {
        this.config = config;
        this.sessions = new Map();
        this.eventHistory = [];
        this.elements = {};
        this.initElements();
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
     * 更新元素文本内容
     */
    updateElementText(elementId, text) {
        const element = this.elements[elementId];
        if (element) {
            element.textContent = text;
        }
    }

    /**
     * 切换元素CSS类
     */
    toggleElementClass(element, className, condition) {
        if (condition) {
            element.classList.add(className);
        } else {
            element.classList.remove(className);
        }
    }

    /**
     * 显示通知消息
     */
    showNotification(message, type = 'info') {
        // 简单的控制台通知，后续可以实现更好的UI通知
        console.log(`[${type.toUpperCase()}] ${message}`);
    }

    /**
     * 更新连接状态显示
     */
    updateConnectionStatus(text, connected) {
        const indicator = this.elements.connectionStatus?.querySelector('.indicator-dot');
        const textElement = this.elements.connectionStatus?.querySelector('.indicator-text');

        if (textElement) textElement.textContent = text;
        if (indicator) this.toggleElementClass(indicator, 'connected', connected);
    }

    /**
     * 更新各种状态显示
     */
    updateWebSocketStatus(status) {
        this.updateElementText('websocketStatus', `WebSocket: ${status}`);
    }

    updateSessionCount() {
        const count = window.sessionManager ? window.sessionManager.sessions.size : 0;
        this.updateElementText('sessionCount', `会话: ${count}`);
    }

    updateEventCount() {
        this.updateElementText('totalEvents', `事件: ${this.eventHistory.length}`);
    }

    updateLastActivity() {
        this.updateElementText('lastActivity', `最后活动: ${new Date().toLocaleTimeString()}`);
    }

    updateTime() {
        this.updateElementText('currentTime', new Date().toLocaleTimeString());
        setTimeout(() => this.updateTime(), this.config.TIME_UPDATE_INTERVAL);
    }

    /**
     * 显示/隐藏空白状态
     */
    hideEmptyState() {
        if (this.elements.emptyState) {
            this.elements.emptyState.style.display = 'none';
        }
    }

    showEmptyState() {
        if (this.elements.emptyState) {
            this.elements.emptyState.style.display = 'flex';
        }
    }

    /**
     * 切换设置面板
     */
    toggleSettings() {
        if (this.elements.settingsPanel) {
            this.elements.settingsPanel.classList.toggle('open');
        }
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
     * 添加事件到历史
     */
    addEventToHistory(event) {
        this.eventHistory.push(event);
        this.updateEventCount();
        this.updateLastActivity();
    }
}

/**
 * 重构后的主GUI类 - 组合各个职责明确的组件
 */
class MCPTerminalGUI {
    constructor() {
        // 注入配置
        this.config = GUI_CONFIG;

        // 创建各个管理器组件
        this.settingsManager = new SettingsManager(this.config);
        this.uiStateManager = new UIStateManager(this.config);

        // 创建WebSocket客户端，注入消息处理器
        this.wsClient = new WebSocketClient(this.config, {
            onConnectionChange: (status, connected) => {
                this.uiStateManager.updateConnectionStatus(status, connected);
                this.uiStateManager.updateWebSocketStatus(status);
            },
            onMessage: (data) => this.handleWebSocketMessage(data)
        });

        // 初始化
        this.init();
    }

    /**
     * 初始化应用
     */
    init() {
        this.initEventListeners();
        this.wsClient.connect();
        this.uiStateManager.updateTime();
        this.settingsManager.applySettings();

        console.log('MCP Terminal GUI 已初始化（重构版本）');
    }

    /**
     * 初始化事件监听器
     */
    initEventListeners() {
        // 设置按钮
        this.uiStateManager.elements.settingsBtn?.addEventListener('click', () => {
            this.uiStateManager.toggleSettings();
        });

        this.uiStateManager.elements.closeSettings?.addEventListener('click', () => {
            this.uiStateManager.toggleSettings();
        });

        // 清除历史按钮
        this.uiStateManager.elements.clearHistory?.addEventListener('click', () => {
            this.uiStateManager.clearHistory();
        });

        // 新建标签按钮
        this.uiStateManager.elements.newTabBtn?.addEventListener('click', () => {
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

        terminalTheme?.addEventListener('change', (e) => {
            this.settingsManager.updateSetting('theme', e.target.value);
            this.settingsManager.applySettings();
        });

        fontSize?.addEventListener('input', (e) => {
            this.settingsManager.updateSetting('fontSize', parseInt(e.target.value));
            if (fontSizeValue) fontSizeValue.textContent = `${e.target.value}px`;
            this.settingsManager.applySettings();
        });

        autoScroll?.addEventListener('change', (e) => {
            this.settingsManager.updateSetting('autoScroll', e.target.checked);
        });

        showTimestamps?.addEventListener('change', (e) => {
            this.settingsManager.updateSetting('showTimestamps', e.target.checked);
        });
    }

    /**
     * 处理WebSocket消息
     */
    handleWebSocketMessage(data) {
        const { type, sessionId, data: eventData } = data;

        // 添加到事件历史
        this.uiStateManager.addEventToHistory(data);

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

            case 'ping':
                this.handlePing(data);
                break;

            default:
                console.log('未知消息类型:', type);
        }
    }

    /**
     * 处理各种事件
     */
    handleConnectionEstablished(data) {
        console.log('连接已建立:', data);
        this.uiStateManager.showNotification('GUI界面已连接到MCP服务器', 'success');
    }

    handleSessionCreated(sessionId, data) {
        console.log('会话已创建:', sessionId, data);

        if (window.sessionManager) {
            window.sessionManager.createSession(sessionId, data);
        }

        this.uiStateManager.updateSessionCount();
        this.uiStateManager.hideEmptyState();
    }

    handleTerminalOutput(sessionId, data) {
        if (window.terminalRenderer) {
            window.terminalRenderer.writeOutput(sessionId, data.output);
        }
    }

    handleSessionClosed(sessionId, data) {
        console.log('会话已关闭:', sessionId, data);

        if (window.sessionManager) {
            window.sessionManager.closeSession(sessionId);
        }

        this.uiStateManager.updateSessionCount();
    }

    handleToolCall(_sessionId, data) {
        console.log('工具调用:', data);
        this.uiStateManager.showNotification(`AI调用工具: ${data.tool}`, 'info');
    }

    handleError(_sessionId, data) {
        console.error('收到错误事件:', data);
        this.uiStateManager.showNotification(`错误: ${data.error}`, 'error');
    }

    handleSessionSync(sessionId, data) {
        console.log('会话同步:', sessionId, data);

        if (window.sessionManager) {
            window.sessionManager.syncSession(sessionId, data);
        }

        this.uiStateManager.updateSessionCount();
        this.uiStateManager.hideEmptyState();
    }

    handlePing(data) {
        // 响应pong消息
        this.wsClient.send({
            type: 'pong',
            timestamp: new Date().toISOString(),
            originalTimestamp: data.timestamp
        });
        console.log('已响应ping消息');
    }

    /**
     * 创建新标签
     */
    createNewTab() {
        // 这个功能暂时不实现，因为会话是由AI自动创建的
        this.uiStateManager.showNotification('会话由AI自动创建', 'info');
    }

    /**
     * 处理键盘快捷键
     */
    handleKeyboard(e) {
        if (e.ctrlKey) {
            switch (e.key) {
                case ',':
                    e.preventDefault();
                    this.uiStateManager.toggleSettings();
                    break;
                case 'l':
                    e.preventDefault();
                    this.uiStateManager.clearHistory();
                    break;
            }
        }
    }

    /**
     * 清理资源
     */
    cleanup() {
        this.wsClient.close();
    }
}

// ============================================================================
// 主入口 - 初始化重构后的GUI应用
// ============================================================================

// 初始化应用
document.addEventListener('DOMContentLoaded', () => {
    window.mcpGUI = new MCPTerminalGUI();
});
