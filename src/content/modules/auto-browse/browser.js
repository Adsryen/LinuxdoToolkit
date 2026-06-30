/**
 * 浏览引擎
 *
 * 核心浏览逻辑：话题列表扫描 + 帖子详情页浏览。
 * 合并自 automation 的列表管理和 ryen.js 的仿真人行为。
 */

const random = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min
const sleep = (ms) => new Promise(r => setTimeout(r, ms))

export class BrowseEngine {
  constructor(scroll, liker, options = {}) {
    this.scroll = scroll
    this.liker = liker
    this.listPath = options.listPath || '/latest'
    this.maxViews = options.maxViews || 50
    this.maxLikes = options.maxLikes || 50
    this.onStats = options.onStats || (() => {})

    this.running = false
    this.viewedTopics = new Set(this._loadViewed())
    this.viewedPosts = new Set()
    this.sessionViews = 0

    this._abortController = null
  }

  start() {
    if (this.running) return
    this.running = true
    this._abortController = new AbortController()

    const pageType = this._detectPageType()
    console.log('[BrowseEngine] 启动，页面类型:', pageType)

    if (pageType === 'topic') {
      this._browseTopic()
    } else if (pageType === 'list') {
      this._browseList()
    } else {
      // 跳转到列表页
      window.location.href = this.listPath
    }
  }

  stop() {
    this.running = false
    this._abortController?.abort()
  }

  restart() {
    this.stop()
    setTimeout(() => this.start(), 1000)
  }

  destroy() {
    this.stop()
    this._saveViewed()
  }

  setListPath(path) {
    this.listPath = path
  }

  /**
   * 处理页面变化（由模块的 onPageChange 调用）
   */
  handlePageChange(pageType) {
    if (!this.running) return
    this.viewedPosts.clear()

    if (pageType === 'topic') {
      setTimeout(() => this._browseTopic(), 1000)
    } else if (pageType === 'list') {
      setTimeout(() => this._browseList(), 500)
    }
  }

  clearHistory() {
    this.viewedTopics.clear()
    this.viewedPosts.clear()
    this.sessionViews = 0
    this.liker?.clearHistory()
    this._saveViewed()
    this._emitStats()
  }

  // ========== 话题列表浏览 ==========

  async _browseList() {
    const scroll = this.scroll
    scroll.reset()

    while (this.running) {
      try {
        // 查找未浏览的话题
        const found = await this._findUnviewedTopic()
        if (found) return  // 进入了话题页面，等 handlePageChange 回调

        // 检查会话限制
        if (this.sessionViews >= this.maxViews) {
          console.log('[BrowseEngine] 达到会话浏览上限')
          this.running = false
          return
        }

        // 滚动加载更多
        if (scroll.isAtBottom()) {
          await sleep(random(1500, 2500))
          if (!scroll.hasNewContent()) {
            if (scroll.isContentFullyLoaded()) {
              console.log('[BrowseEngine] 列表已加载完，刷新')
              await sleep(1000)
              window.location.href = this.listPath
              return
            }
          }
        }

        await scroll.humanScroll()
        await sleep(random(scroll.config.scrollInterval, scroll.config.scrollInterval * 1.3))
      } catch (e) {
        console.error('[BrowseEngine] 列表浏览出错:', e)
        await sleep(3000)
      }
    }
  }

  async _findUnviewedTopic() {
    const rows = document.querySelectorAll('.topic-list-item, tr[data-topic-id]')
    for (const row of rows) {
      if (!this.running) return false
      const link = row.querySelector(
        '.title a[href*="/t/topic/"], .link-top-line a[href*="/t/topic/"], a.title[href*="/t/topic/"]'
      )
      if (!link) continue

      const topicId = this._getTopicId(link.href)
      if (!topicId || this.viewedTopics.has(topicId)) {
        if (topicId) this._markViewed(row)
        continue
      }

      // 找到未浏览的话题
      link.scrollIntoView({ behavior: 'auto', block: 'center' })
      await sleep(random(300, 600))
      link.click()
      return true
    }
    return false
  }

  // ========== 帖子详情页浏览 ==========

  async _browseTopic() {
    const topicId = this._getTopicId(window.location.href)
    if (!topicId) return

    // 标记已浏览
    if (!this.viewedTopics.has(topicId)) {
      this.viewedTopics.add(topicId)
      this.sessionViews++
      this._saveViewed()
      this._emitStats()
    }

    // 滚动浏览所有回复
    const scroll = this.scroll
    await scroll.scrollToTop()
    scroll.reset()

    while (this.running) {
      try {
        await this._processVisiblePosts()

        if (scroll.isAtBottom()) {
          await sleep(random(1500, 2500))
          if (!scroll.hasNewContent()) {
            if (scroll.isContentFullyLoaded()) {
              console.log('[BrowseEngine] 帖子浏览完成')
              break
            }
          }
        }

        // 混合使用基础滚动和仿真人滚动
        if (Math.random() < 0.3) {
          await scroll.humanScroll()
          await scroll.dwellOnContent()
        } else {
          scroll.scrollDown()
          await sleep(random(scroll.config.scrollInterval, scroll.config.scrollInterval * 1.3))
        }
      } catch (e) {
        console.error('[BrowseEngine] 浏览帖子出错:', e)
        await sleep(2000)
      }
    }

    // 浏览完成，返回列表
    if (this.running) {
      await sleep(1000)
      window.location.href = this.listPath
    }
  }

  async _processVisiblePosts() {
    const posts = document.querySelectorAll('article[id^="post_"]')
    const vh = window.innerHeight

    for (const post of posts) {
      if (!this.running) break
      const rect = post.getBoundingClientRect()
      if (rect.top < vh * 0.9 && rect.bottom > vh * 0.1) {
        const postId = post.id.replace('post_', '')
        if (this.viewedPosts.has(postId)) continue
        this.viewedPosts.add(postId)
        this._emitStats()

        // 阅读等待
        await sleep(random(this.scroll.config.readMin || 300, this.scroll.config.readMax || 800))

        // 随机点赞
        if (this.liker?.shouldLike(this.maxLikes)) {
          const result = await this.liker.tryLike(post, postId)
          if (result.success) this._emitStats()
        }
      }
    }
  }

  // ========== 工具 ==========

  _detectPageType() {
    const path = location.pathname
    if (/^\/t\/topic\/\d+/.test(path)) return 'topic'
    if (['/', '/latest', '/new', '/unread', '/top', '/hot'].includes(path) || path.startsWith('/c/')) return 'list'
    return 'other'
  }

  _getTopicId(url) {
    const m = url?.match(/\/t\/topic\/(\d+)/)
    return m ? m[1] : null
  }

  _markViewed(row) {
    if (!row.classList.contains('ltk-viewed')) {
      row.classList.add('ltk-viewed')
      row.style.opacity = '0.6'
    }
  }

  _emitStats() {
    this.onStats?.({
      sessionViews: this.sessionViews,
      sessionLikes: this.liker?.sessionLiked || 0,
      totalViews: this.viewedTopics.size,
      totalLikes: this.liker?.likedPosts?.size || 0,
    })
  }

  _saveViewed() {
    try {
      const arr = [...this.viewedTopics]
      if (arr.length > 5000) arr.splice(0, arr.length - 5000)
      localStorage.setItem('ltk_viewed_topics', JSON.stringify(arr))
    } catch {}
  }

  _loadViewed() {
    try { return JSON.parse(localStorage.getItem('ltk_viewed_topics') || '[]') } catch { return [] }
  }
}
