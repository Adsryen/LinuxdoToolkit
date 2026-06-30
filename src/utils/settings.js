/**
 * Settings Manager
 *
 * 统一管理扩展配置，基于 chrome.storage.local
 * 提供类型安全的读写、默认值、变更通知
 *
 * 存储结构：
 *   toolkit.global            → 全局配置
 *   toolkit.module.{moduleId} → 模块配置
 *   toolkit.enabledModules    → 模块启用状态
 *   toolkit.stats             → 统计数据
 *   toolkit.backups           → 自动备份快照
 */

const PREFIX = 'toolkit.'
const KEYS = {
  global: `${PREFIX}global`,
  enabledModules: `${PREFIX}enabledModules`,
  stats: `${PREFIX}stats`,
  backups: `${PREFIX}backups`,
}

// 全局默认配置
const GLOBAL_DEFAULTS = {
  theme: 'auto',        // auto | light | dark
  language: 'zh-CN',
  toolbarEnabled: true,
  toolbarPosition: { x: -1, y: 80 },  // -1 表示使用默认右侧
  toolbarCollapsed: false,
  autoBackup: true,
  maxBackups: 5,
}

class SettingsManager {
  constructor() {
    this._cache = {}
    this._listeners = new Map()
    this._initialized = false
  }

  /**
   * 初始化，预加载全局配置和模块开关
   */
  async init() {
    if (this._initialized) return

    const [global, enabledModules] = await Promise.all([
      this._get(KEYS.global),
      this._get(KEYS.enabledModules),
    ])

    this._cache[KEYS.global] = { ...GLOBAL_DEFAULTS, ...global }
    this._cache[KEYS.enabledModules] = enabledModules || {}

    // 监听外部变更（如 Popup 修改了配置）
    chrome.storage.onChanged.addListener((changes, namespace) => {
      if (namespace !== 'local') return
      for (const [key, { newValue }] of Object.entries(changes)) {
        if (key.startsWith(PREFIX)) {
          this._cache[key] = newValue
          this._notify(key, newValue)
        }
      }
    })

    this._initialized = true
  }

  // ========== 全局配置 ==========

  /**
   * 获取全局配置
   * @param {string} [key] - 可选，获取单个字段
   * @returns {any}
   */
  getGlobal(key) {
    const global = this._cache[KEYS.global] || GLOBAL_DEFAULTS
    return key ? global[key] : global
  }

  /**
   * 更新全局配置
   * @param {object} partial - 部分配置
   */
  async setGlobal(partial) {
    const current = this._cache[KEYS.global] || GLOBAL_DEFAULTS
    const merged = { ...current, ...partial }
    await this._set(KEYS.global, merged)
    return merged
  }

  // ========== 模块配置 ==========

  /**
   * 获取模块配置
   * @param {string} moduleId
   * @param {object} [defaults] - 默认值
   * @returns {Promise<object>}
   */
  async getModule(moduleId, defaults = {}) {
    const key = `${PREFIX}module.${moduleId}`
    const cached = this._cache[key]
    if (cached) return { ...defaults, ...cached }

    const stored = await this._get(key)
    const merged = { ...defaults, ...stored }
    this._cache[key] = merged
    return merged
  }

  /**
   * 更新模块配置
   * @param {string} moduleId
   * @param {object} partial - 部分配置
   */
  async setModule(moduleId, partial) {
    const key = `${PREFIX}module.${moduleId}`
    const current = this._cache[key] || {}
    const merged = { ...current, ...partial }
    await this._set(key, merged)
    return merged
  }

  // ========== 模块开关 ==========

  /**
   * 获取所有模块启用状态
   * @returns {object} { moduleId: boolean }
   */
  getEnabledModules() {
    return { ...(this._cache[KEYS.enabledModules] || {}) }
  }

  /**
   * 判断模块是否启用
   * @param {string} moduleId
   * @returns {boolean}
   */
  isModuleEnabled(moduleId) {
    const enabled = this._cache[KEYS.enabledModules] || {}
    return enabled[moduleId] !== false  // 默认启用
  }

  /**
   * 设置模块启用状态
   * @param {string} moduleId
   * @param {boolean} enabled
   */
  async setModuleEnabled(moduleId, enabled) {
    const current = this._cache[KEYS.enabledModules] || {}
    const merged = { ...current, [moduleId]: enabled }
    await this._set(KEYS.enabledModules, merged)
    return merged
  }

  /**
   * 批量设置模块启用状态
   * @param {object} map - { moduleId: boolean }
   */
  async setEnabledModules(map) {
    const current = this._cache[KEYS.enabledModules] || {}
    const merged = { ...current, ...map }
    await this._set(KEYS.enabledModules, merged)
    return merged
  }

  // ========== 统计数据 ==========

  /**
   * 获取统计数据
   * @returns {Promise<object>}
   */
  async getStats() {
    return (await this._get(KEYS.stats)) || {}
  }

  /**
   * 更新统计数据
   * @param {object} partial
   */
  async setStats(partial) {
    const current = (await this._get(KEYS.stats)) || {}
    const merged = { ...current, ...partial }
    await this._set(KEYS.stats, merged)
    return merged
  }

  // ========== 变更监听 ==========

  /**
   * 监听某个 key 的变化
   * @param {string} key - 存储 key（如 'toolkit.global'）
   * @param {Function} callback - (newValue) => void
   * @returns {Function} 取消监听函数
   */
  onChange(key, callback) {
    if (!this._listeners.has(key)) {
      this._listeners.set(key, new Set())
    }
    this._listeners.get(key).add(callback)
    return () => this._listeners.get(key)?.delete(callback)
  }

  /**
   * 监听全局配置变化
   * @param {Function} callback
   * @returns {Function}
   */
  onGlobalChange(callback) {
    return this.onChange(KEYS.global, callback)
  }

  /**
   * 监听模块配置变化
   * @param {string} moduleId
   * @param {Function} callback
   * @returns {Function}
   */
  onModuleChange(moduleId, callback) {
    return this.onChange(`${PREFIX}module.${moduleId}`, callback)
  }

  /**
   * 监听模块开关变化
   * @param {Function} callback
   * @returns {Function}
   */
  onEnabledChange(callback) {
    return this.onChange(KEYS.enabledModules, callback)
  }

  // ========== 批量操作（供备份使用） ==========

  /**
   * 获取所有 toolkit.* 数据
   * @returns {Promise<object>}
   */
  async exportAll() {
    return new Promise((resolve) => {
      chrome.storage.local.get(null, (items) => {
        const data = {}
        for (const [key, value] of Object.entries(items)) {
          if (key.startsWith(PREFIX)) {
            data[key] = value
          }
        }
        resolve(data)
      })
    })
  }

  /**
   * 导入数据
   * @param {object} data - { key: value }
   * @param {'overwrite'|'merge'} strategy
   */
  async importAll(data, strategy = 'overwrite') {
    if (strategy === 'overwrite') {
      await this._setBatch(data)
    } else {
      const current = await this.exportAll()
      const merged = { ...current }
      for (const [key, value] of Object.entries(data)) {
        if (typeof value === 'object' && typeof merged[key] === 'object') {
          merged[key] = { ...merged[key], ...value }
        } else {
          merged[key] = value
        }
      }
      await this._setBatch(merged)
    }
    // 刷新缓存
    for (const [key, value] of Object.entries(data)) {
      this._cache[key] = value
    }
  }

  // ========== 内部方法 ==========

  _get(key) {
    return new Promise((resolve) => {
      chrome.storage.local.get(key, (result) => {
        resolve(result[key] ?? null)
      })
    })
  }

  _set(key, value) {
    return new Promise((resolve) => {
      chrome.storage.local.set({ [key]: value }, resolve)
    })
  }

  _setBatch(obj) {
    return new Promise((resolve) => {
      chrome.storage.local.set(obj, resolve)
    })
  }

  _notify(key, newValue) {
    const listeners = this._listeners.get(key)
    if (listeners) {
      for (const cb of listeners) {
        try { cb(newValue) } catch (e) { console.error('Settings listener error:', e) }
      }
    }
  }
}

// 导出单例
export const settings = new SettingsManager()
