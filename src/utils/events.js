/**
 * 模块间事件总线
 *
 * 用于模块间松耦合通信，避免直接依赖。
 * 例如：自动浏览启停 → 工具栏状态更新
 */

/** @type {Map<string, Set<Function>>} */
const listeners = new Map()

/**
 * 订阅事件
 * @param {string} event - 事件名
 * @param {Function} callback - 回调函数
 * @returns {Function} 取消订阅函数
 */
export function on(event, callback) {
  if (!listeners.has(event)) {
    listeners.set(event, new Set())
  }
  listeners.get(event).add(callback)

  return () => off(event, callback)
}

/**
 * 取消订阅
 * @param {string} event
 * @param {Function} callback
 */
export function off(event, callback) {
  const set = listeners.get(event)
  if (set) {
    set.delete(callback)
    if (set.size === 0) {
      listeners.delete(event)
    }
  }
}

/**
 * 发布事件
 * @param {string} event
 * @param {*} data
 */
export function emit(event, data) {
  const set = listeners.get(event)
  if (set) {
    for (const callback of set) {
      try {
        callback(data)
      } catch (error) {
        console.error(`[EventBus] 事件 "${event}" 的回调执行出错:`, error)
      }
    }
  }
}

/**
 * 一次性订阅
 * @param {string} event
 * @param {Function} callback
 * @returns {Function} 取消订阅函数
 */
export function once(event, callback) {
  const wrapper = (data) => {
    off(event, wrapper)
    callback(data)
  }
  return on(event, wrapper)
}

/**
 * 清除所有监听（用于模块销毁时）
 */
export function clear() {
  listeners.clear()
}

// 预定义事件名
export const EVENTS = {
  // 模块生命周期
  MODULE_ENABLED: 'module:enabled',
  MODULE_DISABLED: 'module:disabled',
  MODULE_STATUS_CHANGED: 'module:status',

  // 自动浏览
  AUTO_BROWSE_START: 'auto-browse:start',
  AUTO_BROWSE_STOP: 'auto-browse:stop',
  AUTO_BROWSE_STATS: 'auto-browse:stats',

  // 主题变化
  THEME_CHANGED: 'theme:changed',

  // 导航
  PAGE_CHANGED: 'page:changed',

  // 工具栏
  TOOLBAR_TOGGLE: 'toolbar:toggle',

  // 备份
  BACKUP_CREATED: 'backup:created',
  RESTORE_COMPLETED: 'restore:completed'
}

export const EventBus = {
  on,
  off,
  emit,
  once,
  clear,
  EVENTS
}
