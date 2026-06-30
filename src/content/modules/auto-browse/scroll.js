/**
 * 滚动控制器（基于 ryen.js 的仿真人滚动）
 *
 * 核心特性：
 * - wheel burst：模拟鼠标滚轮，多步小幅度滚动
 * - 微停顿：burst 后随机暂停
 * - 长休息：偶发长时间暂停
 * - 内容驻留：在可读元素上停顿
 * - 上划回看：偶尔回滚
 */

const random = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min
const sleep = (ms) => new Promise(r => setTimeout(r, ms))

export class ScrollController {
  constructor(config = {}) {
    this.config = config
    this._lastScrollHeight = 0
    this._noNewCount = 0
  }

  updateConfig(config) {
    this.config = config
  }

  // ========== 核心滚动 ==========

  /**
   * 模拟一次鼠标滚轮"突发"（核心方法）
   * 一次 burst 包含 3~8 步，每步 12~45px，间隔 14~28ms
   */
  async wheelBurst(direction = 1) {
    const steps = random(this.config.wheelBurstMin || 3, this.config.wheelBurstMax || 8)
    for (let i = 0; i < steps; i++) {
      const step = random(this.config.wheelStepMin || 12, this.config.wheelStepMax || 45)
      const jitter = random(-2, 3)
      window.scrollBy({ top: direction * (step + jitter) })
      const interval = random(this.config.wheelIntervalMin || 14, this.config.wheelIntervalMax || 28)
      await sleep(interval)
    }
  }

  // ========== 行为模拟 ==========

  /**
   * 微停顿：35% 概率，250~1100ms
   */
  async maybeMicroPause() {
    if (Math.random() < (this.config.microPauseChance ?? 0.35)) {
      await sleep(random(this.config.microPauseMin || 250, this.config.microPauseMax || 1100))
    }
  }

  /**
   * 长休息：3% 概率，2500~7000ms
   */
  async maybeLongRest() {
    if (Math.random() < (this.config.longRestChance ?? 0.03)) {
      await sleep(random(this.config.longRestMin || 2500, this.config.longRestMax || 7000))
    }
  }

  /**
   * 上划回看：偶尔回滚一小段
   */
  async maybeUpScroll() {
    if (Math.random() < (this.config.upScrollChance ?? 0)) {
      const amount = random(this.config.upScrollMin || 20, this.config.upScrollMax || 90)
      window.scrollBy({ top: -amount })
      await sleep(random(80, 160))
    }
  }

  /**
   * 内容驻留：在可读元素上停留
   */
  async maybeDwell() {
    if (Math.random() < 0.25) {
      const el = this._findReadableNearCenter()
      if (el) {
        await sleep(random(this.config.dwellMin || 800, this.config.dwellMax || 2000))
      }
    }
  }

  // ========== 位置检测 ==========

  isAtBottom() {
    const h = document.documentElement
    return h.scrollTop + h.clientHeight >= h.scrollHeight - 200
  }

  isAtTop() {
    return document.documentElement.scrollTop < 100
  }

  hasNewContent() {
    const current = document.documentElement.scrollHeight
    if (current > this._lastScrollHeight) {
      this._lastScrollHeight = current
      this._noNewCount = 0
      return true
    }
    this._noNewCount++
    return false
  }

  isContentFullyLoaded() {
    return this._noNewCount >= (this.config.retry || 3)
  }

  reset() {
    this._lastScrollHeight = document.documentElement.scrollHeight
    this._noNewCount = 0
  }

  async scrollToTop() {
    window.scrollTo({ top: 0, behavior: 'auto' })
    await sleep(random(200, 400))
  }

  // ========== 内部 ==========

  _findReadableNearCenter() {
    const selectors = 'h1, h2, h3, h4, h5, h6, img, pre, code, blockquote, .onebox, .lightbox'
    const nodes = Array.from(document.querySelectorAll(selectors))
    if (!nodes.length) return null

    const vh = window.innerHeight
    const centerY = vh / 2
    let best = null
    let bestScore = Infinity

    for (const n of nodes) {
      const r = n.getBoundingClientRect()
      if (r.width < 20 || r.height < 16) continue
      if (r.bottom < 0 || r.top > vh) continue

      const elCY = r.top + r.height / 2
      const score = Math.abs(elCY - centerY)
      if (score < bestScore) {
        bestScore = score
        best = n
      }
    }

    return best && bestScore < 180 ? best : null
  }
}