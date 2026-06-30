/**
 * Popup Script
 *
 * 极简控制中心：模块列表（图标+名称+toggle）+ 跳转设置
 */

// ========== 默认模块定义（当无法连接 content script 时使用） ==========
const DEFAULT_MODULES = [
  { id: 'credit',      name: '积分监控',  icon: '💰', description: '实时积分收入',   category: 'data',      enabled: true },
  { id: 'auto-browse', name: '自动浏览',  icon: '🔄', description: '自动浏览帖子',   category: 'efficiency', enabled: true },
  { id: 'side-topic',  name: '话题侧栏',  icon: '📋', description: '侧边话题面板',   category: 'preview',   enabled: true },
  { id: 'peek',        name: '快速预览',  icon: '👁️', description: '抽屉式预览',    category: 'preview',   enabled: true },
  { id: 'ui-enhance',  name: '界面美化',  icon: '🎨', description: '暗黑模式/主题',  category: 'ui',        enabled: true },
]

const CATEGORY_NAMES = {
  efficiency: '效率',
  preview: '预览',
  data: '数据',
  ui: '界面',
  other: '其他',
}

// ========== DOM ==========
const $ = (sel) => document.querySelector(sel)
const statusBar = $('#status-bar')
const statusText = $('#status-text')
const moduleListEl = $('#module-list')

// ========== 初始化 ==========
document.addEventListener('DOMContentLoaded', async () => {
  const manifest = chrome.runtime.getManifest()
  $('#version-text').textContent = `v${manifest.version}`

  $('#btn-options').addEventListener('click', openOptions)
  $('#btn-refresh').addEventListener('click', loadModules)
  $('#link-options').addEventListener('click', (e) => { e.preventDefault(); openOptions() })

  await loadModules()
})

// ========== 加载模块 ==========
async function loadModules() {
  moduleListEl.innerHTML = '<div class="loading">加载中...</div>'

  let modules = null
  let connected = false

  // 1. 尝试从 content script 获取实时模块列表
  try {
    const response = await sendMessage({ type: 'GET_MODULE_LIST' })
    if (response?.success && !response.noTab) {
      modules = response.data
      connected = true
    }
  } catch {
    // 忽略
  }

  // 2. 回退：从 storage 读取开关状态
  if (!modules) {
    const enabledMap = await getEnabledModules()
    modules = DEFAULT_MODULES.map(m => ({
      ...m,
      enabled: enabledMap[m.id] !== false,
    }))

    try {
      const tabs = await chrome.tabs.query({ url: ['https://linux.do/*', 'https://www.linux.do/*'] })
      setStatus(tabs.length > 0 ? 'no-tab' : 'offline')
    } catch {
      setStatus('offline')
    }
  } else {
    setStatus('connected')
  }

  renderModules(modules, connected)
}

// ========== 渲染模块列表 ==========
function renderModules(modules, connected) {
  if (!modules?.length) {
    moduleListEl.innerHTML = `
      <div class="empty-state">
        <div class="empty-icon">📦</div>
        <p>暂无可用模块</p>
      </div>`
    return
  }

  // 按分类分组
  const grouped = {}
  for (const m of modules) {
    const cat = m.category || 'other'
    if (!grouped[cat]) grouped[cat] = []
    grouped[cat].push(m)
  }

  let html = ''
  const order = ['efficiency', 'preview', 'data', 'ui', 'other']

  for (const cat of order) {
    const items = grouped[cat]
    if (!items?.length) continue

    html += `<div class="module-list-header">${CATEGORY_NAMES[cat] || cat}</div>`
    for (const m of items) {
      html += `
        <div class="module-item" data-id="${m.id}">
          <div class="module-info">
            <span class="module-icon">${m.icon}</span>
            <div class="module-details">
              <span class="module-name">${m.name}</span>
              <span class="module-desc">${m.description}</span>
            </div>
          </div>
          <label class="toggle">
            <input type="checkbox" data-module-id="${m.id}" ${m.enabled ? 'checked' : ''}>
            <span class="toggle-slider"></span>
          </label>
        </div>`
    }
  }

  moduleListEl.innerHTML = html

  // 绑定 toggle 事件
  moduleListEl.querySelectorAll('input[type="checkbox"]').forEach(input => {
    input.addEventListener('change', async (e) => {
      const moduleId = e.target.dataset.moduleId
      const enabled = e.target.checked
      await toggleModule(moduleId, enabled)
    })
  })
}

// ========== 切换模块 ==========
async function toggleModule(moduleId, enabled) {
  await setModuleEnabled(moduleId, enabled)
  try {
    await sendMessage({ type: enabled ? 'ENABLE_MODULE' : 'DISABLE_MODULE', moduleId })
  } catch {
    // content script 不在线，下次打开页面生效
  }
}

// ========== 状态栏 ==========
function setStatus(state) {
  statusBar.className = 'status-bar'
  switch (state) {
    case 'connected':
      statusText.textContent = '已连接 linux.do'
      break
    case 'no-tab':
      statusBar.classList.add('no-tab')
      statusText.textContent = '页面未加载内容脚本'
      break
    case 'offline':
      statusBar.classList.add('offline')
      statusText.textContent = '未找到 linux.do 标签页'
      break
  }
}

// ========== 工具函数 ==========
function sendMessage(message) {
  return new Promise((resolve, reject) => {
    chrome.runtime.sendMessage(message, (response) => {
      if (chrome.runtime.lastError) {
        reject(new Error(chrome.runtime.lastError.message))
      } else {
        resolve(response)
      }
    })
  })
}

async function getEnabledModules() {
  return new Promise((resolve) => {
    chrome.storage.local.get('toolkit.enabledModules', (result) => {
      resolve(result['toolkit.enabledModules'] || {})
    })
  })
}

async function setModuleEnabled(moduleId, enabled) {
  const current = await getEnabledModules()
  current[moduleId] = enabled
  return new Promise((resolve) => {
    chrome.storage.local.set({ 'toolkit.enabledModules': current }, resolve)
  })
}

function openOptions() {
  chrome.runtime.openOptionsPage()
}
