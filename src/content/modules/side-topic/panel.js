/**
 * 话题侧边面板
 *
 * 可拖拽、可缩放的浮动面板，显示话题列表。
 * 支持 Feed 切换、位置/大小持久化、折叠/展开。
 */

import { Z_INDEX } from '../../../utils/z-index.js'

const PANEL_ID = 'ltk-side-panel'
const STYLE_ID = 'ltk-side-style'

export class SidePanel {
  constructor(options = {}) {
    this.options = options
    this.container = null
    this.collapsed = options.collapsed || false
    this.position = options.position || { left: null, top: 88 }
    this.size = options.size || { width: 360, height: 520 }
    this._isDragging = false
    this._isResizing = false
  }

  mount() {
    if (this.container) return
    this._injectStyles()

    this.container = document.createElement('div')
    this.container.id = PANEL_ID
    this.container.innerHTML = this._buildHTML()
    document.body.appendChild(this.container)

    this._restoreGeometry()
    this._bindEvents()
    if (this.collapsed) this.container.classList.add('collapsed')
  }

  unmount() {
    this.container?.remove()
    this.container = null
  }

  show() { if (this.container) this.container.style.display = '' }
  hide() { if (this.container) this.container.style.display = 'none' }

  renderTopics(topics) {
    const list = this.container?.querySelector('.stp-list')
    if (!list) return

    if (!topics?.length) {
      list.innerHTML = '<div class="stp-empty">暂无话题</div>'
      return
    }

    let html = ''
    for (const t of topics) {
      const time = this._relativeTime(t.lastActivity)
      const badge = t.pinned ? '📌 ' : t.unseen ? '🆕 ' : ''
      const unread = t.newPosts > 0 ? `<span class="stp-unread">${t.newPosts}</span>` : ''
      html += `
        <div class="stp-topic" data-id="${t.id}">
          <div class="stp-topic-title">${badge}${this._escape(t.title)} ${unread}</div>
          <div class="stp-topic-meta">
            <span>${this._escape(t.author || '')}</span>
            <span>💬 ${t.replies}</span>
            <span>👁 ${t.views}</span>
            <span>${time}</span>
          </div>
        </div>`
    }
    list.innerHTML = html

    list.querySelectorAll('.stp-topic').forEach(el => {
      el.addEventListener('click', () => {
        this.options.onTopicClick?.(el.dataset.id)
      })
    })
  }

  showError(msg) {
    const list = this.container?.querySelector('.stp-list')
    if (list) list.innerHTML = `<div class="stp-empty">${this._escape(msg)}</div>`
  }

  // ========== 内部 ==========

  _buildHTML() {
    const o = this.options
    const feedBtns = Object.entries(o.feeds || {}).map(([key, feed]) =>
      `<button class="stp-feed-btn${key === o.feed ? ' active' : ''}" data-feed="${key}">${feed.name}</button>`
    ).join('')

    return `
      <div class="stp-header" title="拖拽移动">
        <span class="stp-title">📋 话题列表</span>
        <div class="stp-actions">
          <button class="stp-btn stp-refresh" title="刷新">🔄</button>
          <button class="stp-btn stp-collapse" title="折叠/展开">▼</button>
        </div>
      </div>
      <div class="stp-body">
        <div class="stp-feeds">${feedBtns}</div>
        <div class="stp-list"><div class="stp-empty">加载中...</div></div>
      </div>
      <div class="stp-resize-handle" title="拖拽调整大小"></div>
    `
  }

  _restoreGeometry() {
    const el = this.container
    if (this.position.left != null) {
      el.style.left = this.position.left + 'px'
      el.style.right = 'auto'
    } else {
      el.style.left = (window.innerWidth - this.size.width - 20) + 'px'
    }
    el.style.top = (this.position.top || 88) + 'px'
    el.style.width = this.size.width + 'px'
    el.style.height = this.size.height + 'px'
  }

  _bindEvents() {
    const c = this.container

    // 折叠
    c.querySelector('.stp-collapse').addEventListener('click', () => {
      this.collapsed = !this.collapsed
      c.classList.toggle('collapsed', this.collapsed)
      c.querySelector('.stp-collapse').textContent = this.collapsed ? '▶' : '▼'
      this.options.onCollapseChange?.(this.collapsed)
    })

    // 刷新
    c.querySelector('.stp-refresh').addEventListener('click', () => this.options.onRefresh?.())

    // Feed 切换
    c.querySelectorAll('.stp-feed-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        c.querySelectorAll('.stp-feed-btn').forEach(b => b.classList.remove('active'))
        btn.classList.add('active')
        this.options.onFeedChange?.(btn.dataset.feed)
      })
    })

    // 拖拽
    this._setupDrag(c.querySelector('.stp-header'))

    // 缩放
    this._setupResize(c.querySelector('.stp-resize-handle'))
  }

  _setupDrag(handle) {
    let startX, startY, startLeft, startTop
    const el = this.container

    handle.addEventListener('mousedown', (e) => {
      if (e.target.closest('button')) return
      e.preventDefault()
      this._isDragging = true
      startX = e.clientX
      startY = e.clientY
      startLeft = el.offsetLeft
      startTop = el.offsetTop

      const onMove = (ev) => {
        if (!this._isDragging) return
        const x = Math.max(0, Math.min(window.innerWidth - 50, startLeft + ev.clientX - startX))
        const y = Math.max(0, Math.min(window.innerHeight - 50, startTop + ev.clientY - startY))
        el.style.left = x + 'px'
        el.style.top = y + 'px'
      }
      const onUp = () => {
        this._isDragging = false
        document.removeEventListener('mousemove', onMove)
        document.removeEventListener('mouseup', onUp)
        this.options.onPositionChange?.({ left: el.offsetLeft, top: el.offsetTop })
      }
      document.addEventListener('mousemove', onMove)
      document.addEventListener('mouseup', onUp)
    })
  }

  _setupResize(handle) {
    let startX, startY, startW, startH
    const el = this.container

    handle.addEventListener('mousedown', (e) => {
      e.preventDefault()
      this._isResizing = true
      startX = e.clientX
      startY = e.clientY
      startW = el.offsetWidth
      startH = el.offsetHeight

      const onMove = (ev) => {
        if (!this._isResizing) return
        const w = Math.max(240, startW + ev.clientX - startX)
        const h = Math.max(200, startH + ev.clientY - startY)
        el.style.width = w + 'px'
        el.style.height = h + 'px'
      }
      const onUp = () => {
        this._isResizing = false
        document.removeEventListener('mousemove', onMove)
        document.removeEventListener('mouseup', onUp)
        this.options.onSizeChange?.({ width: el.offsetWidth, height: el.offsetHeight })
      }
      document.addEventListener('mousemove', onMove)
      document.addEventListener('mouseup', onUp)
    })
  }

  _relativeTime(dateStr) {
    if (!dateStr) return ''
    const diff = Date.now() - new Date(dateStr).getTime()
    const mins = Math.floor(diff / 60000)
    if (mins < 1) return '刚刚'
    if (mins < 60) return `${mins}分`
    const hours = Math.floor(mins / 60)
    if (hours < 24) return `${hours}时`
    return `${Math.floor(hours / 24)}天`
  }

  _escape(str) {
    const d = document.createElement('div')
    d.textContent = str || ''
    return d.innerHTML
  }

  _injectStyles() {
    if (document.getElementById(STYLE_ID)) return
    const style = document.createElement('style')
    style.id = STYLE_ID
    style.textContent = `
      #${PANEL_ID} {
        position: fixed;
        z-index: ${Z_INDEX.panel};
        background: var(--stp-bg, #fff);
        border: 1px solid var(--stp-border, #e5e7eb);
        border-radius: 10px;
        box-shadow: 0 4px 16px rgba(0,0,0,.12);
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
        font-size: 13px;
        color: var(--stp-text, #1a1a2e);
        display: flex;
        flex-direction: column;
        overflow: hidden;
      }
      #${PANEL_ID}.collapsed .stp-body { display: none; }
      #${PANEL_ID}.collapsed .stp-resize-handle { display: none; }
      #${PANEL_ID}.collapsed { height: auto !important; }
      .stp-header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: 8px 12px;
        background: var(--stp-header-bg, #f8f9fa);
        border-bottom: 1px solid var(--stp-border, #e5e7eb);
        cursor: grab;
        flex-shrink: 0;
      }
      .stp-header:active { cursor: grabbing; }
      .stp-title { font-weight: 600; font-size: 13px; }
      .stp-actions { display: flex; gap: 2px; }
      .stp-btn {
        width: 24px; height: 24px;
        background: none; border: none;
        cursor: pointer; font-size: 12px;
        border-radius: 4px;
        display: flex; align-items: center; justify-content: center;
      }
      .stp-btn:hover { background: var(--stp-hover, #f0f1f3); }
      .stp-body { flex: 1; display: flex; flex-direction: column; overflow: hidden; }
      .stp-feeds {
        display: flex; gap: 2px; padding: 6px 8px;
        border-bottom: 1px solid var(--stp-border, #e5e7eb);
        flex-shrink: 0;
      }
      .stp-feed-btn {
        flex: 1; padding: 4px 8px;
        background: none; border: 1px solid var(--stp-border, #e5e7eb);
        border-radius: 4px; font-size: 11px; cursor: pointer;
        color: var(--stp-text-secondary, #6b7280);
        transition: all .15s;
      }
      .stp-feed-btn:hover { background: var(--stp-hover, #f0f1f3); }
      .stp-feed-btn.active {
        background: var(--stp-primary, #3b82f6);
        color: #fff; border-color: var(--stp-primary, #3b82f6);
      }
      .stp-list { flex: 1; overflow-y: auto; }
      .stp-topic {
        padding: 8px 12px;
        border-bottom: 1px solid var(--stp-border, #e5e7eb);
        cursor: pointer;
        transition: background .1s;
      }
      .stp-topic:hover { background: var(--stp-hover, #f0f1f3); }
      .stp-topic-title {
        font-size: 13px; font-weight: 500;
        margin-bottom: 4px; line-height: 1.3;
        display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical;
        overflow: hidden;
      }
      .stp-topic-meta {
        display: flex; gap: 8px; font-size: 11px;
        color: var(--stp-text-muted, #9ca3af);
      }
      .stp-unread {
        background: var(--stp-primary, #3b82f6);
        color: #fff; font-size: 10px;
        padding: 1px 5px; border-radius: 8px;
        font-weight: 600;
      }
      .stp-empty {
        text-align: center; padding: 24px;
        color: var(--stp-text-muted, #9ca3af);
        font-size: 12px;
      }
      .stp-resize-handle {
        position: absolute; bottom: 0; left: 0;
        width: 16px; height: 16px;
        cursor: nwse-resize;
      }
      .dark #${PANEL_ID}, [data-theme="dark"] #${PANEL_ID} {
        --stp-bg: #1a1a2e;
        --stp-header-bg: #16162a;
        --stp-border: #2d2d4a;
        --stp-text: #e2e8f0;
        --stp-text-secondary: #94a3b8;
        --stp-text-muted: #64748b;
        --stp-hover: #222240;
        --stp-primary: #3b82f6;
      }
    `
    document.head.appendChild(style)
  }
}
