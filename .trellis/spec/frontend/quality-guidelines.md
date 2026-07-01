# Quality Guidelines

> Code quality standards for this Chrome Extension project.

---

## Error Handling

### Module lifecycle errors

All module lifecycle methods are wrapped in try/catch by the framework (`ModuleManager` and `Module` base class). Individual modules should still handle their own async operations:

```javascript
// ✅ Correct — graceful degradation
async refresh() {
  try {
    const topics = await this.store.fetchTopics(path)
    this.panel?.renderTopics(topics)
  } catch (e) {
    console.error('[SideTopic] 刷新失败:', e)
    this.panel?.showError('加载失败')
  }
}

// ❌ Wrong — unhandled promise rejection crashes silently
async refresh() {
  const topics = await this.store.fetchTopics(path)  // throws
  this.panel?.renderTopics(topics)
}
```

### Background message handling

All message handlers in `background/index.js` are wrapped in a single try/catch:

```javascript
async function handleMessage(message, sender, sendResponse) {
  try {
    switch (message.type) { ... }
  } catch (error) {
    console.error('处理消息失败:', error)
    sendResponse({ success: false, error: error.message })
  }
}
```

### Event bus callbacks

Event callbacks are wrapped in try/catch by the event bus:

```javascript
export function emit(event, data) {
  for (const callback of set) {
    try { callback(data) }
    catch (error) { console.error(`[EventBus] 事件 "${event}" 的回调执行出错:`, error) }
  }
}
```

---

## Logging

### Use the logger utility

```javascript
import { logger } from '../../utils/helpers.js'

logger.info('初始化完成')
logger.warn('检测到冲突')
logger.error('请求失败:', error)
```

### Module-specific console prefix

When logging directly, use module name prefix:

```javascript
console.log('[AutoBrowse] 开始运行')
console.error('[Credit] 刷新失败:', e)
console.warn('[SideTopic] 已注册，跳过')
```

---

## Resource Cleanup

### Mandatory cleanup checklist

Every module's `onDestroy()` and every UI component's `unmount()` MUST:

- [ ] Clear all `setInterval` / `setTimeout` (store IDs, call `clearInterval`/`clearTimeout`)
- [ ] Remove all DOM elements (call `element.remove()` on root container)
- [ ] Remove all event listeners (call unsubscribe functions from EventBus)
- [ ] Disconnect MutationObserver (call `observer.disconnect()`)
- [ ] Set references to `null` (prevents memory leaks)

```javascript
// ✅ Correct — complete cleanup
onDestroy() {
  if (this.refreshTimer) {
    clearInterval(this.refreshTimer)
    this.refreshTimer = null
  }
  this._disconnectObserver()
  this.panel?.unmount()
  this.widget?.unmount()
}

// ❌ Wrong — leaked timer
onDestroy() {
  this.panel?.unmount()
}
```

---

## Forbidden Patterns

### DOM
- ❌ `element.innerHTML = userContent` — XSS risk. Use `textContent` or sanitize
- ❌ `document.getElementById()` without `ltk-` prefix — may collide with host page
- ❌ `document.querySelector('.topic-list')` — too generic, may match host page elements
- ❌ Inline event handlers (`onclick="..."`) — use `addEventListener`

### Async
- ❌ `async` function without try/catch on the top-level await
- ❌ `Promise` without `.catch()` or try/catch
- ❌ `chrome.runtime.onMessage` without `return true` for async response

### Storage
- ❌ Direct `chrome.storage.local` calls outside `settings.js` and `background/index.js`
- ❌ `localStorage` for anything other than ephemeral UI state
- ❌ Large objects in `localStorage` (it's synchronous and blocks the main thread)

### Performance
- ❌ `MutationObserver` without `disconnect()` in cleanup
- ❌ `setInterval` shorter than 1 second unless absolutely necessary
- ❌ DOM queries in loops without caching

---

## Code Review Checklist

Before submitting a module change:

1. [ ] All timers/observers are cleaned up in `onDestroy()`/`unmount()`
2. [ ] Error handling on all async operations
3. [ ] Storage keys use `toolkit.` prefix
4. [ ] DOM IDs/classes use `ltk-` prefix
5. [ ] z-index values imported from `z-index.js`
6. [ ] Module settings declared in `getSettingsSchema()`
7. [ ] Dark mode styles included (`.dark` or `[data-theme="dark"]` selector)
8. [ ] No console.log left in production paths (use `logger.debug` for dev-only)
9. [ ] `manifest.json` permissions not expanded without reason
10. [ ] Build succeeds (`npm run build`)

---

## Testing

This project currently has no automated tests. Manual testing is done on `https://linux.do`:

1. Load unpacked extension from `dist/` in Chrome
2. Test each module: enable/disable, verify UI appears, verify no console errors
3. Test SPA navigation: navigate between pages, verify modules respond correctly
4. Test persistence: close/reopen browser, verify settings are retained
5. Test dark mode: toggle site theme, verify all injected UI adapts