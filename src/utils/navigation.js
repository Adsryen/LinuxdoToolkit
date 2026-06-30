/**
 * SPA 导航检测
 *
 * 统一各油猴脚本中重复的 URL 变化检测逻辑。
 * 拦截 pushState/replaceState + 监听 popstate + MutationObserver 兜底。
 */

// 页面类型常量
export const PAGE_TYPES = {
  TOPIC: 'topic',
  LIST: 'list',
  HOME: 'home',
  CATEGORY: 'category',
  USER: 'user',
  OTHER: 'other'
}

/**
 * 从 URL 解析页面类型
 * @param {string|URL} url
 * @returns {string}
 */
export function getPageType(url = window.location.href) {
  const pathname = typeof url === 'string' ? new URL(url, location.origin).pathname : url.pathname

  if (/^\/t\/topic\/\d+/.test(pathname)) return PAGE_TYPES.TOPIC
  if (/^\/[tn](\/|$)/.test(pathname)) return PAGE_TYPES.TOPIC
  if (pathname === '/' || pathname === '/latest' || pathname === '/new' || pathname === '/unread') return PAGE_TYPES.HOME
  if (pathname.startsWith('/top') || pathname.startsWith('/hot')) return PAGE_TYPES.LIST
  if (pathname.startsWith('/c/')) return PAGE_TYPES.CATEGORY
  if (pathname.startsWith('/u/')) return PAGE_TYPES.USER

  return PAGE_TYPES.OTHER
}

/**
 * 是否为话题页
 */
export function isTopicPage(url) {
  return getPageType(url) === PAGE_TYPES.TOPIC
}

/**
 * 是否为列表页（首页/最新/热门/分类等）
 */
export function isListPage(url) {
  const type = getPageType(url)
  return type === PAGE_TYPES.HOME || type === PAGE_TYPES.LIST || type === PAGE_TYPES.CATEGORY
}

/**
 * 从 URL 提取话题 ID
 * @param {string} url
 * @returns {string|null}
 */
export function getTopicId(url = window.location.href) {
  const match = url.match(/\/t\/topic\/(\d+)/) || url.match(/\/t\/[^/]+\/(\d+)/)
  return match ? match[1] : null
}

// 拦截 pushState / replaceState，触发自定义事件
;(function interceptHistoryMethods() {
  const originalPushState = history.pushState
  const originalReplaceState = history.replaceState

  history.pushState = function (...args) {
    originalPushState.apply(this, args)
    window.dispatchEvent(new CustomEvent('toolkit:navigate', { detail: { type: 'pushstate' } }))
  }

  history.replaceState = function (...args) {
    originalReplaceState.apply(this, args)
    window.dispatchEvent(new CustomEvent('toolkit:navigate', { detail: { type: 'replacestate' } }))
  }
})()

/**
 * 监听 URL 变化
 * @param {Function} callback - (url, pageType) => void
 * @returns {Function} 取消监听函数
 */
export function observe(callback) {
  let lastUrl = location.href

  function checkUrl() {
    const currentUrl = location.href
    if (currentUrl !== lastUrl) {
      lastUrl = currentUrl
      callback(currentUrl, getPageType(currentUrl))
    }
  }

  // 自定义导航事件（pushState / replaceState）
  const onNavigate = () => checkUrl()
  window.addEventListener('toolkit:navigate', onNavigate)

  // popstate（浏览器前进后退）
  const onPopstate = () => checkUrl()
  window.addEventListener('popstate', onPopstate)

  // MutationObserver 兜底（Discourse SPA 有时不触发上述事件）
  const observer = new MutationObserver(checkUrl)
  if (document.body) {
    observer.observe(document.body, { childList: true, subtree: true })
  }

  // 返回清理函数
  return () => {
    window.removeEventListener('toolkit:navigate', onNavigate)
    window.removeEventListener('popstate', onPopstate)
    observer.disconnect()
  }
}

export const Navigation = {
  PAGE_TYPES,
  getPageType,
  isTopicPage,
  isListPage,
  getTopicId,
  observe
}
