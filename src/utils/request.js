/**
 * 统一请求封装
 *
 * 封装 fetch，自动携带 CSRF token，统一错误处理。
 * 替代油猴脚本中的 GM_xmlhttpRequest 同源请求。
 */

/**
 * 获取 CSRF token
 * @returns {string|null}
 */
export function getCsrfToken() {
  return document.querySelector('meta[name="csrf-token"]')?.content || null
}

/**
 * 基础请求
 * @param {string} url - 请求地址
 * @param {Object} options - fetch 选项
 * @returns {Promise<any>} 解析后的 JSON
 */
async function request(url, options = {}) {
  const csrfToken = getCsrfToken()

  const headers = {
    Accept: 'application/json',
    ...options.headers
  }

  if (csrfToken) {
    headers['X-CSRF-Token'] = csrfToken
  }

  // POST/PUT 请求自动设置 Content-Type
  if (options.body && !headers['Content-Type']) {
    headers['Content-Type'] = 'application/json'
  }

  const response = await fetch(url, {
    credentials: 'include',
    ...options,
    headers
  })

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}))
    const error = new Error(errorData.errors?.[0] || `HTTP ${response.status}`)
    error.status = response.status
    error.data = errorData

    // 429 速率限制
    if (response.status === 429) {
      error.rateLimited = true
      error.waitSeconds = errorData.extras?.wait_seconds
    }

    throw error
  }

  return response.json()
}

/**
 * GET 请求
 * @param {string} url
 * @param {Object} options - 额外 fetch 选项
 * @returns {Promise<any>}
 */
export async function get(url, options = {}) {
  return request(url, { ...options, method: 'GET' })
}

/**
 * POST 请求
 * @param {string} url
 * @param {Object} data - 请求体
 * @param {Object} options - 额外 fetch 选项
 * @returns {Promise<any>}
 */
export async function post(url, data = {}, options = {}) {
  return request(url, {
    ...options,
    method: 'POST',
    body: JSON.stringify(data)
  })
}

/**
 * PUT 请求
 * @param {string} url
 * @param {Object} data - 请求体
 * @param {Object} options - 额外 fetch 选项
 * @returns {Promise<any>}
 */
export async function put(url, data = {}, options = {}) {
  return request(url, {
    ...options,
    method: 'PUT',
    body: JSON.stringify(data)
  })
}

export const Request = {
  get,
  post,
  put,
  getCsrfToken,
  request
}
