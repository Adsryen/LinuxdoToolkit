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

    // 初始化 settings
    await settings.init()

    // 注册所有内置模块
    this._registerBuiltInModules()

    // 根据已保存的开关状态启动模块
    const enabledMap = settings.getEnabledModules()
    for (const [id, module] of this.modules) {
      const isEnabled = enabledMap[id] !== false  // 默认启用
      const moduleSettings = await settings.getModule(id, module.defaultSettings)

      await module.init(moduleSettings)
      if (isEnabled) {
        await module.enable()
      }
    }

    // 监听模块开关变化
    settings.onEnabledChange(async (enabledMap) => {
      for (const [id, module] of this.modules) {
        const shouldEnable = enabledMap[id] !== false
        if (shouldEnable && !module.enabled) {
          await module.enable()
        } else if (!shouldEnable && module.enabled) {
          await module.disable()
        }
      }
    })

    this.initialized = true
    console.log(`[ModuleManager] 初始化完成，已注册 ${this.modules.size} 个模块`)
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
   * 注册内置模块
   * 后续每个模块完成后在此添加
   */
  _registerBuiltInModules() {
    // Phase 2: Credit 积分监控
    import('./credit/index.js').then(({ CreditModule }) => {
      this.register(CreditModule)
    })

    // Phase 3: Auto Browse 自动浏览
    import('./auto-browse/index.js').then(({ AutoBrowseModule }) => {
      this.register(AutoBrowseModule)
    })

    // Phase 4: Side Topic 话题侧栏
    import('./side-topic/index.js').then(({ SideTopicModule }) => {
      this.register(SideTopicModule)
    })

    // Phase 5: LD Peek 快速预览
    // import('./peek/index.js').then(({ PeekModule }) => {
    //   this.register(PeekModule)
    // })

    // Phase 6: UI Enhance 界面美化
    // import('./ui-enhance/index.js').then(({ UIEnhanceModule }) => {
    //   this.register(UIEnhanceModule)
    // })
  }
}

// 重新导出基类和工具
export { Module, getPageType } from './base.js'
