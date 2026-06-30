/**
 * 统一存储封装
 *
 * 封装 chrome.storage.local，替代油猴脚本中的 GM_setValue/GM_getValue 和 localStorage。
 * 所有 key 统一加 'toolkit.' 前缀，避免与其他扩展冲突。
 */

const PREFIX = 'toolkit.'

/**
 * 读取单个 key
 * @param {string} key - 不含前缀的 key
 * @param {*} defaultValue - 默认值
 * @returns {Promise<*>}
 */
export async function get(key, defaultValue = null) {
  try {
    const fullKey = PREFIX + key
    const result = await chrome.storage.local.get(fullKey)
    const value = result[fullKey]
    return value !== undefined ? value : defaultValue
  } catch (error) {
    console.error('[Storage] get 失败:', key, error)
    return defaultValue
  }
}

/**
 * 批量读取
 * @param {string[]} keys - 不含前缀的 key 数组
 * @returns {Promise<Object>} { key: value } 不含前缀
 */
export async function getMany(keys) {
  try {
    const fullKeys = keys.map((k) => PREFIX + k)
    const result = await chrome.storage.local.get(fullKeys)
    const output = {}
    for (const key of keys) {
      const value = result[PREFIX + key]
      if (value !== undefined) {
        output[key] = value
      }
    }
    return output
  } catch (error) {
    console.error('[Storage] getMany 失败:', error)
    return {}
  }
}

/**
 * 写入单个 key
 * @param {string} key - 不含前缀的 key
 * @param {*} value - 值（会被 JSON 序列化）
 */
export async function set(key, value) {
  try {
    const fullKey = PREFIX + key
    await chrome.storage.local.set({ [fullKey]: value })
  } catch (error) {
    console.error('[Storage] set 失败:', key, error)
  }
}

/**
 * 批量写入
 * @param {Object} obj - { key: value } 不含前缀
 */
export async function setMany(obj) {
  try {
    const fullObj = {}
    for (const [key, value] of Object.entries(obj)) {
      fullObj[PREFIX + key] = value
    }
    await chrome.storage.local.set(fullObj)
  } catch (error) {
    console.error('[Storage] setMany 失败:', error)
  }
}

/**
 * 删除单个 key
 * @param {string} key - 不含前缀的 key
 */
export async function remove(key) {
  try {
    await chrome.storage.local.remove(PREFIX + key)
  } catch (error) {
    console.error('[Storage] remove 失败:', key, error)
  }
}

/**
 * 按前缀扫描所有 key（用于备份）
 * @param {string} prefix - key 前缀（不含 'toolkit.'）
 * @returns {Promise<Object>} { key: value } 不含 toolkit. 前缀
 */
export async function getAll(prefix = '') {
  try {
    const fullPrefix = PREFIX + prefix
    const all = await chrome.storage.local.get(null)
    const result = {}
    for (const [fullKey, value] of Object.entries(all)) {
      if (fullKey.startsWith(fullPrefix)) {
        // 去掉 toolkit. 前缀，保留模块前缀
        const key = fullKey.slice(PREFIX.length)
        result[key] = value
      }
    }
    return result
  } catch (error) {
    console.error('[Storage] getAll 失败:', error)
    return {}
  }
}

/**
 * 监听存储变化
 * @param {Function} callback - (changes, namespace) => void
 * @returns {Function} 取消监听函数
 */
export function onChanged(callback) {
  const listener = (changes, namespace) => {
    if (namespace === 'local') {
      // 过滤出 toolkit. 前缀的变化
      const filtered = {}
      for (const [fullKey, change] of Object.entries(changes)) {
        if (fullKey.startsWith(PREFIX)) {
          const key = fullKey.slice(PREFIX.length)
          filtered[key] = change
        }
      }
      if (Object.keys(filtered).length > 0) {
        callback(filtered)
      }
    }
  }

  chrome.storage.onChanged.addListener(listener)

  return () => {
    chrome.storage.onChanged.removeListener(listener)
  }
}

/**
 * 清除所有 toolkit 数据
 */
export async function clearAll() {
  try {
    const all = await chrome.storage.local.get(null)
    const keysToRemove = Object.keys(all).filter((k) => k.startsWith(PREFIX))
    if (keysToRemove.length > 0) {
      await chrome.storage.local.remove(keysToRemove)
    }
  } catch (error) {
    console.error('[Storage] clearAll 失败:', error)
  }
}

export const Storage = {
  get,
  getMany,
  set,
  setMany,
  remove,
  getAll,
  onChanged,
  clearAll
}
