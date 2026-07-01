# Utility & Event Patterns

> This project is vanilla JavaScript — no React hooks. This document covers **utility functions, event patterns, and communication patterns** that serve the same role as hooks in framework projects.

---

## Utility Functions (`src/utils/`)

All shared utilities are in `src/utils/` and re-exported from `src/utils/index.js`.

### Core utilities

| Utility | File | Purpose |
|---------|------|---------|
| `settings` | `settings.js` | Singleton SettingsManager — read/write chrome.storage with caching |
| `EventBus` / `emit/on/off/once` | `events.js` | Pub/sub event bus for inter-module communication |
| `DOM` / `createElement/injectStyles/waitForElement` | `dom.js` | DOM manipulation helpers |
| `debounce` / `throttle` | `helpers.js` | Standard debounce/throttle |
| `randomInt` / `randomDelay` | `helpers.js` | Random utilities for simulation |
| `logger` | `helpers.js` | Prefixed console.log wrapper |
| `Z_INDEX` | `z-index.js` | Centralized z-index layer constants |

### When to create a new utility

1. Same logic appears in 2+ modules → extract to `src/utils/`
2. Function is pure and has no module-specific dependencies
3. Add JSDoc type annotations
4. Re-export in `src/utils/index.js`

---

## Event Bus Pattern

Used for loose coupling between modules:

```javascript
import { emit, on, EVENTS } from '../../utils/events.js'

// Publish
emit(EVENTS.MODULE_ENABLED, { moduleId: 'auto-browse' })

// Subscribe (returns unsubscribe function)
const unsubscribe = on(EVENTS.MODULE_ENABLED, (data) => {
  console.log('Module enabled:', data.moduleId)
})

// One-time subscription
once(EVENTS.THEME_CHANGED, (data) => { /* ... */ })
```

### Predefined events (in `EVENTS` constant)

- `module:enabled` / `module:disabled` / `module:status` — module lifecycle
- `auto-browse:start` / `auto-browse:stop` / `auto-browse:stats` — auto-browse module
- `theme:changed` — dark mode toggle
- `page:changed` — SPA navigation
- `toolbar:toggle` — toolbar show/hide
- `backup:created` / `restore:completed` — backup operations

### Event naming convention

`namespace:action` — lowercase, colon-separated.

---

## Settings Manager Pattern

Singleton `settings` from `src/utils/settings.js`:

```javascript
import { settings } from '../../utils/settings.js'

// Module config
const config = await settings.getModule('auto-browse', defaults)
await settings.setModule('auto-browse', { speed: 'fast' })

// Global config
const theme = settings.getGlobal('theme')
await settings.setGlobal({ theme: 'dark' })

// Module enable/disable
const enabled = settings.isModuleEnabled('credit')
await settings.setModuleEnabled('credit', false)

// Change listeners
const unsub = settings.onModuleChange('auto-browse', (newConfig) => {
  // React to config changes from Options page
})

// Export/Import
const allData = await settings.exportAll()
await settings.importAll(data, 'merge')
```

### Storage key prefix

All keys use `toolkit.` prefix:
- `toolkit.global` — global settings
- `toolkit.module.<id>` — per-module settings
- `toolkit.enabledModules` — module toggle map
- `toolkit.stats` — statistics
- `toolkit.backups` — auto-backup snapshots

---

## Message Passing (Extension IPC)

Three-layer communication: Popup ↔ Background ↔ Content Script

```javascript
// Send message (from popup/options)
chrome.runtime.sendMessage({ type: 'ENABLE_MODULE', moduleId: 'credit' }, (response) => {
  // Handle response
})

// Receive in background (src/background/index.js)
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  // Always return true for async response
  return true
})

// Forward to content script (background → content)
chrome.tabs.sendMessage(tabId, message)
```

### Message types

Defined in `src/background/index.js` switch statement:
- `GET_MODULE_LIST` / `TOGGLE_MODULE` / `ENABLE_MODULE` / `DISABLE_MODULE`
- `GET_SETTINGS` / `SET_SETTINGS`
- `GET_MODULE_SETTINGS` / `SET_MODULE_SETTINGS`
- `GET_ENABLED_MODULES` / `SET_MODULE_ENABLED`
- `EXPORT_BACKUP` / `IMPORT_BACKUP`
- `FETCH_CREDIT_INFO` — cross-origin request relay
- `OPEN_OPTIONS`

---

## Common Mistakes

1. **Using `localStorage` for persistent data** — it's per-domain and cleared with cookies. Use `chrome.storage.local` via `settings.js` instead. Only use `localStorage` for ephemeral UI state (panel position, running flag)
2. **Not returning `true` from `chrome.runtime.onMessage`** — needed for async `sendResponse`
3. **Forgetting to unsubscribe from events** — always call the returned unsubscribe function in `onDestroy()`
4. **Direct `chrome.storage.local.get()`** — use `settings.js` for caching and change notifications