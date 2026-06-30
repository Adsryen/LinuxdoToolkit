/**
 * 话题缓存
 *
 * 内存缓存 + JSON API 获取，避免重复请求。
 */

export class TopicCache {
  constructor(options = {}) {
    this.maxSize = options.maxSize || 10
    this._cache = new Map()  // topicId → { data, fetchedAt }
    this._seen = new Set(this._loadSeen())
  }

  get size() { return this._cache.size }

  /**
   * 从缓存获取话题数据
   */
  get(topicId) {
    const entry = this._cache.get(String(topicId))
    if (!entry) return null
    return entry.data
  }

  /**
   * 从 API 获取话题数据
   */
  async fetch(topicId) {
    const id = String(topicId)
    const cached = this._cache.get(id)
    if (cached && Date.now() - cached.fetchedAt < 60000) {
      return cached.data
    }

    try {
      const csrfToken = document.querySelector('meta[name="csrf-token"]')?.content
      const resp = await fetch(`/t/topic/${id}.json`, {
        credentials: 'include',
        headers: {
          Accept: 'application/json',
          ...(csrfToken ? { 'x-csrf-token': csrfToken } : {}),
        },
      })

      if (!resp.ok) throw new Error(`HTTP ${resp.status}`)
      const data = await resp.json()

      this._set(id, data)
      return data
    } catch (e) {
      console.error(`[TopicCache] 获取话题 ${id} 失败:`, e)
      return null
    }
  }

  /**
   * 预加载话题（不等待）
   */
  prefetch(topicId) {
    const id = String(topicId)
    if (this._cache.has(id)) return
    this.fetch(id).catch(() => {})
  }

  /**
   * 标记话题已读
   */
  markSeen(topicId) {
    const id = String(topicId)
    if (this._seen.has(id)) return
    this._seen.add(id)
    this._saveSeen()
  }

  isSeen(topicId) {
    return this._seen.has(String(topicId))
  }

  clear() {
    this._cache.clear()
  }

  // ========== 内部 ==========

  _set(id, data) {
    // LRU: 超过上限移除最旧的
    if (this._cache.size >= this.maxSize) {
      const oldest = this._cache.keys().next().value
      this._cache.delete(oldest)
    }
    this._cache.set(id, { data, fetchedAt: Date.now() })
  }

  _saveSeen() {
    try {
      const arr = [...this._seen]
      if (arr.length > 500) arr.splice(0, arr.length - 500)
      localStorage.setItem('ltk_peek_seen', JSON.stringify(arr))
    } catch {}
  }

  _loadSeen() {
    try { return JSON.parse(localStorage.getItem('ltk_peek_seen') || '[]') } catch { return [] }
  }
}
