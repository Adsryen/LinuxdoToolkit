/**
 * LinuxdoToolkit - Background Service Worker
 *
 * 扩展的后台服务脚本，负责：
 * - 扩展生命周期管理
 * - 消息通信协调
 * - 存储管理
 * - 通知处理
 */

// 扩展安装事件
chrome.runtime.onInstalled.addListener((details) => {
  console.log('LinuxdoToolkit 已安装', details)

  // 初始化默认设置
  if (details.reason === 'install') {
    initializeDefaultSettings()
  }

  // 更新处理
  if (details.reason === 'update') {
    handleUpdate(details.previousVersion)
  }
})

/**
 * 初始化默认设置
 */
async function initializeDefaultSettings() {
  const defaultSettings = {
    modules: {
      ui: {
        enabled: true,
        darkMode: false,
        theme: 'default'
      },
      tools: {
        enabled: true,
        autoSign: false,
        quickReply: true
      },
      notifications: {
        enabled: true,
        desktop: true,
        sound: false
      }
    },
    shortcuts: {
      toggleDarkMode: 'Ctrl+Shift+D',
      openSettings: 'Ctrl+Shift+L',
      quickReply: 'Ctrl+Shift+R'
    },
    version: '1.0.0'
  }

  try {
    await chrome.storage.sync.set({ settings: defaultSettings })
    console.log('默认设置已初始化')
  } catch (error) {
    console.error('初始化设置失败:', error)
  }
}

/**
 * 处理扩展更新
 */
function handleUpdate(previousVersion) {
  console.log(`扩展从 ${previousVersion} 更新到 ${chrome.runtime.getManifest().version}`)
  // 在这里处理版本迁移逻辑
}

// 消息监听
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  console.log('收到消息:', message)

  switch (message.type) {
    case 'GET_SETTINGS':
      handleGetSettings(sendResponse)
      return true

    case 'UPDATE_SETTINGS':
      handleUpdateSettings(message.data, sendResponse)
      return true

    case 'SEND_NOTIFICATION':
      handleNotification(message.data)
      sendResponse({ success: true })
      return false

    default:
      sendResponse({ error: '未知消息类型' })
      return false
  }
})

/**
 * 获取设置
 */
async function handleGetSettings(sendResponse) {
  try {
    const result = await chrome.storage.sync.get('settings')
    sendResponse({ success: true, data: result.settings })
  } catch (error) {
    sendResponse({ success: false, error: error.message })
  }
}

/**
 * 更新设置
 */
async function handleUpdateSettings(newSettings, sendResponse) {
  try {
    await chrome.storage.sync.set({ settings: newSettings })
    sendResponse({ success: true })
  } catch (error) {
    sendResponse({ success: false, error: error.message })
  }
}

/**
 * 处理通知
 */
function handleNotification(data) {
  chrome.notifications.create({
    type: 'basic',
    iconUrl: 'public/icons/icon128.png',
    title: data.title || 'LinuxdoToolkit',
    message: data.message || '',
    priority: data.priority || 0
  })
}

// 监听来自 content script 的连接
chrome.runtime.onConnect.addListener((port) => {
  console.log('Content script 已连接:', port.name)

  port.onDisconnect.addListener(() => {
    console.log('Content script 已断开:', port.name)
  })
})

console.log('LinuxdoToolkit Background Service Worker 已启动')
