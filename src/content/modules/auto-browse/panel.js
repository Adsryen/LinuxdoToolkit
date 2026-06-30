/**
 * 自动浏览控制面板
 *
 * 浮动面板 UI，支持：速度预设、列表来源、点赞开关、统计数据。
 * 可折叠/最小化。
 */

import { Z_INDEX } from '../../../utils/z-index.js'

const PANEL_ID = 'ltk-auto-panel'
const STYLE_ID = 'ltk-auto-style'

export class ControlPanel {
  constructor(options = {}) {
    this.options = options
    this.container = null
    this.minimized = false
    this._dragOffset = { x: 0, y: 0 }
    this._isDragging = false
  }

  mount() {
    if (this.container) return
    this._injectStyles()

    this.container = document.createElement('div')
    this.container.id = PANEL_ID
    this.container.innerHTML = this._buildHTML()
    document.body.appendChild(this.container)
    this._restorePosition()
    this._bindEvents()
    this._syncButtons()
  }

  unmount() {
    this.container?.remove()
    this.container = null
  }

  show() { if (this.container) this.container.style.display = '' }
  hide() { if (this.container) this.container.style.display = 'none' }

  setRunning(v) {
    if (!this.container) return
    this.container.querySelector('.ab-btn-start').style.display = v ? 'none' : ''
    this.container.querySelector('.ab-btn-stop').style.display = v ? '' : 'none'
    this.container.querySelector('.ab-status').textContent = v ? '运行中' : '已停止'
    this.container.querySelector('.ab-dot').className = `ab-dot ${v ? 'running' : 'stopped'}`
  }

  updateStats(stats) {
    if (!this.container) return
    const set = (id, v) => { const el = this.container.querySelector(`#${id}`); if (el) el.textContent = v }
    set('ab-session-views', stats.sessionViews ?? 0)
    set('ab-session-likes', stats.sessionLikes ?? 0)
    set('ab-total-views', stats.totalViews ?? 0)
    set('ab-total-likes', stats.totalLikes ?? 0)
  }

  // ========== 内部 ==========

  _buildHTML() {
    const o = this.options
    return `
      <div class="ab-header">
        <span>🔄 自动浏览</span>
        <button class="ab-minimize" title="折叠">−</button>
      </div>
      <div class="ab-body">
        <div class="ab-row">
          <span class="ab-label">速度</span>
          <div class="ab-btns">
            <button class="ab-btn ab-speed" data-v="slow">慢</button>
            <button class="ab-btn ab-speed" data-v="normal">正常</button>
            <button class="ab-btn ab-speed" data-v="fast">快</button>
            <button class="ab-btn ab-speed" data-v="turbo">极速</button>
          </div>
        </div>
        <div class="ab-row">
          <span class="ab-label">列表</span>
          <div class="ab-btns">
            <button class="ab-btn ab-list" data-v="latest">最新</button>
            <button class="ab-btn ab-list" data-v="new">新帖</button>
            <button class="ab-btn ab-list" data-v="unread">未读</button>
          </div>
        </div>
        <div class="ab-row">
          <span class="ab-label">点赞</span>
          <div class="ab-btns">
            <button class="ab-btn ab-like" data-v="true">开</button>
            <button class="ab-btn ab-like" data-v="false">关</button>
          </div>
        </div>
        <div class="ab-row">
          <span class="ab-label">概率</span>
          <div class="ab-btns">
            <button class="ab-btn ab-chance" data-v="low">低</button>
            <button class="ab-btn ab-chance" data-v="medium">中</button>
            <button class="ab-btn ab-chance" data-v="high">高</button>
            <button class="ab-btn ab-chance" data-v="veryHigh">极高</button>
          </div>
        </div>
        <button class="ab-btn ab-btn-start ab-full">开始自动浏览</button>
        <button class="ab-btn ab-btn-stop ab-full" style="display:none">停止运行</button>
        <button class="ab-btn ab-btn-clear ab-full ab-secondary">清除浏览记录</button>
        <div class="ab-row">
          <span class="ab-label">看完</span>
          <div class="ab-btns">
            <button class="ab-btn ab-readall" data-v="true">全部</button>
            <button class="ab-btn ab-readall" data-v="false">50%</button>
          </div>
        </div>
        <div class="ab-stats">
          <div class="ab-stat-row"><span>状态</span><span><span class="ab-dot stopped"></span><span class="ab-status">未启动</span></span></div>
          <div class="ab-stat-row"><span>本次浏览</span><span id="ab-session-views">0</span></div>
          <div class="ab-stat-row"><span>本次点赞</span><span id="ab-session-likes">0</span></div>
          <div class="ab-stat-row"><span>总计浏览</span><span id="ab-total-views">0</span></div>
          <div class="ab-stat-row"><span>总计点赞</span><span id="ab-total-likes">0</span></div>
        </div>
      </div>
    `
  }

  _bindEvents() {
    const c = this.container
    c.querySelector('.ab-minimize').addEventListener('click', () => {
      this.minimized = !this.minimized
      c.classList.toggle('minimized', this.minimized)
      c.querySelector('.ab-minimize').textContent = this.minimized ? '+' : '−'
    })

    c.querySelector('.ab-btn-start').addEventListener('click', () => this.options.onStart?.())
    c.querySelector('.ab-btn-stop').addEventListener('click', () => this.options.onStop?.())
    c.querySelector('.ab-btn-clear').addEventListener('click', () => {
      if (confirm('确定清除所有浏览记录？')) this.options.onClearHistory?.()
    })

    c.querySelectorAll('.ab-speed').forEach(btn => {
      btn.addEventListener('click', () => {
        this._activate(c.querySelectorAll('.ab-speed'), btn)
        this.options.onSpeedChange?.(btn.dataset.v)
      })
    })
    c.querySelectorAll('.ab-list').forEach(btn => {
      btn.addEventListener('click', () => {
        this._activate(c.querySelectorAll('.ab-list'), btn)
        this.options.onListChange?.(btn.dataset.v)
      })
    })
    c.querySelectorAll('.ab-like').forEach(btn => {
      btn.addEventListener('click', () => {
        this._activate(c.querySelectorAll('.ab-like'), btn)
        this.options.onLikeToggle?.(btn.dataset.v === 'true')
      })
    })
    c.querySelectorAll('.ab-chance').forEach(btn => {
      btn.addEventListener('click', () => {
        this._activate(c.querySelectorAll('.ab-chance'), btn)
        this.options.onLikeChanceChange?.(btn.dataset.v)
      })
    })
    c.querySelectorAll('.ab-readall').forEach(btn => {
      btn.addEventListener('click', () => {
        this._activate(c.querySelectorAll('.ab-readall'), btn)
        this.options.onReadAllToggle?.(btn.dataset.v === 'true')
      })
    })

    // 拖拽
    this._setupDrag(c.querySelector('.ab-header'))
  }

  _syncButtons() {
    const o = this.options
    const c = this.container
    this._activateByValue(c.querySelectorAll('.ab-speed'), o.speed)
    this._activateByValue(c.querySelectorAll('.ab-list'), o.listType)
    this._activateByValue(c.querySelectorAll('.ab-like'), String(o.enableLike))
    this._activateByValue(c.querySelectorAll('.ab-chance'), o.likeChance)
    this._activateByValue(c.querySelectorAll('.ab-readall'), String(o.readAll))
  }

  _restorePosition() {
    try {
      const pos = JSON.parse(localStorage.getItem('ltk_ab_panel_pos'))
      if (pos) {
        this.container.style.left = pos.left + 'px'
        this.container.style.top = pos.top + 'px'
        this.container.style.right = 'auto'
      }
    } catch {}
  }

  _activate(btns, active) {
    btns.forEach(b => b.classList.remove('active'))
    active.classList.add('active')
  }

  _activateByValue(btns, value) {
    btns.forEach(b => {
      b.classList.toggle('active', b.dataset.v === value)
    })
  }

  _setupDrag(handle) {
    const el = this.container
    let startX, startY, startLeft, startTop

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
        el.style.right = 'auto'
      }
      const onUp = () => {
        this._isDragging = false
        document.removeEventListener('mousemove', onMove)
        document.removeEventListener('mouseup', onUp)
        try {
          localStorage.setItem('ltk_ab_panel_pos', JSON.stringify({ left: el.offsetLeft, top: el.offsetTop }))
        } catch {}
      }
      document.addEventListener('mousemove', onMove)
      document.addEventListener('mouseup', onUp)
    })
  }

  _injectStyles() {
    if (document.getElementById(STYLE_ID)) return
    const style = document.createElement('style')
    style.id = STYLE_ID
    style.textContent = `
      #${PANEL_ID} {
        position: fixed;
        top: 80px;
        right: 20px;
        z-index: ${Z_INDEX.panel};
        background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
        border-radius: 12px;
        padding: 14px;
        box-shadow: 0 4px 20px rgba(0,0,0,.25);
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
        font-size: 13px;
        color: #fff;
        min-width: 220px;
        transition: all .3s;
      }
      #${PANEL_ID}.minimized { min-width: auto; padding: 8px; }
      #${PANEL_ID}.minimized .ab-body { display: none; }
      .ab-header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 10px; font-weight: 600; font-size: 14px; cursor: grab; }
      .ab-header:active { cursor: grabbing; }
      #${PANEL_ID}.minimized .ab-header { margin-bottom: 0; }
      .ab-minimize { background: rgba(255,255,255,.2); border: none; color: #fff; width: 22px; height: 22px; border-radius: 50%; cursor: pointer; font-size: 14px; }
      .ab-row { display: flex; align-items: center; margin-bottom: 6px; gap: 6px; }
      .ab-label { font-size: 11px; opacity: .9; width: 30px; flex-shrink: 0; }
      .ab-btns { display: flex; gap: 3px; flex: 1; }
      .ab-btn { padding: 4px 8px; border: none; border-radius: 4px; background: rgba(255,255,255,.2); color: #fff; font-size: 11px; cursor: pointer; transition: all .2s; }
      .ab-btn:hover { background: rgba(255,255,255,.3); }
      .ab-btn.active { background: #4CAF50; font-weight: 600; }
      .ab-full { width: 100%; padding: 8px; margin-top: 4px; font-size: 12px; border-radius: 6px; }
      .ab-btn-start { background: #4CAF50; }
      .ab-btn-stop { background: #f44336; }
      .ab-btn-clear { background: rgba(255,255,255,.15); }
      .ab-secondary { font-size: 11px; padding: 5px; }
      .ab-stats { margin-top: 10px; padding: 8px; background: rgba(255,255,255,.12); border-radius: 6px; }
      .ab-stat-row { display: flex; justify-content: space-between; font-size: 11px; padding: 2px 0; }
      .ab-dot { display: inline-block; width: 7px; height: 7px; border-radius: 50%; margin-right: 5px; }
      .ab-dot.running { background: #4CAF50; animation: ab-pulse 1.5s infinite; }
      .ab-dot.stopped { background: #f44336; }
      @keyframes ab-pulse { 0%,100%{opacity:1} 50%{opacity:.5} }
      .dark #${PANEL_ID}, [data-theme="dark"] #${PANEL_ID} { background: linear-gradient(135deg, #2d3748 0%, #4a5568 100%); }
    `
    document.head.appendChild(style)
  }
}
