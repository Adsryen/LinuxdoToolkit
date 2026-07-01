# Directory Structure

> Chrome Extension (MV3) project — vanilla JavaScript, no framework.

---

## Overview

This is a browser extension project using Vite for bundling. Source code lives in `src/`, built output in `dist/`. The extension targets `linux.do` domain.

---

## Directory Layout

```
src/
├── manifest.json                 # Chrome MV3 manifest
├── background/
│   └── index.js                  # Service Worker (message relay, lifecycle, backup)
├── content/
│   ├── index.js                  # Content script entry (bootstrap)
│   ├── modules/
│   │   ├── index.js              # ModuleManager — registers, initializes, manages modules
│   │   ├── base.js               # Module base class — lifecycle interface
│   │   ├── auto-browse/          # Auto-browse module
│   │   │   ├── index.js          #   Module entry (extends Module)
│   │   │   ├── browser.js        #   Browse engine logic
│   │   │   ├── scroll.js         #   Scroll controller
│   │   │   ├── like.js           #   Like system
│   │   │   └── panel.js          #   Control panel UI (vanilla DOM)
│   │   ├── side-topic/           # Side topic panel module
│   │   │   ├── index.js
│   │   │   ├── panel.js          #   Side panel UI
│   │   │   ├── topics.js         #   Topic data fetching
│   │   │   └── filters.js        #   Filter logic
│   │   ├── peek/                 # Quick preview module
│   │   │   ├── index.js
│   │   │   ├── drawer.js         #   Drawer UI
│   │   │   ├── button.js         #   Floating trigger button
│   │   │   └── cache.js          #   Topic cache
│   │   ├── credit/               # Credit monitor module
│   │   │   ├── index.js
│   │   │   └── widget.js         #   Floating widget UI
│   │   └── ui-enhance/           # UI enhancement module
│   │       ├── index.js
│   │       └── theme.js          #   Theme/dark mode logic
│   └── toolbar/                  # Unified floating toolbar
│       ├── index.js
│       └── toolbar.js
├── popup/
│   ├── index.html
│   ├── index.js
│   └── styles.css
├── options/
│   ├── index.html
│   ├── index.js
│   └── styles.css
├── utils/
│   ├── index.js                  # Re-exports all utilities
│   ├── storage.js                # chrome.storage wrapper
│   ├── settings.js               # SettingsManager singleton
│   ├── request.js                # fetch wrapper with CSRF
│   ├── dom.js                    # DOM helpers (createElement, injectStyles, waitForElement)
│   ├── navigation.js             # SPA navigation detection
│   ├── theme.js                  # Theme detection & sync
│   ├── events.js                 # EventBus (pub/sub)
│   ├── z-index.js                # Z-index layer constants
│   ├── helpers.js                # General utilities (debounce, throttle, randomInt, etc.)
│   ├── backup.js                 # Backup/restore logic
│   ├── history.js                # Browse history tracking
│   ├── conflict.js               # Conflict detection with other scripts
│   └── i18n.js                   # Internationalization (zh-CN/en)
└── styles/
    └── content.css               # Global content styles
```

---

## Module Organization

Each module under `src/content/modules/<name>/` is self-contained:

- `index.js` — Module class extending `Module` base class
- `panel.js` / `widget.js` / `drawer.js` — UI components (vanilla DOM)
- `*.js` — Domain logic (e.g., `browser.js`, `scroll.js`, `like.js`)

### Adding a new module

1. Create directory `src/content/modules/<module-id>/`
2. Create `index.js` with a class extending `Module` (from `base.js`)
3. Implement required lifecycle methods: `onInit()`, `onDestroy()`
4. Optionally implement: `getStatusBar()`, `getSettingsSchema()`
5. Register in `src/content/modules/index.js` → `_registerBuiltInModules()`
6. Add to `DEFAULT_MODULES` in `src/options/index.js` and `src/popup/index.js`

---

## Naming Conventions

| Convention | Example |
|-----------|---------|
| Module directory | `auto-browse/`, `side-topic/` (kebab-case) |
| Module class | `AutoBrowseModule`, `SideTopicModule` (PascalCase) |
| Module ID | `'auto-browse'`, `'side-topic'` (kebab-case) |
| Utility files | `dom.js`, `events.js` (lowercase, single word when possible) |
| CSS classes | `ab-btn`, `ltk-auto-panel` (lowercase, prefixed with module abbreviation) |
| DOM IDs | `ltk-auto-panel`, `ltk-peek-drawer` (`ltk-` prefix for toolkit) |
| Storage keys | `toolkit.module.auto-browse`, `toolkit.global` |
| Event names | `module:enabled`, `auto-browse:start` (namespace:action) |
| localStorage keys | `ltk_auto_running`, `ltk_peek_read_later` (for non-critical cache only) |

---

## Examples

- Well-structured module: `src/content/modules/auto-browse/` — clean separation of index (lifecycle), browser (engine), scroll (controller), like (system), panel (UI)
- Utility singleton: `src/utils/settings.js` — SettingsManager class exported as singleton `settings`
- Event bus: `src/utils/events.js` — pub/sub with named events under `EVENTS` constant