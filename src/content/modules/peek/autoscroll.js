/**
 * 自动阅读滚动
 *
 * 在抽屉详情模式下自动滚动内容，模拟阅读。
 * 支持暂停/恢复、速度变化、微停顿。
 */

export class AutoScroll {
  constructor(options = {}) {
    this.speed = options.speed || 42  // px/s
    this.running = false
    this.paused = false
    this._target = null
    this._raf = 0
    this._lastTime = 0
    this._pauseTimer = 0
    this._nextPauseAt = 0
  }

  /**
   * 开始自动滚动
   * @param {HTMLElement} target - 滚动目标（iframe 的 documentElement 或 div）
   */
  start(target) {
    if (this.running) this.stop()
    this._target = target
    this.running = true
    this.paused = false
    this._lastTime = performance.now()
    this._nextPauseAt = this._lastTime + this._randomPauseDelay()
    this._raf = requestAnimationFrame((t) => this._tick(t))
  }

  /**
   * 停止自动滚动
   */
  stop() {
    this.running = false
    this.paused = false
    if (this._raf) {
      cancelAnimationFrame(this._raf)
      this._raf = 0
    }
    clearTimeout(this._pauseTimer)
    this._target = null
  }

  /**
   * 暂停（用户交互触发，短暂暂停后恢复）
   */
  pause() {
    if (!this.running || this.paused) return
    this.paused = true
    clearTimeout(this._pauseTimer)
    this._pauseTimer = setTimeout(() => {
      this.paused = false
      this._lastTime = performance.now()
      this._nextPauseAt = this._lastTime + this._randomPauseDelay()
    }, 2000)
  }

  /**
   * 更新速度
   */
  setSpeed(speed) {
    this.speed = speed
  }

  // ========== 内部 ==========

  _tick(now) {
    if (!this.running || !this._target) return

    if (!this.paused) {
      const dt = (now - this._lastTime) / 1000
      const scrollAmount = this.speed * dt

      // 检查是否到达底部
      const el = this._target
      const maxScroll = el.scrollHeight - el.clientHeight
      const atBottom = el.scrollTop >= maxScroll - 5

      if (atBottom) {
        this.stop()
        return
      }

      el.scrollTop += scrollAmount

      // 微停顿
      if (now >= this._nextPauseAt) {
        this.paused = true
        const pauseDuration = 500 + Math.random() * 2500
        this._pauseTimer = setTimeout(() => {
          this.paused = false
          this._lastTime = performance.now()
          this._nextPauseAt = this._lastTime + this._randomPauseDelay()
        }, pauseDuration)
      }
    }

    this._lastTime = now
    this._raf = requestAnimationFrame((t) => this._tick(t))
  }

  _randomPauseDelay() {
    // 每 3~8 秒触发一次微停顿
    return 3000 + Math.random() * 5000
  }
}
