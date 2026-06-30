/**
 * 模块管理器
 *
 * 负责加载、初始化和管理所有功能模块
 */

// 导入所有模块
import { uiModule } from './ui/index.js'
import { toolsModule } from './tools/index.js'

/**
 * 模块管理器类
 */
export class ModuleManager {
  constructor() {
    this.modules = new Map()
    this.settings = null
  }

  /**
   * 初始化模块管理器
   */
  async init(settings) {
    this.settings = settings

    // 注册所有模块
    this.registerModule('ui', uiModule)
    this.registerModule('tools', toolsModule)

    // 初始化所有已启用的模块
    await this.initEnabledModules()

    console.log(`已加载 ${this.modules.size} 个模块`)
  }

  /**
   * 注册模块
   */
  registerModule(name, module) {
    if (this.modules.has(name)) {
      console.warn(`模块 "${name}" 已存在，将被覆盖`)
    }
    this.modules.set(name, module)
    console.log(`注册模块: ${name}`)
  }

  /**
   * 初始化所有已启用的模块
   */
  async initEnabledModules() {
    for (const [name, module] of this.modules) {
      if (this.isModuleEnabled(name)) {
        try {
          await module.init(this.getModuleSettings(name))
          console.log(`模块 "${name}" 已初始化`)
        } catch (error) {
          console.error(`模块 "${name}" 初始化失败:`, error)
        }
      }
    }
  }

  /**
   * 检查模块是否启用
   */
  isModuleEnabled(moduleName) {
    if (!this.settings || !this.settings.modules) {
      return true // 默认启用
    }
    const moduleSettings = this.settings.modules[moduleName]
    return moduleSettings ? moduleSettings.enabled : true
  }

  /**
   * 获取模块设置
   */
  getModuleSettings(moduleName) {
    if (!this.settings || !this.settings.modules) {
      return {}
    }
    return this.settings.modules[moduleName] || {}
  }

  /**
   * 启用模块
   */
  async enableModule(moduleName) {
    const module = this.modules.get(moduleName)
    if (!module) {
      console.error(`模块 "${moduleName}" 不存在`)
      return
    }

    try {
      await module.enable()
      console.log(`模块 "${moduleName}" 已启用`)
    } catch (error) {
      console.error(`启用模块 "${moduleName}" 失败:`, error)
    }
  }

  /**
   * 禁用模块
   */
  async disableModule(moduleName) {
    const module = this.modules.get(moduleName)
    if (!module) {
      console.error(`模块 "${moduleName}" 不存在`)
      return
    }

    try {
      await module.disable()
      console.log(`模块 "${moduleName}" 已禁用`)
    } catch (error) {
      console.error(`禁用模块 "${moduleName}" 失败:`, error)
    }
  }

  /**
   * 更新设置
   */
  async updateSettings(newSettings) {
    this.settings = newSettings
    // 重新初始化所有模块
    await this.initEnabledModules()
  }

  /**
   * 页面变化回调
   */
  async onPageChange(url) {
    for (const [name, module] of this.modules) {
      if (this.isModuleEnabled(name) && module.onPageChange) {
        try {
          await module.onPageChange(url)
        } catch (error) {
          console.error(`模块 "${name}" 处理页面变化失败:`, error)
        }
      }
    }
  }

  /**
   * 获取所有模块信息
   */
  getModulesInfo() {
    const info = []
    for (const [name, module] of this.modules) {
      info.push({
        name,
        description: module.description || '',
        enabled: this.isModuleEnabled(name)
      })
    }
    return info
  }
}
