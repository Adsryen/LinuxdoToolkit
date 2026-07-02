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

// ========== 模块设置 Schema ==========
// 与各模块的 getSettingsSchema() 保持一致，Options 页独立使用
const MODULE_SCHEMAS = {
  'auto-browse': {
    fields: [
      { key: 'speed',           label: '浏览速度',     type: 'select', options: [
        { value: 'slow', label: '慢速' }, { value: 'normal', label: '正常' }, { value: 'fast', label: '快速' },
      ], default: 'normal' },
      { key: 'listType',        label: '列表来源',     type: 'select', options: [
        { value: 'latest', label: '最新' }, { value: 'top', label: '热门' }, { value: 'new', label: '新帖' },
      ], default: 'latest' },
      { key: 'enableLike',      label: '随机点赞',     type: 'toggle', default: true },
      { key: 'likeChance',      label: '点赞概率',     type: 'select', options: [
        { value: 'low', label: '低 5%' }, { value: 'medium', label: '中 15%' }, { value: 'high', label: '高 25%' }, { value: 'veryHigh', label: '极高 40%' },
      ], default: 'medium' },
      { key: 'maxSessionViews', label: '单次最大浏览', type: 'number', default: 50 },
      { key: 'maxSessionLikes', label: '单次最大点赞', type: 'number', default: 50 },
      { key: 'autoResume',      label: '自动恢复运行', type: 'toggle', default: false },
      { key: 'readAll',         label: '单篇阅读深度', type: 'toggle', default: false, description: '全部：从第一楼看到底；50%：读到约 50~65% 后进入下一帖' },
      { key: 'restEnabled',    label: '启用休息机制', type: 'toggle', default: false },
      { key: 'restInterval',   label: '浏览间隔(分钟)', type: 'number', default: 15, min: 5, max: 120 },
      { key: 'restDuration',   label: '休息时长(分钟)', type: 'number', default: 5, min: 1, max: 30 },
    ],
  },
  'credit': {
    fields: [
      { key: 'refreshInterval', label: '刷新间隔', type: 'select', options: [
        { value: 60000, label: '1 分钟' }, { value: 300000, label: '5 分钟' }, { value: 600000, label: '10 分钟' }, { value: 1800000, label: '30 分钟' },
      ], default: 300000 },
      { key: 'resetPosition', label: '重置悬浮位置', type: 'action', action: 'reset-position', description: '将积分悬浮组件恢复到默认位置（右下角）' },
    ],
  },
  'side-topic': {
    fields: [
      { key: 'feed',      label: '默认 Feed', type: 'select', options: [
        { value: 'latest', label: '最新' }, { value: 'top', label: '热门' }, { value: 'new', label: '新帖' }, { value: 'unread', label: '未读' },
      ], default: 'latest' },
      { key: 'collapsed', label: '默认折叠',   type: 'toggle', default: false },
    ],
  },
  'peek': {
    fields: [
      { key: 'mode',            label: '默认预览模式',     type: 'select', options: [
        { value: 'summary', label: '摘要' }, { value: 'detail', label: '详情（iframe）' },
      ], default: 'summary' },
      { key: 'drawerWidth',     label: '抽屉宽度 (%)',     type: 'number', default: 50 },
      { key: 'autoScrollSpeed', label: '自动滚动速度 (px/s)', type: 'number', default: 42 },
      { key: 'enablePrefetch',  label: '悬停预加载',       type: 'toggle', default: true },
      { key: 'trackView',       label: '记录浏览历史',     type: 'toggle', default: true },
    ],
  },
  'ui-enhance': {
    fields: [
      { key: 'theme',       label: '主题',     type: 'select', options: [
        { value: 'auto', label: '🔄 跟随系统' }, { value: 'dark', label: '🌙 暗黑' }, { value: 'green', label: '🌿 绿色' }, { value: 'purple', label: '💜 紫色' },
      ], default: 'auto' },
      { key: 'compactMode', label: '紧凑模式', type: 'toggle', default: false, description: '减小间距，显示更多内容' },
      { key: 'wideMode',    label: '宽屏模式', type: 'toggle', default: false, description: '扩大内容区域宽度' },
    ],
  },
}

// ========== 通用表单渲染器 ==========

class FormRenderer {
  /**
   * @param {object} schema - { fields: [...] }
   * @param {object} values - 当前值 { key: value }
   * @param {string} moduleId - 模块 ID
   */
  constructor(schema, values = {}, moduleId = '') {
    this.schema = schema
    this.values = { ...values }
    this.moduleId = moduleId
    this.onChange = null
  }

  /**
   * 渲染表单为 DOM 文档片段
   * @returns {DocumentFragment}
   */
  render() {
    const frag = document.createDocumentFragment()
    for (const field of this.schema.fields) {
      const value = field.key in this.values ? this.values[field.key] : field.default
      const el = this._renderField(field, value)
      frag.appendChild(el)
    }
    return frag
  }

  _renderField(field, value) {
    const row = document.createElement('div')
    row.className = 'form-field'

    // 左侧：label + description
    const left = document.createElement('div')
    left.className = 'form-field-left'
    const label = document.createElement('div')
    label.className = 'form-field-label'
    label.textContent = field.label
    left.appendChild(label)
    if (field.description) {
      const desc = document.createElement('div')
      desc.className = 'form-field-desc'
      desc.textContent = field.description
      left.appendChild(desc)
    }

    // 右侧：控件
    const right = document.createElement('div')
    right.className = 'form-field-right'

    switch (field.type) {
      case 'toggle':
        right.appendChild(this._renderToggle(field, value))
        break
      case 'select':
        right.appendChild(this._renderSelect(field, value))
        break
      case 'number':
        right.appendChild(this._renderNumber(field, value))
        break
      case 'action':
        right.appendChild(this._renderAction(field))
        break
    }

    row.appendChild(left)
    row.appendChild(right)
    return row
  }

  _renderToggle(field, value) {
    const label = document.createElement('label')
    label.className = 'toggle'
    const input = document.createElement('input')
    input.type = 'checkbox'
    input.checked = !!value
    input.addEventListener('change', () => {
      this.values[field.key] = input.checked
      this.onChange?.(field.key, input.checked)
    })
    const span = document.createElement('span')
    span.className = 'toggle-slider'
    label.appendChild(input)
    label.appendChild(span)
    return label
  }

  _renderSelect(field, value) {
    const select = document.createElement('select')
    select.className = 'detail-select'
    for (const opt of (field.options || [])) {
      const option = document.createElement('option')
      option.value = opt.value
      option.textContent = opt.label
      option.selected = (String(value) === String(opt.value))
      select.appendChild(option)
    }
    select.addEventListener('change', () => {
      this.values[field.key] = select.value
      this.onChange?.(field.key, select.value)
    })
    return select
  }

  _renderNumber(field, value) {
    const input = document.createElement('input')
    input.type = 'number'
    input.className = 'detail-input'
    input.value = value ?? field.default
    if (field.min !== undefined) input.min = field.min
    if (field.max !== undefined) input.max = field.max
    input.addEventListener('input', () => {
      const num = parseInt(input.value, 10)
      if (!isNaN(num)) {
        this.values[field.key] = num
        this.onChange?.(field.key, num)
      }
    })
    return input
  }

  _renderAction(field) {
    const btn = document.createElement('button')
    btn.className = 'btn btn-secondary btn-sm'
    btn.textContent = field.label
    btn.addEventListener('click', async () => {
      btn.disabled = true
      btn.textContent = '处理中...'
      try {
        if (field.action === 'reset-position') {
          const key = `toolkit.module.${this.moduleId}`
          const result = await chrome.storage.local.get(key)
          const current = result[key] || {}
          const updated = { ...current, position: null }
          await chrome.storage.local.set({ [key]: updated })
          try {
            await sendMessage({ type: 'SET_MODULE_SETTINGS', moduleId: this.moduleId, value: updated })
          } catch {}
          toast('位置已重置', 'success')
        }
        this.onChange?.(field.key, true)
      } catch (e) {
        toast('操作失败: ' + e.message, 'error')
      }
      btn.disabled = false
      btn.textContent = field.label
    })
    return btn
  }
}

// ========== DOM ==========
const $ = (sel) => document.querySelector(sel)
const $$ = (sel) => document.querySelectorAll(sel)

// ========== 初始化 ==========
document.addEventListener('DOMContentLoaded', async () => {
  const manifest = chrome.runtime.getManifest()
  $('#about-version').textContent = `v${manifest.version}`

  setupNavigation()
  setupDashboard()
  setupGlobalSettings()
  setupToolbarSettings()
  setupBackup()

  await loadModules()
  await loadDashboard()
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
let activeDetailPanel = null
const debounceTimers = {}

async function loadModules() {
  const grid = $('#module-grid')
  const enabledMap = await getEnabledModules()

  let html = ''
  for (const m of DEFAULT_MODULES) {
    const enabled = enabledMap[m.id] !== false
    const hasSchema = !!MODULE_SCHEMAS[m.id]
    html += `
      <div class="module-card" data-id="${m.id}">
        <div class="module-card-header">
          <div class="module-card-info">
            <span class="module-card-icon">${m.icon}</span>
            <span class="module-card-name">${m.name}</span>
            ${hasSchema ? '<span class="module-card-gear">⚙</span>' : ''}
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
      e.stopPropagation()
      const moduleId = e.target.dataset.moduleId
      const enabled = e.target.checked
      await setModuleEnabled(moduleId, enabled)
      try {
        await sendMessage({ type: enabled ? 'ENABLE_MODULE' : 'DISABLE_MODULE', moduleId })
      } catch {}
      toast(enabled ? `${getModuleName(moduleId)} 已启用` : `${getModuleName(moduleId)} 已禁用`, 'success')
    })
  })

  // 卡片点击 → 展开/折叠详情面板
  grid.querySelectorAll('.module-card').forEach(card => {
    card.addEventListener('click', async (e) => {
      // 点击 toggle 不触发面板
      if (e.target.closest('.toggle')) return
      const moduleId = card.dataset.id
      if (!MODULE_SCHEMAS[moduleId]) return
      toggleModuleDetail(moduleId, card)
    })
  })
}

/**
 * 展开/折叠模块详情面板
 */
async function toggleModuleDetail(moduleId, card) {
  // 如果已有面板，先关闭
  if (activeDetailPanel) {
    closeDetailPanel()
  }

  // 如果点击的是已展开的卡片，折叠即可
  if (card.classList.contains('expanded')) {
    return
  }

  // 加载当前设置值
  const schema = MODULE_SCHEMAS[moduleId]
  const currentValues = await loadModuleSettings(moduleId)

  // 构建默认值（schema default → 当前值覆盖）
  const values = {}
  for (const field of schema.fields) {
    values[field.key] = field.default
  }
  Object.assign(values, currentValues)

  // 创建详情面板
  const detail = document.createElement('div')
  detail.className = 'module-detail'
  detail.id = `module-detail-${moduleId}`

  const title = document.createElement('div')
  title.className = 'module-detail-title'
  title.textContent = `${getModuleName(moduleId)} 设置`
  detail.appendChild(title)

  // 渲染表单
  const formRenderer = new FormRenderer(schema, values, moduleId)
  formRenderer.onChange = (key, newValue) => {
    values[key] = newValue
    debounceSaveSettings(moduleId, values)
  }
  detail.appendChild(formRenderer.render())

  // 插入到卡片后面
  card.classList.add('expanded')
  card.after(detail)
  activeDetailPanel = { moduleId, card, detail }
}

function closeDetailPanel() {
  if (!activeDetailPanel) return
  activeDetailPanel.card.classList.remove('expanded')
  activeDetailPanel.detail.remove()
  activeDetailPanel = null
}

/**
 * Debounce 保存模块设置（300ms）
 */
function debounceSaveSettings(moduleId, values) {
  if (debounceTimers[moduleId]) clearTimeout(debounceTimers[moduleId])
  debounceTimers[moduleId] = setTimeout(async () => {
    await saveModuleSettings(moduleId, values)
    delete debounceTimers[moduleId]
  }, 300)
}

/**
 * 保存模块设置到 storage 并通知 content script
 */
async function saveModuleSettings(moduleId, values) {
  const key = `toolkit.module.${moduleId}`
  try {
    const result = await chrome.storage.local.get(key)
    const current = result[key] || {}
    const merged = { ...current, ...values }
    await chrome.storage.local.set({ [key]: merged })
    // 通知 content script 更新模块配置
    try {
      await sendMessage({ type: 'SET_MODULE_SETTINGS', moduleId, value: merged })
    } catch {}
    toast(`${getModuleName(moduleId)} 设置已保存`, 'success')
  } catch (e) {
    toast('保存失败: ' + e.message, 'error')
  }
}

/**
 * 从 storage 加载模块设置
 */
function loadModuleSettings(moduleId) {
  return new Promise((resolve) => {
    const key = `toolkit.module.${moduleId}`
    chrome.storage.local.get(key, (result) => {
      resolve(result[key] || {})
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

// ========== 仪表盘 ==========

function setupDashboard() {
  $('#btn-refresh-dash').addEventListener('click', () => loadDashboard())
  $('#btn-clear-dash').addEventListener('click', () => {
    if (!confirm('确定清除所有浏览记录？此操作不可撤销。')) return
    chrome.storage.local.set({ 'toolkit.history.records': [], 'toolkit.history.likes': [] }, () => {
      loadDashboard()
      toast('记录已清除', 'success')
    })
  })
}

async function loadDashboard() {
  const result = await chrome.storage.local.get(['toolkit.history.records', 'toolkit.history.likes'])
  const records = result['toolkit.history.records'] || []
  const likes = result['toolkit.history.likes'] || []

  const now = Date.now()
  const today = 86400000

  $('#dash-total-views').textContent = records.length
  $('#dash-today-views').textContent = records.filter(r => r.updatedAt > now - today).length
  $('#dash-total-likes').textContent = likes.length
  $('#dash-today-likes').textContent = likes.filter(l => l.timestamp > now - today).length

  const tbody = $('#dash-tbody')
  if (!records.length) {
    tbody.innerHTML = '<tr><td colspan="4" class="text-muted">暂无浏览记录</td></tr>'
    return
  }

  tbody.innerHTML = records.slice(0, 50).map(r => {
    const title = r.title || '无标题'
    const progress = r.totalPosts > 0 ? Math.round((r.browsedTo / r.totalPosts) * 100) : 0
    const time = formatTime(r.updatedAt || r.createdAt)
    return `
      <tr>
        <td>
          <a class="dash-topic-link" href="${r.url || '/t/topic/' + r.topicId}" target="_blank" title="${title}">
            #${r.topicId} ${title}
          </a>
        </td>
        <td>
          <span class="dash-progress">
            <span class="dash-progress-bar"><span class="dash-progress-fill" style="width:${progress}%"></span></span>
            ${r.browsedTo || 0} / ${r.totalPosts || '-'} 楼
          </span>
        </td>
        <td><span class="dash-like">${r.liked ? '❤️' : '-'}</span></td>
        <td><span class="dash-time">${time}</span></td>
      </tr>`
  }).join('')
}

function formatTime(timestamp) {
  if (!timestamp) return '-'
  const d = new Date(timestamp)
  const now = new Date()
  const diff = now - d

  if (diff < 60000) return '刚刚'
  if (diff < 3600000) return `${Math.floor(diff / 60000)} 分钟前`
  if (diff < 86400000) return `${Math.floor(diff / 3600000)} 小时前`
  if (diff < 604800000) return `${Math.floor(diff / 86400000)} 天前`

  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
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
