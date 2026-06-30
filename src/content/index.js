/**
 * LinuxdoToolkit - Content Script
 *
 * 注入到 Linux.do 页面的内容脚本，负责：
 * - 加载和管理功能模块
 * - 与页面 DOM 交互
 * - 与 background script 通信
 */

import { ModuleManager } from './modules/index.js'
import { Toolbar } from './toolbar/index.js'
import { Navigation } from '../utils/navigation.js'
import { settings } from '../utils/settings.js'

/**
 * 扩展主类
 */
class LinuxdoToolkit {
  constructor() {
    this.moduleManager = new ModuleManager()
    this.toolbar = null
    this.navigation = new Navigation()
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
      // 初始化模块管理器（内部会初始化 settings 和所有模块）
      await this.moduleManager.init()

      // 创建浮动工具栏
      this.setupToolbar()

      // 设置 SPA 导航监听
      this.setupNavigation()

      // 监听来自 Popup / Background 的消息
      this.setupMessageListener()

      this.initialized = true
      console.log('LinuxdoToolkit 初始化完成')
    } catch (error) {
      console.error('LinuxdoToolkit 初始化失败:', error)
    }
  }

  /**
   * 创建浮动工具栏
   */
  setupToolbar() {
    const globalSettings = settings.getGlobal()
    if (globalSettings.toolbarEnabled === false) return

    this.toolbar = new Toolbar(this.moduleManager)
    this.toolbar.mount()
  }

  /**
   * 设置 SPA 导航监听
   */
  setupNavigation() {
    this.navigation.start()
    this.navigation.on((url, pageType) => {
      console.log('[Navigation] 页面变化:', url, pageType)
      this.moduleManager.onPageChange(url)
    })
  }

  /**
   * 监听来自 Popup / Background 的消息
   */
  setupMessageListener() {
    chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
      this.handleMessage(message, sender, sendResponse)
      return true  // 保持消息通道开放
    })
  }

  /**
   * 处理消息
   */
  async handleMessage(message, sender, sendResponse) {
    try {
      switch (message.type) {
        case 'GET_MODULE_LIST':
          sendResponse({
            success: true,
            data: this.moduleManager.getModuleList()
          })
          break

        case 'TOGGLE_MODULE':
          await this.moduleManager.toggle(message.moduleId)
          this.toolbar?.refreshStatusBars()
          sendResponse({ success: true })
          break

        case 'ENABLE_MODULE':
          await this.moduleManager.enable(message.moduleId)
          this.toolbar?.refreshStatusBars()
          sendResponse({ success: true })
          break

        case 'DISABLE_MODULE':
          await this.moduleManager.disable(message.moduleId)
          this.toolbar?.refreshStatusBars()
          sendResponse({ success: true })
          break

        case 'GET_STATUS_BARS':
          sendResponse({
            success: true,
            data: this.moduleManager.getStatusBars()
          })
          break

        case 'GET_SETTINGS_SCHEMAS':
          sendResponse({
            success: true,
            data: this.moduleManager.getSettingsSchemas()
          })
          break

        default:
          sendResponse({ success: false, error: '未知消息类型' })
      }
    } catch (error) {
      console.error('[Message] 处理失败:', error)
      sendResponse({ success: false, error: error.message })
    }
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
