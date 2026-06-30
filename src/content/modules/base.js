/**
 * Module Base Class
 *
 * 所有功能模块的基类，定义标准化生命周期和接口。
 * 新模块只需继承此基类并覆盖需要的方法。
 *
 * @example
 * class MyModule extends Module {
 *   constructor() {
 *     super({
 *       id: 'my-module',
 *       name: '我的模块',
 *       icon: '✨',
 *       description: '模块描述',
 *       category: 'efficiency',
 *       defaultSettings: { enabled: true }
 *     })
 *   }
 *
 *   async onInit() { /* 初始化逻辑 */ }
 *   onDestroy() { /* 清理逻辑 */ }
 * }
 */
export class Module {
  /**
   * @param {ModuleConfig} config - 模块配置
   */
  constructor(config = {}) {
    // 模块元信息
    this.id = config.id || 'unknown'
    this.name = config.name || '未命名模块'
    this.icon = config.icon || '📦'
    this.description = config.description || ''
    this.category = config.category || 'other'

    // 默认设置
    this.defaultSettings = config.defaultSettings || {}

    // 运行时状态
    this.enabled = false
    this.started = false
    this.settings = {}
  }

  // ========== 生命周期（子类覆盖） ==========

  /**
   * 模块初始化时调用（只在首次启用时触发）
   * 用于创建 DOM、注册事件、初始化状态等
   * @param {object} settings - 模块配置
   */
  async onInit(settings) {
    // 子类覆盖
  }

  /**
   * 模块销毁时调用
   * 必须清理所有 DOM、定时器、事件监听
   */
  onDestroy() {
    // 子类覆盖
  }

  /**
   * 模块启用时调用（从禁用状态恢复）
   */
  async onEnable() {
    // 子类覆盖
  }

  /**
   * 模块禁用时调用（保留状态但停止运行）
   */
  async onDisable() {
    // 子类覆盖
  }

  /**
   * SPA 页面变化时调用
   * @param {string} url - 新 URL
   * @param {string} pageType - 页面类型（topic | category | user | home | other）
   */
  onPageChange(url, pageType) {
    // 子类覆盖
  }

  /**
   * 设置变化时调用
   * @param {object} newSettings - 新配置
   */
  onSettingsChange(newSettings) {
    // 子类覆盖
  }

  // ========== 接口方法（子类可覆盖） ==========

  /**
   * 向工具栏注册状态条
   * 返回 null 表示不注册
   * @returns {StatusBarConfig|null}
   */
  getStatusBar() {
    return null
  }

  /**
   * 设置面板描述，Options 页据此自动生成配置 UI
   * @returns {SettingsSchema|null}
   */
  getSettingsSchema() {
    return null
  }

  // ========== 框架方法（不要覆盖） ==========

  /**
   * 初始化模块（框架调用）
   * @param {object} settings - 模块配置
   * @returns {Promise<boolean>} 是否初始化成功
   */
  async init(settings) {
    if (this.started) return true
    try {
      this.settings = { ...this.defaultSettings, ...settings }
      await this.onInit(this.settings)
      this.started = true
      return true
    } catch (e) {
      console.error(`[${this.name}] 初始化失败:`, e)
      return false
    }
  }

  /**
   * 销毁模块（框架调用）
   */
  destroy() {
    if (!this.started) return
    try {
      this.onDestroy()
    } catch (e) {
      console.error(`[${this.name}] 销毁失败:`, e)
    }
    this.started = false
    this.enabled = false
  }

  /**
   * 启用模块（框架调用）
   */
  async enable() {
    if (this.enabled) return
    if (!this.started) {
      await this.init(this.settings)
    }
    try {
      await this.onEnable()
    } catch (e) {
      console.error(`[${this.name}] 启用失败:`, e)
    }
    this.enabled = true
  }

  /**
   * 禁用模块（框架调用）
   */
  async disable() {
    if (!this.enabled) return
    try {
      await this.onDisable()
    } catch (e) {
      console.error(`[${this.name}] 禁用失败:`, e)
    }
    this.enabled = false
  }

  /**
   * 更新模块配置（框架调用）
   * @param {object} newSettings
   */
  async updateSettings(newSettings) {
    this.settings = { ...this.settings, ...newSettings }
    try {
      await this.onSettingsChange(this.settings)
    } catch (e) {
      console.error(`[${this.name}] 配置更新失败:`, e)
    }
  }
}

/**
 * 判断页面类型
 * @param {string} url
 * @returns {string}
 */
export function getPageType(url) {
  if (!url) return 'other'
  if (url.includes('/t/')) return 'topic'
  if (url.includes('/c/')) return 'category'
  if (url.includes('/u/') || url.includes('/my/')) return 'user'
  if (url.includes('/top') || url.includes('/latest') || url.includes('/new')) return 'list'
  if (/https?:\/\/[^/]+\/?$/.test(url)) return 'home'
  return 'other'
}
