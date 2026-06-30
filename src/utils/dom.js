/**
 * DOM 工具
 *
 * 统一样式注入、元素创建等操作。
 * 解决各油猴脚本中 CSP 兼容和重复注入的问题。
 */

/** @type {Map<string, HTMLStyleElement>} */
const injectedStyles = new Map()

/**
 * 注入 CSS 样式
 * 使用 createElement('style') 而非 innerHTML，兼容 CSP
 * @param {string} css - CSS 文本
 * @param {string} id - 样式标识（用于去重和移除）
 * @returns {HTMLStyleElement}
 */
export function injectStyles(css, id) {
  // 已存在则先移除
  if (injectedStyles.has(id)) {
    removeStyles(id)
  }

  const style = document.createElement('style')
  style.id = `toolkit-style-${id}`
  style.type = 'text/css'
  style.appendChild(document.createTextNode(css))

  document.head.appendChild(style)
  injectedStyles.set(id, style)

  return style
}

/**
 * 移除已注入的样式
 * @param {string} id
 */
export function removeStyles(id) {
  const style = injectedStyles.get(id)
  if (style && style.parentNode) {
    style.parentNode.removeChild(style)
    injectedStyles.delete(id)
  }
}

/**
 * 创建 DOM 元素
 * @param {string} tag - 标签名
 * @param {Object} attrs - 属性（className, id, textContent 等）
 * @param {Array|HTMLElement|string} children - 子元素
 * @returns {HTMLElement}
 */
export function createElement(tag, attrs = {}, children = []) {
  const el = document.createElement(tag)

  for (const [key, value] of Object.entries(attrs)) {
    if (key === 'className') {
      el.className = value
    } else if (key === 'textContent') {
      el.textContent = value
    } else if (key === 'innerHTML') {
      el.innerHTML = value
    } else if (key.startsWith('on') && typeof value === 'function') {
      el.addEventListener(key.slice(2).toLowerCase(), value)
    } else if (key === 'style' && typeof value === 'object') {
      Object.assign(el.style, value)
    } else if (key === 'dataset' && typeof value === 'object') {
      Object.assign(el.dataset, value)
    } else {
      el.setAttribute(key, value)
    }
  }

  const childArray = Array.isArray(children) ? children : [children]
  for (const child of childArray) {
    if (typeof child === 'string') {
      el.appendChild(document.createTextNode(child))
    } else if (child instanceof Node) {
      el.appendChild(child)
    }
  }

  return el
}

/**
 * 等待元素出现
 * @param {string} selector - CSS 选择器
 * @param {number} timeout - 超时时间（毫秒），0 表示不超时
 * @param {HTMLElement} root - 根元素
 * @returns {Promise<Element>}
 */
export function waitForElement(selector, timeout = 5000, root = document.body) {
  return new Promise((resolve, reject) => {
    const element = root.querySelector(selector)
    if (element) {
      resolve(element)
      return
    }

    const observer = new MutationObserver((mutations, obs) => {
      const element = root.querySelector(selector)
      if (element) {
        obs.disconnect()
        resolve(element)
      }
    })

    observer.observe(root, {
      childList: true,
      subtree: true
    })

    if (timeout > 0) {
      setTimeout(() => {
        observer.disconnect()
        reject(new Error(`等待元素 "${selector}" 超时 (${timeout}ms)`))
      }, timeout)
    }
  })
}

export const DOM = {
  injectStyles,
  removeStyles,
  createElement,
  waitForElement
}
