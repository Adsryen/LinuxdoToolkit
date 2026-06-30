/**
 * Options Page Script
 *
 * 左侧分类导航 + 右侧内容区
 * - 模块管理：卡片式列表 + toggle
 * - 全局设置：主题、语言、自动备份
 * - 工具栏：开关、默认折叠
 * - 备份与恢复：导出/导入/快照
 * - 关于
 */

// ========== 默认模块 ==========
const DEFAULT_MODULES = [
  { id: 'credit',      name: '积分监控',  icon: '💰', description: '实时积分收入悬浮小组件，支持拖拽和详情面板',   category: 'data' },
  { id: 'auto-browse', name: '自动浏览',  icon: '🔄', description: '自动浏览帖子、随机点赞，仿真人滚动',         category: 'efficiency' },
  { id: 'side-topic',  name: '话题侧栏',  icon: '📋', description: '可拖拽侧边面板，实时话题列表和分类筛选',      category: 'preview' },
  { id: 'peek',        name: '快速预览',  icon: '👁️', description: '抽屉式预览、自动阅读、收藏夹和稍后读',       category: 'preview' },
  { id: 'ui-enhance',  name: '界面美化',  icon: '🎨', description: '暗黑模式增强、自定义主题和布局优化',          category: 'ui' },
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
const $$ = (sel) => document.querySelectorAll(sel)

// ========== 初始化 ==========
document.addEventListener('DOMContentLoaded', async () => {
  const manifest = chrome.runtime.getManifest()
  $('#about-version').textContent = `v${manifest.version}`

  setupNavigation()
  setupGlobalSettings()
  setupToolbarSettings()
  setupBackup()

  await loadModules()
  await loadGlobalSettings()
  await loadToolbarSettings()
  await loadSnapshots()
})

// ========== 导航 ==========
function setupNavigation() {
  $$('.nav-item').forEach(item => {
    item.addEventListener('click', () => {
      const section = item.dataset.section
      $$('.nav-item').forEach(n => n.classList.remove('active'))
      item.classList.add('active')
      $$('.section').forEach(s => s.classList.remove('active'))
      $(`#section-${section}`)?.classList.add('active')
    })
  })
}

// ========== 模块管理 ==========
async function loadModules() {
  const grid = $('#module-grid')
  const enabledMap = await getEnabledModules()

  // 未来可从 content 动态获取，当前用默认列表
  let html = ''
  for (const m of DEFAULT_MODULES) {
    const enabled = enabledMap[m.id] !== false
    html += `
      <div class="module-card" data-id="${m.id}">
        <div class="module-card-header">
          <div class="module-card-info">
            <span class="module-card-icon">${m.icon}</span>
            <span class="module-card-name">${m.name}</span>
          </div>
          <label class="toggle">
            <input type="checkbox" data-module-id="${m.id}" ${enabled ? 'checked' : ''}>
            <span class="toggle-slider"></span>
          </label>
        </div>
        <div class="module-card-desc">${m.description}</div>
        <span class="module-card-category">${CATEGORY_NAMES[m.category] || m.category}</span>
      </div>`
  }

  grid.innerHTML = html

  // toggle 事件
  grid.querySelectorAll('input[type="checkbox"]').forEach(input => {
    input.addEventListener('change', async (e) => {
      const moduleId = e.target.dataset.moduleId
      const enabled = e.target.checked
      await setModuleEnabled(moduleId, enabled)
      // 通知 content script
      try {
        await sendMessage({ type: enabled ? 'ENABLE_MODULE' : 'DISABLE_MODULE', moduleId })
      } catch {}
      toast(enabled ? `${getModuleName(moduleId)} 已启用` : `${getModuleName(moduleId)} 已禁用`, 'success')
    })
  })
}

function getModuleName(id) {
  return DEFAULT_MODULES.find(m => m.id === id)?.name || id
}

// ========== 全局设置 ==========
function setupGlobalSettings() {
  $('#btn-save-global').addEventListener('click', async () => {
    const global = {
      theme: $('#global-theme').value,
      language: $('#global-language').value,
      autoBackup: $('#global-auto-backup').checked,
    }
    await sendMessage({ type: 'SET_SETTINGS', key: 'toolkit.global', value: global })
    toast('全局设置已保存', 'success')
  })
}

async function loadGlobalSettings() {
  try {
    const resp = await sendMessage({ type: 'GET_SETTINGS', key: 'toolkit.global' })
    const data = resp?.data || {}
    $('#global-theme').value = data.theme || 'auto'
    $('#global-language').value = data.language || 'zh-CN'
    $('#global-auto-backup').checked = data.autoBackup !== false
  } catch {}
}

// ========== 工具栏设置 ==========
function setupToolbarSettings() {
  $('#btn-save-toolbar').addEventListener('click', async () => {
    const global = {
      toolbarEnabled: $('#toolbar-enabled').checked,
      toolbarCollapsed: $('#toolbar-collapsed').checked,
    }
    await sendMessage({ type: 'SET_SETTINGS', key: 'toolkit.global', value: global })
    toast('工具栏设置已保存', 'success')
  })
}

async function loadToolbarSettings() {
  try {
    const resp = await sendMessage({ type: 'GET_SETTINGS', key: 'toolkit.global' })
    const data = resp?.data || {}
    $('#toolbar-enabled').checked = data.toolbarEnabled !== false
    $('#toolbar-collapsed').checked = data.toolbarCollapsed || false
  } catch {}
}

// ========== 备份与恢复 ==========
function setupBackup() {
  // 导出到文件
  $('#btn-export').addEventListener('click', async () => {
    try {
      const resp = await sendMessage({ type: 'EXPORT_BACKUP' })
      if (!resp?.success) throw new Error(resp?.error)
      const blob = new Blob([JSON.stringify(resp.data, null, 2)], { type: 'application/json' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `linuxdo-toolkit-backup-${new Date().toISOString().slice(0, 10)}.json`
      a.click()
      URL.revokeObjectURL(url)
      toast('备份已导出', 'success')
    } catch (e) {
      toast('导出失败: ' + e.message, 'error')
    }
  })

  // 复制到剪贴板
  $('#btn-export-clipboard').addEventListener('click', async () => {
    try {
      const resp = await sendMessage({ type: 'EXPORT_BACKUP' })
      if (!resp?.success) throw new Error(resp?.error)
      const encoded = btoa(unescape(encodeURIComponent(JSON.stringify(resp.data))))
      await navigator.clipboard.writeText(encoded)
      toast('已复制到剪贴板', 'success')
    } catch (e) {
      toast('复制失败: ' + e.message, 'error')
    }
  })

  // 文件导入
  $('#btn-import').addEventListener('click', () => {
    $('#import-file').click()
  })

  $('#import-file').addEventListener('change', (e) => {
    const file = e.target.files[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = () => {
      try {
        const data = JSON.parse(reader.result)
        showImportPreview(data)
      } catch {
        toast('无效的 JSON 文件', 'error')
      }
    }
    reader.readAsText(file)
    e.target.value = ''
  })

  // 剪贴板导入
  $('#btn-import-clipboard').addEventListener('click', async () => {
    try {
      const text = await navigator.clipboard.readText()
      const json = JSON.parse(decodeURIComponent(escape(atob(text))))
      showImportPreview(json)
    } catch {
      toast('剪贴板内容无效', 'error')
    }
  })

  // 导入确认
  $('#btn-import-overwrite').addEventListener('click', () => executeImport('overwrite'))
  $('#btn-import-merge').addEventListener('click', () => executeImport('merge'))
  $('#btn-import-cancel').addEventListener('click', () => {
    $('#import-preview').style.display = 'none'
    pendingImportData = null
  })
}

let pendingImportData = null

function showImportPreview(data) {
  if (!data?.data) {
    toast('无效的备份文件', 'error')
    return
  }
  pendingImportData = data

  const diffEl = $('#diff-content')
  const keys = Object.keys(data.data)
  let html = ''
  for (const key of keys) {
    const short = key.replace('toolkit.', '')
    html += `<div class="diff-item"><span class="diff-key">${short}</span><span class="diff-status changed">将更新</span></div>`
  }
  diffEl.innerHTML = html || '<p class="text-muted">无数据</p>'
  $('#import-preview').style.display = 'block'
}

async function executeImport(strategy) {
  if (!pendingImportData) return
  try {
    const resp = await sendMessage({ type: 'IMPORT_BACKUP', data: pendingImportData, strategy })
    if (!resp?.success) throw new Error(resp?.error)
    toast('导入成功', 'success')
    $('#import-preview').style.display = 'none'
    pendingImportData = null
    // 刷新页面数据
    await loadGlobalSettings()
    await loadToolbarSettings()
    await loadModules()
  } catch (e) {
    toast('导入失败: ' + e.message, 'error')
  }
}

// ========== 快照 ==========
async function loadSnapshots() {
  try {
    const result = await chrome.storage.local.get('toolkit.backups')
    const snapshots = result['toolkit.backups'] || []
    const list = $('#snapshot-list')

    if (!snapshots.length) {
      list.innerHTML = '<span class="text-muted">暂无快照</span>'
      return
    }

    let html = ''
    for (const s of snapshots) {
      const time = new Date(s.timestamp).toLocaleString('zh-CN')
      html += `
        <div class="snapshot-item">
          <span class="snapshot-time">${time}</span>
          <button class="btn btn-sm btn-secondary" data-snapshot-id="${s.id}">恢复</button>
        </div>`
    }
    list.innerHTML = html

    list.querySelectorAll('button[data-snapshot-id]').forEach(btn => {
      btn.addEventListener('click', async () => {
        const id = btn.dataset.snapshotId
        const snapshot = snapshots.find(s => s.id === id)
        if (!snapshot) return
        if (!confirm('确定要恢复到此快照？当前设置将被覆盖。')) return
        try {
          await sendMessage({ type: 'IMPORT_BACKUP', data: { data: snapshot.data }, strategy: 'overwrite' })
          toast('快照已恢复', 'success')
          await loadGlobalSettings()
          await loadToolbarSettings()
        } catch (e) {
          toast('恢复失败: ' + e.message, 'error')
        }
      })
    })
  } catch {
    // 忽略
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

function toast(message, type = 'info') {
  const el = $('#toast')
  el.textContent = message
  el.className = `toast ${type}`
  el.style.display = 'block'
  requestAnimationFrame(() => el.classList.add('show'))
  setTimeout(() => {
    el.classList.remove('show')
    setTimeout(() => { el.style.display = 'none' }, 300)
  }, 2500)
}
