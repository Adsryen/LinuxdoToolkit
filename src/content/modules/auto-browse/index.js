/**
 * 自动浏览模块
 *
 * 合并自 linuxdo-automation + ryen.js 两个油猴脚本。
 * 功能：自动浏览帖子、仿真人滚动、随机点赞、必读文章、休息机制。
 */

import { Module, getPageType } from '../base.js'
import { settings } from '../../utils/settings.js'
import { ScrollController } from './scroll.js'
import { LikeSystem } from './like.js'
import { BrowseEngine } from './browser.js'
import { ControlPanel } from './panel.js'

const SPEED_PRESETS = {
  slow:   { name: '慢速', scrollStep: 300, scrollInterval: 2500, loadWait: 4000, readMin: 2000, readMax: 4000, retry: 4 },
  normal: { name: '正常', scrollStep: 400, scrollInterval: 1500, loadWait: 2500, readMin: 800,  readMax: 1500, retry: 3 },
  fast:   { name: '快速', scrollStep: 500, scrollInterval: 800,  loadWait: 1500, readMin: 300,  readMax: 800,  retry: 3 },
  turbo:  { name: '极速', scrollStep: 600, scrollInterval: 400,  loadWait: 1000, readMin: 100,  readMax: 300,  retry: 2 },
}

const LIST_OPTIONS = {
  latest:  { name: '最新', path: '/latest' },
  new:     { name: '新帖', path: '/new' },
  unread:  { name: '未读', path: '/unread' },
}

export class AutoBrowseModule extends Module {
  constructor() {
    super({
      id: 'auto-browse',
      name: '自动浏览',
      icon: '🔄',
      description: '自动浏览帖子、随机点赞、仿真人滚动',
      category: 'efficiency',
      defaultSettings: {
        speed: 'normal',
        listType: 'latest',
        enableLike: true,
        likeChance: 'medium',
        maxSessionViews: 50,
        maxSessionLikes: 50,
        autoResume: false,
      },
    })

    this.scroll = null
    this.liker = null
    this.engine = null
    this.panel = null
    this.running = false
    this.stuckTimer = null
    this.lastActivity = 0
    this.stats = { sessionViews: 0, sessionLikes: 0, totalViews: 0, totalLikes: 0 }
  }

  async onInit(s) {
    this.scroll = new ScrollController(SPEED_PRESETS[s.speed] || SPEED_PRESETS.normal)
    this.liker = new LikeSystem({
      enabled: s.enableLike,
      chance: s.likeChance,
    })
    this.engine = new BrowseEngine(this.scroll, this.liker, {
      listPath: LIST_OPTIONS[s.listType]?.path || '/latest',
      maxViews: s.maxSessionViews,
      maxLikes: s.maxSessionLikes,
      onStats: (stats) => this._onStats(stats),
    })

    // 创建面板
    this.panel = new ControlPanel({
      speed: s.speed,
      listType: s.listType,
      enableLike: s.enableLike,
      likeChance: s.likeChance,
      onStart: () => this.start(),
      onStop: () => this.stop(),
      onSpeedChange: (v) => this._setSpeed(v),
      onListChange: (v) => this._setList(v),
      onLikeToggle: (v) => this._setLike(v),
      onLikeChanceChange: (v) => this._setLikeChance(v),
      onClearHistory: () => this.engine?.clearHistory(),
    })
    this.panel.mount()

    // 恢复上次状态
    if (s.autoResume && this._loadRunning()) {
      setTimeout(() => this.start(), 2000)
    }
  }

  onDestroy() {
    this.stop()
    this.panel?.unmount()
    this.engine?.destroy()
  }

  onEnable() {
    this.panel?.show()
  }

  onDisable() {
    this.stop()
    this.panel?.hide()
  }

  onPageChange(url, pageType) {
    if (!this.running) return
    this.lastActivity = Date.now()
    this.engine?.handlePageChange(pageType)
  }

  getStatusBar() {
    if (!this.running) return null
    return {
      text: `已浏览 ${this.stats.sessionViews} 帖 · 点赞 ${this.stats.sessionLikes}`,
      actions: [{ label: '暂停', onClick: () => this.stop() }],
    }
  }

  getSettingsSchema() {
    return {
      fields: [
        { key: 'speed',        label: '浏览速度',    type: 'select', options: Object.entries(SPEED_PRESETS).map(([k, v]) => ({ value: k, label: v.name })), default: 'normal' },
        { key: 'listType',     label: '列表来源',    type: 'select', options: Object.entries(LIST_OPTIONS).map(([k, v]) => ({ value: k, label: v.name })), default: 'latest' },
        { key: 'enableLike',   label: '随机点赞',    type: 'toggle', default: true },
        { key: 'likeChance',   label: '点赞概率',    type: 'select', options: [{ value: 'low', label: '低 5%' }, { value: 'medium', label: '中 15%' }, { value: 'high', label: '高 25%' }, { value: 'veryHigh', label: '极高 40%' }], default: 'medium' },
        { key: 'maxSessionViews', label: '单次最大浏览', type: 'number', default: 50 },
        { key: 'maxSessionLikes', label: '单次最大点赞', type: 'number', default: 50 },
        { key: 'autoResume',   label: '自动恢复运行', type: 'toggle', default: false },
      ],
    }
  }

  // ========== 控制 ==========

  start() {
    if (this.running) return
    this.running = true
    this.lastActivity = Date.now()
    this._saveRunning(true)
    this._startStuckDetection()
    this.engine.start()
    this.panel?.setRunning(true)
    console.log('[AutoBrowse] 开始运行')
  }

  stop() {
    if (!this.running) return
    this.running = false
    this._saveRunning(false)
    this._stopStuckDetection()
    this.engine.stop()
    this.panel?.setRunning(false)
    console.log('[AutoBrowse] 停止运行')
  }

  // ========== 内部 ==========

  _onStats(stats) {
    this.stats = { ...this.stats, ...stats }
    this.lastActivity = Date.now()
    this.panel?.updateStats(this.stats)
  }

  _setSpeed(v) {
    this.settings.speed = v
    this.scroll?.updateConfig(SPEED_PRESETS[v] || SPEED_PRESETS.normal)
    settings.setModule(this.id, { speed: v })
  }

  _setList(v) {
    this.settings.listType = v
    this.engine?.setListPath(LIST_OPTIONS[v]?.path || '/latest')
    settings.setModule(this.id, { listType: v })
  }

  _setLike(v) {
    this.settings.enableLike = v
    this.liker?.setEnabled(v)
    settings.setModule(this.id, { enableLike: v })
  }

  _setLikeChance(v) {
    this.settings.likeChance = v
    this.liker?.setChance(v)
    settings.setModule(this.id, { likeChance: v })
  }

  _startStuckDetection() {
    this._stopStuckDetection()
    this.lastActivity = Date.now()
    this.stuckTimer = setInterval(() => {
      if (!this.running) return
      if (Date.now() - this.lastActivity > 30000) {
        console.warn('[AutoBrowse] 检测到卡住，自动重启')
        this.engine?.restart()
        this.lastActivity = Date.now()
      }
    }, 10000)
  }

  _stopStuckDetection() {
    if (this.stuckTimer) {
      clearInterval(this.stuckTimer)
      this.stuckTimer = null
    }
  }

  _saveRunning(v) {
    try { localStorage.setItem('ltk_auto_running', JSON.stringify(v)) } catch {}
  }

  _loadRunning() {
    try { return JSON.parse(localStorage.getItem('ltk_auto_running') || 'false') } catch { return false }
  }
}
