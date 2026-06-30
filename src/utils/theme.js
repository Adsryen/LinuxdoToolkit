/**
 * 主题检测与同步
 *
 * 检测 linux.do 的暗黑模式，监听主题变化，供所有模块同步。
 */

/**
 * 检测当前是否为暗黑模式
 * linux.do 使用 .dark class 或 data-theme 属性
 * @returns {boolean}
 */
export function isDark() {
  const html = document.documentElement
  return (
    html.classList.contains('dark') ||
    html.classList.contains('dark-mode') ||
    html.dataset.theme === 'dark'
  )
}

/**
 * 获取当前主题名称
 * @returns {string} 'dark' | 'light'
 */
export function getTheme() {
  return isDark() ? 'dark' : 'light'
}

/**
 * 监听主题变化
 * @param {Function} callback - (isDark: boolean, theme: string) => void
 * @returns {Function} 取消监听函数
 */
export function observe(callback) {
  let lastDark = isDark()

  const observer = new MutationObserver(() => {
    const currentDark = isDark()
    if (currentDark !== lastDark) {
      lastDark = currentDark
      callback(currentDark, currentDark ? 'dark' : 'light')
    }
  })

  observer.observe(document.documentElement, {
    attributes: true,
    attributeFilter: ['class', 'data-theme']
  })

  return () => observer.disconnect()
}

/**
 * 应用自定义主题到元素
 * @param {string} themeName - 主题名称
 * @param {HTMLElement} element - 目标元素，默认 document.documentElement
 */
export function applyTheme(themeName, element = document.documentElement) {
  element.setAttribute('data-toolkit-theme', themeName)
}

export const Theme = {
  isDark,
  getTheme,
  observe,
  applyTheme
}
