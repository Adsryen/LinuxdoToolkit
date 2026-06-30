/**
 * 通用工具函数
 *
 * 从原 utils/index.js 迁移，保持所有原有功能不变
 */

/**
 * 防抖函数
 */
export function debounce(func, wait, immediate = false) {
  let timeout
  return function executedFunction(...args) {
    const context = this
    const later = () => {
      timeout = null
      if (!immediate) func.apply(context, args)
    }
    const callNow = immediate && !timeout
    clearTimeout(timeout)
    timeout = setTimeout(later, wait)
    if (callNow) func.apply(context, args)
  }
}

/**
 * 节流函数
 */
export function throttle(func, limit) {
  let inThrottle
  return function executedFunction(...args) {
    const context = this
    if (!inThrottle) {
      func.apply(context, args)
      inThrottle = true
      setTimeout(() => (inThrottle = false), limit)
    }
  }
}

/**
 * 安全获取嵌套对象属性
 */
export function getNestedValue(obj, path, defaultValue = undefined) {
  const keys = path.split('.')
  let result = obj

  for (const key of keys) {
    if (result === null || result === undefined || typeof result !== 'object') {
      return defaultValue
    }
    result = result[key]
  }

  return result !== undefined ? result : defaultValue
}

/**
 * 格式化日期
 */
export function formatDate(date, format = 'YYYY-MM-DD HH:mm:ss') {
  const d = new Date(date)
  const year = d.getFullYear()
  const month = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  const hours = String(d.getHours()).padStart(2, '0')
  const minutes = String(d.getMinutes()).padStart(2, '0')
  const seconds = String(d.getSeconds()).padStart(2, '0')

  return format
    .replace('YYYY', year)
    .replace('MM', month)
    .replace('DD', day)
    .replace('HH', hours)
    .replace('mm', minutes)
    .replace('ss', seconds)
}

/**
 * 生成唯一 ID
 */
export function generateId() {
  return Date.now().toString(36) + Math.random().toString(36).substr(2)
}

/**
 * 深拷贝对象
 */
export function deepClone(obj) {
  if (obj === null || typeof obj !== 'object') {
    return obj
  }

  if (obj instanceof Date) {
    return new Date(obj.getTime())
  }

  if (obj instanceof Array) {
    return obj.map((item) => deepClone(item))
  }

  if (obj instanceof Object) {
    const copy = {}
    Object.keys(obj).forEach((key) => {
      copy[key] = deepClone(obj[key])
    })
    return copy
  }

  return obj
}

/**
 * 深度合并对象
 */
export function mergeDeep(target, source) {
  const output = Object.assign({}, target)
  if (isObject(target) && isObject(source)) {
    Object.keys(source).forEach((key) => {
      if (isObject(source[key])) {
        if (!(key in target)) {
          Object.assign(output, { [key]: source[key] })
        } else {
          output[key] = mergeDeep(target[key], source[key])
        }
      } else {
        Object.assign(output, { [key]: source[key] })
      }
    })
  }
  return output
}

/**
 * 检查是否为纯对象
 */
function isObject(item) {
  return item && typeof item === 'object' && !Array.isArray(item)
}

/**
 * 随机整数（含 min 和 max）
 */
export function randomInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min
}

/**
 * 随机延迟
 */
export function randomDelay(min, max) {
  const delay = randomInt(min, max)
  return new Promise((resolve) => setTimeout(resolve, delay))
}

/**
 * 日志工具
 */
export const logger = {
  info: (...args) => {
    console.log('[LinuxdoToolkit]', ...args)
  },
  warn: (...args) => {
    console.warn('[LinuxdoToolkit]', ...args)
  },
  error: (...args) => {
    console.error('[LinuxdoToolkit]', ...args)
  },
  debug: (...args) => {
    if (window.__linuxdoToolkitDebug) {
      console.debug('[LinuxdoToolkit]', ...args)
    }
  }
}
