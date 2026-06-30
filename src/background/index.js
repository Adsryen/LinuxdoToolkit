/**
 * Background Service Worker
 *
 * 负责：
 * - 扩展生命周期管理
 * - Popup ↔ Content 的消息中转
 * - 存储管理
 * - 快捷键处理
 * - 自动备份
 */

// ========== 生命周期 ==========

chrome.runtime.onInstalled.addListener((details) => {
  console.log('扩展已安装/更新:', details.reason)

  if (details.reason === 'install') {
    initDefaultSettings()
  } else if (details.reason === 'update') {
    handleUpdate(details.previousVersion)
  }
})

/**
 * 初始化默认配置
 */
async function initDefaultSettings() {
  await chrome.storage.local.set({
    'toolkit.global': {
      theme: 'auto',
      language: 'zh-CN',
      toolbarEnabled: true,
      toolbarPosition: { x: -1, y: 80 },
      toolbarCollapsed: false,
      autoBackup: true,
      maxBackups: 5,
    },
    'toolkit.enabledModules': {},
    'toolkit.stats': {},
  })
  console.log('默认配置已初始化')
}

/**
 * 处理版本更新
 */
function handleUpdate(previousVersion) {
  console.log(`扩展从 ${previousVersion} 更新到 ${chrome.runtime.getManifest().version}`)
}

// ========== 消息处理 ==========

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  handleMessage(message, sender, sendResponse)
  return true  // 保持通道开放（异步响应）
})

async function handleMessage(message, sender, sendResponse) {
  try {
    switch (message.type) {
      // 模块列表（中转到 content script）
      case 'GET_MODULE_LIST':
        forwardToContent(message, sendResponse)
        break

      // 模块开关（中转到 content script）
      case 'TOGGLE_MODULE':
      case 'ENABLE_MODULE':
      case 'DISABLE_MODULE':
        forwardToContent(message, sendResponse)
        break

      // 全局配置
      case 'GET_SETTINGS': {
        const key = message.key || 'toolkit.global'
        const result = await chrome.storage.local.get(key)
        sendResponse({ success: true, data: result[key] ?? null })
        break
      }

      case 'SET_SETTINGS': {
        await chrome.storage.local.set({ [message.key]: message.value })
        sendResponse({ success: true })
        break
      }

      // 模块配置
      case 'GET_MODULE_SETTINGS': {
        const key = `toolkit.module.${message.moduleId}`
        const result = await chrome.storage.local.get(key)
        sendResponse({ success: true, data: result[key] || {} })
        break
      }

      case 'SET_MODULE_SETTINGS': {
        const key = `toolkit.module.${message.moduleId}`
        await chrome.storage.local.set({ [key]: message.value })
        sendResponse({ success: true })
        break
      }

      // 模块开关状态
      case 'GET_ENABLED_MODULES': {
        const result = await chrome.storage.local.get('toolkit.enabledModules')
        sendResponse({ success: true, data: result['toolkit.enabledModules'] || {} })
        break
      }

      case 'SET_MODULE_ENABLED': {
        const result = await chrome.storage.local.get('toolkit.enabledModules')
        const map = result['toolkit.enabledModules'] || {}
        map[message.moduleId] = message.enabled
        await chrome.storage.local.set({ 'toolkit.enabledModules': map })
        // 同时通知 content script
        forwardToContent(message, () => {})
        sendResponse({ success: true })
        break
      }

      // 备份
      case 'EXPORT_BACKUP':
        handleExportBackup(sendResponse)
        break

      case 'IMPORT_BACKUP':
        handleImportBackup(message.data, message.strategy, sendResponse)
        break

      // 打开 Options 页
      case 'OPEN_OPTIONS':
        chrome.runtime.openOptionsPage()
        sendResponse({ success: true })
        break

      default:
        sendResponse({ success: false, error: '未知消息类型' })
    }
  } catch (error) {
    console.error('处理消息失败:', error)
    sendResponse({ success: false, error: error.message })
  }
}

/**
 * 转发消息到 content script
 */
async function forwardToContent(message, sendResponse) {
  try {
    // 同时匹配 linux.do 和 www.linux.do
    const tabs = await chrome.tabs.query({
      url: ['https://linux.do/*', 'https://www.linux.do/*']
    })
    if (tabs.length === 0) {
      sendResponse({ success: true, data: [], noTab: true })
      return
    }
    // 尝试所有匹配的 tab，直到有一个成功
    for (const tab of tabs) {
      try {
        const response = await chrome.tabs.sendMessage(tab.id, message)
        sendResponse(response || { success: true })
        return
      } catch (e) {
        // 这个 tab 可能没有 content script，继续尝试下一个
        continue
      }
    }
    sendResponse({ success: true, data: [], noTab: true })
  } catch (error) {
    sendResponse({ success: false, error: error.message })
  }
}

// ========== 备份 ==========

async function handleExportBackup(sendResponse) {
  try {
    const all = await chrome.storage.local.get(null)
    const data = {}
    for (const [key, value] of Object.entries(all)) {
      if (key.startsWith('toolkit.')) {
        data[key] = value
      }
    }
    sendResponse({
      success: true,
      data: {
        version: 1,
        timestamp: new Date().toISOString(),
        appVersion: chrome.runtime.getManifest().version,
        data,
      },
    })
  } catch (error) {
    sendResponse({ success: false, error: error.message })
  }
}

async function handleImportBackup(data, strategy, sendResponse) {
  try {
    if (!data?.data) {
      sendResponse({ success: false, error: '无效的备份数据' })
      return
    }
    if (strategy === 'overwrite') {
      await chrome.storage.local.set(data.data)
    } else {
      const current = await chrome.storage.local.get(null)
      const merged = { ...current }
      for (const [key, value] of Object.entries(data.data)) {
        if (typeof value === 'object' && typeof merged[key] === 'object') {
          merged[key] = { ...merged[key], ...value }
        } else {
          merged[key] = value
        }
      }
      await chrome.storage.local.set(merged)
    }
    sendResponse({ success: true })
  } catch (error) {
    sendResponse({ success: false, error: error.message })
  }
}

// ========== 快捷键 ==========

chrome.commands.onCommand.addListener((command) => {
  switch (command) {
    case 'toggle-dark-mode':
      forwardToContent({ type: 'TOGGLE_MODULE', moduleId: 'ui-enhance' }, () => {})
      break
    case 'open-settings':
      chrome.runtime.openOptionsPage()
      break
  }
})

// ========== 自动备份 ==========

chrome.storage.onChanged.addListener((changes, namespace) => {
  if (namespace !== 'local') return
  const changedKeys = Object.keys(changes)
  if (changedKeys.some(k => k.startsWith('toolkit.module.'))) {
    handleAutoBackup()
  }
})

async function handleAutoBackup() {
  try {
    const { 'toolkit.global': globalSettings } = await chrome.storage.local.get('toolkit.global')
    if (!globalSettings?.autoBackup) return

    const all = await chrome.storage.local.get(null)
    const data = {}
    for (const [key, value] of Object.entries(all)) {
      if (key.startsWith('toolkit.module.') || key === 'toolkit.global') {
        data[key] = value
      }
    }

    const snapshot = {
      id: Date.now().toString(36),
      timestamp: new Date().toISOString(),
      data,
    }

    const { 'toolkit.backups': backups = [] } = await chrome.storage.local.get('toolkit.backups')
    backups.unshift(snapshot)
    const max = globalSettings.maxBackups || 5
    if (backups.length > max) backups.length = max
    await chrome.storage.local.set({ 'toolkit.backups': backups })
  } catch (error) {
    console.error('自动备份失败:', error)
  }
}

console.log('Background Service Worker 已启动')
