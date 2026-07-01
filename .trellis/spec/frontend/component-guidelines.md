# Module Guidelines

> How modules and UI components are built in this project. This project uses **vanilla JavaScript** with a class-based module pattern — no React, no framework components.

---

## Module Base Class

All modules extend `Module` from `src/content/modules/base.js`. This provides a standardized lifecycle:

```javascript
// src/content/modules/base.js → Module class
class MyModule extends Module {
  constructor() {
    super({
      id: 'my-module',           // unique, kebab-case
      name: '我的模块',           // display name (Chinese)
      icon: '✨',                 // emoji icon
      description: '模块描述',
      category: 'efficiency',    // efficiency | ui | data | preview | other
      defaultSettings: {         // default config values
        enabled: true,
      },
    })
  }

  async onInit(settings) { /* create DOM, register events, init state */ }
  onDestroy() { /* clean up ALL DOM, timers, event listeners */ }
  async onEnable() { /* restore from disabled state */ }
  async onDisable() { /* pause but keep state */ }
  onPageChange(url, pageType) { /* respond to SPA navigation */ }
  onSettingsChange(newSettings) { /* react to config changes */ }

  getStatusBar() { return null }         // optional: toolbar status
  getSettingsSchema() { return null }    // optional: options page form
}
```

### Lifecycle contract

```
constructor → init() → onInit() → enable() → onEnable()
                                         → disable() → onDisable()
                           → destroy() → onDestroy()
```

- `init()` is called once (lazy — only when module is first enabled)
- `enable()`/`disable()` can be called multiple times
- `destroy()` is final — module is removed from DOM
- **Never skip calling `super.init()` or `super.destroy()`** — the framework methods handle state tracking

---

## UI Component Pattern (Vanilla DOM)

UI components are plain classes with `mount()`/`unmount()` lifecycle:

```javascript
// src/content/modules/auto-browse/panel.js → ControlPanel
export class ControlPanel {
  constructor(options = {}) {
    this.options = options      // callback functions: onStart, onStop, etc.
    this.container = null       // root DOM element
  }

  mount() {
    if (this.container) return
    this._injectStyles()                              // 1. inject CSS
    this.container = document.createElement('div')    // 2. create root element
    this.container.id = 'ltk-auto-panel'
    this.container.innerHTML = this._buildHTML()      // 3. build HTML string
    document.body.appendChild(this.container)         // 4. append to body
    this._bindEvents()                                // 5. bind event listeners
  }

  unmount() {
    this.container?.remove()     // remove from DOM
    this.container = null        // clear reference
  }

  show() { /* display = '' */ }
  hide() { /* display = 'none' */ }
}
```

### Key conventions

- **CSS is injected inline** via `document.createElement('style')` with a unique ID (e.g., `ltk-auto-style`)
- **DOM IDs** use `ltk-` prefix (e.g., `ltk-auto-panel`, `ltk-peek-drawer`)
- **CSS class names** use module abbreviation prefix (e.g., `ab-btn`, `ab-speed`, `ab-header`)
- **Event handlers** are bound in `_bindEvents()`, not via inline `onclick` attributes
- **Callback pattern**: pass functions via `options` object, not custom events

---

## Styling Patterns

1. **Inline `<style>` injection** — standard approach for content scripts (avoids CSP issues):
   ```javascript
   const style = document.createElement('style')
   style.id = 'ltk-auto-style'
   style.textContent = `#ltk-auto-panel { position: fixed; ... }`
   document.head.appendChild(style)
   ```

2. **CSS-in-JS via template literals** — styles are defined as string literals inside component classes

3. **z-index from centralized layer map** — always import from `src/utils/z-index.js`:
   ```javascript
   import { Z_INDEX } from '../../../utils/z-index.js'
   // Z_INDEX.widget = 2000, Z_INDEX.panel = 4000, Z_INDEX.modal = 5000
   ```

4. **Dark mode** — use `.dark` or `[data-theme="dark"]` selector in injected styles:
   ```css
   .dark #ltk-auto-panel, [data-theme="dark"] #ltk-auto-panel { background: #2d3748; }
   ```

5. **Existing CSS files** — `src/options/styles.css` and `src/popup/styles.css` for standalone pages; modules use inline styles

---

## Forbidden Patterns

- ❌ `innerHTML` for user-generated content (use `textContent` or sanitize)
- ❌ `document.getElementById()` without `ltk-` prefix (risk of collision with host page)
- ❌ `setTimeout`/`setInterval` without cleanup in `onDestroy()` or `unmount()`
- ❌ Hardcoded z-index values (use `Z_INDEX` from `z-index.js`)
- ❌ Direct `chrome.storage.local.set()` in modules (use `settings` singleton)
- ❌ Direct `GM_*` API calls (use `utils/` wrappers instead)

---

## Common Mistakes

1. **Forgetting to clean up timers** — always store timer IDs and clear them in `onDestroy()`/`unmount()`
2. **Not checking `this.container` before accessing** — always guard with `if (!this.container) return`
3. **CSS collision with host page** — always prefix selectors with `#ltk-*` ID or `.ltk-*` class
4. **Using `localStorage` for persistent config** — use `chrome.storage.local` via `settings.js`; `localStorage` is acceptable only for ephemeral UI state (panel position, running flag)