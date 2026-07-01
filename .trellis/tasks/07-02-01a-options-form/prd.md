# 通用表单渲染器 + 快捷键配置

> Phase 1 剩余项

## 背景

当前 Options 页（`src/options/index.js`）的模块管理区域只展示模块卡片和 toggle 开关，各模块的详细设置（如自动浏览的速度、点赞概率等）无法在 Options 页中配置。每个模块已通过 `getSettingsSchema()` 声明了自己的配置字段结构，但缺少一个通用渲染器将这些 schema 自动转换为表单 UI。

同时，扩展缺少快捷键支持，用户无法通过键盘快速操作。

## 需求

### 1. 通用表单渲染器

在 Options 页中实现一个 `FormRenderer`，根据模块的 `getSettingsSchema()` 返回值自动生成表单 UI。

**Schema 字段类型支持**（基于现有模块声明的字段）：

| type | 渲染为 | 示例模块 |
|------|--------|---------|
| `toggle` | 开关 (checkbox) | auto-browse: enableLike |
| `select` | 下拉选择 | auto-browse: speed, likeChance |
| `number` | 数字输入 | auto-browse: maxSessionViews |
| `text` | 文本输入 | 预留 |
| `color` | 颜色选择器 | 预留（ui-enhance 主题色） |

**交互流程**：
1. 用户在 Options 页点击模块卡片 → 展开模块详情面板
2. 面板内显示该模块的所有配置字段（由 FormRenderer 渲染）
3. 用户修改字段 → 实时保存到 `chrome.storage.local`
4. 保存后通知 content script 更新模块配置

**关键文件**：
- `src/options/index.js` — 添加模块详情面板和 FormRenderer 逻辑
- `src/options/index.html` — 添加详情面板的 DOM 结构
- `src/options/styles.css` — 表单样式

### 2. 快捷键配置

在 Options 页的"全局设置"区域添加快捷键配置：

- 切换工具栏显示/隐藏：默认 `Ctrl+Shift+L`
- 快速启用/禁用当前页面模块：默认 `Ctrl+Shift+M`
- 快捷键通过 `chrome.commands` API 实现（在 `manifest.json` 中声明）

**关键文件**：
- `src/manifest.json` — 添加 `commands` 字段
- `src/options/index.js` — 快捷键说明 UI
- `src/background/index.js` — 快捷键事件处理

## 约束

- FormRenderer 必须是纯函数/类，不依赖特定模块
- 表单字段变更使用 debounce 保存（300ms），避免频繁写入 storage
- 快捷键不得与浏览器或 linux.do 站点已有的快捷键冲突

## 验收标准

- [ ] Options 页点击模块卡片可展开详情面板，显示该模块所有配置字段
- [ ] toggle/select/number 三种类型字段正确渲染并能修改
- [ ] 修改配置后，content script 中的模块能收到 `onSettingsChange` 回调
- [ ] `Ctrl+Shift+L` 可切换工具栏显示/隐藏
- [ ] `Ctrl+Shift+M` 可快速切换当前页面模块状态
- [ ] `npm run build` 构建成功