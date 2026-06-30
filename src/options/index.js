/**
 * Options 页面脚本
 */

// 当前设置
let currentSettings = null

// DOM 元素缓存
const elements = {}

/**
 * 初始化
 */
async function init() {
  // 缓存 DOM 元素
  cacheElements()

  // 加载设置
  await loadSettings()

  // 绑定事件
  bindEvents()

  // 更新 UI
  updateUI()

  console.log('Options 页面已初始化')
}

/**
 * 缓存 DOM 元素
 */
function cacheElements() {
  // 导航项
  elements.navItems = document.querySelectorAll('.nav-item')
  elements.tabContents = document.querySelectorAll('.tab-content')

  // 设置项
  elements.autoStart = document.getElementById('auto-start')
  elements.debugMode = document.getElementById('debug-mode')
  elements.darkMode = document.getElementById('dark-mode')
  elements.themeSelect = document.getElementById('theme-select')
  elements.autoSign = document.getElementById('auto-sign')
  elements.quickReply = document.getElementById('quick-reply')
  elements.desktopNotification = document.getElementById('desktop-notification')
  elements.soundNotification = document.getElementById('sound-notification')

  // 按钮
  elements.saveSettings = document.getElementById('save-settings')
  elements.resetSettings = document.getElementById('reset-settings')
}

/**
 * 加载设置
 */
async function loadSettings() {
  return new Promise((resolve) => {
    chrome.runtime.sendMessage(
      { type: 'GET_SETTINGS' },
      (response) => {
        if (response.success) {
          currentSettings = response.data
        } else {
          console.error('加载设置失败:', response.error)
        }
        resolve()
      }
    )
  })
}

/**
 * 保存设置
 */
async function saveSettings() {
  return new Promise((resolve) => {
    chrome.runtime.sendMessage(
      {
        type: 'UPDATE_SETTINGS',
        data: currentSettings
      },
      (response) => {
        if (response.success) {
          showNotification('设置已保存', 'success')
        } else {
          showNotification('保存失败: ' + response.error, 'error')
        }
        resolve()
      }
    )
  })
}

/**
 * 绑定事件
 */
function bindEvents() {
  // 导航切换
  elements.navItems.forEach((item) => {
    item.addEventListener('click', () => {
      const tabName = item.dataset.tab
      switchTab(tabName)
    })
  })

  // 保存设置按钮
  elements.saveSettings.addEventListener('click', async () => {
    collectSettings()
    await saveSettings()
  })

  // 重置设置按钮
  elements.resetSettings.addEventListener('click', async () => {
    if (confirm('确定要重置所有设置吗？这将恢复到默认设置。')) {
      await initializeDefaultSettings()
      await loadSettings()
      updateUI()
      showNotification('设置已重置', 'success')
    }
  })

  // 监听设置变化
  const settingInputs = document.querySelectorAll('input, select')
  settingInputs.forEach((input) => {
    input.addEventListener('change', () => {
      collectSettings()
    })
  })
}

/**
 * 切换标签页
 */
function switchTab(tabName) {
  // 更新导航项状态
  elements.navItems.forEach((item) => {
    if (item.dataset.tab === tabName) {
      item.classList.add('active')
    } else {
      item.classList.remove('active')
    }
  })

  // 更新内容区域
  elements.tabContents.forEach((content) => {
    if (content.id === `tab-${tabName}`) {
      content.classList.add('active')
    } else {
      content.classList.remove('active')
    }
  })
}

/**
 * 收集当前设置
 */
function collectSettings() {
  if (!currentSettings) {
    currentSettings = {}
  }

  // 从 UI 收集设置
  currentSettings.modules = {
    ui: {
      enabled: true,
      darkMode: elements.darkMode?.checked || false,
      theme: elements.themeSelect?.value || 'default'
    },
    tools: {
      enabled: true,
      autoSign: elements.autoSign?.checked || false,
      quickReply: elements.quickReply?.checked || false
    },
    notifications: {
      enabled: true,
      desktop: elements.desktopNotification?.checked || false,
      sound: elements.soundNotification?.checked || false
    }
  }
}

/**
 * 更新 UI
 */
function updateUI() {
  if (!currentSettings) {
    return
  }

  // 更新 UI 模块设置
  if (currentSettings.modules?.ui) {
    const ui = currentSettings.modules.ui
    if (elements.darkMode) elements.darkMode.checked = ui.darkMode || false
    if (elements.themeSelect) elements.themeSelect.value = ui.theme || 'default'
  }

  // 更新工具模块设置
  if (currentSettings.modules?.tools) {
    const tools = currentSettings.modules.tools
    if (elements.autoSign) elements.autoSign.checked = tools.autoSign || false
    if (elements.quickReply) elements.quickReply.checked = tools.quickReply !== false
  }

  // 更新通知设置
  if (currentSettings.modules?.notifications) {
    const notifications = currentSettings.modules.notifications
    if (elements.desktopNotification) elements.desktopNotification.checked = notifications.desktop !== false
    if (elements.soundNotification) elements.soundNotification.checked = notifications.sound || false
  }
}

/**
 * 初始化默认设置
 */
async function initializeDefaultSettings() {
  return new Promise((resolve) => {
    chrome.runtime.sendMessage(
      { type: 'INIT_DEFAULT_SETTINGS' },
      (response) => {
        resolve()
      }
    )
  })
}

/**
 * 显示通知
 */
function showNotification(message, type = 'info') {
  // 创建通知元素
  const notification = document.createElement('div')
  notification.className = `notification notification-${type}`
  notification.textContent = message
  notification.style.cssText = `
    position: fixed;
    top: 20px;
    right: 20px;
    padding: 12px 24px;
    background: ${type === 'success' ? '#52c41a' : type === 'error' ? '#ff4d4f' : '#1890ff'};
    color: white;
    border-radius: 6px;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
    z-index: 10000;
    animation: slideIn 0.3s ease;
  `

  // 添加动画样式
  const style = document.createElement('style')
  style.textContent = `
    @keyframes slideIn {
      from {
        transform: translateX(100%);
        opacity: 0;
      }
      to {
        transform: translateX(0);
        opacity: 1;
      }
    }
    @keyframes slideOut {
      from {
        transform: translateX(0);
        opacity: 1;
      }
      to {
        transform: translateX(100%);
        opacity: 0;
      }
    }
  `
  document.head.appendChild(style)

  document.body.appendChild(notification)

  // 3 秒后移除
  setTimeout(() => {
    notification.style.animation = 'slideOut 0.3s ease'
    setTimeout(() => {
      if (notification.parentNode) {
        notification.parentNode.removeChild(notification)
      }
    }, 300)
  }, 3000)
}

// 初始化
document.addEventListener('DOMContentLoaded', init)
