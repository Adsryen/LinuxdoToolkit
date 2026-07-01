# State Management

> Chrome Extension project — state lives in `chrome.storage.local` and module instances. No Redux, no Context, no reactive framework.

---

## State Categories

### 1. Persistent State (`chrome.storage.local`)

All user-facing state that must survive browser restarts:

| Key | Content | Managed by |
|-----|---------|-----------|
| `toolkit.global` | Theme, language, toolbar settings | `settings.js` |
| `toolkit.module.<id>` | Per-module config | `settings.js` |
| `toolkit.enabledModules` | `{ moduleId: boolean }` map | `settings.js` |
| `toolkit.stats` | Session/total counts | `settings.js` |
| `toolkit.backups` | Auto-backup snapshots (max 5) | `settings.js` + `background/index.js` |
| `toolkit.history.records` | Browse history records | `history.js` |
| `toolkit.history.likes` | Like history | `history.js` |

**Always access via `settings.js` singleton**, never directly:
```javascript
// ✅ Correct
import { settings } from '../../utils/settings.js'
const config = await settings.getModule('auto-browse', defaults)

// ❌ Wrong — bypasses cache and change listeners
chrome.storage.local.get('toolkit.module.auto-browse', (r) => { ... })
```

### 2. Runtime State (module instances)

Module instance properties that don't need persistence:

```javascript
class AutoBrowseModule extends Module {
  constructor() {
    super(...)
    this.running = false          // current run state
    this.timer = null             // interval reference
    this.stats = { ... }          // in-memory stats (synced to storage periodically)
    this.lastActivity = 0         // timestamp for stuck detection
  }
}
```

### 3. Ephemeral UI State (`localStorage`)

UI-only state, acceptable to lose on clear:

| Key | Content | Module |
|-----|---------|--------|
| `ltk_auto_running` | `true/false` — resume across page loads | auto-browse |
| `ltk_ab_panel_pos` | `{ left, top }` — panel drag position | auto-browse |
| `ltk_peek_read_later` | `[topicId, ...]` — read later list | peek |

**Rule**: `localStorage` is acceptable ONLY for:
- Non-critical UI state (panel position, collapsed state)
- Values that can be reconstructed (running flag for page-load resume)
- Never for user configuration or settings

---

## Change Propagation

### Module → Storage → Options Page

```
Content Script (module)           Background                Options Page
  settings.setModule(id, {...}) ──→ chrome.storage.local ──→ settings.onModuleChange()
```

### Options Page → Storage → Content Script

```
Options Page                      Background                Content Script
  chrome.runtime.sendMessage() ──→ chrome.storage.local ──→ chrome.storage.onChanged
                                                              → settings._notify()
                                                              → module.onSettingsChange()
```

### Module ↔ Module

```
Module A ──→ emit(EVENTS.XXX, data) ──→ Module B (via event bus)
```

---

## Data Flow in Practice

### Module initialization flow

```
1. ModuleManager.init()
2.   settings.init() → preload toolkit.global + toolkit.enabledModules
3.   For each enabled module:
4.     settings.getModule(id, defaults) → merge stored + defaults
5.     module.init(mergedSettings) → onInit()
6.     module.enable() → onEnable()
```

### Settings update flow

```
1. User changes setting in Options page
2. Options → sendMessage({ type: 'SET_SETTINGS', key, value })
3. Background → chrome.storage.local.set({ key, value })
4. chrome.storage.onChanged fires in content script
5. settings._notify() → invokes registered listeners
6. Module.onSettingsChange() → reconfigures behavior
```

---

## Forbidden Patterns

- ❌ Global variables for shared state (use EventBus or settings)
- ❌ Direct `chrome.storage.local.get/set` outside `settings.js` and `background/index.js`
- ❌ `localStorage` for user configuration or settings
- ❌ Module A importing Module B directly (use EventBus for loose coupling)
- ❌ Mutating `this.settings` without calling `settings.setModule()` (won't persist)

---

## Common Mistakes

1. **Assuming storage is synchronous** — `chrome.storage` is async, always `await`
2. **Not merging defaults** — always use `{ ...defaults, ...stored }` pattern (see `settings.getModule()`)
3. **Forgetting to clean up listeners** — `onChange()` returns an unsubscribe function, call it in `onDestroy()`