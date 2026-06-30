/**
 * 浏览引擎（永不停止，除非用户手动停止）
 */

import { history } from '../../../utils/history.js'

const random = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min
const sleep = (ms) => new Promise(r => setTimeout(r, ms))

export class BrowseEngine {
  constructor(scroll, liker, options = {}) {
    this.scroll = scroll
    this.liker = liker
    this.listPath = options.listPath || '/latest'
    this.maxLikes = options.maxLikes || 50
    this.readAll = options.readAll || false
    this.onStats = options.onStats || (() => {})

    this.running = false
    this.viewedPosts = new Set()
    this._sessionViewed = new Set()
    this.sessionViews = 0
    this._currentTopicId = null
    this._currentTopicTitle = ''
    this._currentBrowsedTo = 0
    this._currentTotalPosts = 0
    this._accumulatedTime = 0
    this._lastActionTime = 0
    this._browseTime = 3600000
    this._restTime = 600000
    this._loopGuard = 0  // 防止无限循环
  }

  start() {
    if (this.running) return
    this.running = true
    this._lastActionTime = Date.now()

    const pageType = this._detectPageType()
    console.log('[BrowseEngine] 启动，页面类型:', pageType)
    this._startLoop(pageType)
  }

  stop() {
    this.running = false
    this._flushRecord()
  }

  restart() { this.stop(); setTimeout(() => this.start(), 1000) }
  destroy() { this.stop() }
  setListPath(path) { this.listPath = path }
  setReadAll(v) { this.readAll = v }

  handlePageChange(pageType) {
    if (!this.running) return
    this._flushRecord()
    this.viewedPosts.clear()

    if (pageType === 'topic') {
      if (this._currentTopicId === this._getTopicId(window.location.href)) return
      this._currentTopicId = null
      setTimeout(() => this._browseTopicLoop(), 800)
    } else {
      // 列表页、首页、分类页、未知页 → 继续找帖子
      this._currentTopicId = null
      setTimeout(() => this._ensureListAndBrowse(), 500)
    }
  }

  clearHistory() {
    history.clear()
    this._sessionViewed.clear()
    this.viewedPosts.clear()
    this.sessionViews = 0
    this._emitStats()
  }

  // ========== 统一入口：确保在列表页并查找帖子 ==========

  async _startLoop(pageType) {
    if (pageType === 'topic') {
      await this._browseTopicLoop()
    } else {
      await this._ensureListAndBrowse()
    }
  }

  async _ensureListAndBrowse() {
    while (this.running) {
      // 检查当前是否在列表页
      const pt = this._detectPageType()
      if (pt === 'topic') {
        await this._browseTopicLoop()
        return
      }
      if (pt !== 'list' && pt !== 'home' && pt !== 'category') {
        // 不在浏览页面 → 跳到列表页
        console.log('[BrowseEngine] 不在浏览页面，跳转到', this.listPath)
        window.location.href = this.listPath
        return
      }

      // 在列表页，查找未浏览帖子
      const found = await this._findUnviewed()
      if (found) return  // 进入帖子，等 handlePageChange 回调

      // 滚动到底部，加载更多
      if (this.scroll.isAtBottom() || this._loopGuard > 0) {
        await sleep(random(1500, 2500))
        if (!this.scroll.hasNewContent()) {
          if (this.scroll.isContentFullyLoaded()) {
            this._loopGuard++
            if (this._loopGuard > 2) {
              // 当前列表页无可用内容，切换到 /latest
              console.log('[BrowseEngine] 当前列表页无新内容，切换到 /latest')
              window.location.href = '/latest'
              this._loopGuard = 0
              return
            }
            window.location.href = this.listPath
            return
          }
        }
      }

      await this.scroll.wheelBurst(1)
      await sleep(random(100, 300))
    }
  }

  // ========== 话题页浏览 ==========

  async _browseTopicLoop() {
    const topicId = this._getTopicId(window.location.href)
    if (!topicId) {
      // 不在话题页 → 去列表页
      window.location.href = this.listPath
      return
    }

    this._currentTopicId = topicId
    this._currentTopicTitle = this._extractTopicTitle()
    this._currentBrowsedTo = 0
    this._currentTotalPosts = this._extractReplyCount()
    this.viewedPosts.clear()
    this._sessionViewed.add(topicId)
    this.sessionViews++
    this._loopGuard = 0
    this._emitStats()

    this.scroll.reset()
    // 从第一楼开始读
    await this.scroll.scrollToTop()

    const skipMode = !this.readAll
    const skipPercent = skipMode ? random(50, 65) : 100

    while (this.running) {
      await this.scroll.wheelBurst(1)

      this._accumulateTime()
      if (this._accumulatedTime >= this._browseTime) {
        await this._takeRest()
      }

      await this._processVisiblePosts()
      await this.scroll.maybeMicroPause()
      await this.scroll.maybeLongRest()
      await this.scroll.maybeUpScroll()
      await this.scroll.maybeDwell()

      // 跳过模式：读到 50~65% 就跳到下一篇
      if (skipMode && this._currentTotalPosts > 0) {
        const current = document.documentElement.scrollTop + document.documentElement.clientHeight
        const total = document.documentElement.scrollHeight
        if (total > 0 && (current / total * 100) >= skipPercent) {
          this._flushRecord()
          console.log(`[BrowseEngine] 跳过模式，已读 ${Math.round(current / total * 100)}%，跳下一个`)
          await sleep(800)
          window.location.href = this.listPath
          return
        }
      }

      if (this.scroll.isAtBottom()) {
        await sleep(600)
        if (this.scroll.isAtBottom()) {
          await this._processVisiblePosts()
          this._flushRecord()
          console.log('[BrowseEngine] 到达底部，返回列表')
          await sleep(800)
          window.location.href = this.listPath
          return
        }
      }
    }
  }

  // ========== 查找未浏览帖子 ==========

  async _findUnviewed() {
    // 通用选择器，覆盖所有列表页
    const rows = document.querySelectorAll(
      '.topic-list-item, tr[data-topic-id], .topic-list-body tr, .latest-topic-list-item, .topic-list .topic-list-item'
    )
    for (const row of rows) {
      if (!this.running) return false
      const link = row.querySelector(
        'a[href*="/t/topic/"], a[href*="/t/"], .title a[href*="/t/"], .link-top-line a[href*="/t/"], a.raw-topic-link[href*="/t/"]'
      )
      if (!link) continue

      const topicId = this._getTopicId(link.href)
      if (!topicId) continue

      if (!this.readAll && (this._sessionViewed.has(topicId) || history.isViewed(topicId))) {
        this._markViewed(row)
        continue
      }

      const title = link.textContent?.trim() || ''
      link.scrollIntoView({ behavior: 'auto', block: 'center' })
      await sleep(random(300, 600))
      this._currentTopicId = topicId
      this._currentTopicTitle = title
      this._sessionViewed.add(topicId)
      link.click()
      return true
    }
    return false
  }

  // ========== 帖子处理 ==========

  async _processVisiblePosts() {
    const posts = document.querySelectorAll('article[id^="post_"]')
    const vh = window.innerHeight

    for (const post of posts) {
      if (!this.running) break
      const rect = post.getBoundingClientRect()
      if (rect.top < vh * 0.9 && rect.bottom > vh * 0.1) {
        const postId = post.id.replace('post_', '')
        const postNum = parseInt(post.querySelector('.post-number')?.textContent) || parseInt(postId) || 0
        if (postNum > this._currentBrowsedTo) {
          this._currentBrowsedTo = postNum
        }
        if (this.viewedPosts.has(postId)) continue
        this.viewedPosts.add(postId)
        this._emitStats()

        if (this.liker?.shouldLike(this.maxLikes)) {
          const result = await this.liker.tryLike(post, postId)
          if (result.success) {
            history.addLike(this._currentTopicId, postId)
            this._emitStats()
          }
        }
      }
    }
  }

  // ========== 记录 ==========

  _flushRecord() {
    if (!this._currentTopicId) return
    history.addRecord({
      topicId: this._currentTopicId,
      title: this._currentTopicTitle,
      url: window.location.href,
      browsedTo: this._currentBrowsedTo,
      totalPosts: this._currentTotalPosts,
      liked: history.isLiked(this._currentTopicId),
    })
    this._currentTopicId = null
    this._emitStats()
  }

  // ========== 休息 ==========

  _accumulateTime() {
    const now = Date.now()
    this._accumulatedTime += now - this._lastActionTime
    this._lastActionTime = now
  }

  async _takeRest() {
    this._accumulatedTime = 0
    console.log(`[BrowseEngine] 休息 ${this._restTime / 60000} 分钟...`)
    this._emitStats()
    await sleep(this._restTime)
    console.log('[BrowseEngine] 休息结束，继续浏览')
    this._lastActionTime = Date.now()
  }

  // ========== 工具 ==========

  _detectPageType() {
    const path = location.pathname
    if (/^\/t\/topic\/\d+/.test(path) || /^\/t\/[^/]+\/\d+/.test(path)) return 'topic'
    if (path === '/' || path === '/latest' || path === '/new' || path === '/unread' || path === '/top' || path === '/hot') return 'home'
    if (path.startsWith('/c/') || path.startsWith('/tag/')) return 'category'
    if (path.startsWith('/u/')) return 'user'
    return 'other'
  }

  _getTopicId(url) {
    const m = url?.match(/\/t\/topic\/(\d+)/) || url?.match(/\/t\/[^/]+\/(\d+)/)
    return m ? m[1] : null
  }

  _extractTopicTitle() {
    return document.querySelector('h1 .fancy-title, .topic-title, h1')?.textContent?.trim() || ''
  }

  _extractReplyCount() {
    const text = document.querySelector('.posts-count')?.textContent || ''
    return parseInt(text) || 0
  }

  _markViewed(row) {
    if (!row.classList.contains('ltk-viewed')) {
      row.classList.add('ltk-viewed')
      row.style.opacity = '0.6'
    }
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