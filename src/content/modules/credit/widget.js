/**
 * 积分悬浮小组件
 *
 * 可拖拽的悬浮数字，显示积分差值。
 * hover 显示详情，点击刷新。
 */

import { Z_INDEX } from '../../../utils/z-index.js'

const WIDGET_ID = 'ldc-mini'
const TOOLTIP_ID = 'ldc-tooltip'
const STYLE_ID = 'ldc-style'

export class CreditWidget {
  constructor(options = {}) {
    this.position = options.position || null
    this.onClick = options.onClick || (() => {})
    this.onPositionChange = options.onPositionChange || (() => {})

    this.container = null
    this.tooltip = null
    this.isDragging = false
  }

  /**
   * 挂载到页面
   */
  mount() {
    if (this.container) return

    this._injectStyles()

    // 主组件
    this.container = document.createElement('div')
    this.container.id = WIDGET_ID
    this.container.className = 'ldc-loading'
    this.container.textContent = '···'

    // tooltip
    this.tooltip = document.createElement('div')
    this.tooltip.id = TOOLTIP_ID

    // 恢复位置
    this._restorePosition()

    document.body.appendChild(this.container)
    document.body.appendChild(this.tooltip)

    // 事件绑定
    this._bindEvents()
  }

  /**
   * 从页面移除
   */
  unmount() {
    this.container?.remove()
    this.tooltip?.remove()
    this.container = null
    this.tooltip = null
  }

  /**
   * 更新显示
   * @param {number} diff - 积分差值
   * @param {string} tooltipText - tooltip 内容
   */
  update(diff, tooltipText) {
    if (!this.container) return
    this.container.textContent = (diff > 0 ? '+' : '') + diff.toFixed(2)
    this.container.className = diff > 0 ? 'ldc-positive' : diff < 0 ? 'ldc-negative' : 'ldc-neutral'
    this._tooltipText = tooltipText
  }

  /**
   * 显示加载状态
   */
  showLoading() {
    if (!this.container) return
    this.container.textContent = '···'
    this.container.className = 'ldc-loading'
    this._tooltipText = '加载中...'
  }

  /**
   * 显示错误
   * @param {string} msg
   */
  showError(msg) {
    if (!this.container) return
    this.container.textContent = '!'
    this.container.className = 'ldc-negative'
    this._tooltipText = msg
  }

  // ========== 内部 ==========

  _injectStyles() {
    if (document.getElementById(STYLE_ID)) return

    const style = document.createElement('style')
    style.id = STYLE_ID
    style.textContent = `
      #${WIDGET_ID} {
        position: fixed;
        background: var(--ltk-bg, #ffffff);
        border: 1px solid var(--ltk-border, #e5e7eb);
        border-radius: 8px;
        box-shadow: var(--ltk-shadow, 0 2px 4px rgba(0,0,0,.04));
        z-index: ${Z_INDEX.widget};
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
        padding: 8px 12px;
        font-size: 13px;
        font-weight: 600;
        cursor: move;
        user-select: none;
        transition: .3s;
        color: var(--ltk-text, #1a1a2e);
      }
      #${WIDGET_ID}.ldc-loading { color: var(--ltk-text-secondary, #6b7280); }
      #${WIDGET_ID}.ldc-positive { color: #10b981; }
      #${WIDGET_ID}.ldc-negative { color: #ef4444; }
      #${WIDGET_ID}.ldc-neutral { color: var(--ltk-text-secondary, #6b7280); }

      #${TOOLTIP_ID} {
        position: fixed;
        background: rgba(0,0,0,.8);
        color: #fff;
        padding: 8px 12px;
        border-radius: 6px;
        font-size: 12px;
        white-space: pre;
        z-index: ${Z_INDEX.widget + 1};
        opacity: 0;
        transition: .15s;
        pointer-events: none;
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      }

      html.ltk-dark #${TOOLTIP_ID} {
        background: rgba(255,255,255,.9);
        color: #000;
      }
    `
    document.head.appendChild(style)
  }

  _restorePosition() {
    if (this.position) {
      Object.assign(this.container.style, {
        right: this.position.right || '20px',
        bottom: this.position.bottom || '20px',
      })
    } else {
      this.container.style.right = '20px'
      this.container.style.bottom = '20px'
    }
  }

  _savePosition() {
    const pos = {
      right: this.container.style.right,
      bottom: this.container.style.bottom,
    }
    this.onPositionChange(pos)
  }

  _bindEvents() {
    const el = this.container

    // hover tooltip
    el.onmouseenter = () => {
      if (!this.tooltip) return
      this.tooltip.textContent = this._tooltipText || '加载中...'
      const r = el.getBoundingClientRect()
      this.tooltip.style.right = (window.innerWidth - r.right) + 'px'
      this.tooltip.style.top = (r.bottom + 6) + 'px'
      this.tooltip.style.opacity = '1'
    }

    el.onmouseleave = () => {
      if (this.tooltip) this.tooltip.style.opacity = '0'
    }

    // 拖拽
    let startX, startY, startRight, startBottom

    el.onmousedown = (e) => {
      e.preventDefault()
      startX = e.clientX
      startY = e.clientY
      const r = el.getBoundingClientRect()
      startRight = window.innerWidth - r.right
      startBottom = window.innerHeight - r.bottom

      const onMove = (ev) => {
        this.isDragging = true
        el.style.right = (startRight + (startX - ev.clientX)) + 'px'
        el.style.bottom = (startBottom + (startY - ev.clientY)) + 'px'
      }

      const onUp = () => {
        document.removeEventListener('mousemove', onMove)
        document.removeEventListener('mouseup', onUp)
        this._savePosition()
        setTimeout(() => { this.isDragging = false }, 50)
      }

      document.addEventListener('mousemove', onMove)
      document.addEventListener('mouseup', onUp)
    }

    // 点击刷新
    el.onclick = () => {
      if (this.isDragging) return
      this.onClick()
    }
  }
}
