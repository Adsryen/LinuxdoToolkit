/**
 * 冲突检测
 *
 * 检测与其他扩展或油猴脚本的冲突。
 * 检查项：
 * - 已知的油猴脚本（LD Peek、automation 等原版）
 * - 其他 linux.do 相关扩展
 * - CSP 冲突
 */

const KNOWN_SCRIPTS = [
  { name: 'LD Peek (原版)', marker: 'ldpeek-eye', type: 'tampermonkey' },
  { name: 'LINUX DO Credit 积分 (原版)', marker: 'ldc-mini', type: 'tampermonkey' },
  { name: 'Linux.do 自动浏览助手 (原版)', marker: 'linuxdo-auto-panel', type: 'tampermonkey' },
  { name: 'linux-do-side-topic (原版)', marker: 'ldsv-panel', type: 'extension' },
]

export class ConflictDetector {
  constructor() {
    this.conflicts = []
  }

  /**
   * 运行所有检测
   * @returns {ConflictResult[]}
   */
  detect() {
    this.conflicts = []
    this._checkKnownScripts()
    this._checkGlobals()
    return this.conflicts
  }

  /**
   * 检测并通知用户
   */
  detectAndNotify() {
    const conflicts = this.detect()
    if (!conflicts.length) return

    console.warn('[ConflictDetector] 检测到冲突:', conflicts)

    // 显示通知
    const msg = conflicts.map(c => `• ${c.name}`).join('\n')
    this._showNotification(
      '⚠️ 检测到冲突',
      `以下脚本/扩展可能与 LinuxdoToolkit 冲突：\n${msg}\n建议禁用原版脚本以避免功能重复。`
    )

    return conflicts
  }

  // ========== 检测方法 ==========

  _checkKnownScripts() {
    for (const script of KNOWN_SCRIPTS) {
      if (script.type === 'tampermonkey') {
        // 检查 DOM 中是否有原版脚本创建的元素
        if (document.getElementById(script.marker) ||
            document.querySelector(`[id*="${script.marker}"]`)) {
          this.conflicts.push({
            name: script.name,
            severity: 'warning',
            message: '建议禁用原版脚本，功能已被 LinuxdoToolkit 替代',
          })
        }
      }
    }
  }

  _checkGlobals() {
    // 检查是否有其他扩展注入的全局变量
    if (window.__linuxdoToolkit && window.__linuxdoToolkit !== window.__linuxdoToolkit) {
      this.conflicts.push({
        name: 'LinuxdoToolkit 重复加载',
        severity: 'error',
        message: '扩展似乎被加载了多次',
      })
    }

    // 检查 GM_* API（说明有油猴脚本在运行）
    if (typeof GM_getValue !== 'undefined' || typeof GM_setValue !== 'undefined') {
      this.conflicts.push({
        name: 'Tampermonkey/Violentmonkey 环境',
        severity: 'info',
        message: '检测到油猴脚本环境，部分功能可能重复',
      })
    }
  }

  _showNotification(title, message) {
    // 优先使用 chrome.notifications
    try {
      chrome.runtime.sendMessage({
        type: 'SEND_NOTIFICATION',
        data: { title, message, priority: 1 },
      })
    } catch {
      // 降级为 console.warn
      console.warn(`${title}\n${message}`)
    }
  }
}
