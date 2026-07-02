# 自动浏览回写准确的浏览楼数

> P1 — 修复 01f 中浏览楼数不准确的问题

## 问题

当前 `browser.js` 的 `_getCurrentPostNumber()` 和 `_extractTotalPosts()` 通过数 DOM 中 `.topic-post` 元素来获取楼数。但 Discourse 是懒加载的——离开视口的帖子会被卸载，DOM 中只保留当前可见和附近的帖子，导致：

- `_getCurrentPostNumber()` 返回的是 DOM 中最后一个 `.topic-post` 的楼层号，可能远小于实际滚动到的位置
- `_extractTotalPosts()` 返回的是 DOM 中当前已加载的帖子数，不是真实总回复数

## 解决方案

Discourse 页面右侧有一个 `timeline-scrollarea` 组件，其中的 `.timeline-replies` 元素直接显示了当前位置和总数：

```html
<div class="timeline-replies">8 / 49</div>
```

- `8` = 当前滚动到的楼层（准确）
- `49` = 该话题的总回复数（准确）

### 修改点

**1. 重写 `_extractTotalPosts()`**

```javascript
_extractTotalPosts() {
  const replies = document.querySelector('.timeline-replies')
  if (replies) {
    const match = replies.textContent.match(/(\d+)\s*\/\s*(\d+)/)
    if (match) return parseInt(match[2])  // 总数
  }
  return 0
}
```

**2. 重写 `_getCurrentPostNumber()`**

```javascript
_getCurrentPostNumber() {
  const replies = document.querySelector('.timeline-replies')
  if (replies) {
    const match = replies.textContent.match(/(\d+)\s*\/\s*(\d+)/)
    if (match) return parseInt(match[1])  // 当前楼层
  }
  return 0
}
```

**3. 确保回写发生在跳转之前**

当前 `_startScrolling()` 的流程已经是正确的：滚动循环结束 → 更新 `history.addRecord()` → `_navigateNextTopic()`。只需确保 `_getCurrentPostNumber()` 返回准确值即可。

## 关键文件

- `src/content/modules/auto-browse/browser.js` — 重写 `_extractTotalPosts()` 和 `_getCurrentPostNumber()`

## 约束

- `.timeline-replies` 在话题页始终存在（Discourse 核心组件），但需处理页面加载初期可能尚未渲染的情况
- 正则匹配失败时 fallback 到 DOM 计数（当前实现）

## 验收标准

- [ ] `_getCurrentPostNumber()` 返回的楼数与页面 timeline 显示的当前楼层一致
- [ ] `_extractTotalPosts()` 返回的总数与页面 timeline 显示的总回复数一致
- [ ] 浏览记录中 `browsedTo` 字段准确反映实际浏览到的楼层
- [ ] 跳转下一个帖子前，记录已回写到 storage
- [ ] `npm run build` 构建成功