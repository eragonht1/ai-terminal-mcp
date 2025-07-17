/**
 * 会话管理器模块
 *
 * 该模块负责管理终端会话的标签页和面板，提供会话的创建、
 * 切换、关闭等功能，以及会话状态的可视化管理。
 *
 * 主要功能：
 * - 会话标签页管理
 * - 会话面板切换
 * - 会话状态跟踪
 * - 用户界面更新
 *
 * @author MCP Terminal Server Team
 * @version 1.1.0
 */

// ============================================================================
// 配置常量
// ============================================================================

/** 会话调整大小延迟时间（毫秒） */
const SESSION_RESIZE_DELAY = 100;

/** 会话ID显示长度 */
const SESSION_ID_DISPLAY_LENGTH = 8;

// ============================================================================
// 会话管理器类
// ============================================================================

/**
 * 会话管理器
 *
 * 负责管理所有终端会话的生命周期，包括标签页的创建、切换、
 * 关闭等操作，以及会话状态的可视化展示。
 */
class SessionManager {
    /**
     * 构造函数
     *
     * 初始化会话管理器，设置数据结构和DOM元素引用，
     * 并调用初始化方法完成设置。
     */
    constructor() {
        // 数据结构
        this.sessions = new Map(); // sessionId -> session data
        this.activeSessions = new Set(); // 活跃的会话ID
        this.currentSessionId = null;

        // DOM元素引用
        this._initializeDOMReferences();

        // 初始化组件
        this.init();
    }

    /**
     * 初始化DOM元素引用
     * @private
     */
    _initializeDOMReferences() {
        this.tabBar = document.getElementById('tab-bar');
        this.terminalContent = document.getElementById('terminal-content');
        this.emptyState = document.getElementById('empty-state');
    }

    /**
     * 创建DOM元素
     */
    _createElement(tag, className, content = '') {
        const element = document.createElement(tag);
        if (className) element.className = className;
        if (content) element.textContent = content;
        return element;
    }

    /**
     * 创建会话数据对象
     */
    _createSessionData(sessionData) {
        return {
            ...sessionData,
            createdAt: new Date(),
            isActive: false,
            output: []
        };
    }

    /**
     * 获取会话标题
     */
    _getSessionTitle(sessionData) {
        const { type, cwd } = sessionData;
        const dirName = cwd.split('\\').pop() || cwd.split('/').pop() || 'Terminal';
        return `${type === 'powershell' ? 'PS' : 'CMD'}: ${dirName}`;
    }

    /**
     * 延迟执行终端调整
     */
    _delayedTerminalResize(sessionId) {
        setTimeout(() => {
            window.terminalRenderer?.resizeTerminal(sessionId);
        }, SESSION_RESIZE_DELAY);
    }

    /**
     * 延迟执行终端挂载
     */
    _delayedTerminalMount(sessionId, container) {
        setTimeout(() => {
            window.terminalRenderer?.mountTerminal(sessionId, container);
        }, SESSION_RESIZE_DELAY);
    }

    /**
     * 初始化会话管理器
     */
    init() {
        console.log('会话管理器已初始化');
    }

    /**
     * 创建新会话
     */
    createSession(sessionId, sessionData) {
        if (this.sessions.has(sessionId)) {
            console.warn(`会话 ${sessionId} 已存在`);
            return;
        }

        // 存储会话数据
        this.sessions.set(sessionId, this._createSessionData(sessionData));

        // 创建终端实例
        const terminal = window.terminalRenderer?.createTerminal(sessionId, sessionData);
        if (!terminal) {
            console.error(`创建会话 ${sessionId} 的终端失败`);
            return;
        }

        // 创建标签
        this.createTab(sessionId, sessionData);
        
        // 创建终端面板
        this.createTerminalPanel(sessionId, sessionData);
        
        // 激活新会话
        this.activateSession(sessionId);
        
        // 隐藏空白状态
        this.hideEmptyState();
        
        console.log(`会话 ${sessionId} 已创建`);
    }

    /**
     * 创建会话标签
     */
    createTab(sessionId, sessionData) {
        const tab = this._createElement('div', 'tab');
        tab.dataset.sessionId = sessionId;

        // 标签标题
        const title = this._createElement('span', 'tab-title', this._getSessionTitle(sessionData));
        title.title = `${sessionData.type.toUpperCase()} - ${sessionData.cwd}`;

        // 关闭按钮
        const closeBtn = this._createElement('span', 'tab-close', '×');
        closeBtn.title = '关闭会话';
        
        // 事件监听
        tab.addEventListener('click', (e) => {
            if (e.target !== closeBtn) {
                this.activateSession(sessionId);
            }
        });
        
        closeBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            this.closeSession(sessionId);
        });
        
        tab.appendChild(title);
        tab.appendChild(closeBtn);
        
        // 插入到新建按钮之前
        const newTabBtn = document.getElementById('new-tab-btn');
        this.tabBar.insertBefore(tab, newTabBtn);
    }

    /**
     * 创建终端面板
     */
    createTerminalPanel(sessionId, sessionData) {
        const panel = this._createElement('div', 'terminal-panel');
        panel.dataset.sessionId = sessionId;

        // 会话信息栏
        const sessionInfo = this._createElement('div', 'session-info');
        sessionInfo.innerHTML = `
            <div>
                <span class="session-id">${sessionId.substring(0, SESSION_ID_DISPLAY_LENGTH)}...</span>
                <span class="session-type">${sessionData.type.toUpperCase()}</span>
                <span class="session-cwd">${sessionData.cwd}</span>
            </div>
            <div>
                <span>PID: ${sessionData.pid}</span>
                <span>创建时间: ${new Date().toLocaleTimeString()}</span>
            </div>
        `;

        // 终端输出区域
        const terminalOutput = this._createElement('div', 'terminal-output');
        terminalOutput.id = `terminal-${sessionId}`;

        panel.appendChild(sessionInfo);
        panel.appendChild(terminalOutput);

        this.terminalContent.appendChild(panel);

        // 挂载终端到DOM
        this._delayedTerminalMount(sessionId, terminalOutput);
    }

    /**
     * 激活会话
     */
    activateSession(sessionId) {
        if (!this.sessions.has(sessionId)) {
            console.warn(`会话 ${sessionId} 不存在`);
            return;
        }

        // 取消激活当前会话
        if (this.currentSessionId) {
            this.deactivateSession(this.currentSessionId);
        }

        // 激活新会话
        this.currentSessionId = sessionId;
        
        // 更新标签状态
        const tab = this.getTabElement(sessionId);
        if (tab) {
            tab.classList.add('active');
        }
        
        // 显示对应的终端面板
        const panel = this.getPanelElement(sessionId);
        if (panel) {
            panel.classList.add('active');
        }
        
        // 更新会话数据
        const sessionData = this.sessions.get(sessionId);
        sessionData.isActive = true;
        sessionData.lastActivated = new Date();
        
        // 调整终端尺寸
        this._delayedTerminalResize(sessionId);
        
        console.log(`会话 ${sessionId} 已激活`);
    }

    /**
     * 取消激活会话
     */
    deactivateSession(sessionId) {
        if (!this.sessions.has(sessionId)) {
            return;
        }

        // 更新标签状态
        const tab = this.getTabElement(sessionId);
        if (tab) {
            tab.classList.remove('active');
        }
        
        // 隐藏终端面板
        const panel = this.getPanelElement(sessionId);
        if (panel) {
            panel.classList.remove('active');
        }
        
        // 更新会话数据
        const sessionData = this.sessions.get(sessionId);
        sessionData.isActive = false;
    }

    /**
     * 关闭会话
     */
    closeSession(sessionId) {
        if (!this.sessions.has(sessionId)) {
            console.warn(`会话 ${sessionId} 不存在`);
            return;
        }

        // 移除标签
        const tab = this.getTabElement(sessionId);
        if (tab) {
            tab.remove();
        }
        
        // 移除终端面板
        const panel = this.getPanelElement(sessionId);
        if (panel) {
            panel.remove();
        }
        
        // 销毁终端实例
        window.terminalRenderer?.destroyTerminal(sessionId);
        
        // 移除会话数据
        this.sessions.delete(sessionId);
        this.activeSessions.delete(sessionId);
        
        // 如果关闭的是当前激活的会话，激活其他会话
        if (this.currentSessionId === sessionId) {
            this.currentSessionId = null;
            this.activateNextSession();
        }
        
        // 如果没有会话了，显示空白状态
        if (this.sessions.size === 0) {
            this.showEmptyState();
        }
        
        console.log(`会话 ${sessionId} 已关闭`);
    }

    /**
     * 同步会话数据
     */
    syncSession(sessionId, sessionData) {
        if (this.sessions.has(sessionId)) {
            // 更新现有会话
            const existing = this.sessions.get(sessionId);
            this.sessions.set(sessionId, { ...existing, ...sessionData });
        } else {
            // 创建新会话
            this.createSession(sessionId, sessionData);
        }
    }

    /**
     * 激活下一个可用会话
     */
    activateNextSession() {
        const sessionIds = Array.from(this.sessions.keys());
        if (sessionIds.length > 0) {
            this.activateSession(sessionIds[0]);
        }
    }

    /**
     * 获取标签元素
     */
    getTabElement(sessionId) {
        return this.tabBar.querySelector(`[data-session-id="${sessionId}"]`);
    }

    /**
     * 获取面板元素
     */
    getPanelElement(sessionId) {
        return this.terminalContent.querySelector(`[data-session-id="${sessionId}"]`);
    }



    /**
     * 设置会话加载状态
     */
    setSessionLoading(sessionId, loading = true) {
        const tab = this.getTabElement(sessionId);
        if (tab) {
            if (loading) {
                tab.classList.add('loading');
            } else {
                tab.classList.remove('loading');
            }
        }
    }

    /**
     * 更新会话标题
     */
    updateSessionTitle(sessionId, title) {
        const tab = this.getTabElement(sessionId);
        if (tab) {
            const titleElement = tab.querySelector('.tab-title');
            if (titleElement) {
                titleElement.textContent = title;
            }
        }
    }

    /**
     * 隐藏空白状态
     */
    hideEmptyState() {
        this.emptyState.style.display = 'none';
    }

    /**
     * 显示空白状态
     */
    showEmptyState() {
        this.emptyState.style.display = 'flex';
    }

    /**
     * 获取当前激活的会话ID
     */
    getCurrentSessionId() {
        return this.currentSessionId;
    }

    /**
     * 获取所有会话
     */
    getAllSessions() {
        return Array.from(this.sessions.entries());
    }

    /**
     * 获取会话数量
     */
    getSessionCount() {
        return this.sessions.size;
    }

    /**
     * 清理所有会话
     */
    cleanup() {
        // 关闭所有会话
        const sessionIds = Array.from(this.sessions.keys());
        sessionIds.forEach(sessionId => {
            this.closeSession(sessionId);
        });
        
        this.sessions.clear();
        this.activeSessions.clear();
        this.currentSessionId = null;
        
        // 显示空白状态
        this.showEmptyState();
        
        console.log('会话管理器已清理');
    }
}

// 初始化会话管理器
document.addEventListener('DOMContentLoaded', () => {
    window.sessionManager = new SessionManager();
});
