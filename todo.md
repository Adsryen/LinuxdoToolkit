# LinuxdoToolkit 开发计划

> 将 Linux.do 社区的油猴脚本与单功能扩展融合为一站式浏览器扩展

---

## 架构设计

### 三层交互模型

```
第1层：Popup（极简控制中心）
  → 点击扩展图标弹出，快速开关模块，一键跳转设置

第2层：页面内浮动工具栏（统一控制台）
  → 聚合所有运行中模块的状态，快捷操作入口

第3层：模块专属面板/组件
  → 每个模块自己的 UI（侧边栏、悬浮球、抽屉等）
```

### 目录结构

```
src/
├── manifest.json
├── background/
│   └── index.js                    # Service Worker
├── content/
│   ├── index.js                    # 内容脚本入口
│   ├── modules/
│   │   ├── index.js                # ModuleManager（已有）
│   │   ├── auto-browse/            # 自动浏览模块
│   │   │   ├── index.js
│   │   │   ├── browser.js          # 帖子浏览逻辑
│   │   │   ├── scroll.js           # 滚动控制器
│   │   │   ├── like.js             # 点赞逻辑
│   │   │   └── panel.js            # 控制面板 UI
│   │   ├── side-topic/             # 话题侧栏模块
│   │   │   ├── index.js
│   │   │   ├── panel.js            # 侧边面板
│   │   │   ├── topics.js           # 话题数据
│   │   │   └── filters.js          # 筛选器
│   │   ├── peek/                   # 快速预览模块
│   │   │   ├── index.js
│   │   │   ├── drawer.js           # 抽屉 UI
│   │   │   ├── button.js           # 悬浮入口
│   │   │   └── cache.js            # 话题缓存
│   │   ├── credit/                 # 积分监控模块
│   │   │   ├── index.js
│   │   │   └── widget.js           # 悬浮小组件
│   │   └── ui-enhance/             # 界面美化模块
│   │       ├── index.js
│   │       └── theme.js            # 主题/暗黑模式
│   └── toolbar/                    # 统一浮动工具栏
│       ├── index.js
│       ├── toolbar.js              # 工具栏组件
│       └── styles.css
├── popup/
│   ├── index.html
│   ├── index.js
│   └── styles.css
├── options/
│   ├── index.html
│   ├── index.js
│   └── styles.css
├── utils/
│   ├── index.js
│   ├── storage.js                  # 统一存储封装
│   ├── request.js                  # 统一请求封装（fetch + CSRF）
│   ├── dom.js                      # DOM 工具
│   ├── navigation.js               # SPA 导航检测
│   ├── theme.js                    # 主题检测与同步
│   ├── events.js                   # 模块间事件总线
│   ├── z-index.js                  # z-index 层级管理
│   └── backup.js                   # 备份与恢复（导出/导入/自动快照）
├── styles/
│   ├── content.css
│   └── variables.css               # CSS 变量（主题色等）
└── popup/ options/ ...
```

### 统一模块接口

```javascript
// 每个模块必须实现的接口
{
  id: 'auto-browse',           // 唯一标识
  name: '自动浏览',             // 显示名
  icon: '🔄',                  // 图标
  description: '自动浏览帖子',  // 描述
  category: 'efficiency',      // 分类: efficiency | ui | data | preview

  // 生命周期
  init(settings) {},           // 初始化
  destroy() {},                // 销毁（清理 DOM、定时器、事件监听）
  enable() {},                 // 启用
  disable() {},                // 禁用

  // 页面响应
  onPageChange(url, pageType) {},

  // 向工具栏注册状态条（可选）
  getStatusBar() {
    return { text: '已浏览 23 帖', actions: [{ label: '暂停', onClick: fn }] }
  },

  // 设置面板描述（Options 页统一渲染）
  getSettingsSchema() {
    return { fields: [...], groups: [...] }
  }
}
```

### 存储结构

```
chrome.storage.local
├── toolkit.global                   → { theme, language, toolbarPos, toolbarCollapsed }
├── toolkit.module.auto-browse       → { speed, enableLike, likeChance, ... }
├── toolkit.module.side-topic        → { feed, filters, panelPos, panelSize }
├── toolkit.module.peek              → { settings, seenTopics, favorites }
├── toolkit.module.credit            → { position, refreshInterval }
├── toolkit.module.ui-enhance        → { darkMode, customCSS }
├── toolkit.stats                    → { sessionViews, sessionLikes, ... }
└── toolkit.enabledModules           → { 'auto-browse': true, 'side-topic': true, ... }
```

所有以 `toolkit.` 为前缀的 key 均纳入备份范围。

### 备份与恢复

用户数据全部存在 `chrome.storage.local`，换电脑后数据丢失。提供三种备份方式：

**方式一：JSON 文件导出/导入（核心，必做）**

```
Options 页 → 备份与恢复
├── 导出备份  → 生成 .json 文件下载到本地
├── 导入恢复  → 选择 .json 文件，预览差异，确认后覆盖/合并
└── 自动备份  → 定期生成备份（存入 chrome.storage.local 的独立 key）
```

备份文件格式：
```json
{
  "version": 1,
  "timestamp": "2026-06-30T12:00:00Z",
  "appVersion": "1.0.0",
  "data": {
    "toolkit.global": { ... },
    "toolkit.module.auto-browse": { ... },
    "toolkit.module.side-topic": { ... },
    "toolkit.module.peek": { ... },
    "toolkit.module.credit": { ... },
    "toolkit.module.ui-enhance": { ... },
    "toolkit.stats": { ... },
    "toolkit.enabledModules": { ... }
  }
}
```

导入时策略：
- 完全覆盖：清空现有数据，用备份替换
- 智能合并：逐 key 对比，保留两边最新数据（按 timestamp）
- 预览差异：导入前展示哪些 key 会变化，让用户确认

**方式二：剪贴板复制/粘贴（轻量补充）**

- 一键复制所有配置到剪贴板（Base64 编码的压缩 JSON）
- 粘贴导入，适合临时迁移或分享配置

**方式三：自动备份（可选，后台静默）**

- 每次修改设置后自动保存一份快照到 `toolkit.backups`（最多保留最近 5 份）
- 恢复时可选择回滚到某个历史快照
- 快照仅保存配置，不保存浏览记录等大体积数据

### z-index 层级管理

```javascript
// 统一分配，避免各模块互相抢占
const Z_LAYERS = {
  content:      1000,   // 内容增强（高亮、标记等）
  widget:       2000,   // 悬浮小组件（积分显示）
  toolbar:      3000,   // 统一工具栏
  panel:        4000,   // 模块面板（侧栏、自动浏览面板）
  modal:        5000,   // 模态框/抽屉（LD Peek）
  notification: 6000,   // 通知提示
};
```

---

## 开发阶段

### Phase 0 — 基础设施 ✅

- [x] 项目初始化（Vite + MV3 骨架）
- [x] **实现 `utils/storage.js`** — 封装 chrome.storage，支持前缀隔离，替代 GM_setValue/localStorage
- [x] **实现 `utils/request.js`** — 封装 fetch，自动携带 CSRF token，处理跨域请求
- [x] **实现 `utils/navigation.js`** — SPA 导航检测（统一各脚本重复的 URL polling/MutationObserver）
- [x] **实现 `utils/theme.js`** — 检测 linux.do 暗黑模式，同步给所有模块
- [x] **实现 `utils/events.js`** — 模块间事件总线（模块启停、状态变更通知等）
- [x] **实现 `utils/z-index.js`** — z-index 分配器
- [x] **实现 `utils/dom.js`** — DOM 工具（创建面板、注入样式等）
- [x] **实现 `utils/backup.js`** — 备份与恢复核心逻辑
  - [x] `exportAll()` — 扫描所有 `toolkit.*` key，打包为带版本号的 JSON
  - [x] `importFromJSON(json, strategy)` — 支持"完全覆盖"和"智能合并"两种策略
  - [x] `getDiff(current, backup)` — 返回差异对比结果，供导入预览
  - [x] `autoSnapshot()` — 设置变更后自动保存快照（最多保留 5 份）
  - [x] `listSnapshots()` / `restoreSnapshot(id)` — 快照管理与回滚
  - [x] 剪贴板导入导出（Base64 编码的压缩 JSON）
  - [x] 版本兼容处理 — 备份文件 version 字段校验，跨版本迁移逻辑
- [x] **重构 `utils/` 目录** — 原有通用函数迁移到 helpers.js，index.js 改为统一 re-export 入口
- [x] **完善模块接口规范** — 定义 Module 基类/接口，标准化生命周期
- [x] **完善 settings 管理** — 基于 chrome.storage 的全局配置读写

### Phase 1 — 模块管理器 + Popup ✅

- [x] **重构 ModuleManager** — 基于 Phase 0 的接口规范重写，支持动态注册/注销
- [x] **重写 Popup** — 极简设计：模块列表（图标+名称+toggle）+ 跳转设置
- [x] **模块状态通信** — Popup ↔ background ↔ content 的消息通道
- [x] **实现统一工具栏（页面内）** — 折叠式浮动面板，聚合模块状态
  - [x] 可拖拽定位，位置持久化
  - [x] 折叠/展开动画
  - [x] 模块状态条插槽机制
  - [x] 跟随站点暗黑模式
- [x] **重写 Options 页框架** — 左侧分类导航 + 右侧内容区
  - [ ] 通用表单渲染器（根据模块的 settings schema 自动生成配置 UI）
  - [ ] 快捷键配置
  - [x] 模块启用/禁用
  - [x] **备份与恢复页面** — 导出下载、文件导入、差异预览、剪贴板操作、自动快照回滚

### Phase 2 — 积分监控模块（Credit） ✅

> 优先级最高：最简单，UI 最少，验证模块架构

- [x] **迁移 `LINUX DO Credit 积分.js`** → `src/content/modules/credit/`
  - [x] 悬浮数字小组件（保留可拖拽 + hover 详情）
  - [x] 替换 GM_* API → chrome.storage + fetch
  - [x] 定时刷新 + 手动刷新
  - [x] 暗黑模式适配
- [x] **接入工具栏** — 注册状态条：`积分: +3.42`
- [ ] **接入 Options 页** — 刷新间隔、显示位置、开关

### Phase 3 — 自动浏览模块（Auto Browse） ✅

> 合并两个功能重叠的脚本：`linuxdo-automation.user.js` + `ryen.js`

- [x] **设计统一的自动浏览引擎**
  - [x] 滚动控制器 — 取 ryen.js 的仿真人滚动（wheel burst + micro pause + dwell）
  - [x] 话题列表管理 — 取 automation 的列表扫描 + 已浏览记录
  - [x] 点赞系统 — 取 automation 的 API 点赞 + 上限检测
  - [ ] 必读文章 — 取 ryen.js 的必读列表
  - [ ] 休息机制 — 两者合并，可配置
  - [x] 卡住检测 — 取 automation 的心跳检测
- [x] **控制面板 UI**
  - [x] 速度预设切换（慢/正常/快/极速）
  - [x] 列表来源选择（最新/新帖/未读）
  - [x] 点赞开关 + 概率
  - [x] 运行状态 + 统计数据
  - [x] 面板支持折叠/最小化
- [x] **接入工具栏** — 注册状态条：`已浏览 23 帖 · 点赞 5`
- [x] **接入 Options 页** — 全部高级参数

### Phase 4 — 话题侧栏模块（Side Topic） ✅

- [x] **迁移 `linux-do-side-topic-v0.1.0`** → `src/content/modules/side-topic/`
  - [x] 可拖拽/缩放侧边面板
  - [x] 话题列表 + 实时更新
  - [x] Feed 切换（最新/新帖/未读/排行）
  - [ ] 分类筛选 + 标签筛选
  - [ ] 版本更新检测
- [x] **代码重构** — 原扩展是多文件结构，整合为模块化结构
- [x] **替换存储层** — 原用 chrome.storage 直接调用，改用 utils/settings.js
- [x] **接入工具栏** — 注册状态条：`12 条新内容`
- [x] **接入 Options 页** — 面板默认位置/大小、默认 Feed、筛选预设

### Phase 5 — 快速预览模块（LD Peek） ✅

> 最复杂：621KB，iframe 抽屉 + 自动滚动 + 收藏夹 + 稍后读

- [x] **代码分析与拆分** — 将单文件拆为多个职责模块
  - [x] `button.js` — 悬浮入口（hover 显示，预览+稍后读）
  - [x] `drawer.js` — 抽屉模式（摘要+详情 iframe）
  - [ ] `preview.js` — 话题摘要预览（合并进 drawer）
  - [x] `autoscroll.js` — 自动阅读滚动（微停顿+暂停恢复）
  - [ ] `favorites.js` — 收藏夹 + 稍后读（基础版内置 drawer）
  - [x] `cache.js` — 话题缓存管理
  - [ ] `page-nav.js` — 页面导航记录
- [x] **迁移存储** — GM_* → chrome.storage / localStorage
- [x] **接入工具栏** — 注册状态条：`预览缓存 3`
- [x] **接入 Options 页** — 抽屉尺寸、自动滚动速度、预加载开关

### Phase 6 — 界面美化模块（UI Enhance） ✅

- [x] **暗黑模式增强** — 基于 theme.js 的自动切换 + 手动覆盖
- [x] **布局优化** — 紧凑模式 + 宽屏模式
- [x] **自定义主题** — CSS 变量系统，支持 5 种主题（自动/浅色/深色/护眼绿/雅紫）
- [x] **接入 Options 页** — 主题选择、紧凑模式、宽屏模式

### Phase 7 — 打磨与发布

- [x] **性能优化** — 懒加载模块（Promise.all 并行注册+初始化）、只初始化已启用模块、减少内容脚本体积
- [x] **冲突检测** — 检测并提示与其他扩展/脚本的冲突（原版 LD Peek/automation/credit 脚本）
- [x] **国际化基础** — 预留 i18n 结构（中/英双语，t() 翻译函数）
- ~~[ ] **Chrome Web Store 上架**~~ （用户跳过）
- [x] **文档完善** — README.md 更新（架构、模块清单、开发指南、迁移说明）
- [x] **CI/CD** — GitHub Actions 自动构建

---

## 开发规范

### 新增模块流程

1. 在 `src/content/modules/` 下创建模块目录
2. 实现模块接口（id, name, init, destroy, ...）
3. 在 ModuleManager 中注册
4. 实现 `getStatusBar()` 接入工具栏
5. 实现 `getSettingsSchema()` 接入 Options 页
6. 在 Popup 中自动显示（基于注册信息）

### 从油猴脚本迁移的注意事项

| 油猴 API | 替代方案 |
|----------|---------|
| `GM_setValue / GM_getValue` | `chrome.storage.local` via `utils/storage.js` |
| `GM_addStyle` | `utils/dom.js` 的 `injectStyles()` |
| `GM_xmlhttpRequest` | `utils/request.js`（fetch + 跨域处理） |
| `GM_registerMenuCommand` | 工具栏状态条 + Options 页 |
| `GM_notification` | `chrome.notifications` API |
| `@match` | manifest.json 的 `content_scripts.matches` |
| `@run-at document-idle` | manifest.json 的 `run_at` |
| inline style（被 CSP 拦截） | 使用 CSS 文件 或 `document.createElement('style')` |

### 存储 Key 命名

- 全局配置：`toolkit.global`
- 模块配置：`toolkit.module.{module-id}`
- 统计数据：`toolkit.stats`
- 模块开关：`toolkit.enabledModules`
- 自动备份快照：`toolkit.backups` → `[{ timestamp, version, data }]`（最多 5 份，仅配置不含浏览记录）

---

## 当前参考脚本清单

| 脚本 | 路径 | 功能 | 迁移阶段 |
|------|------|------|---------|
| LINUX DO Credit 积分 | `reference/Tampermonkey/` | 积分实时收入悬浮组件 | Phase 2 |
| linuxdo-automation | `reference/Tampermonkey/` | 自动浏览 + 随机点赞 | Phase 3 |
| ryen.js | `reference/Tampermonkey/` | 自动浏览（仿真人滚动） | Phase 3（合并） |
| linux-do-side-topic | `reference/linux-do-side-topic-v0.1.0/` | 可拖拽侧边话题面板 | Phase 4 |
| LD Peek | `reference/Tampermonkey/` | 快速预览抽屉 + 自动阅读 | Phase 5 |

> 后续新脚本持续加入 `reference/` 目录，按功能分类后对应到开发阶段。
