# 积分模块 Options 页接入

> Phase 2 剩余项 — 轻量任务

## 背景

积分监控模块（`src/content/modules/credit/index.js`）已实现核心功能：悬浮数字小组件、定时刷新、手动刷新、暗黑模式适配。`getSettingsSchema()` 已声明 `refreshInterval` 字段，但 Options 页目前没有模块详情面板，用户无法在 UI 中修改这些配置。

## 需求

依赖 01a-options-form 的 FormRenderer 完成后，接入积分模块的配置：

1. **刷新间隔**：用户可选 1分钟 / 5分钟 / 10分钟 / 30分钟（已在 schema 中声明）
2. **显示位置**：允许用户重置悬浮组件到默认位置
3. **开关控制**：在模块卡片 toggle 基础上，确保启用/禁用实时生效

## 关键文件

- `src/content/modules/credit/index.js` — 已有 `getSettingsSchema()` 和 `onSettingsChange()`
- `src/content/modules/credit/widget.js` — 悬浮组件实现
- `src/options/index.js` — 需 FormRenderer 完成后自动支持

## 约束

- 尽量复用现有代码，不重写 widget 组件
- 位置重置功能：将 `toolkit.module.credit` 中的 `position` 字段设为 `null`

## 验收标准

- [ ] Options 页积分模块详情面板可修改刷新间隔
- [ ] 修改刷新间隔后，content script 中的定时器间隔更新
- [ ] 可通过 Options 页重置悬浮组件位置
- [ ] 模块 toggle 开关正常工作
- [ ] `npm run build` 构建成功