/**
 * z-index 层级管理
 *
 * 统一分配各模块 UI 的 z-index，避免互相抢占。
 * 所有模块必须引用此常量，禁止硬编码 z-index 值。
 */

export const Z_INDEX = {
  /** 内容增强（高亮、标记等） */
  content: 1000,

  /** 悬浮小组件（积分显示等） */
  widget: 2000,

  /** 统一工具栏 */
  toolbar: 3000,

  /** 模块面板（侧栏、自动浏览面板等） */
  panel: 4000,

  /** 模态框/抽屉（LD Peek 等） */
  modal: 5000,

  /** 通知提示 */
  notification: 6000
}
