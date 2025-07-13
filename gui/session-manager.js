/**
 * 会话管理器 - 管理终端会话的标签和面板
 * 负责创建、切换、关闭会话标签
 */

class SessionManager {
    constructor() {
        this.sessions = new Map(); // sessionId -> session data
        this.activeSessions = new Set(); // 活跃的会话ID
        this.currentSessionId = null;
        
        // DOM元素
        this.tabBar = document.getElementById('tab-bar');
        this.terminalContent = document.getElementById('terminal-content');
        this.emptyState = document.getElementById('empty-state');
        
        this.init();
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
        this.sessions.set(sessionId, {
            ...sessionData,
            createdAt: new Date(),
            isActive: false,
            output: []
        });

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
        const tab = document.createElement('div');
        tab.className = 'tab';
        tab.dataset.sessionId = sessionId;
        
        // 标签标题
        const title = document.createElement('span');
        title.className = 'tab-title';
        title.textContent = this.getTabTitle(sessionData);
        title.title = `${sessionData.type.toUpperCase()} - ${sessionData.cwd}`;
        
        // 关闭按钮
        const closeBtn = document.createElement('span');
        closeBtn.className = 'tab-close';
        closeBtn.textContent = '×';
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
        const panel = document.createElement('div');
        panel.className = 'terminal-panel';
        panel.dataset.sessionId = sessionId;
        
        // 会话信息栏
        const sessionInfo = document.createElement('div');
        sessionInfo.className = 'session-info';
        sessionInfo.innerHTML = `
            <div>
                <span class="session-id">${sessionId.substring(0, 8)}...</span>
                <span class="session-type">${sessionData.type.toUpperCase()}</span>
                <span class="session-cwd">${sessionData.cwd}</span>
            </div>
            <div>
                <span>PID: ${sessionData.pid}</span>
                <span>创建时间: ${new Date().toLocaleTimeString()}</span>
            </div>
        `;
        
        // 终端输出区域
        const terminalOutput = document.createElement('div');
        terminalOutput.className = 'terminal-output';
        terminalOutput.id = `terminal-${sessionId}`;
        
        panel.appendChild(sessionInfo);
        panel.appendChild(terminalOutput);
        
        this.terminalContent.appendChild(panel);
        
        // 挂载终端到DOM
        setTimeout(() => {
            window.terminalRenderer?.mountTerminal(sessionId, terminalOutput);
        }, 100);
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
        setTimeout(() => {
            window.terminalRenderer?.resizeTerminal(sessionId);
        }, 100);
        
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
     * 生成标签标题
     */
    getTabTitle(sessionData) {
        const { type, cwd } = sessionData;
        const dirName = cwd.split('\\').pop() || cwd.split('/').pop() || 'Terminal';
        return `${type === 'powershell' ? 'PS' : 'CMD'}: ${dirName}`;
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
