/**
 * 快速预览模块（LD Peek）
 *
 * 精简迁移自 LD Peek 油猴脚本（15000+ 行）。
 * 保留核心功能：
 * - 悬浮入口按钮（出现在话题链接旁）
 * - 抽屉模式预览（iframe 加载话题详情）
 * - 话题缓存
 * - 自动阅读滚动
 * - 收藏夹 / 稍后读
 */

import { Module, getPageType } from '../base.js'
import { settings } from '../../../utils/settings.js'
import { PeekButton } from './button.js'
import { PeekDrawer } from './drawer.js'
import { TopicCache } from './cache.js'

export class PeekModule extends Module {
  constructor() {
    super({
      id: 'peek',
      name: '快速预览',
      icon: '👁️',
      description: '悬浮入口 + 抽屉预览 + 自动阅读',
      category: 'preview',
      defaultSettings: {
        mode: 'summary',          // summary | detail
        drawerWidth: 50,          // 百分比
        autoScrollSpeed: 42,      // px/s
        enablePrefetch: true,
        trackView: true,
        trackViewDelay: 2500,     // ms
      },
    })

    this.button = null
    this.drawer = null
    this.cache = null
    this._hoverTimer = 0
    this._topicObserver = null
  }

  async onInit(s) {
    this.cache = new TopicCache({ maxSize: 10 })

    this.drawer = new PeekDrawer({
      mode: s.mode,
      width: s.drawerWidth,
      cache: this.cache,
      onClose: () => this.button?.hide(),
      onTopicChange: (id) => this._trackView(id),
    })

    this.button = new PeekButton({
      onClick: (topicId, href) => this._openTopic(topicId, href),
      onReadLater: (topicId) => this._addToReadLater(topicId),
    })

    // 监听页面上的话题链接
    this._setupLinkObserver()
  }

  onDestroy() {
    this.drawer?.close()
    this.drawer?.unmount()
    this.button?.unmount()
    this._disconnectObserver()
  }

  onEnable() {
    this._setupLinkObserver()
  }

  onDisable() {
    this.drawer?.close()
    this._disconnectObserver()
  }

  onPageChange(url, pageType) {
    // 页面变化时重新扫描链接
    setTimeout(() => this._scanLinks(), 500)
  }

  getStatusBar() {
    const cacheSize = this.cache?.size || 0
    return cacheSize > 0 ? { text: `预览缓存 ${cacheSize}` } : null
  }

  getSettingsSchema() {
    return {
      fields: [
        { key: 'mode', label: '默认预览模式', type: 'select',
          options: [{ value: 'summary', label: '摘要' }, { value: 'detail', label: '详情（iframe）' }],
          default: 'summary' },
        { key: 'drawerWidth', label: '抽屉宽度 (%)', type: 'number', default: 50 },
        { key: 'autoScrollSpeed', label: '自动滚动速度 (px/s)', type: 'number', default: 42 },
        { key: 'enablePrefetch', label: '悬停预加载', type: 'toggle', default: true },
        { key: 'trackView', label: '记录浏览历史', type: 'toggle', default: true },
      ],
    }
  }

  // ========== 内部 ==========

  _openTopic(topicId, href) {
    const mode = this.settings.mode || 'summary'
    this.drawer?.open(topicId, mode, href)
  }

  _setupLinkObserver() {
    this._disconnectObserver()
    this._topicObserver = new MutationObserver(() => this._scanLinks())
    if (document.body) {
      this._topicObserver.observe(document.body, { childList: true, subtree: true })
    }
    this._scanLinks()
  }

  _disconnectObserver() {
    if (this._topicObserver) {
      this._topicObserver.disconnect()
      this._topicObserver = null
    }
  }

  _scanLinks() {
    const links = document.querySelectorAll(
      'a.title[href*="/t/topic/"], a.search-link[href*="/t/topic/"], a.raw-topic-link[href*="/t/topic/"]'
    )
    for (const link of links) {
      if (link.dataset.peekBound) continue
      link.dataset.peekBound = 'true'

      const topicId = this._extractTopicId(link.href)
      if (!topicId) continue

      // 悬浮入口
      link.addEventListener('mouseenter', (e) => {
        clearTimeout(this._hoverTimer)
        this._hoverTimer = setTimeout(() => {
          this.button?.show(link, topicId, link.href)
          // 预加载
          if (this.settings.enablePrefetch) {
            this.cache?.prefetch(topicId)
          }
        }, 180)
      })

      link.addEventListener('mouseleave', () => {
        clearTimeout(this._hoverTimer)
        this.button?.hideSoon(300)
      })
    }
  }

  _extractTopicId(href) {
    const m = href?.match(/\/t\/topic\/(\d+)/)
    return m ? m[1] : null
  }

  _trackView(topicId) {
    if (!this.settings.trackView) return
    const delay = this.settings.trackViewDelay || 2500
    setTimeout(() => {
      this.cache?.markSeen(topicId)
    }, delay)
  }

  _addToReadLater(topicId) {
    try {
      const key = 'ltk_peek_read_later'
      const list = JSON.parse(localStorage.getItem(key) || '[]')
      if (!list.includes(topicId)) {
        list.unshift(topicId)
        if (list.length > 100) list.length = 100
        localStorage.setItem(key, JSON.stringify(list))
      }
    } catch {}
  }
}
