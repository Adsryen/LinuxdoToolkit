/**
 * 话题侧栏模块
 *
 * 迁移自 linux-do-side-topic 扩展。
 * 功能：可拖拽/缩放侧边面板，实时话题列表，Feed 切换，分类筛选。
 */

import { Module } from '../base.js'
import { settings } from '../../../utils/settings.js'
import { SidePanel } from './panel.js'
import { TopicStore } from './topics.js'

const FEEDS = {
  latest:  { name: '最新', path: '/latest' },
  new:     { name: '新帖', path: '/new' },
  unread:  { name: '未读', path: '/unread' },
  top:     { name: '排行', path: '/top' },
}

export class SideTopicModule extends Module {
  constructor() {
    super({
      id: 'side-topic',
      name: '话题侧栏',
      icon: '📋',
      description: '可拖拽侧边面板，实时话题列表',
      category: 'preview',
      defaultSettings: {
        feed: 'latest',
        panelPosition: null,   // { left, top }
        panelSize: null,       // { width, height }
        collapsed: false,
      },
    })

    this.panel = null
    this.store = null
    this.refreshTimer = null
  }

  async onInit(s) {
    this.store = new TopicStore()

    this.panel = new SidePanel({
      feed: s.feed,
      position: s.panelPosition,
      size: s.panelSize,
      collapsed: s.collapsed,
      feeds: FEEDS,
      onFeedChange: (v) => this._setFeed(v),
      onRefresh: () => this.refresh(),
      onTopicClick: (id) => this._navigateToTopic(id),
      onPositionChange: (pos) => settings.setModule(this.id, { panelPosition: pos }),
      onSizeChange: (size) => settings.setModule(this.id, { panelSize: size }),
      onCollapseChange: (v) => settings.setModule(this.id, { collapsed: v }),
    })
    this.panel.mount()

    // 首次加载
    await this.refresh()

    // 定时刷新（每 60 秒）
    this.refreshTimer = setInterval(() => this.refresh(), 60000)
  }

  onDestroy() {
    if (this.refreshTimer) {
      clearInterval(this.refreshTimer)
      this.refreshTimer = null
    }
    this.panel?.unmount()
  }

  onEnable() { this.panel?.show() }
  onDisable() { this.panel?.hide() }

  getStatusBar() {
    const count = this.store?.newCount || 0
    return count > 0 ? { text: `${count} 条新内容` } : null
  }

  getSettingsSchema() {
    return {
      fields: [
        { key: 'feed', label: '默认 Feed', type: 'select',
          options: Object.entries(FEEDS).map(([k, v]) => ({ value: k, label: v.name })),
          default: 'latest' },
        { key: 'collapsed', label: '默认折叠', type: 'toggle', default: false },
      ],
    }
  }

  // ========== 控制 ==========

  async refresh() {
    const feed = this.settings.feed || 'latest'
    const path = FEEDS[feed]?.path || '/latest'
    try {
      const topics = await this.store.fetchTopics(path)
      this.panel?.renderTopics(topics)
    } catch (e) {
      console.error('[SideTopic] 刷新失败:', e)
      this.panel?.showError('加载失败')
    }
  }

  // ========== 内部 ==========

  _setFeed(v) {
    this.settings.feed = v
    settings.setModule(this.id, { feed: v })
    this.refresh()
  }

  _navigateToTopic(topicId) {
    window.location.href = `/t/topic/${topicId}`
  }
}
