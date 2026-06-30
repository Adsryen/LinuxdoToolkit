<div align="center">

# 🚀 LinuxdoToolkit

**将 Linux.do 社区的油猴脚本与单功能扩展融合为一站式浏览器扩展**

[![GitHub stars](https://img.shields.io/github/stars/Adsryen/LinuxdoToolkit?style=social)](https://github.com/Adsryen/LinuxdoToolkit/stargazers)
[![GitHub issues](https://img.shields.io/github/issues/Adsryen/LinuxdoToolkit)](https://github.com/Adsryen/LinuxdoToolkit/issues)
[![GitHub license](https://img.shields.io/github/license/Adsryen/LinuxdoToolkit)](https://github.com/Adsryen/LinuxdoToolkit/blob/main/LICENSE)

</div>

---

## 📖 简介

**LinuxdoToolkit** 是一个 Manifest V3 浏览器扩展，将网络上所有适配 [Linux.do](https://linux.do) 社区的油猴脚本和单功能扩展整合到一个统一的扩展中。

### 🎯 为什么需要这个项目？

- ✅ **告别脚本混乱** - 不再需要安装多个油猴脚本
- ✅ **统一管理** - 一个扩展管理所有功能
- ✅ **性能优化** - 模块懒加载，避免多个脚本冲突
- ✅ **冲突检测** - 自动检测并提示与其他脚本的冲突
- ✅ **数据备份** - 完整的配置备份与恢复系统

---

## ✨ 功能模块

| 模块 | 图标 | 说明 | 来源 |
|------|------|------|------|
| **积分监控** | 💰 | 实时积分收入悬浮小组件，可拖拽 | [LINUX DO Credit 积分](https://greasyfork.org/scripts/560312) |
| **自动浏览** | 🔄 | 自动浏览帖子、随机点赞、仿真人滚动 | [linuxdo-automation](https://greasyfork.org/scripts/490382) + ryen.js |
| **话题侧栏** | 📋 | 可拖拽/缩放侧边面板，Feed 切换 | [linux-do-side-topic](https://github.com/Adsryen/LinuxdoToolkit/tree/main/reference) |
| **快速预览** | 👁️ | 悬浮入口 + 抽屉预览 + 自动阅读 | [LD Peek](https://greasyfork.org/scripts/584017) |
| **界面美化** | 🎨 | 暗黑模式增强、5 种主题、紧凑/宽屏模式 | 内置 |

### 架构特点

- **模块化设计** - 基于 Module 基类，统一生命周期管理
- **懒加载** - 模块按需 import，不阻塞页面加载
- **三层交互** - Popup（极简控制）→ 工具栏（状态聚合）→ 模块面板（专属 UI）
- **数据安全** - 自动备份、快照回滚、JSON 导入导出

---

## 📦 安装方法

### 手动安装（开发者模式）

1. **下载项目**

   ```bash
   git clone https://github.com/Adsryen/LinuxdoToolkit.git
   cd LinuxdoToolkit
   ```

2. **安装依赖并构建**

   ```bash
   npm install
   npm run build
   ```

3. **加载到 Chrome**

   - 打开 `chrome://extensions/`
   - 开启「开发者模式」
   - 点击「加载已解压的扩展程序」
   - 选择 `dist` 目录

4. **访问 [linux.do](https://linux.do)**，扩展自动激活 🎉

---

## 🛠️ 开发

### 环境要求

- Node.js >= 18
- npm 或 pnpm

### 开发命令

```bash
npm install          # 安装依赖
npm run dev          # 开发构建（watch 模式）
npm run build        # 生产构建
npm run lint         # 代码检查
```

### 项目结构

```
src/
├── manifest.json              # MV3 清单
├── background/index.js        # Service Worker（消息中转、备份、自动备份）
├── content/
│   ├── index.js               # 内容脚本入口
│   ├── modules/
│   │   ├── base.js            # Module 基类（生命周期接口）
│   │   ├── index.js           # ModuleManager（注册、开关、通信）
│   │   ├── credit/            # 💰 积分监控（2 文件）
│   │   ├── auto-browse/       # 🔄 自动浏览（5 文件）
│   │   ├── side-topic/        # 📋 话题侧栏（3 文件）
│   │   ├── peek/              # 👁️ 快速预览（5 文件）
│   │   └── ui-enhance/        # 🎨 界面美化（1 文件）
│   └── toolbar/               # 统一浮动工具栏
├── popup/                     # Popup 弹窗
├── options/                   # Options 设置页
├── styles/                    # 全局样式 + 主题 CSS 变量
└── utils/                     # 工具库（14 个模块）
    ├── settings.js            # 统一配置管理
    ├── storage.js             # chrome.storage 封装
    ├── request.js             # 网络请求（fetch + CSRF）
    ├── navigation.js          # SPA 导航检测
    ├── theme.js               # 主题检测
    ├── events.js              # 模块间事件总线
    ├── z-index.js             # z-index 层级管理
    ├── dom.js                 # DOM 工具
    ├── backup.js              # 备份与恢复
    ├── conflict.js            # 冲突检测
    └── i18n.js                # 国际化（中/英）
```

### 新增模块流程

1. 在 `src/content/modules/` 下创建目录
2. 继承 `Module` 基类：

```javascript
import { Module } from '../base.js'

export class MyModule extends Module {
  constructor() {
    super({
      id: 'my-module',
      name: '我的模块',
      icon: '✨',
      description: '模块描述',
      category: 'efficiency',
    })
  }

  async onInit(settings) { /* 初始化 */ }
  onDestroy() { /* 清理 DOM/定时器/事件 */ }
  async onEnable() { /* 启用 */ }
  async onDisable() { /* 禁用 */ }
  onPageChange(url, pageType) { /* 页面变化 */ }
  getStatusBar() { return { text: '状态文本' } }
  getSettingsSchema() { return { fields: [...] } }
}
```

3. 在 `ModuleManager._registerBuiltInModules()` 中注册：

```javascript
import('./my-module/index.js').then(({ MyModule }) => this.register(MyModule))
```

### 从油猴脚本迁移

| 油猴 API | 替代方案 |
|----------|---------|
| `GM_setValue / GM_getValue` | `chrome.storage.local` via `settings.js` |
| `GM_addStyle` | `document.createElement('style')` |
| `GM_xmlhttpRequest` | `fetch`（manifest.json 的 `host_permissions`） |
| `GM_registerMenuCommand` | 工具栏状态条 + Options 页 |
| `GM_notification` | `chrome.notifications` API |
| `@match` | manifest.json 的 `content_scripts.matches` |
| inline style（被 CSP 拦截） | CSS 文件 或 `document.createElement('style')` |

---

## 🤝 贡献指南

1. **Fork** 本项目
2. **创建** 功能分支 (`git checkout -b feature/AmazingFeature`)
3. **提交** 更改 (`git commit -m 'feat: add AmazingFeature'`)
4. **推送** 分支 (`git push origin feature/AmazingFeature`)
5. **打开** Pull Request

提交规范使用 [Conventional Commits](https://www.conventionalcommits.org/)：

```
feat(module): 添加新功能
fix(credit): 修复积分刷新失败
docs(readme): 更新安装说明
```

---

## 🗺️ 开发进度

| Phase | 名称 | 状态 |
|-------|------|------|
| 0 | 基础设施（utils、存储、请求、导航、事件） | ✅ |
| 1 | 模块管理器 + Popup + Options + 工具栏 | ✅ |
| 2 | 积分监控模块 | ✅ |
| 3 | 自动浏览模块（合并两个脚本） | ✅ |
| 4 | 话题侧栏模块 | ✅ |
| 5 | 快速预览模块（精简版 LD Peek） | ✅ |
| 6 | 界面美化模块 | ✅ |
| 7 | 打磨与发布 | 🚧 |

---

## 🙏 致谢

- [Linux.do](https://linux.do) - 优秀的技术社区
- [Chenyme](https://greasyfork.org/users/chenyme) - 积分监控脚本作者
- [kaibush](https://greasyfork.org/users/kaibush) - LD Peek 作者
- [ryen](https://greasyfork.org/users/ryen) - 自动浏览脚本作者
- 所有油猴脚本作者的辛勤付出

---

## 📄 许可证

[MIT License](LICENSE)

---

<div align="center">

**如果这个项目对你有帮助，请给我们一个 ⭐️ Star！**

</div>
