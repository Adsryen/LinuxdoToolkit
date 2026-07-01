# 修复自动浏览历史记录

> P0 Bug — 自动浏览不记录浏览历史

## 问题

`BrowseEngine`（`src/content/modules/auto-browse/browser.js`）在浏览过程中**从未调用 `history.addRecord()`**，导致：

1. `_startScrolling()` 进入话题页后，只是把 topicId 加到本地 `_sessionViewed` Set，不持久化
2. 滚动到底部/skip 百分比后，不记录浏览到的楼数 (`browsedTo`)
3. 话题标题 (`title`) 和总回复数 (`totalPosts`) 也未提取
4. Options 页仪表盘始终显示 0 条记录

`HistoryStore`（`src/utils/history.js`）已经实现了完整的 `addRecord()` 接口，只需要在 BrowseEngine 中调用它。

## 修复点

### 1. `_startScrolling()` — 进入话题页时记录

在开始滚动前，调用 `history.addRecord()` 记录话题基本信息：

```javascript
// 提取话题信息
const topicId = this._getTopicId(window.location.href)
const title = document.querySelector('a.fancy-title')?.textContent?.trim() || 
              document.querySelector('title')?.textContent?.replace(' - Linux.do', '')?.trim() || ''
const totalPosts = parseInt(document.querySelector('.topic-post')?.closest('[data-post-count]')?.dataset?.postCount || '0')

// 记录到 history
if (topicId) {
  history.addRecord({
    topicId,
    title,
    url: window.location.href,
    browsedTo: 0,    // 刚开始浏览
    totalPosts,
    liked: false,
  })
}
```

### 2. `_startScrolling()` — 离开话题页时更新楼数

在滚动循环结束（到达底部/skip）后，更新已浏览到的楼数：

```javascript
// 计算当前浏览到的楼层
const visiblePosts = document.querySelectorAll('.topic-post').length
const lastPostNumber = parseInt(
  document.querySelector('.topic-post:last-child .post-number')?.textContent || '0'
)

history.addRecord({
  topicId,
  title,
  url: window.location.href,
  browsedTo: lastPostNumber || visiblePosts,
  totalPosts,
  liked: false,
})
```

### 3. 点赞时同步更新

在 `LikeSystem` 点赞成功后，调用 `history.addLike(topicId, postId)` 更新点赞记录。

## 关键文件

- `src/content/modules/auto-browse/browser.js` — 主要修改：在 `_startScrolling()` 中添加 `history.addRecord()` 调用
- `src/content/modules/auto-browse/like.js` — 确认点赞后调用 `history.addLike()`
- `src/utils/history.js` — 无需修改（已经是完整实现）

## 约束

- 不改变现有浏览引擎的控制流
- `history.addRecord()` 内部有 debounce 保存（500ms），不会造成性能问题
- 话题标题提取需要处理多种 DOM 结构（topic 页、latest 列表页等）

## 验收标准

- [x] 自动浏览进入话题页后，`toolkit.history.records` 中有该话题记录
- [x] 浏览到底部/skip 后，记录中的 `browsedTo` 更新为已浏览的楼数
- [x] 记录包含 `topicId`、`title`、`url`、`browsedTo`、`totalPosts` 字段
- [x] 同一话题多次浏览时，更新已有记录而非重复创建（`history.addRecord` 内部已实现 findIndex 更新逻辑）
- [x] Options 页仪表盘正确显示浏览统计
- [x] `npm run build` 构建成功