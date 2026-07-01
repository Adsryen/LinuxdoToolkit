# 快速预览扩展功能

> Phase 5 剩余项：摘要预览 + 收藏夹 + 页面导航

## 背景

快速预览模块（`src/content/modules/peek/`）已实现核心功能：悬浮入口按钮、抽屉模式预览（iframe）、话题缓存、自动阅读滚动。原 LD Peek 脚本（`reference/Tampermonkey/`）还有三个功能未迁移：话题摘要预览（preview.js）、收藏夹/稍后读独立管理（favorites.js）、页面导航记录（page-nav.js）。

## 需求

### 1. 话题摘要预览（preview.js → 合并到 drawer.js）

增强抽屉的摘要模式：

- 从话题页提取前 N 个帖子的摘要文本（不加载 iframe）
- 支持两种预览模式切换：摘要（轻量文本）↔ 详情（iframe 完整加载）
- 摘要模式下点击帖子可跳转到对应楼层
- 摘要数据缓存到 TopicCache，避免重复抓取

**摘要提取来源**：话题列表页的 `.topic-excerpt` 或抓取第一页帖子的 `.cooked` 内容前 200 字符。

### 2. 收藏夹 + 稍后读（favorites.js）

在抽屉中添加独立的收藏夹面板：

- **收藏夹（Favorites）**：用户手动收藏的话题列表
  - 收藏按钮在抽屉标题栏，点击添加/取消收藏
  - 收藏列表在抽屉中单独展示，支持搜索
  - 持久化到 `chrome.storage.local`（key: `toolkit.module.peek.favorites`）
- **稍后读（Read Later）**：已有基础实现（`_addToReadLater`），需增强：
  - 在抽屉中增加"稍后读"标签页，展示所有稍后读列表
  - 支持从稍后读列表中移除条目
  - 支持一键清空

**数据结构**：
```json
// 收藏夹
{ "id": "12345", "title": "帖子标题", "url": "/t/topic/12345", "category": "讨论", "addedAt": 1700000000000 }
// 稍后读（复用现有 localStorage key: ltk_peek_read_later）
```

### 3. 页面导航记录（page-nav.js）

记录用户浏览路径，支持快速前后跳转：

- 自动记录用户点击的帖子链接（话题列表页 → 话题详情页）
- 抽屉中显示"最近浏览"列表（按时间倒序）
- 最近浏览上限 50 条，超出自动淘汰旧记录
- 持久化到 `chrome.storage.local`（key: `toolkit.module.peek.history`）

## 关键文件

- `src/content/modules/peek/index.js` — 添加收藏夹、导航记录逻辑
- `src/content/modules/peek/drawer.js` — 增强摘要模式、添加收藏/稍后读/导航标签页
- `src/content/modules/peek/button.js` — 悬浮按钮增加收藏快捷操作
- `src/content/modules/peek/cache.js` — 缓存支持摘要数据

## 约束

- 摘要模式仅抓取话题第一页内容，不递归加载
- 收藏夹上限 200 条，稍后读上限 100 条
- 导航记录只记录 linux.do 域内的页面跳转
- 抽屉标签页切换保持流畅（无闪烁）

## 验收标准

- [ ] 抽屉支持摘要/详情两种预览模式，可切换
- [ ] 摘要模式显示帖子摘要文本，点击可跳转
- [ ] 收藏按钮可添加/取消收藏，收藏列表持久化
- [ ] 稍后读标签页展示所有待读列表，支持移除
- [ ] 最近浏览列表按时间倒序显示，最多 50 条
- [ ] 所有数据持久化，浏览器重启后保留
- [ ] `npm run build` 构建成功