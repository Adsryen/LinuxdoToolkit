# Type Safety

> This project is **vanilla JavaScript** — no TypeScript. Type safety is achieved through **JSDoc annotations** and runtime validation.

---

## JSDoc Conventions

The project uses JSDoc for type annotations. These are not enforced at build time but serve as documentation for AI assistants and developers.

### Parameter types

```javascript
/**
 * @param {string} moduleId - Module identifier
 * @param {object} [defaults] - Default settings (optional)
 * @returns {Promise<object>}
 */
async getModule(moduleId, defaults = {}) { ... }
```

### Complex types

```javascript
/**
 * @param {Object} options
 * @param {string} options.speed - Speed preset name
 * @param {number} options.maxViews - Maximum views per session
 * @param {Function} [options.onStart] - Callback when browsing starts
 * @param {Function} [options.onStop] - Callback when browsing stops
 */
constructor(options = {}) { ... }
```

### Map and Set types

```javascript
/** @type {Map<string, Module>} */
this.modules = new Map()

/** @type {Map<string, Set<Function>>} */
const listeners = new Map()
```

### Return types

```javascript
/**
 * @returns {StatusBarConfig|null}
 */
getStatusBar() { return null }

/**
 * @returns {SettingsSchema|null}
 */
getSettingsSchema() { return null }
```

---

## Type Patterns in Use

### Module config shape

```javascript
// Module constructor config
{
  id: 'auto-browse',           // string
  name: '自动浏览',             // string
  icon: '🔄',                  // string (emoji)
  description: '...',          // string
  category: 'efficiency',      // 'efficiency' | 'ui' | 'data' | 'preview' | 'other'
  defaultSettings: {           // object
    speed: 'normal',           // string
    enableLike: true,          // boolean
    maxSessionViews: 50,       // number
  },
}
```

### Settings schema shape

```javascript
{
  fields: [
    {
      key: 'speed',            // string — storage key
      label: '浏览速度',        // string — display label
      type: 'select',          // 'select' | 'toggle' | 'number' | 'text'
      options: [...],          // for 'select': [{ value, label }]
      default: 'normal',       // default value
    },
  ],
}
```

### Status bar shape

```javascript
{
  text: '已浏览 23 帖 · 点赞 5',          // string — display text
  actions: [                              // optional action buttons
    { label: '暂停', onClick: () => {} },
  ],
}
```

### Message shape (extension IPC)

```javascript
// Request
{ type: 'ENABLE_MODULE', moduleId: 'credit' }

// Response
{ success: true, data: { ... } }
{ success: false, error: 'Error message' }
```

---

## Runtime Validation

Since there's no compile-time type checking, use defensive patterns:

### Default values with nullish coalescing

```javascript
const interval = settings.refreshInterval || REFRESH_INTERVAL
const enabled = enabledMap[id] !== false  // default to true
```

### Guard clauses

```javascript
if (!this.container) return
if (!this.widget) return
if (!resp?.success) throw new Error(resp?.error)
```

### Optional chaining

```javascript
this.panel?.unmount()
this.cache?.prefetch(topicId)
const csrfToken = document.querySelector('meta[name="csrf-token"]')?.content
```

### Destructuring with defaults

```javascript
const { 'toolkit.backups': backups = [] } = await chrome.storage.local.get('toolkit.backups')
const { 'toolkit.global': globalSettings } = await chrome.storage.local.get('toolkit.global')
```

---

## Forbidden Patterns

- ❌ `any` type in JSDoc (always specify the actual type)
- ❌ Type coercion with `==` (use `===` and `!==`)
- ❌ `typeof x === 'object'` without null check (use `x !== null && typeof x === 'object'`)
- ❌ Assuming `chrome.storage.local.get()` returns a value (always provide defaults)

---

## Common Mistakes

1. **Not handling `null` from storage** — `chrome.storage.local.get('key')` returns `{ key: undefined }` if key doesn't exist. Always provide defaults: `result['key'] || {}`
2. **Assuming `sendResponse` is synchronous** — always `return true` in `chrome.runtime.onMessage` for async handlers
3. **Mutating `this.settings` directly** — use `settings.setModule()` to persist changes