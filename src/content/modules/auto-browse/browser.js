/**
 * 浏览引擎（基于 ryen.js 参考实现）
 *
 * 核心流程：
 * 1. 列表页 → fetch /latest.json → 存 localStorage → 跳转第一个话题
 * 2. 话题页 → 仿真人滚动 → 到底部 → 从 localStorage 取下一个话题 → 跳转
 * 3. 话题列表空了 → 跳回列表页重新 fetch
 * 4. 首次使用 → 必读文章 → 点赞 N 条 → 正常浏览
 *
 * 所有页面跳转使用 window.location.href（整页跳转），
 * 内容脚本在新页面重新注入后自动恢复运行。
 */

import { history } from '../../../utils/history.js'

const random = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min
const sleep = (ms) => new Promise(r => setTimeout(r, ms))

// ========== 必读文章配置 ==========

const MUST_READ_POSTS = [
  { id: '1051',   url: 'https://linux.do/t/topic/1051/' },
  { id: '5973',   url: 'https://linux.do/t/topic/5973' },
  { id: '102770', url: 'https://linux.do/t/topic/102770' },
  { id: '154010', url: 'https://linux.do/t/topic/154010' },
  { id: '149576', url: 'https://linux.do/t/topic/149576' },
  { id: '22118',  url: 'https://linux.do/t/topic/22118' },
]
const MUST_READ_LIKES_NEEDED = 5

// ========== localStorage key 常量 ==========

const LS_PREFIX = 'ltk_ab_'

export class BrowseEngine {
  constructor(scroll, liker, options = {}) {
    this.scroll = scroll
    this.liker = liker
    this.listPath = options.listPath || '/latest'
    this.maxLikes = options.maxLikes || 50
    this.readAll = options.readAll || false
    this.onStats = options.onStats || (() => {})
    this.onInternalNavigate = options.onInternalNavigate || (() => {})

    // 运行状态
    this.running = false
    this.isScrolling = false

    // 话题列表（跨页面持久化）
    this.topicList = this._lsLoad('topicList', [])

    // 累计浏览时间
    this.accumulatedTime = this._lsLoad('accumulatedTime', 0)
    this.lastActionTime = 0
    this.browseTime = 3600000   // 1 小时
    this.restTime = 600000      // 10 分钟

    // 必读文章状态
    this.firstUseChecked = this._lsLoad('firstUseChecked', false)
    this.likesCount = this._lsLoad('likesCount', 0)
    this.selectedPost = this._lsLoad('selectedPost', null)

    // 统计
    this.sessionViews = 0
    this._sessionViewed = new Set()
  }

  // ========== localStorage 工具 ==========

  _lsKey(key) { return `${LS_PREFIX}${key}` }

  _lsLoad(key, defaultValue = null) {
    try {
      const value = localStorage.getItem(this._lsKey(key))
      return value ? JSON.parse(value) : defaultValue
    } catch { return defaultValue }
  }

  _lsSave(key, value) {
    try { localStorage.setItem(this._lsKey(key), JSON.stringify(value)) } catch {}
  }

  _lsRemove(key) {
    try { localStorage.removeItem(this._lsKey(key)) } catch {}
  }

  // ========== 控制接口 ==========

  start() {
    if (this.running) return
    this.running = true
    this.lastActionTime = Date.now()

    // 从 localStorage 恢复话题列表
    this.topicList = this._lsLoad('topicList', [])
    this.accumulatedTime = this._lsLoad('accumulatedTime', 0)

    const isTopicPage = this._isTopicPage()
    console.log('[BrowseEngine] 启动, 话题页:', isTopicPage, ', 话题列表剩余:', this.topicList.length)

    if (!this.firstUseChecked) {
      this._handleFirstUse()
    } else if (isTopicPage) {
      this._startScrolling()
    } else {
      this._fetchAndBrowse()
    }
  }

  stop() {
    this.running = false
    this.isScrolling = false
    this._lsSave('accumulatedTime', this.accumulatedTime)
    console.log('[BrowseEngine] 停止')
  }

  restart() {
    this.stop()
    setTimeout(() => this.start(), 1000)
  }

  destroy() { this.stop() }

  setListPath(path) { this.listPath = path }

  setReadAll(v) { this.readAll = v }

  /**
   * SPA 页面变化（保留接口兼容，但当前使用整页跳转，此方法基本不需要）
   */
  handlePageChange(pageType) {
    if (!this.running) return

    if (pageType === 'topic') {
      setTimeout(() => this._startScrolling(), 800)
    } else {
      this.isScrolling = false
      setTimeout(() => this._fetchAndBrowse(), 500)
    }
  }

  clearHistory() {
    history.clear()
    this._sessionViewed.clear()
    this.sessionViews = 0
    this._lsRemove('topicList')
    this.topicList = []
    this._emitStats()
  }

  // ========== 必读文章流程 ==========

  async _handleFirstUse() {
    if (!this.running) return

    // 还没选文章 → 随机选一篇
    if (!this.selectedPost) {
      const idx = Math.floor(Math.random() * MUST_READ_POSTS.length)
      this.selectedPost = MUST_READ_POSTS[idx]
      this._lsSave('selectedPost', this.selectedPost)
      console.log(`[BrowseEngine] 首次使用，随机选择必读文章: ${this.selectedPost.url}`)
      window.location.href = this.selectedPost.url
      return
    }

    // 在必读文章页面
    const currentUrl = window.location.href
    if (currentUrl.includes(this.selectedPost.url.replace(/\/$/, ''))) {
      console.log(`[BrowseEngine] 在必读文章页面, 已点赞: ${this.likesCount}/${MUST_READ_LIKES_NEEDED}`)

      while (this.likesCount < MUST_READ_LIKES_NEEDED && this.running) {
        const liked = await this._likeRandomComment()
        if (liked) {
          this.likesCount++
          this._lsSave('likesCount', this.likesCount)
        }

        if (this.likesCount >= MUST_READ_LIKES_NEEDED) {
          console.log('[BrowseEngine] 完成必读点赞，开始正常浏览')
          this._lsSave('firstUseChecked', true)
          this.firstUseChecked = true
          this._lsRemove('selectedPost')
          this._lsRemove('likesCount')
          this.selectedPost = null
          this.likesCount = 0
          await this._fetchAndBrowse()
          return
        }

        await sleep(800)
      }
    } else {
      // 不在必读文章页面，跳过去
      window.location.href = this.selectedPost.url
    }
  }

  /**
   * 在必读文章中随机点赞一条评论
   */
  async _likeRandomComment() {
    if (!this.running) return false

    const likeButtons = Array.from(document.querySelectorAll(
      '.like-button, .like-count, [data-like-button], .discourse-reactions-reaction-button'
    )).filter(btn =>
      btn &&
      btn.offsetParent !== null &&
      !btn.classList.contains('has-like') &&
      !btn.classList.contains('liked')
    )

    if (likeButtons.length > 0) {
      const btn = likeButtons[Math.floor(Math.random() * likeButtons.length)]
      btn.scrollIntoView({ behavior: 'smooth', block: 'center' })
      await sleep(1000)

      if (!this.running) return false

      console.log('[BrowseEngine] 必读点赞')
      btn.click()
      await sleep(1000)
      return true
    }

    // 当前可见区域没有可点赞的评论，往下滚动
    window.scrollBy({ top: 500, behavior: 'smooth' })
    await sleep(1000)
    return false
  }

  // ========== 话题列表获取 ==========

  /**
   * 从 API 获取话题列表，存 localStorage，然后跳转第一个
   */
  async _fetchAndBrowse() {
    if (!this.running) return

    // 如果还有缓存的列表，直接用
    const cached = this._lsLoad('topicList', [])
    if (cached.length > 0 && this.topicList.length === 0) {
      this.topicList = cached
    }

    if (this.topicList.length > 0) {
      await this._navigateNextTopic()
      return
    }

    console.log('[BrowseEngine] 从 API 获取话题列表...')
    await this._fetchTopics()
    await this._navigateNextTopic()
  }

  async _fetchTopics() {
    let page = 1
    const topicList = []
    let retryCount = 0
    const maxRetries = 3
    const topicLimit = 100
    const commentLimit = 1000

    while (topicList.length < topicLimit && retryCount < maxRetries) {
      try {
        const resp = await fetch(`https://linux.do/latest.json?no_definitions=true&page=${page}`)
        const data = await resp.json()

        if (data?.topic_list?.topics) {
          const filtered = data.topic_list.topics.filter(t => t.posts_count < commentLimit)
          topicList.push(...filtered)
          page++
        } else {
          break
        }
      } catch (err) {
        console.error('[BrowseEngine] 获取话题列表失败:', err)
        retryCount++
        await sleep(1000)
      }
    }

    if (topicList.length > topicLimit) {
      topicList.length = topicLimit
    }

    this.topicList = topicList
    this._lsSave('topicList', topicList)
    console.log(`[BrowseEngine] 已获取 ${topicList.length} 个话题`)
  }

  /**
   * 从缓存列表中取出下一个话题并跳转
   */
  async _navigateNextTopic() {
    if (this.topicList.length === 0) {
      await this._fetchTopics()
    }

    if (this.topicList.length > 0) {
      const topic = this.topicList.shift()
      this._lsSave('topicList', this.topicList)

      const url = topic.last_read_post_number
        ? `https://linux.do/t/topic/${topic.id}/${topic.last_read_post_number}`
        : `https://linux.do/t/topic/${topic.id}`

      console.log(`[BrowseEngine] 导航到: ${topic.title} (${url})`)
      this.onInternalNavigate?.(url)
      window.location.href = url
    } else {
      console.log('[BrowseEngine] 没有更多话题，返回列表页')
      const listUrl = `https://linux.do${this.listPath}`
      this.onInternalNavigate?.(listUrl)
      window.location.href = listUrl
    }
  }

  // ========== 话题页滚动浏览 ==========

  async _startScrolling() {
    if (this.isScrolling) return
    this.isScrolling = true
    this.lastActionTime = Date.now()

    const topicId = this._getTopicId(window.location.href)
    console.log('[BrowseEngine] 开始滚动浏览, topicId:', topicId)

    if (topicId && !this._sessionViewed.has(topicId)) {
      this._sessionViewed.add(topicId)
      this.sessionViews++
      this._emitStats()
    }

    this.scroll.reset()

    // 跳过模式：只读 50~65%
    const skipMode = !this.readAll
    const skipPercent = skipMode ? random(50, 65) : 100

    while (this.isScrolling && this.running) {
      // 1. 滚轮突发滚动
      await this.scroll.wheelBurst(1)

      // 2. 累计时间，检查休息
      this._accumulateTime()
      if (this.accumulatedTime >= this.browseTime) {
        await this._takeRest()
      }

      // 3. 微停顿 / 长休息 / 内容驻留
      await this.scroll.maybeMicroPause()
      await this.scroll.maybeLongRest()
      await this.scroll.maybeDwell()

      // 4. 跳过模式检查
      if (skipMode) {
        const h = document.documentElement
        if (h.scrollHeight > 0 && (h.scrollTop + h.clientHeight) / h.scrollHeight * 100 >= skipPercent) {
          console.log(`[BrowseEngine] 跳过模式，已读 ~${Math.round((h.scrollTop + h.clientHeight) / h.scrollHeight * 100)}%`)
          break
        }
      }

      // 5. 到达底部 → 下一个话题
      if (this._isNearBottom()) {
        await sleep(600)
        if (this._isNearBottom()) {
          console.log('[BrowseEngine] 到达底部')
          break
        }
      }
    }

    // 离开当前话题页
    this.isScrolling = false
    this._lsSave('accumulatedTime', this.accumulatedTime)

    if (this.running) {
      await sleep(800)
      // 从缓存取下一个话题
      this.topicList = this._lsLoad('topicList', [])
      await this._navigateNextTopic()
    }
  }

  // ========== 休息机制 ==========

  _accumulateTime() {
    const now = Date.now()
    this.accumulatedTime += now - this.lastActionTime
    this.lastActionTime = now
  }

  async _takeRest() {
    this.accumulatedTime = 0
    this._lsSave('accumulatedTime', 0)
    console.log(`[BrowseEngine] 休息 ${this.restTime / 60000} 分钟...`)
    this._emitStats()

    // 休息期间仍然检查 running 状态
    const start = Date.now()
    while (Date.now() - start < this.restTime && this.running) {
      await sleep(1000)
    }

    if (this.running) {
      console.log('[BrowseEngine] 休息结束，继续浏览')
      this.lastActionTime = Date.now()
    }
  }

  // ========== 工具方法 ==========

  _isTopicPage() {
    return /\/t\/topic\/\d+/.test(window.location.href)
  }

  _isNearBottom() {
    const h = document.documentElement
    return h.scrollTop + h.clientHeight >= h.scrollHeight - 200
  }

  _getTopicId(url) {
    const m = url?.match(/\/t\/topic\/(\d+)/) || url?.match(/\/t\/[^/]+\/(\d+)/)
    return m ? m[1] : null
  }

  _emitStats() {
    const stats = history.getStats()
    this.onStats?.({
      sessionViews: this.sessionViews,
      sessionLikes: this.liker?.sessionLiked || 0,
      totalViews: stats.totalViews,
      totalLikes: stats.totalLikes,
    })
  }
}