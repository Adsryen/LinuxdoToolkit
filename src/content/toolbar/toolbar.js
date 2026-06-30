/**
 * 统一浮动工具栏
 *
 * 折叠式浮动面板，聚合所有运行中模块的状态。
 * 支持：可拖拽定位、折叠/展开、位置持久化、暗黑模式。
 */

import { Z_INDEX } from '../../utils/z-index.js'
import { settings } from '../../utils/settings.js'

const TOOLBAR_ID = 'linuxdo-toolkit-toolbar'
const COLLAPSE_KEY = 'toolbar-collapsed'
const POSITION_KEY = 'toolbar-position'

export class Toolbar {
  constructor(moduleManager) {
    this.moduleManager = moduleManager
    this.container = null
    this.isCollapsed = false
    this.isDragging = false
    this.dragOffset = { x: 0, y: 0 }
    this.position = null  // { x, y }
    this._statusBarEls = new Map()
    this._updateTimer = null
  }

  /**
   * 创建并挂载工具栏
   */
  async mount() {
    if (this.container) return

    // 读取持久化状态
    const global = settings.getGlobal()
    this.isCollapsed = global.toolbarCollapsed ?? false
    this.position = global.toolbarPosition ?? null

    // 创建 DOM
    this.container = document.createElement('div')
    this.container.id = TOOLBAR_ID
    this.container.innerHTML = this._buildHTML()
    document.body.appendChild(this.container)

    // 注入样式
    this._injectStyles()

    // 设置 z-index
    this.container.style.zIndex = Z_INDEX.toolbar

    // 恢复位置
    this._restorePosition()

    // 绑定事件
    this._bindEvents()

    // 渲染模块状态条
    this._renderStatusBars()

    // 应用折叠状态
    if (this.isCollapsed) {
      this.container.classList.add('collapsed')
    }

    // 定时刷新状态条
    this._startAutoUpdate()
  }

  /**
   * 卸载工具栏
   */
  unmount() {
    if (!this.container) return
    this._stopAutoUpdate()
    this.container.remove()
    this.container = null
    this._statusBarEls.clear()
  }

  /**
   * 刷新状态条内容
   */
  refreshStatusBars() {
    this._renderStatusBars()
  }

  // ========== 内部方法 ==========

  _buildHTML() {
    return `
      <div class="ltk-toolbar-header" title="拖拽移动">
        <span class="ltk-toolbar-icon">🧰</span>
        <span class="ltk-toolbar-title">Toolkit</span>
        <button class="ltk-toolbar-collapse" title="折叠/展开">▼</button>
      </div>
      <div class="ltk-toolbar-body">
        <div class="ltk-toolbar-status-bars"></div>
        <div class="ltk-toolbar-actions">
          <button class="ltk-toolbar-btn" data-action="options" title="设置">⚙️</button>
        </div>
      </div>
    `
  }

  _injectStyles() {
    if (document.getElementById('ltk-toolbar-style')) return

    const style = document.createElement('style')
    style.id = 'ltk-toolbar-style'
    style.textContent = `
      #${TOOLBAR_ID} {
        position: fixed;
        right: 16px;
        top: 80px;
        width: 200px;
        background: var(--ltk-bg, #ffffff);
        border: 1px solid var(--ltk-border, #e5e7eb);
        border-radius: 10px;
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        font-size: 12px;
        color: var(--ltk-text, #1a1a2e);
        user-select: none;
        transition: width 0.2s, box-shadow 0.2s;
        overflow: hidden;
      }

      #${TOOLBAR_ID}:hover {
        box-shadow: 0 6px 20px rgba(0, 0, 0, 0.15);
      }

      #${TOOLBAR_ID}.collapsed {
        width: 42px;
      }

      #${TOOLBAR_ID}.collapsed .ltk-toolbar-body {
        display: none;
      }

      #${TOOLBAR_ID}.collapsed .ltk-toolbar-title {
        display: none;
      }

      #${TOOLBAR_ID}.collapsed .ltk-toolbar-collapse {
        transform: rotate(-90deg);
      }

      .ltk-toolbar-header {
        display: flex;
        align-items: center;
        gap: 6px;
        padding: 8px 10px;
        cursor: grab;
        background: var(--ltk-header-bg, #f8f9fa);
        border-bottom: 1px solid var(--ltk-border, #e5e7eb);
      }

      .ltk-toolbar-header:active {
        cursor: grabbing;
      }

      .ltk-toolbar-icon {
        font-size: 16px;
        flex-shrink: 0;
      }

      .ltk-toolbar-title {
        flex: 1;
        font-size: 12px;
        font-weight: 600;
        white-space: nowrap;
      }

      .ltk-toolbar-collapse {
        background: none;
        border: none;
        cursor: pointer;
        font-size: 10px;
        color: var(--ltk-text-secondary, #6b7280);
        padding: 2px;
        transition: transform 0.2s;
        line-height: 1;
      }

      .ltk-toolbar-body {
        padding: 6px 10px 8px;
      }

      .ltk-toolbar-status-bars {
        display: flex;
        flex-direction: column;
        gap: 4px;
        margin-bottom: 6px;
      }

      .ltk-status-bar {
        display: flex;
        align-items: center;
        gap: 6px;
        padding: 4px 0;
        font-size: 11px;
        color: var(--ltk-text-secondary, #6b7280);
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
      }

      .ltk-status-bar .ltk-status-icon {
        font-size: 12px;
        flex-shrink: 0;
      }

      .ltk-status-bar .ltk-status-text {
        flex: 1;
        overflow: hidden;
        text-overflow: ellipsis;
      }

      .ltk-status-empty {
        font-size: 11px;
        color: var(--ltk-text-muted, #9ca3af);
        padding: 4px 0;
      }

      .ltk-toolbar-actions {
        display: flex;
        gap: 4px;
        padding-top: 6px;
        border-top: 1px solid var(--ltk-border, #e5e7eb);
      }

      .ltk-toolbar-btn {
        flex: 1;
        display: flex;
        align-items: center;
        justify-content: center;
        padding: 4px;
        background: none;
        border: 1px solid var(--ltk-border, #e5e7eb);
        border-radius: 6px;
        cursor: pointer;
        font-size: 13px;
        transition: background 0.15s;
      }

      .ltk-toolbar-btn:hover {
        background: var(--ltk-hover-bg, #f0f1f3);
      }

      /* Dark mode - 基于 linux.do 的暗黑模式 */
      .dark-mode #${TOOLBAR_ID},
      [data-theme="dark"] #${TOOLBAR_ID} {
        --ltk-bg: #1a1a2e;
        --ltk-header-bg: #16162a;
        --ltk-border: #2d2d4a;
        --ltk-text: #e2e8f0;
        --ltk-text-secondary: #94a3b8;
        --ltk-text-muted: #64748b;
        --ltk-hover-bg: #222240;
      }
    `
    document.head.appendChild(style)
  }

  _restorePosition() {
    if (this.position && this.position.x >= 0) {
      this.container.style.left = this.position.x + 'px'
      this.container.style.top = this.position.y + 'px'
      this.container.style.right = 'auto'
    }
    // 默认右侧，不需要额外处理
  }

  _savePosition() {
    const rect = this.container.getBoundingClientRect()
    this.position = { x: rect.left, y: rect.top }
    settings.setGlobal({ toolbarPosition: this.position })
  }

  _saveCollapsed() {
    settings.setGlobal({ toolbarCollapsed: this.isCollapsed })
  }

  _bindEvents() {
    // 折叠/展开
    const collapseBtn = this.container.querySelector('.ltk-toolbar-collapse')
    collapseBtn.addEventListener('click', (e) => {
      e.stopPropagation()
      this.isCollapsed = !this.isCollapsed
      this.container.classList.toggle('collapsed', this.isCollapsed)
      this._saveCollapsed()
    })

    // 点击 header 也折叠/展开
    const header = this.container.querySelector('.ltk-toolbar-header')
    header.addEventListener('dblclick', (e) => {
      e.preventDefault()
      this.isCollapsed = !this.isCollapsed
      this.container.classList.toggle('collapsed', this.isCollapsed)
      this._saveCollapsed()
    })

    // 拖拽
    this._setupDrag(header)

    // 设置按钮
    this.container.querySelector('[data-action="options"]')
      .addEventListener('click', () => {
        chrome.runtime.sendMessage({ type: 'OPEN_OPTIONS' })
      })
  }

  _setupDrag(handle) {
    let startX, startY, startLeft, startTop

    const onMouseDown = (e) => {
      if (e.target.closest('button')) return
      e.preventDefault()
      this.isDragging = true

      const rect = this.container.getBoundingClientRect()
      startX = e.clientX
      startY = e.clientY
      startLeft = rect.left
      startTop = rect.top

      // 切换到 left/top 定位
      this.container.style.left = startLeft + 'px'
      this.container.style.top = startTop + 'px'
      this.container.style.right = 'auto'

      document.addEventListener('mousemove', onMouseMove)
      document.addEventListener('mouseup', onMouseUp)
    }

    const onMouseMove = (e) => {
      if (!this.isDragging) return
      const dx = e.clientX - startX
      const dy = e.clientY - startY
      const newLeft = Math.max(0, Math.min(window.innerWidth - 50, startLeft + dx))
      const newTop = Math.max(0, Math.min(window.innerHeight - 50, startTop + dy))
      this.container.style.left = newLeft + 'px'
      this.container.style.top = newTop + 'px'
    }

    const onMouseUp = () => {
      if (!this.isDragging) return
      this.isDragging = false
      document.removeEventListener('mousemove', onMouseMove)
      document.removeEventListener('mouseup', onMouseUp)
      this._savePosition()
    }

    handle.addEventListener('mousedown', onMouseDown)
  }

  _renderStatusBars() {
    const container = this.container?.querySelector('.ltk-toolbar-status-bars')
    if (!container) return

    const bars = this.moduleManager.getStatusBars()

    if (!bars.length) {
      container.innerHTML = '<div class="ltk-status-empty">暂无活跃模块</div>'
      return
    }

    container.innerHTML = bars.map(bar => `
      <div class="ltk-status-bar" data-module="${bar.moduleId}">
        <span class="ltk-status-icon">${bar.icon}</span>
        <span class="ltk-status-text">${bar.text || ''}</span>
      </div>
    `).join('')

    // 绑定 action 按钮
    for (const bar of bars) {
      if (bar.actions) {
        const el = container.querySelector(`[data-module="${bar.moduleId}"]`)
        for (const action of bar.actions) {
          const btn = document.createElement('button')
          btn.className = 'ltk-toolbar-btn'
          btn.style.cssText = 'flex:none;padding:2px 6px;font-size:10px;margin-left:auto;'
          btn.textContent = action.label
          btn.addEventListener('click', action.onClick)
          el.appendChild(btn)
        }
      }
    }
  }

  _startAutoUpdate() {
    this._updateTimer = setInterval(() => {
      this._renderStatusBars()
    }, 5000)
  }

  _stopAutoUpdate() {
    if (this._updateTimer) {
      clearInterval(this._updateTimer)
      this._updateTimer = null
    }
  }
}
