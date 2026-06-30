/**
 * 抽屉预览 UI
 *
 * 右侧抽屉面板，支持两种模式：
 * - summary: 摘要模式（显示话题元数据 + 帖子摘要）
 * - detail: 详情模式（iframe 加载完整话题页面）
 *
 * 包含自动阅读滚动功能。
 */

import { Z_INDEX } from '../../../utils/z-index.js'
import { AutoScroll } from './autoscroll.js'

const STYLE_ID = 'ltk-peek-drawer-style'

export class PeekDrawer {
  constructor(options = {}) {
    this.options = options
    this.cache = options.cache
    this.mode = options.mode || 'summary'
    this.widthPercent = options.width || 50

    this.root = null
    this.shade = null
    this.body = null
    this.header = null
    this.footer = null
    this.iframe = null

    this.topicId = null
    this.topicHref = null
    this.isOpen = false
    this.autoScroll = new AutoScroll({ speed: options.autoScrollSpeed || 42 })
  }

  mount() {
    if (this.root) return
    this._injectStyles()

    // 背景遮罩
    this.shade = document.createElement('div')
    this.shade.className = 'peek-shade'
    this.shade.addEventListener('click', () => this.close())

    // 抽屉主体
    this.root = document.createElement('aside')
    this.root.className = 'peek-drawer'
    this.root.style.width = this.widthPercent + '%'

    this.root.innerHTML = `
      <div class="peek-header">
        <div class="peek-title-area">
          <span class="peek-mode-badge"></span>
          <span class="peek-title">加载中...</span>
        </div>
        <div class="peek-header-actions">
          <button class="peek-btn peek-btn-scroll" title="自动阅读">📖</button>
          <button class="peek-btn peek-btn-fav" title="收藏">⭐</button>
          <button class="peek-btn" data-action="newtab" title="新标签页打开">↗</button>
          <button class="peek-btn peek-btn-close" title="关闭">✕</button>
        </div>
      </div>
      <div class="peek-body"></div>
      <div class="peek-footer">
        <span class="peek-footer-info"></span>
      </div>
    `

    document.body.appendChild(this.shade)
    document.body.appendChild(this.root)

    this.body = this.root.querySelector('.peek-body')
    this.header = this.root.querySelector('.peek-header')
    this.footer = this.root.querySelector('.peek-footer')

    this._bindEvents()
  }

  unmount() {
    this.close()
    this.root?.remove()
    this.shade?.remove()
    this.root = null
    this.shade = null
  }

  /**
   * 打开抽屉
   */
  async open(topicId, mode, href) {
    if (!this.root) this.mount()

    this.topicId = topicId
    this.topicHref = href || `/t/topic/${topicId}`
    this.mode = mode || 'summary'
    this.isOpen = true

    this.shade.classList.add('open')
    this.root.classList.add('open')

    // 更新标题
    this.root.querySelector('.peek-mode-badge').textContent = this.mode === 'detail' ? '详情' : '摘要'
    this.root.querySelector('.peek-title').textContent = '加载中...'
    this.root.querySelector('.peek-footer-info').textContent = ''

    // 停止之前的自动滚动
    this.autoScroll.stop()

    if (this.mode === 'detail') {
      await this._openDetail()
    } else {
      await this._openSummary()
    }
  }

  /**
   * 关闭抽屉
   */
  close() {
    this.isOpen = false
    this.autoScroll.stop()
    this.shade?.classList.remove('open')
    this.root?.classList.remove('open')

    // 清理 iframe
    if (this.iframe) {
      this.iframe.src = 'about:blank'
      this.iframe = null
    }

    this.options.onClose?.()
  }

  // ========== 内部 ==========

  async _openSummary() {
    this.body.innerHTML = '<div class="peek-loading">加载中...</div>'

    try {
      let topic = this.cache?.get(this.topicId)
      if (!topic) {
        topic = await this.cache?.fetch(this.topicId)
      }

      if (!topic) throw new Error('无法加载话题')

      this.root.querySelector('.peek-title').textContent = topic.title || '无标题'

      const created = topic.created_at ? new Date(topic.created_at).toLocaleString('zh-CN') : ''
      const posters = (topic.posters || []).slice(0, 5)
      const html = `
        <div class="peek-summary">
          <h2 class="peek-topic-title">${this._esc(topic.fancy_title || topic.title)}</h2>
          <div class="peek-topic-meta">
            <span>💬 ${topic.posts_count || 0} 回复</span>
            <span>👁 ${topic.views || 0} 浏览</span>
            ${created ? `<span>📅 ${created}</span>` : ''}
          </div>
          ${topic.category_id ? `<span class="peek-category">分类 #${topic.category_id}</span>` : ''}
          <div class="peek-posters">
            ${posters.map(p => `<span class="peek-poster">${p.username || '?'}</span>`).join('')}
          </div>
          <hr class="peek-divider">
          <div class="peek-stream-placeholder">
            <p>帖子内容需要详情模式查看。</p>
            <button class="peek-btn peek-switch-detail">切换到详情模式 ↗</button>
          </div>
        </div>
      `
      this.body.innerHTML = html
      this.root.querySelector('.peek-footer-info').textContent = `话题 #${this.topicId}`

      this.body.querySelector('.peek-switch-detail')?.addEventListener('click', () => {
        this.open(this.topicId, 'detail', this.topicHref)
      })
    } catch (e) {
      this.body.innerHTML = `<div class="peek-error">加载失败: ${this._esc(e.message)}</div>`
    }
  }

  async _openDetail() {
    this.body.innerHTML = ''
    this.root.querySelector('.peek-title').textContent = '详情模式'
    this.root.querySelector('.peek-footer-info').textContent = `话题 #${this.topicId}`

    this.iframe = document.createElement('iframe')
    this.iframe.className = 'peek-iframe'
    this.iframe.src = this.topicHref
    this.iframe.sandbox = 'allow-same-origin allow-scripts allow-popups'
    this.body.appendChild(this.iframe)

    this.iframe.addEventListener('load', () => {
      try {
        const title = this.iframe.contentDocument?.title || ''
        if (title) this.root.querySelector('.peek-title').textContent = title
      } catch {}
    })
  }

  _bindEvents() {
    this.root.querySelector('.peek-btn-close').addEventListener('click', () => this.close())

    this.root.querySelector('[data-action="newtab"]').addEventListener('click', () => {
      window.open(this.topicHref, '_blank', 'noopener,noreferrer')
    })

    this.root.querySelector('.peek-btn-scroll').addEventListener('click', () => {
      if (this.autoScroll.running) {
        this.autoScroll.stop()
        this.root.querySelector('.peek-btn-scroll').textContent = '📖'
      } else {
        const target = this.mode === 'detail' && this.iframe
          ? this.iframe.contentDocument?.documentElement
          : this.body
        if (target) {
          this.autoScroll.start(target)
          this.root.querySelector('.peek-btn-scroll').textContent = '⏸'
        }
      }
    })

    this.root.querySelector('.peek-btn-fav').addEventListener('click', () => {
      this._toggleFavorite()
    })

    // 滚动/交互暂停自动滚动
    this.body.addEventListener('wheel', () => this.autoScroll.pause(), { passive: true })
    this.body.addEventListener('pointerdown', () => this.autoScroll.pause(), true)
  }

  _toggleFavorite() {
    try {
      const key = 'ltk_peek_favorites'
      const list = JSON.parse(localStorage.getItem(key) || '[]')
      const idx = list.indexOf(this.topicId)
      if (idx >= 0) {
        list.splice(idx, 1)
        this.root.querySelector('.peek-btn-fav').textContent = '⭐'
      } else {
        list.unshift(this.topicId)
        if (list.length > 100) list.length = 100
        this.root.querySelector('.peek-btn-fav').textContent = '🌟'
      }
      localStorage.setItem(key, JSON.stringify(list))
    } catch {}
  }

  _esc(str) {
    const d = document.createElement('div')
    d.textContent = str || ''
    return d.innerHTML
  }

  _injectStyles() {
    if (document.getElementById(STYLE_ID)) return
    const style = document.createElement('style')
    style.id = STYLE_ID
    style.textContent = `
      .peek-shade {
        position: fixed; inset: 0;
        background: rgba(0,0,0,.3);
        z-index: ${Z_INDEX.modal};
        opacity: 0; pointer-events: none;
        transition: opacity .25s;
      }
      .peek-shade.open { opacity: 1; pointer-events: auto; }
      .peek-drawer {
        position: fixed;
        top: 0; right: 0; bottom: 0;
        z-index: ${Z_INDEX.modal + 1};
        background: var(--ltk-bg, #fff);
        box-shadow: -4px 0 20px rgba(0,0,0,.15);
        display: flex; flex-direction: column;
        transform: translateX(100%);
        transition: transform .3s ease;
      }
      .peek-drawer.open { transform: translateX(0); }
      .peek-header {
        display: flex; align-items: center; justify-content: space-between;
        padding: 10px 14px;
        background: var(--ltk-header-bg, #f8f9fa);
        border-bottom: 1px solid var(--ltk-border, #e5e7eb);
        flex-shrink: 0;
      }
      .peek-title-area {
        display: flex; align-items: center; gap: 8px;
        flex: 1; min-width: 0;
      }
      .peek-mode-badge {
        font-size: 10px; padding: 2px 6px;
        background: var(--ltk-primary, #3b82f6);
        color: #fff; border-radius: 4px;
        flex-shrink: 0;
      }
      .peek-title {
        font-size: 13px; font-weight: 600;
        white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
      }
      .peek-header-actions {
        display: flex; gap: 2px; flex-shrink: 0;
      }
      .peek-btn {
        width: 28px; height: 28px;
        background: none; border: none;
        cursor: pointer; font-size: 14px;
        border-radius: 6px;
        display: flex; align-items: center; justify-content: center;
      }
      .peek-btn:hover { background: var(--ltk-hover, #f0f1f3); }
      .peek-body {
        flex: 1; overflow-y: auto; padding: 14px;
      }
      .peek-iframe {
        width: 100%; height: 100%; border: none;
      }
      .peek-footer {
        padding: 6px 14px;
        border-top: 1px solid var(--ltk-border, #e5e7eb);
        font-size: 11px; color: var(--ltk-text-muted, #9ca3af);
        flex-shrink: 0;
      }
      .peek-loading, .peek-error {
        text-align: center; padding: 32px;
        color: var(--ltk-text-muted, #9ca3af);
        font-size: 13px;
      }
      .peek-error { color: #ef4444; }
      .peek-summary { }
      .peek-topic-title {
        font-size: 16px; font-weight: 600; margin-bottom: 8px;
      }
      .peek-topic-meta {
        display: flex; gap: 12px; font-size: 12px;
        color: var(--ltk-text-muted, #9ca3af); margin-bottom: 8px;
      }
      .peek-category {
        font-size: 11px; background: var(--ltk-hover, #f0f1f3);
        padding: 2px 8px; border-radius: 4px;
        color: var(--ltk-text-secondary, #6b7280);
        display: inline-block; margin-bottom: 8px;
      }
      .peek-posters {
        display: flex; gap: 6px; flex-wrap: wrap; margin-bottom: 8px;
      }
      .peek-poster {
        font-size: 11px; background: var(--ltk-primary-light, #eff6ff);
        color: var(--ltk-primary, #3b82f6);
        padding: 2px 8px; border-radius: 10px;
      }
      .peek-divider {
        border: none; border-top: 1px solid var(--ltk-border, #e5e7eb);
        margin: 12px 0;
      }
      .peek-stream-placeholder {
        text-align: center; padding: 20px;
        color: var(--ltk-text-muted, #9ca3af); font-size: 13px;
      }
      .peek-stream-placeholder .peek-btn {
        width: auto; height: auto; padding: 6px 14px;
        background: var(--ltk-primary, #3b82f6);
        color: #fff; border-radius: 6px; font-size: 12px;
        margin-top: 8px; display: inline-flex;
      }
      `
    document.head.appendChild(style)
  }
}
