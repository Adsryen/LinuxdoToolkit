/**
 * 国际化基础（i18n）
 *
 * 轻量级国际化方案，支持中英文。
 * 所有 UI 文本通过 `t(key)` 获取，语言从 settings 读取。
 *
 * @example
 * import { t, setLocale } from '../utils/i18n.js'
 * setLocale('zh-CN')
 * t('module.credit.name')  // → '积分监控'
 * t('module.credit.name', 'en')  // → 'Credit Monitor'
 */

const messages = {
  'zh-CN': {
    // 通用
    'common.save': '保存',
    'common.cancel': '取消',
    'common.confirm': '确认',
    'common.delete': '删除',
    'common.loading': '加载中...',
    'common.error': '错误',
    'common.success': '成功',
    'common.enabled': '已启用',
    'common.disabled': '已禁用',

    // 模块
    'module.credit.name': '积分监控',
    'module.credit.desc': '实时积分收入悬浮小组件',
    'module.auto-browse.name': '自动浏览',
    'module.auto-browse.desc': '自动浏览帖子、随机点赞',
    'module.side-topic.name': '话题侧栏',
    'module.side-topic.desc': '可拖拽侧边话题面板',
    'module.peek.name': '快速预览',
    'module.peek.desc': '悬浮入口 + 抽屉预览',
    'module.ui-enhance.name': '界面美化',
    'module.ui-enhance.desc': '暗黑模式、自定义主题',

    // Popup
    'popup.connected': '已连接 linux.do',
    'popup.noTab': '请先打开 linux.do',
    'popup.offline': '未连接',

    // Options
    'options.modules': '模块管理',
    'options.global': '全局设置',
    'options.toolbar': '工具栏',
    'options.backup': '备份与恢复',
    'options.about': '关于',
    'options.theme': '主题',
    'options.language': '语言',
    'options.autoBackup': '自动备份设置',

    // 工具栏
    'toolbar.title': 'Toolkit',
    'toolbar.noActive': '暂无活跃模块',

    // 冲突
    'conflict.title': '⚠️ 检测到冲突',
    'conflict.suggestion': '建议禁用原版脚本以避免功能重复',
  },

  'en': {
    'common.save': 'Save',
    'common.cancel': 'Cancel',
    'common.confirm': 'Confirm',
    'common.delete': 'Delete',
    'common.loading': 'Loading...',
    'common.error': 'Error',
    'common.success': 'Success',
    'common.enabled': 'Enabled',
    'common.disabled': 'Disabled',

    'module.credit.name': 'Credit Monitor',
    'module.credit.desc': 'Real-time credit income widget',
    'module.auto-browse.name': 'Auto Browse',
    'module.auto-browse.desc': 'Auto-browse topics, random likes',
    'module.side-topic.name': 'Side Topic',
    'module.side-topic.desc': 'Draggable side topic panel',
    'module.peek.name': 'Peek',
    'module.peek.desc': 'Floating button + drawer preview',
    'module.ui-enhance.name': 'UI Enhance',
    'module.ui-enhance.desc': 'Dark mode, custom themes',

    'popup.connected': 'Connected to linux.do',
    'popup.noTab': 'Open linux.do first',
    'popup.offline': 'Not connected',

    'options.modules': 'Modules',
    'options.global': 'Global Settings',
    'options.toolbar': 'Toolbar',
    'options.backup': 'Backup & Restore',
    'options.about': 'About',
    'options.theme': 'Theme',
    'options.language': 'Language',
    'options.autoBackup': 'Auto Backup',

    'toolbar.title': 'Toolkit',
    'toolbar.noActive': 'No active modules',

    'conflict.title': '⚠️ Conflict Detected',
    'conflict.suggestion': 'Disable original scripts to avoid duplicate features',
  },
}

let currentLocale = 'zh-CN'

/**
 * 设置当前语言
 * @param {string} locale
 */
export function setLocale(locale) {
  if (messages[locale]) {
    currentLocale = locale
  }
}

/**
 * 获取当前语言
 */
export function getLocale() {
  return currentLocale
}

/**
 * 翻译
 * @param {string} key - 消息 key
 * @param {string} [locale] - 强制使用指定语言
 * @param {object} [params] - 插值参数
 * @returns {string}
 */
export function t(key, locale, params) {
  const lang = locale || currentLocale
  const dict = messages[lang] || messages['zh-CN']
  let text = dict[key] || key

  // 简单插值: t('hello', undefined, { name: 'world' }) → 替换 {name}
  if (params) {
    for (const [k, v] of Object.entries(params)) {
      text = text.replace(new RegExp(`\\{${k}\\}`, 'g'), v)
    }
  }

  return text
}
