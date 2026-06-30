/**
 * 滚动控制器
 *
 * 合并两个脚本的滚动逻辑：
 * - 基础滚动（来自 automation）：固定步长 + 间隔
 * - 仿真人滚动（来自 ryen.js）：wheel burst + micro pause + dwell
 */

const random = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min
const sleep = (ms) => new Promise(r => setTimeout(r, ms))

export class ScrollController {
  constructor(config = {}) {
    this.config = config
    this.running = false
    this.lastScrollHeight = 0
    this.noNewContentCount = 0
  }

  updateConfig(config) {
    this.config = config
  }

  // ========== 基础滚动 ==========

  scrollDown() {
    const step = this.config.scrollStep + random(-30, 30)
    window.scrollBy({ top: step, behavior: 'auto' })
  }

  async scrollToTop() {
    window.scrollTo({ top: 0, behavior: 'auto' })
    await sleep(random(200, 400))
  }

  isAtBottom() {
    const { scrollTop, scrollHeight, clientHeight } = this._getScrollInfo()
    return scrollTop + clientHeight >= scrollHeight - 100
  }

  isAtTop() {
    return this._getScrollInfo().scrollTop < 100
  }

  hasNewContent() {
    const current = document.documentElement.scrollHeight
    if (current > this.lastScrollHeight) {
      this.lastScrollHeight = current
      this.noNewContentCount = 0
      return true
    }
    this.noNewContentCount++
    return false
  }

  isContentFullyLoaded() {
    return this.noNewContentCount >= (this.config.retry || 3)
  }

  reset() {
    this.lastScrollHeight = document.documentElement.scrollHeight
    this.noNewContentCount = 0
  }

  // ========== 仿真人滚动（ryen.js 风格） ==========

  /**
   * 模拟鼠标滚轮：一次 burst 包含多个步进，步进间有微小延迟
   */
  async humanScroll() {
    const burstCount = random(3, 8)
    for (let i = 0; i < burstCount; i++) {
      const step = random(12, 45)
      window.scrollBy({ top: step, behavior: 'auto' })
      await sleep(random(14, 28))
    }

    // 微停顿
    if (Math.random() < 0.35) {
      await sleep(random(250, 1100))
    }

    // 偶发长休息
    if (Math.random() < 0.03) {
      await sleep(random(2500, 7000))
    }
  }

  /**
   * 在特定元素上停留（模拟阅读）
   */
  async dwellOnContent() {
    const selectors = 'h1, h2, h3, h4, h5, h6, img, pre, code, blockquote, .onebox, .lightbox'
    const elements = document.querySelectorAll(selectors)

    for (const el of elements) {
      const rect = el.getBoundingClientRect()
      if (rect.top > 0 && rect.top < window.innerHeight * 0.6) {
        await sleep(random(800, 2000))
        break
      }
    }
  }

  // ========== 内部 ==========

  _getScrollInfo() {
    return {
      scrollTop: window.pageYOffset || document.documentElement.scrollTop,
      scrollHeight: document.documentElement.scrollHeight,
      clientHeight: document.documentElement.clientHeight,
    }
  }
}
