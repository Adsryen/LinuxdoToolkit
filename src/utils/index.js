/**
 * LinuxdoToolkit 工具库
 *
 * 统一导出入口，所有模块从此处导入所需工具。
 *
 * 使用方式：
 *   import { Storage, Request, Navigation, Theme } from '@/utils'
 *   import { debounce, logger } from '@/utils'
 */

// 存储
export { Storage, get, set, getMany, setMany, remove, getAll, onChanged } from './storage.js'

// 网络请求
export { Request, get as httpGet, post as httpPost, put as httpPut, getCsrfToken } from './request.js'

// SPA 导航
export { Navigation, PAGE_TYPES, getPageType, isTopicPage, isListPage, getTopicId } from './navigation.js'

// 主题
export { Theme, isDark, getTheme } from './theme.js'

// 事件总线
export { EventBus, EVENTS, on, off, emit, once } from './events.js'

// z-index 层级
export { Z_INDEX } from './z-index.js'

// DOM 工具
export { DOM, injectStyles, removeStyles, createElement, waitForElement } from './dom.js'

// 设置管理
export { settings } from './settings.js'

// 冲突检测
export { ConflictDetector } from './conflict.js'

// 国际化
export { t, setLocale, getLocale } from './i18n.js'

// 备份与恢复
export { Backup, exportAll, exportAsJSON, exportToFile, importFromJSON, importFromFile } from './backup.js'

// 通用工具函数
export {
  debounce,
  throttle,
  getNestedValue,
  formatDate,
  generateId,
  deepClone,
  mergeDeep,
  randomInt,
  randomDelay,
  logger
} from './helpers.js'
