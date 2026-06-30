/**
 * 悬浮入口按钮
 *
 * 出现在话题链接旁的小眼睛按钮，hover 显示。
 * 点击打开抽屉预览，支持稍后读。
 */

import { Z_INDEX } from '../../../utils/z-index.js'

const STYLE_ID = 'ltk-peek-btn-style'

export class PeekButton {
  constructor(options = {}) {
    this.onClick = options.onClick || (() => {})
    this.onReadLater = options.onReadLater || (() => {})
    this.container = null
    this._hideTimer = 0
    this._currentTopicId = null
    this._currentHref = null
  }

  mount() {
    if (this.container) return
    this._injectStyles()

    this.container = document.createElement('div')
    this.container.id = 'ltk-peek-btn'
    this.container.innerHTML = `
      <button class="ltk-peek-preview" title="抽屉预览">📖</button>
      <button class="ltk-peek-later" title="稍后阅读">+</button>
    `
    this.container.style.display = 'none'
    document.body.appendChild(this.container)

    this.container.querySelector('.ltk-peek-preview').addEventListener('click', (e) => {
      e.stopPropagation()
      this.hide()
      this.onClick(this._currentTopicId, this._currentHref)
    })

    this.container.querySelector('.ltk-peek-later').addEventListener('click', (e) => {
      e.stopPropagation()
      this.onReadLater(this._currentTopicId)
      this.hide()
    })

    this.container.addEventListener('mouseenter', () => this.cancelHide())
    this.container.addEventListener('mouseleave', () => this.hideSoon(500))
  }

  unmount() {
    this.container?.remove()
    this.container = null
  }

  show(anchor, topicId, href) {
    if (!this.container) this.mount()
    clearTimeout(this._hideTimer)
    this._currentTopicId = topicId
    this._currentHref = href

    const rect = anchor.getBoundingClientRect()
    this.container.style.left = (rect.right + 6 + window.scrollX) + 'px'
    this.container.style.top = (rect.top + window.scrollY - 4) + 'px'
    this.container.style.display = 'flex'
  }

  hide() {
    clearTimeout(this._hideTimer)
    if (this.container) this.container.style.display = 'none'
  }

  hideSoon(delay = 300) {
    clearTimeout(this._hideTimer)
    this._hideTimer = setTimeout(() => this.hide(), delay)
  }

  cancelHide() {
    clearTimeout(this._hideTimer)
  }

  _injectStyles() {
    if (document.getElementById(STYLE_ID)) return
    const style = document.createElement('style')
    style.id = STYLE_ID
    style.textContent = `
      #ltk-peek-btn {
        position: absolute;
        z-index: ${Z_INDEX.modal};
        display: flex;
        gap: 3px;
        pointer-events: auto;
      }
      #ltk-peek-btn button {
        width: 26px;
        height: 26px;
        border: 1px solid var(--ltk-border, #e5e7eb);
        border-radius: 6px;
        background: var(--ltk-bg, #fff);
        cursor: pointer;
        font-size: 13px;
        display: flex;
        align-items: center;
        justify-content: center;
        padding: 0;
        box-shadow: 0 1px 4px rgba(0,0,0,.1);
        transition: all .15s;
      }
      #ltk-peek-btn button:hover {
        background: var(--ltk-primary, #3b82f6);
        color: #fff;
        border-color: var(--ltk-primary, #3b82f6);
      }
      `
    document.head.appendChild(style)
  }
}
