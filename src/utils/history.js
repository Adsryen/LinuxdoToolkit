/**
 * 浏览历史数据基座
 *
 * 统一存储和管理所有浏览数据，为后续功能提供数据支持。
 * 存储结构：
 *   toolkit.history.records  → [{ topicId, title, url, browsedTo, liked, timestamp }]
 *   toolkit.history.likes    → [{ topicId, postId, timestamp }]
 *   toolkit.history.lastSync → 最后同步时间
 *
 * 使用 chrome.storage.local 存储，跨设备不丢失（需同步）。
 */

const HISTORY_KEY = 'toolkit.history.records'
const LIKES_KEY = 'toolkit.history.likes'
const MAX_RECORDS = 500

export class HistoryStore {
  constructor() {
    this._records = null
    this._likes = null
  }

  /**
   * 初始化，从 storage 加载数据
   */
  async init() {
    const result = await chrome.storage.local.get([HISTORY_KEY, LIKES_KEY])
    this._records = result[HISTORY_KEY] || []
    this._likes = result[LIKES_KEY] || []
  }

  // ========== 浏览记录 ==========

  /**
   * 记录一个浏览过的帖子
   * @param {object} record
   * @param {string} record.topicId - 帖子 ID
   * @param {string} record.title - 帖子标题
   * @param {string} record.url - 帖子 URL
   * @param {number} record.browsedTo - 浏览到第几楼
   * @param {number} record.totalPosts - 总回复数
   * @param {boolean} record.liked - 是否已点赞
   */
  addRecord(record) {
    if (!this._records) this._records = []

    // 更新或新增
    const idx = this._records.findIndex(r => r.topicId === record.topicId)
    const now = Date.now()

    if (idx >= 0) {
      this._records[idx] = {
        ...this._records[idx],
        ...record,
        updatedAt: now,
      }
    } else {
      this._records.unshift({
        topicId: record.topicId,
        title: record.title || '',
        url: record.url || `/t/topic/${record.topicId}`,
        browsedTo: record.browsedTo || 0,
        totalPosts: record.totalPosts || 0,
        liked: record.liked || false,
        createdAt: now,
        updatedAt: now,
      })
    }

    // 限制数量
    if (this._records.length > MAX_RECORDS) {
      this._records.length = MAX_RECORDS
    }

    this._debouncedSave()
  }

  /**
   * 判断帖子是否已浏览
   */
  isViewed(topicId) {
    return !!this._records?.find(r => r.topicId === String(topicId))
  }

  /**
   * 获取所有浏览记录
   * @param {object} opts
   * @param {number} opts.limit - 限制数量
   * @param {number} opts.offset - 偏移
   * @returns {Array}
   */
  getRecords(opts = {}) {
    const limit = opts.limit || 50
    const offset = opts.offset || 0
    return (this._records || []).slice(offset, offset + limit)
  }

  /**
   * 获取统计信息
   */
  getStats() {
    const records = this._records || []
    const likes = this._likes || []

    return {
      totalViews: records.length,
      totalLikes: likes.length,
      todayViews: records.filter(r => r.updatedAt > Date.now() - 86400000).length,
      todayLikes: likes.filter(l => l.timestamp > Date.now() - 86400000).length,
      recentViews: records.slice(0, 10),
      recentLikes: likes.slice(0, 10),
    }
  }

  /**
   * 清除所有记录
   */
  clear() {
    this._records = []
    this._likes = []
    this._save()
  }

  // ========== 点赞记录 ==========

  /**
   * 记录一个点赞
   * @param {string} topicId - 帖子 ID
   * @param {string} postId - 帖子内楼层 ID
   */
  addLike(topicId, postId) {
    if (!this._likes) this._likes = []

    this._likes.unshift({
      topicId: String(topicId),
      postId: String(postId),
      timestamp: Date.now(),
    })

    if (this._likes.length > MAX_RECORDS) {
      this._likes.length = MAX_RECORDS
    }

    // 同时更新浏览记录中的点赞状态
    const record = this._records?.find(r => r.topicId === String(topicId))
    if (record) record.liked = true

    this._debouncedSave()
  }

  /**
   * 判断帖子是否已点赞
   */
  isLiked(topicId) {
    return !!this._records?.find(r => r.topicId === String(topicId) && r.liked)
  }

  // ========== 内部 ==========

  _save() {
    chrome.storage.local.set({
      [HISTORY_KEY]: this._records || [],
      [LIKES_KEY]: this._likes || [],
    })
  }

  _debouncedSave = this._debounce(() => this._save(), 500)

  _debounce(fn, delay) {
    let timer
    return function (...args) {
      clearTimeout(timer)
      timer = setTimeout(() => fn.apply(this, args), delay)
    }
  }
}

// 单例
export const history = new HistoryStore()