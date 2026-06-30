/**
 * 积分监控模块
 *
 * 迁移自 "LINUX DO Credit 积分" 油猴脚本。
 * 功能：实时显示积分收入差值，悬浮小组件，可拖拽，hover 详情。
 */

import { Module } from '../base.js'
import { CreditWidget } from './widget.js'

const REFRESH_INTERVAL = 5 * 60 * 1000  // 5 分钟

export class CreditModule extends Module {
  constructor() {
    super({
      id: 'credit',
      name: '积分监控',
      icon: '💰',
      description: '实时积分收入悬浮小组件',
      category: 'data',
      defaultSettings: {
        refreshInterval: REFRESH_INTERVAL,
        position: null,  // { right, bottom }
      },
    })

    this.widget = null
    this.timer = null
    this.communityBalance = null
    this.gamificationScore = null
    this.username = null
  }

  async onInit(settings) {
    this.widget = new CreditWidget({
      position: settings.position,
      onClick: () => this.refresh(),
      onPositionChange: (pos) => {
        this.settings.position = pos
        // 持久化位置
        import('../../utils/settings.js').then(({ settings: s }) => {
          s.setModule(this.id, { position: pos })
        })
      },
    })

    this.widget.mount()

    // 首次获取数据
    await this.refresh()

    // 定时刷新
    const interval = settings.refreshInterval || REFRESH_INTERVAL
    this.timer = setInterval(() => this.refresh(), interval)
  }

  onDestroy() {
    if (this.timer) {
      clearInterval(this.timer)
      this.timer = null
    }
    if (this.widget) {
      this.widget.unmount()
      this.widget = null
    }
  }

  onSettingsChange(newSettings) {
    // 更新刷新间隔
    if (this.timer) clearInterval(this.timer)
    const interval = newSettings.refreshInterval || REFRESH_INTERVAL
    this.timer = setInterval(() => this.refresh(), interval)
  }

  /**
   * 刷新积分数据
   */
  async refresh() {
    if (!this.widget) return
    this.widget.showLoading()

    try {
      // 1. 获取 credit.linux.do 的基准值
      const creditData = await this._fetchCreditInfo()
      if (creditData) {
        this.communityBalance = parseFloat(
          creditData['community-balance'] || creditData.community_balance || 0
        )
        this.username = creditData.username || creditData.nickname
      }

      // 2. 获取当前积分
      if (this.username) {
        const userData = await this._fetchUserInfo(this.username)
        if (userData?.user?.gamification_score !== undefined) {
          this.gamificationScore = parseFloat(userData.user.gamification_score)
        }
      }

      // 3. 更新显示
      this._updateDisplay()
    } catch (e) {
      console.error('[Credit] 刷新失败:', e)
      this.widget.showError('请求失败，请确认已登录')
    }
  }

  getStatusBar() {
    if (this.communityBalance === null || this.gamificationScore === null) {
      return { text: '积分: 加载中...' }
    }
    const diff = this.gamificationScore - this.communityBalance
    const sign = diff > 0 ? '+' : ''
    return { text: `积分: ${sign}${diff.toFixed(2)}` }
  }

  getSettingsSchema() {
    return {
      fields: [
        {
          key: 'refreshInterval',
          label: '刷新间隔',
          type: 'select',
          options: [
            { value: 60000, label: '1 分钟' },
            { value: 300000, label: '5 分钟' },
            { value: 600000, label: '10 分钟' },
            { value: 1800000, label: '30 分钟' },
          ],
          default: REFRESH_INTERVAL,
        },
      ],
    }
  }

  // ========== 内部方法 ==========

  _updateDisplay() {
    if (!this.widget) return
    if (this.communityBalance !== null && this.gamificationScore !== null) {
      const diff = this.gamificationScore - this.communityBalance
      const tooltip =
        `仅供参考，可能有误差！\n` +
        `当前分: ${this.gamificationScore.toFixed(2)}\n` +
        `基准值: ${this.communityBalance.toFixed(2)}`
      this.widget.update(diff, tooltip)
    }
  }

  /**
   * 获取 credit.linux.do 用户信息（跨域）
   */
  async _fetchCreditInfo() {
    const url = 'https://credit.linux.do/api/v1/oauth/user-info'
    try {
      const resp = await fetch(url, {
        credentials: 'include',
        headers: {
          Accept: 'application/json',
          Referer: 'https://credit.linux.do/home',
        },
      })
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`)
      const data = await resp.json()
      return data?.data || null
    } catch (e) {
      console.error('[Credit] 获取基准值失败:', e)
      return null
    }
  }

  /**
   * 获取 linux.do 用户积分（同源）
   */
  async _fetchUserInfo(username) {
    const url = `https://linux.do/u/${username}.json`
    try {
      const csrfToken = document.querySelector('meta[name="csrf-token"]')?.content
      const resp = await fetch(url, {
        credentials: 'include',
        headers: {
          Accept: 'application/json',
          ...(csrfToken ? { 'x-csrf-token': csrfToken } : {}),
        },
      })
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`)
      return await resp.json()
    } catch (e) {
      console.error('[Credit] 获取积分失败:', e)
      return null
    }
  }
}
