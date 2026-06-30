/**
 * Module Manager
 *
 * 管理所有功能模块的注册、生命周期、通信。
 * 基于 Module 基类和 SettingsManager。
 */

import { Module, getPageType } from './base.js'
import { settings } from '../../utils/settings.js'
import { emit, EVENTS } from '../../utils/events.js'

export class ModuleManager {
  constructor() {
    /** @type {Map<string, Module>} */
    this.modules = new Map()
    this.initialized = false
  }

  /**
   * 初始化模块管理器
   */
  async init() {
    if (this.initialized) return

    const startTime = performance.now()

    // 初始化 settings
    await settings.init()

    // 等待所有内置模块注册完成
    await this._registerBuiltInModules()

    // 只初始化已启用的模块（禁用的模块延迟初始化）
    const enabledMap = settings.getEnabledModules()
    const initPromises = []

    for (const [id, module] of this.modules) {
      const isEnabled = enabledMap[id] !== false
      if (isEnabled) {
        initPromises.push(this._initModule(id, module))
      }
    }

    // 并行初始化所有已启用模块
    await Promise.all(initPromises)

    // 监听模块开关变化（禁用→启用时延迟初始化）
    settings.onEnabledChange(async (enabledMap) => {
      for (const [id, module] of this.modules) {
        const shouldEnable = enabledMap[id] !== false
        if (shouldEnable && !module.enabled) {
          if (!module.started) {
            await this._initModule(id, module)
          }
          await module.enable()
        } else if (!shouldEnable && module.enabled) {
          await module.disable()
        }
      }
    })

    this.initialized = true
    const elapsed = (performance.now() - startTime).toFixed(0)
    console.log(`[ModuleManager] 初始化完成，${this.modules.size} 个模块，耗时 ${elapsed}ms`)
  }

  /**
   * 初始化单个模块
   */
  async _initModule(id, module) {
    try {
      const moduleSettings = await settings.getModule(id, module.defaultSettings)
      await module.init(moduleSettings)
    } catch (e) {
      console.error(`[ModuleManager] 模块 ${id} 初始化失败:`, e)
    }
  }

  /**
   * 注册模块
   * @param {Module|Function} moduleOrClass - 模块实例或模块类
   * @returns {Module}
   */
  register(moduleOrClass) {
    const module = typeof moduleOrClass === 'function'
      ? new moduleOrClass()
      : moduleOrClass

    if (!(module instanceof Module)) {
      console.error('[ModuleManager] 注册失败: 必须是 Module 的实例或子类')
      return null
    }

    if (this.modules.has(module.id)) {
      console.warn(`[ModuleManager] 模块 ${module.id} 已注册，跳过`)
      return this.modules.get(module.id)
    }

    this.modules.set(module.id, module)
    console.log(`[ModuleManager] 注册模块: ${module.name} (${module.id})`)
    return module
  }

  /**
   * 注销模块
   * @param {string} moduleId
   */
  async unregister(moduleId) {
    const module = this.modules.get(moduleId)
    if (!module) return

    module.destroy()
    this.modules.delete(moduleId)
    console.log(`[ModuleManager] 注销模块: ${moduleId}`)
  }

  /**
   * 启用模块
   * @param {string} moduleId
   */
  async enable(moduleId) {
    const module = this.modules.get(moduleId)
    if (!module) return

    await module.enable()
    await settings.setModuleEnabled(moduleId, true)
    emit(EVENTS.MODULE_ENABLED, { moduleId })
  }

  /**
   * 禁用模块
   * @param {string} moduleId
   */
  async disable(moduleId) {
    const module = this.modules.get(moduleId)
    if (!module) return

    await module.disable()
    await settings.setModuleEnabled(moduleId, false)
    emit(EVENTS.MODULE_DISABLED, { moduleId })
  }

  /**
   * 切换模块启用状态
   * @param {string} moduleId
   */
  async toggle(moduleId) {
    const module = this.modules.get(moduleId)
    if (!module) return

    if (module.enabled) {
      await this.disable(moduleId)
    } else {
      await this.enable(moduleId)
    }
  }

  /**
   * 获取所有模块信息（供 Popup/Options 使用）
   * @returns {Array<ModuleInfo>}
   */
  getModuleList() {
    const list = []
    for (const [id, module] of this.modules) {
      list.push({
        id: module.id,
        name: module.name,
        icon: module.icon,
        description: module.description,
        category: module.category,
        enabled: module.enabled,
        statusBar: module.getStatusBar(),
      })
    }
    return list
  }

  /**
   * 获取所有模块的设置 Schema（供 Options 页使用）
   * @returns {Array<{id, name, icon, schema}>}
   */
  getSettingsSchemas() {
    const schemas = []
    for (const [id, module] of this.modules) {
      const schema = module.getSettingsSchema()
      if (schema) {
        schemas.push({
          id: module.id,
          name: module.name,
          icon: module.icon,
          schema,
        })
      }
    }
    return schemas
  }

  /**
   * 获取模块实例
   * @param {string} moduleId
   * @returns {Module|undefined}
   */
  getModule(moduleId) {
    return this.modules.get(moduleId)
  }

  /**
   * 通知所有模块页面变化
   * @param {string} url
   */
  onPageChange(url) {
    const pageType = getPageType(url)
    for (const [id, module] of this.modules) {
      if (module.enabled) {
        try {
          module.onPageChange(url, pageType)
        } catch (e) {
          console.error(`[${module.name}] 页面变化处理失败:`, e)
        }
      }
    }
  }

  /**
   * 获取所有启用模块的状态栏信息
   * @returns {Array<{moduleId, name, icon, statusBar}>}
   */
  getStatusBars() {
    const bars = []
    for (const [id, module] of this.modules) {
      if (module.enabled) {
        const statusBar = module.getStatusBar()
        if (statusBar) {
          bars.push({
            moduleId: id,
            name: module.name,
            icon: module.icon,
            ...statusBar,
          })
        }
      }
    }
    return bars
  }

  /**
   * 销毁所有模块
   */
  destroyAll() {
    for (const [id, module] of this.modules) {
      module.destroy()
    }
    this.modules.clear()
    this.initialized = false
  }

  // ========== 内部方法 ==========

  /**
   * 注册内置模块（等待所有 import 完成）
   */
  async _registerBuiltInModules() {
    await Promise.all([
      import('./credit/index.js').then(({ CreditModule }) => this.register(CreditModule)),
      import('./auto-browse/index.js').then(({ AutoBrowseModule }) => this.register(AutoBrowseModule)),
      import('./side-topic/index.js').then(({ SideTopicModule }) => this.register(SideTopicModule)),
      import('./peek/index.js').then(({ PeekModule }) => this.register(PeekModule)),
      import('./ui-enhance/index.js').then(({ UIEnhanceModule }) => this.register(UIEnhanceModule)),
    ])
  }
}

// 重新导出基类和工具
export { Module, getPageType } from './base.js'
