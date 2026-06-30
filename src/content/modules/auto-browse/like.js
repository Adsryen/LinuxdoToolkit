/**
 * 点赞系统
 *
 * 基于 linuxdo-automation 的 API 点赞 + 上限检测。
 * 使用 PUT /discourse-reactions/posts/{id}/custom-reactions/heart/toggle.json
 */

const LIKE_CHANCES = {
  low:     0.05,
  medium:  0.15,
  high:    0.25,
  veryHigh: 0.40,
}

const random = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min
const sleep = (ms) => new Promise(r => setTimeout(r, ms))

export class LikeSystem {
  constructor(options = {}) {
    this.enabled = options.enabled ?? true
    this.chanceLevel = options.chance || 'medium'
    this.likedPosts = new Set(this._loadLiked())
    this.sessionLiked = 0
    this.lastLikeTime = 0
    this.limitReached = false
    this.minInterval = 2000
  }

  setEnabled(v) {
    this.enabled = v
  }

  setChance(v) {
    this.chanceLevel = v
  }

  /**
   * 判断是否应该点赞
   * @param {number} maxLikes - 本会话最大点赞数
   */
  shouldLike(maxLikes = 50) {
    if (!this.enabled) return false
    if (this.limitReached) return false
    if (this.sessionLiked >= maxLikes) return false
    if (Date.now() - this.lastLikeTime < this.minInterval) return false
    const chance = LIKE_CHANCES[this.chanceLevel] || 0.15
    return Math.random() < chance
  }

  /**
   * 尝试点赞一个帖子
   * @param {HTMLElement} postEl - article[id^="post_"] 元素
   * @param {string} postId - 帖子 ID
   * @returns {Promise<{success: boolean, rateLimited?: boolean}>}
   */
  async tryLike(postEl, postId) {
    if (this.likedPosts.has(String(postId))) return { success: false }

    // 检查是否已点赞（DOM 标记）
    const likeBtn = postEl.querySelector(
      'button[title="点赞此帖子"], button.btn-toggle-reaction-like'
    )
    if (likeBtn && (likeBtn.classList.contains('has-like') ||
        likeBtn.classList.contains('my-likes') ||
        likeBtn.classList.contains('liked'))) {
      return { success: false }
    }

    await sleep(random(200, 500))

    // 获取实际帖子 ID
    const actualId = postEl.dataset.postId
    if (!actualId) return { success: false }

    const result = await this._sendLike(actualId)

    if (result.success) {
      this.likedPosts.add(String(postId))
      this.sessionLiked++
      this.lastLikeTime = Date.now()
      this._saveLiked()
      return { success: true }
    }

    if (result.rateLimited) {
      this.limitReached = true
      this._handleLikeLimit()
      return { success: false, rateLimited: true }
    }

    return { success: false }
  }

  getStats() {
    return {
      sessionLiked: this.sessionLiked,
      totalLiked: this.likedPosts.size,
      limitReached: this.limitReached,
    }
  }

  clearHistory() {
    this.likedPosts.clear()
    this._saveLiked()
  }

  // ========== 内部 ==========

  async _sendLike(postId) {
    try {
      const csrfToken = document.querySelector('meta[name="csrf-token"]')?.content
      if (!csrfToken) return { success: false, error: 'no csrf' }

      const resp = await fetch(`/discourse-reactions/posts/${postId}/custom-reactions/heart/toggle.json`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'X-CSRF-Token': csrfToken,
        },
      })

      if (resp.ok) return { success: true }

      const data = await resp.json().catch(() => ({}))
      if (resp.status === 429 || data.error_type === 'rate_limit') {
        return { success: false, rateLimited: true, timeLeft: data.extras?.time_left }
      }
      return { success: false, error: data.errors?.[0] || `HTTP ${resp.status}` }
    } catch (e) {
      return { success: false, error: e.message }
    }
  }

  _handleLikeLimit() {
    console.log('[LikeSystem] 达到点赞上限，自动关闭点赞')
    this.enabled = false
    // 关闭弹窗
    const closeBtn = document.querySelector(
      '#dialog-holder button.btn-primary, #dialog-holder button'
    )
    closeBtn?.click()
  }

  _saveLiked() {
    try {
      // 只保存最近 2000 条，避免 localStorage 溢出
      const arr = [...this.likedPosts]
      if (arr.length > 2000) arr.splice(0, arr.length - 2000)
      localStorage.setItem('ltk_liked_posts', JSON.stringify(arr))
    } catch {}
  }

  _loadLiked() {
    try {
      return JSON.parse(localStorage.getItem('ltk_liked_posts') || '[]')
    } catch {
      return []
    }
  }
}
