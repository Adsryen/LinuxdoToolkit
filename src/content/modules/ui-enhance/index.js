/**
 * 界面美化模块
 *
 * 基于 theme.js 的自动切换 + 手动覆盖。
 * 功能：暗黑模式增强、布局优化、自定义主题。
 */

import { Module } from '../base.js'
import { settings } from '../../../utils/settings.js'
import { Theme } from '../../../utils/theme.js'

const THEMES = {
  auto:   { name: '跟随系统', icon: '💻' },
  light:  { name: '浅色',     icon: '☀️' },
  dark:   { name: '深色',     icon: '🌙' },
  green:  { name: '护眼绿',   icon: '🌿' },
  purple: { name: '雅紫',     icon: '💜' },
}

export class UIEnhanceModule extends Module {
  constructor() {
    super({
      id: 'ui-enhance',
      name: '界面美化',
      icon: '🎨',
      description: '暗黑模式增强、自定义主题',
      category: 'ui',
      defaultSettings: {
        theme: 'auto',
        compactMode: false,
        wideMode: false,
        hideElements: [],
      },
    })

    this.themeObserver = null
    this._styleEl = null
  }

  async onInit(s) {
    this._applyTheme(s.theme || 'auto')
    this._applyLayout(s)
    this._watchSystemTheme()
  }

  onDestroy() {
    this._removeTheme()
    this._removeLayout()
    this._disconnectThemeObserver()
  }

  onEnable() {
    this._applyTheme(this.settings.theme || 'auto')
    this._applyLayout(this.settings)
  }

  onDisable() {
    this._removeTheme()
    this._removeLayout()
  }

  onSettingsChange(newSettings) {
    this._applyTheme(newSettings.theme || 'auto')
    this._applyLayout(newSettings)
  }

  getStatusBar() {
    const theme = this.settings.theme || 'auto'
    const info = THEMES[theme]
    return { text: `${info?.icon || '🎨'} ${info?.name || theme}` }
  }

  getSettingsSchema() {
    return {
      fields: [
        { key: 'theme', label: '主题', type: 'select',
          options: Object.entries(THEMES).map(([k, v]) => ({ value: k, label: `${v.icon} ${v.name}` })),
          default: 'auto' },
        { key: 'compactMode', label: '紧凑模式', type: 'toggle', default: false,
          description: '减小间距，显示更多内容' },
        { key: 'wideMode', label: '宽屏模式', type: 'toggle', default: false,
          description: '扩大内容区域宽度' },
      ],
    }
  }

  // ========== 内部 ==========

  _applyTheme(theme) {
    const root = document.documentElement

    // 清除旧主题
    root.removeAttribute('data-ltk-theme')
    root.classList.remove('ltk-dark', 'ltk-green', 'ltk-purple')

    switch (theme) {
      case 'dark':
        root.classList.add('ltk-dark')
        break
      case 'green':
        root.classList.add('ltk-green')
        break
      case 'purple':
        root.classList.add('ltk-purple')
        break
      case 'light':
        // 浅色是默认，不需额外处理
        break
      case 'auto':
      default:
        // 跟随系统
        if (window.matchMedia('(prefers-color-scheme: dark)').matches) {
          root.classList.add('ltk-dark')
        }
        break
    }

    root.setAttribute('data-ltk-theme', theme)
  }

  _applyLayout(s) {
    this._removeLayout()
    if (!s.compactMode && !s.wideMode) return

    this._styleEl = document.createElement('style')
    this._styleEl.id = 'ltk-ui-enhance'

    let css = ''
    if (s.compactMode) {
      css += `
        .topic-list-item { padding-top: 4px !important; padding-bottom: 4px !important; }
        .topic-list .main-link { min-height: auto !important; }
      `
    }
    if (s.wideMode) {
      css += `
        .wrap { max-width: 1400px !important; }
        .container { max-width: 1400px !important; }
      `
    }

    this._styleEl.textContent = css
    document.head.appendChild(this._styleEl)
  }

  _removeLayout() {
    this._styleEl?.remove()
    this._styleEl = null
  }

  _removeTheme() {
    const root = document.documentElement
    root.removeAttribute('data-ltk-theme')
    root.classList.remove('ltk-dark', 'ltk-green', 'ltk-purple')
  }

  _watchSystemTheme() {
    const mq = window.matchMedia('(prefers-color-scheme: dark)')
    const handler = () => {
      if (this.settings.theme === 'auto') {
        this._applyTheme('auto')
      }
    }
    mq.addEventListener('change', handler)
    this._themeChangeHandler = handler
  }

  _disconnectThemeObserver() {
    if (this._themeChangeHandler) {
      window.matchMedia('(prefers-color-scheme: dark)')
        .removeEventListener('change', this._themeChangeHandler)
      this._themeChangeHandler = null
    }
  }
}
