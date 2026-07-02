/**
 * 自动浏览模块
 *
 * 合并自 linuxdo-automation + ryen.js 两个油猴脚本。
 * 功能：自动浏览帖子、仿真人滚动、随机点赞、必读文章、休息机制。
 */

import { Module, getPageType } from '../base.js'
import { settings } from '../../../utils/settings.js'
import { history } from '../../../utils/history.js'
import { ScrollController } from './scroll.js'
import { LikeSystem } from './like.js'
import { BrowseEngine } from './browser.js'
import { ControlPanel } from './panel.js'

const SPEED_PRESETS = {
  slow:   { name: '慢速', wheelBurstMin: 2, wheelBurstMax: 5, wheelStepMin: 10, wheelStepMax: 28, wheelIntervalMin: 18, wheelIntervalMax: 35, microPauseChance: 0.45, microPauseMin: 400, microPauseMax: 1500, longRestChance: 0.04, longRestMin: 3000, longRestMax: 8000, dwellMin: 1000, dwellMax: 2500, upScrollChance: 0.05, upScrollMin: 15, upScrollMax: 60, retry: 4 },
  normal: { name: '正常', wheelBurstMin: 3, wheelBurstMax: 8, wheelStepMin: 12, wheelStepMax: 45, wheelIntervalMin: 14, wheelIntervalMax: 28, microPauseChance: 0.35, microPauseMin: 250, microPauseMax: 1100, longRestChance: 0.03, longRestMin: 2500, longRestMax: 7000, dwellMin: 800,  dwellMax: 2000, upScrollChance: 0,    upScrollMin: 20,  upScrollMax: 90,  retry: 3 },
  fast:   { name: '快速', wheelBurstMin: 4, wheelBurstMax: 10, wheelStepMin: 20, wheelStepMax: 55, wheelIntervalMin: 10, wheelIntervalMax: 22, microPauseChance: 0.25, microPauseMin: 150, microPauseMax: 600,  longRestChance: 0.02, longRestMin: 1500, longRestMax: 4000, dwellMin: 400,  dwellMax: 1000, upScrollChance: 0,    upScrollMin: 10,  upScrollMax: 50,  retry: 2 },
  turbo:  { name: '极速', wheelBurstMin: 5, wheelBurstMax: 12, wheelStepMin: 30, wheelStepMax: 70, wheelIntervalMin: 8,  wheelIntervalMax: 16, microPauseChance: 0.15, microPauseMin: 100, microPauseMax: 300,  longRestChance: 0.01, longRestMin: 1000, longRestMax: 2000, dwellMin: 100,  dwellMax: 500,  upScrollChance: 0,    upScrollMin: 10,  upScrollMax: 30,  retry: 2 },
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
        readAll: false,
        restEnabled: false,
        restInterval: 15,
        restDuration: 5,
      },
    })

    this.scroll = null
    this.liker = null
    this.engine = null
    this.panel = null
    this.running = false
    this.stuckTimer = null
    this.lastActivity = 0
    this.mustReadList = []
    this.stats = { sessionViews: 0, sessionLikes: 0, totalViews: 0, totalLikes: 0 }
  }

  async onInit(s) {
    await history.init()

    // 加载必读列表
    this.mustReadList = await this._loadMustRead()

    this.scroll = new ScrollController(SPEED_PRESETS[s.speed] || SPEED_PRESETS.normal)
    this.liker = new LikeSystem({
      enabled: s.enableLike,
      chance: s.likeChance,
    })
    this.engine = new BrowseEngine(this.scroll, this.liker, {
      listPath: LIST_OPTIONS[s.listType]?.path || '/latest',
      maxViews: s.maxSessionViews,
      maxLikes: s.maxSessionLikes,
      readAll: s.readAll,
      restEnabled: s.restEnabled,
      browseInterval: s.restInterval,
      restDuration: s.restDuration,
      mustRead: this.mustReadList,
      onStats: (stats) => this._onStats(stats),
      onMustReadDone: (item) => this._onMustReadDone(item),
      onResting: (duration, endTime) => this.panel?.setResting(duration, endTime),
      onRestEnd: () => this.panel?.setRestEnd(),
    })

    // 创建面板
    this.panel = new ControlPanel({
      speed: s.speed,
      listType: s.listType,
      enableLike: s.enableLike,
      likeChance: s.likeChance,
      readAll: s.readAll,
      mustRead: this.mustReadList,
      onStart: () => this.start(),
      onStop: () => this.stop(),
      onSpeedChange: (v) => this._setSpeed(v),
      onListChange: (v) => this._setList(v),
      onLikeToggle: (v) => this._setLike(v),
      onLikeChanceChange: (v) => this._setLikeChance(v),
      onReadAllToggle: (v) => this._setReadAll(v),
      onClearHistory: () => this.engine?.clearHistory(),
      onAddMustRead: (url) => this._addMustRead(url),
      onRemoveMustRead: (idx) => this._removeMustRead(idx),
      onSkipRest: () => this.engine?.skipRest(),
    })
    this.panel.mount()

    // 恢复上次运行状态：使用整页跳转，每次页面加载时自动恢复
    if (this._shouldResume(s)) {
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
        { key: 'readAll',      label: '单篇阅读深度',  type: 'toggle', default: false, description: '全部：从第一楼看到底；50%：读到约 50~65% 后进入下一帖' },
        { key: 'restEnabled',  label: '启用休息机制', type: 'toggle', default: false },
        { key: 'restInterval', label: '浏览间隔(分钟)', type: 'number', default: 15 },
        { key: 'restDuration', label: '休息时长(分钟)', type: 'number', default: 5 },
      ],
    }
  }

  onSettingsChange(newSettings) {
    this.settings = { ...this.settings, ...newSettings }
    // 更新引擎休息参数
    if (this.engine) {
      this.engine.restEnabled = newSettings.restEnabled ?? this.engine.restEnabled
      this.engine.browseTime = (newSettings.restInterval ?? (this.engine.browseTime / 60000)) * 60000
      this.engine.restTime = (newSettings.restDuration ?? (this.engine.restTime / 60000)) * 60000
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

  _setReadAll(v) {
    this.settings.readAll = v
    this.engine?.setReadAll(v)
    settings.setModule(this.id, { readAll: v })
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

  _shouldResume(s) {
    return this._loadRunning()
  }

  // ========== 必读列表管理 ==========

  async _loadMustRead() {
    try {
      const result = await chrome.storage.local.get('toolkit.module.auto-browse.mustRead')
      return result['toolkit.module.auto-browse.mustRead'] || []
    } catch { return [] }
  }

  async _saveMustRead() {
    try {
      await chrome.storage.local.set({ 'toolkit.module.auto-browse.mustRead': this.mustReadList })
    } catch {}
  }

  async _addMustRead(url) {
    // 上限 50 条
    if (this.mustReadList.length >= 50) return
    // 去重
    if (this.mustReadList.some(m => m.url === url)) return
    const item = {
      url,
      title: url.replace(/https?:\/\/linux\.do\/t\/[^/]+\/\d+/, '未知话题').replace(/\/$/, ''),
      addedAt: Date.now(),
      read: false,
    }
    this.mustReadList.push(item)
    await this._saveMustRead()
    // 同步到 engine
    if (this.engine) this.engine.mustReadList = this.mustReadList
    this.panel?.updateMustRead(this.mustReadList)
  }

  async _removeMustRead(idx) {
    if (idx < 0 || idx >= this.mustReadList.length) return
    this.mustReadList.splice(idx, 1)
    await this._saveMustRead()
    if (this.engine) this.engine.mustReadList = this.mustReadList
    this.panel?.updateMustRead(this.mustReadList)
  }

  async _onMustReadDone(item) {
    await this._saveMustRead()
    this.panel?.updateMustRead(this.mustReadList)
  }
}
