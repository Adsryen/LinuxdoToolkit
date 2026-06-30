/**
 * Popup 脚本
 */

// DOM 元素
const elements = {
  toggleDarkMode: document.getElementById('toggle-dark-mode'),
  autoSign: document.getElementById('auto-sign'),
  openSettings: document.getElementById('open-settings'),
  moduleUI: document.getElementById('module-ui'),
  moduleTools: document.getElementById('module-tools'),
  reportIssue: document.getElementById('report-issue')
}

// 当前设置
let currentSettings = null

/**
 * 初始化
 */
async function init() {
  // 加载设置
  await loadSettings()

  // 绑定事件
  bindEvents()

  // 更新 UI
  updateUI()

  console.log('Popup 已初始化')
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
        if (!response.success) {
          console.error('保存设置失败:', response.error)
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
  // 暗黑模式切换
  elements.toggleDarkMode.addEventListener('click', async () => {
    if (currentSettings && currentSettings.modules && currentSettings.modules.ui) {
      currentSettings.modules.ui.darkMode = !currentSettings.modules.ui.darkMode
      await saveSettings()
      updateUI()
    }
  })

  // 自动签到
  elements.autoSign.addEventListener('click', async () => {
    // 发送签到消息给 content script
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (tabs[0] && tabs[0].url && tabs[0].url.includes('linux.do')) {
        chrome.tabs.sendMessage(tabs[0].id, { type: 'AUTO_SIGN' })
      }
    })
  })

  // 打开设置
  elements.openSettings.addEventListener('click', () => {
    chrome.runtime.openOptionsPage()
  })

  // UI 模块开关
  elements.moduleUI.addEventListener('change', async () => {
    if (currentSettings && currentSettings.modules && currentSettings.modules.ui) {
      currentSettings.modules.ui.enabled = elements.moduleUI.checked
      await saveSettings()
      updateUI()
    }
  })

  // Tools 模块开关
  elements.moduleTools.addEventListener('change', async () => {
    if (currentSettings && currentSettings.modules && currentSettings.modules.tools) {
      currentSettings.modules.tools.enabled = elements.moduleTools.checked
      await saveSettings()
      updateUI()
    }
  })

  // 报告问题
  elements.reportIssue.addEventListener('click', (e) => {
    e.preventDefault()
    chrome.tabs.create({
      url: 'https://github.com/Adsryen/LinuxdoToolkit/issues'
    })
  })
}

/**
 * 更新 UI
 */
function updateUI() {
  if (!currentSettings) {
    return
  }

  // 更新模块开关状态
  if (currentSettings.modules) {
    if (currentSettings.modules.ui) {
      elements.moduleUI.checked = currentSettings.modules.ui.enabled
    }
    if (currentSettings.modules.tools) {
      elements.moduleTools.checked = currentSettings.modules.tools.enabled
    }
  }

  // 更新暗黑模式按钮状态
  const isDarkMode = currentSettings.modules?.ui?.darkMode || false
  elements.toggleDarkMode.style.background = isDarkMode ? '#e6f7ff' : ''
  elements.toggleDarkMode.querySelector('.icon').textContent = isDarkMode ? '☀️' : '🌙'
}

// 初始化
document.addEventListener('DOMContentLoaded', init)
