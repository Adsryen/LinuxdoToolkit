/**
 * 话题数据管理
 *
 * 从 linux.do 的 JSON API 获取话题列表。
 */

export class TopicStore {
  constructor() {
    this.topics = []
    this.newCount = 0
    this._lastFetchTime = 0
  }

  /**
   * 获取话题列表
   * @param {string} path - Feed 路径，如 /latest
   * @returns {Promise<Topic[]>}
   */
  async fetchTopics(path = '/latest') {
    const url = path.replace(/^\//, '').replace(/\.json$/i, '')
    const apiUrl = `/${url}.json`

    try {
      const csrfToken = document.querySelector('meta[name="csrf-token"]')?.content
      const resp = await fetch(apiUrl, {
        credentials: 'include',
        headers: {
          Accept: 'application/json',
          ...(csrfToken ? { 'x-csrf-token': csrfToken } : {}),
        },
      })

      if (!resp.ok) throw new Error(`HTTP ${resp.status}`)
      const data = await resp.json()

      const topicList = data?.topic_list || {}
      const rawTopics = Array.isArray(topicList.topics) ? topicList.topics : []
      const usersById = this._buildUsersMap(data)

      const topics = rawTopics.map(t => this._normalizeTopic(t, usersById))

      // 计算新内容数
      const prevIds = new Set(this.topics.map(t => t.id))
      this.newCount = topics.filter(t => !prevIds.has(t.id)).length

      this.topics = topics
      this._lastFetchTime = Date.now()
      return topics
    } catch (e) {
      console.error('[TopicStore] 获取话题失败:', e)
      throw e
    }
  }

  // ========== 内部 ==========

  _buildUsersMap(data) {
    const map = new Map()
    if (Array.isArray(data?.users)) {
      for (const u of data.users) {
        if (u?.id != null) map.set(u.id, u)
      }
    }
    return map
  }

  _normalizeTopic(raw, usersById) {
    const posters = Array.isArray(raw.posters) ? raw.posters : []
    const firstPoster = posters[0]
    const authorUser = firstPoster?.user ||
      usersById.get(Number(firstPoster?.user_id))
    const author = authorUser?.username || firstPoster?.username || ''

    return {
      id: raw.id,
      title: raw.fancy_title || raw.title || '无标题',
      category: raw.category_id,
      author,
      replies: raw.posts_count - 1 || 0,
      views: raw.views || 0,
      lastActivity: raw.bumped_at || raw.last_posted_at || raw.created_at,
      pinned: Boolean(raw.pinned),
      closed: Boolean(raw.closed),
      archived: Boolean(raw.archived),
      unseen: Boolean(raw.unseen),
      newPosts: raw.new_posts || 0,
      unreadPosts: raw.unread_posts || 0,
    }
  }
}
