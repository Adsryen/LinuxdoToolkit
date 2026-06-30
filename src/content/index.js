/**
 * LinuxdoToolkit - Content Script
 *
 * 注入到 Linux.do 页面的内容脚本，负责：
 * - 加载和管理功能模块
 * - 与页面 DOM 交互
 * - 与 background script 通信
 */

// 导入模块管理器
import { ModuleManager } from './modules/index.js'

/**
 * 扩展主类
 */
class LinuxdoToolkit {
  constructor() {
    this.moduleManager = new ModuleManager()
    this.initialized = false
  }

  /**
   * 初始化扩展
   */
  async init() {
    if (this.initialized) {
      console.warn('LinuxdoToolkit 已经初始化')
      return
    }

    console.log('LinuxdoToolkit 初始化中...')

    try {
      // 获取设置
      const settings = await this.getSettings()

      // 初始化模块管理器
      await this.moduleManager.init(settings)

      // 监听设置变化
      this.setupSettingsListener()

      // 监听页面变化（用于 SPA 页面）
      this.setupPageObserver()

      this.initialized = true
      console.log('LinuxdoToolkit 初始化完成')
    } catch (error) {
      console.error('LinuxdoToolkit 初始化失败:', error)
    }
  }

  /**
   * 获取设置
   */
  async getSettings() {
    return new Promise((resolve) => {
      chrome.runtime.sendMessage(
        { type: 'GET_SETTINGS' },
        (response) => {
          if (response.success) {
            resolve(response.data)
          } else {
            console.error('获取设置失败:', response.error)
            resolve(null)
          }
        }
      )
    })
  }

  /**
   * 监听设置变化
   */
  setupSettingsListener() {
    chrome.storage.onChanged.addListener((changes, namespace) => {
      if (namespace === 'sync' && changes.settings) {
        const newSettings = changes.settings.newValue
        console.log('设置已更新:', newSettings)
        this.moduleManager.updateSettings(newSettings)
      }
    })
  }

  /**
   * 监听页面变化（SPA 路由）
   */
  setupPageObserver() {
    // 监听 URL 变化
    let lastUrl = location.href
    const observer = new MutationObserver(() => {
      if (location.href !== lastUrl) {
        lastUrl = location.href
        console.log('页面 URL 变化:', lastUrl)
        this.moduleManager.onPageChange(lastUrl)
      }
    })

    observer.observe(document.body, {
      childList: true,
      subtree: true
    })

    // 监听 popstate 事件
    window.addEventListener('popstate', () => {
      console.log('页面导航:', location.href)
      this.moduleManager.onPageChange(location.href)
    })
  }
}

// 初始化扩展
const toolkit = new LinuxdoToolkit()

// 等待 DOM 准备就绪
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    toolkit.init()
  })
} else {
  toolkit.init()
}

// 导出以供调试
window.__linuxdoToolkit = toolkit
