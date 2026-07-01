# 自动浏览扩展功能

> Phase 3 剩余项：必读文章 + 休息机制

## 背景

自动浏览模块（`src/content/modules/auto-browse/`）已实现核心浏览引擎：仿真人滚动、话题列表管理、随机点赞、卡住检测、控制面板 UI。但还有两个来自 ryen.js 的功能未实现：必读文章列表和休息机制。

## 需求

### 1. 必读文章列表

参考 `reference/Tampermonkey/ryen.js` 中的必读列表功能：

- 用户可在控制面板中添加/移除必读文章 URL
- 自动浏览时优先处理必读列表中的文章
- 必读文章看完后自动从列表中移除（或标记为已读）
- 必读列表持久化到 `chrome.storage.local`（key: `toolkit.module.auto-browse.mustRead`）

**数据结构**：
```json
[
  { "url": "/t/topic/12345", "title": "重要公告", "addedAt": 1700000000000, "read": false }
]
```

### 2. 休息机制

- **定时休息**：可配置每浏览 N 分钟后自动暂停 M 分钟
- **浏览上限休息**：单次会话浏览达到上限后自动暂停，等待用户手动恢复
- **休息时行为**：控制面板显示"休息中"状态，倒计时显示剩余休息时间
- **提前恢复**：用户可手动点击"继续"跳过休息

**配置字段**（添加到 `getSettingsSchema()`）：
```javascript
{ key: 'restEnabled',   label: '启用休息机制', type: 'toggle', default: false },
{ key: 'restInterval',  label: '浏览间隔(分钟)', type: 'number', default: 15 },
{ key: 'restDuration',  label: '休息时长(分钟)', type: 'number', default: 5 },
```

## 关键文件

- `src/content/modules/auto-browse/index.js` — 添加必读列表和休息机制逻辑
- `src/content/modules/auto-browse/panel.js` — 控制面板添加必读列表 UI 和休息状态显示
- `src/content/modules/auto-browse/browser.js` — 浏览引擎支持优先处理必读文章

## 约束

- 必读列表上限 50 条
- 休息机制默认关闭，不影响现有用户行为
- 休息期间的倒计时使用 `setInterval` 实现，精度 1 秒

## 验收标准

- [ ] 控制面板可添加/移除必读文章 URL
- [ ] 自动浏览时优先处理必读列表中的文章
- [ ] 必读文章看完后自动标记为已读
- [ ] 启用休息机制后，浏览 N 分钟自动暂停 M 分钟
- [ ] 休息期间显示倒计时，可手动提前恢复
- [ ] 浏览达到上限后自动暂停
- [ ] 配置持久化，重启浏览器后保留
- [ ] `npm run build` 构建成功