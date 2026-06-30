/**
 * 效率工具模块
 *
 * 提供各种效率提升功能，包括：
 * - 快捷键支持
 * - 自动签到
 * - 快速回复
 */

export const toolsModule = {
  name: 'tools',
  description: '效率工具模块',
  enabled: false,

  // 设置
  settings: {
    autoSign: false,
    quickReply: true
  },

  /**
   * 初始化模块
   */
  async init(settings) {
    this.settings = { ...this.settings, ...settings }

    // 注册快捷键
    this.registerShortcuts()

    // 自动签到
    if (this.settings.autoSign) {
      this.setupAutoSign()
    }

    // 快速回复
    if (this.settings.quickReply) {
      this.setupQuickReply()
    }

    console.log('Tools 模块已初始化')
  },

  /**
   * 启用模块
   */
  async enable() {
    this.enabled = true
    this.registerShortcuts()
  },

  /**
   * 禁用模块
   */
  async disable() {
    this.enabled = false
    this.unregisterShortcuts()
  },

  /**
   * 注册快捷键
   */
  registerShortcuts() {
    document.addEventListener('keydown', this.handleKeydown.bind(this))
    console.log('快捷键已注册')
  },

  /**
   * 注销快捷键
   */
  unregisterShortcuts() {
    document.removeEventListener('keydown', this.handleKeydown.bind(this))
    console.log('快捷键已注销')
  },

  /**
   * 处理键盘事件
   */
  handleKeydown(event) {
    // Ctrl + Shift + R: 快速回复
    if (event.ctrlKey && event.shiftKey && event.key === 'R') {
      event.preventDefault()
      this.openQuickReply()
    }
  },

  /**
   * 设置自动签到
   */
  setupAutoSign() {
    // 检查是否今天已签到
    const lastSignDate = localStorage.getItem('linuxdo-toolkit-last-sign')
    const today = new Date().toDateString()

    if (lastSignDate !== today) {
      // 延迟执行签到，避免页面加载时执行
      setTimeout(() => {
        this.performAutoSign()
      }, 3000)
    }
  },

  /**
   * 执行自动签到
   */
  async performAutoSign() {
    try {
      // 查找签到按钮
      const signButton = document.querySelector('.sign-up-btn, [data-action="sign"]')

      if (signButton && !signButton.classList.contains('disabled')) {
        signButton.click()
        localStorage.setItem('linuxdo-toolkit-last-sign', new Date().toDateString())
        console.log('自动签到完成')
      }
    } catch (error) {
      console.error('自动签到失败:', error)
    }
  },

  /**
   * 设置快速回复
   */
  setupQuickReply() {
    // 在输入框添加快捷按钮
    const replyInputs = document.querySelectorAll('.reply-input, textarea[name="reply"]')

    replyInputs.forEach((input) => {
      this.addQuickReplyButton(input)
    })

    // 监听新出现的输入框
    const observer = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        mutation.addedNodes.forEach((node) => {
          if (node.nodeType === 1) {
            const inputs = node.querySelectorAll('.reply-input, textarea[name="reply"]')
            inputs.forEach((input) => {
              this.addQuickReplyButton(input)
            })
          }
        })
      })
    })

    observer.observe(document.body, {
      childList: true,
      subtree: true
    })
  },

  /**
   * 添加快速回复按钮
   */
  addQuickReplyButton(inputElement) {
    if (inputElement.dataset.quickReplyAdded) {
      return
    }

    const button = document.createElement('button')
    button.className = 'linuxdo-toolkit-quick-reply'
    button.textContent = '⚡ 快速回复'
    button.style.cssText = `
      position: absolute;
      right: 10px;
      bottom: 10px;
      padding: 5px 10px;
      background: #1890ff;
      color: white;
      border: none;
      border-radius: 4px;
      cursor: pointer;
      font-size: 12px;
    `

    button.addEventListener('click', () => {
      this.openQuickReply()
    })

    // 确保父元素有相对定位
    if (inputElement.parentElement) {
      inputElement.parentElement.style.position = 'relative'
      inputElement.parentElement.appendChild(button)
    }

    inputElement.dataset.quickReplyAdded = 'true'
  },

  /**
   * 打开快速回复
   */
  openQuickReply() {
    const replyInput = document.querySelector('.reply-input, textarea[name="reply"]')
    if (replyInput) {
      replyInput.focus()
      replyInput.scrollIntoView({ behavior: 'smooth', block: 'center' })
    }
  },

  /**
   * 页面变化回调
   */
  async onPageChange(url) {
    // 根据页面类型调整工具
    console.log('Tools 模块: 页面变化', url)
  }
}
