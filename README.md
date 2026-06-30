<div align="center">

# 🚀 LinuxdoToolkit

**将 Linux.do 社区的油猴脚本整合为一站式浏览器扩展**

[![GitHub stars](https://img.shields.io/github/stars/Adsryen/LinuxdoToolkit?style=social)](https://github.com/Adsryen/LinuxdoToolkit/stargazers)
[![GitHub issues](https://img.shields.io/github/issues/Adsryen/LinuxdoToolkit)](https://github.com/Adsryen/LinuxdoToolkit/issues)
[![GitHub license](https://img.shields.io/github/license/Adsryen/LinuxdoToolkit)](https://github.com/Adsryen/LinuxdoToolkit/blob/main/LICENSE)

</div>

---

## 📖 简介

**LinuxdoToolkit** 是一个浏览器扩展，旨在将网络上所有适配 [Linux.do](https://linux.do) 社区的油猴脚本整合到一个统一的扩展中。

### 🎯 为什么需要这个项目？

- ✅ **告别脚本混乱** - 不再需要安装多个油猴脚本
- ✅ **统一管理** - 一个扩展管理所有功能
- ✅ **性能优化** - 避免多个脚本冲突和重复加载
- ✅ **持续更新** - 集中维护，确保兼容性
- ✅ **开箱即用** - 无需手动配置油猴环境

---

## ✨ 功能特性

### 🔧 核心功能

| 功能分类 | 功能描述 | 状态 |
|---------|---------|------|
| 🎨 界面美化 | 优化页面布局、主题切换、暗黑模式 | 🚧 开发中 |
| 📊 数据统计 | 帖子热度、用户活跃度、数据可视化 | 📋 计划中 |
| ⚡ 效率工具 | 快捷键、自动签到、快速回复 | 📋 计划中 |
| 🔔 消息通知 | 实时提醒、桌面通知、消息管理 | 📋 计划中 |
| 🛡️ 安全增强 | 广告过滤、隐私保护、内容净化 | 📋 计划中 |
| 📱 体验优化 | 无限滚动、图片预览、代码高亮 | 📋 计划中 |

### 🎨 特色功能

- **模块化设计** - 按需启用/禁用功能
- **自定义配置** - 灵活的设置选项
- **主题系统** - 支持自定义主题
- **快捷键支持** - 提高操作效率
- **数据同步** - 配置云端同步（计划中）

---

## 📦 安装方法

### 方式一：Chrome 应用商店（推荐）

> 🚧 敬请期待，即将上架

### 方式二：手动安装（开发者模式）

1. **下载项目**

   ```bash
   git clone https://github.com/Adsryen/LinuxdoToolkit.git
   ```

2. **打开 Chrome 扩展管理页面**

   - 在地址栏输入：`chrome://extensions/`
   - 或者：菜单 → 更多工具 → 扩展程序

3. **启用开发者模式**

   - 打开右上角的"开发者模式"开关

4. **加载扩展**

   - 点击"加载已解压的扩展程序"
   - 选择项目中的 `dist` 或 `src` 文件夹

5. **完成安装** 🎉

   - 扩展图标将出现在浏览器工具栏

### 方式三：Firefox 附加组件

> 📋 计划支持，敬请期待

---

## 🚀 使用说明

### 基本使用

1. **安装完成后**，点击浏览器工具栏中的扩展图标
2. **访问 [Linux.do](https://linux.do)**，扩展将自动激活
3. **在设置中**启用你需要的功能模块

### 功能模块管理

```
扩展图标 → 设置 → 功能模块
├── 界面美化
│   ├── 暗黑模式
│   ├── 自定义主题
│   └── 布局调整
├── 效率工具
│   ├── 快捷键
│   ├── 自动签到
│   └── 快速回复
└── 更多模块...
```

### 快捷键

| 快捷键 | 功能 |
|--------|------|
| `Ctrl + Shift + L` | 打开扩展设置 |
| `Ctrl + Shift + D` | 切换暗黑模式 |
| `Ctrl + Shift + R` | 快速回复 |
| *更多快捷键...* | *可在设置中自定义* |

---

## 🛠️ 开发指南

### 环境要求

- **Node.js** >= 16.0.0
- **npm** >= 8.0.0 或 **yarn** >= 1.22.0 或 **pnpm** >= 7.0.0

### 项目结构

```
LinuxdoToolkit/
├── src/
│   ├── manifest.json        # 扩展配置文件
│   ├── background/          # 后台脚本
│   │   └── index.js
│   ├── content/             # 内容脚本（注入到页面）
│   │   ├── index.js
│   │   └── modules/
│   │       ├── ui/          # 界面美化模块
│   │       ├── tools/       # 效率工具模块
│   │       └── ...
│   ├── popup/               # 弹出窗口
│   │   ├── index.html
│   │   ├── index.js
│   │   └── styles.css
│   ├── options/             # 设置页面
│   │   ├── index.html
│   │   ├── index.js
│   │   └── styles.css
│   ├── components/          # 公共组件
│   ├── utils/               # 工具函数
│   └── styles/              # 公共样式
├── public/                  # 静态资源
│   └── icons/               # 扩展图标
├── reference/               # 参考脚本（油猴脚本收集）
├── dist/                    # 构建输出
├── scripts/                 # 构建脚本
├── tests/                   # 测试文件
├── .github/                 # GitHub 配置
│   └── workflows/           # CI/CD 流程
├── package.json
├── vite.config.js           # Vite 配置
├── tsconfig.json            # TypeScript 配置（可选）
├── README.md
├── LICENSE
└── .gitignore
```

### 快速开始

```bash
# 1. 克隆项目
git clone https://github.com/Adsryen/LinuxdoToolkit.git
cd LinuxdoToolkit

# 2. 安装依赖
npm install
# 或
yarn install
# 或
pnpm install

# 3. 启动开发模式
npm run dev

# 4. 构建生产版本
npm run build
```

### 开发命令

```bash
npm run dev          # 启动开发服务器（热更新）
npm run build        # 构建生产版本
npm run lint         # 代码检查
npm run format       # 代码格式化
npm run test         # 运行测试
npm run clean        # 清理构建文件
```

### 添加新功能模块

1. **创建模块目录**

   ```bash
   mkdir src/content/modules/your-module
   ```

2. **创建模块文件**

   ```javascript
   // src/content/modules/your-module/index.js
   export default {
     name: 'your-module',
     description: '模块描述',
     enabled: true,
     
     // 初始化
     init() {
       console.log('模块已初始化')
     },
     
     // 启用
     enable() {
       // 启用逻辑
     },
     
     // 禁用
     disable() {
       // 禁用逻辑
     }
   }
   ```

3. **注册模块**

   在 `src/content/modules/index.js` 中注册：

   ```javascript
   import yourModule from './your-module'
   
   export const modules = [
     // ... 其他模块
     yourModule
   ]
   ```

---

## 🤝 贡献指南

我们欢迎所有形式的贡献！

### 如何贡献

1. **Fork** 本项目
2. **创建** 你的功能分支 (`git checkout -b feature/AmazingFeature`)
3. **提交** 你的更改 (`git commit -m 'Add some AmazingFeature'`)
4. **推送到** 分支 (`git push origin feature/AmazingFeature`)
5. **打开** Pull Request

### 贡献类型

- 🐛 **Bug 修复** - 报告或修复 bug
- ✨ **新功能** - 提出或实现新功能
- 📝 **文档** - 改进文档
- 🎨 **界面** - UI/UX 改进
- 🌐 **翻译** - 多语言支持
- 💡 **建议** - 提出改进建议

### 提交规范

我们使用 [Conventional Commits](https://www.conventionalcommits.org/) 规范：

```
<type>(<scope>): <subject>

# 示例
feat(ui): 添加暗黑模式切换功能
fix(tools): 修复自动签到失败问题
docs(readme): 更新安装说明
```

### 报告 Bug

使用 [GitHub Issues](https://github.com/Adsryen/LinuxdoToolkit/issues) 报告 bug，请包含：

- 清晰的标题和描述
- 复现步骤
- 预期行为 vs 实际行为
- 浏览器版本和操作系统
- 截图或录屏（如果可能）

---

## 📚 相关资源

### 参考脚本

本项目收集了以下油猴脚本作为参考（存放在 `reference/` 目录）：

- 更多脚本持续收集中...

### 相关链接

- [Linux.do 社区](https://linux.do)
- [Chrome 扩展开发文档](https://developer.chrome.com/docs/extensions/)
- [Firefox 扩展开发文档](https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions)
- [Vite 官方文档](https://vitejs.dev/)

---

## 🗺️ 开发路线图

### Phase 1 - 基础框架 ✅

- [x] 项目初始化
- [x] 基础架构搭建
- [ ] 核心模块加载系统
- [ ] 设置管理系统

### Phase 2 - 核心功能 🚧

- [ ] 界面美化模块
- [ ] 效率工具模块
- [ ] 基础设置页面

### Phase 3 - 高级功能 📋

- [ ] 数据统计模块
- [ ] 消息通知模块
- [ ] 安全增强模块
- [ ] 主题系统

### Phase 4 - 发布与优化 📋

- [ ] Chrome 应用商店上架
- [ ] Firefox 附加组件上架
- [ ] 性能优化
- [ ] 用户反馈收集

---

## 🙏 致谢

感谢以下项目和社区的启发：

- [Linux.do](https://linux.do) - 优秀的技术社区
- 所有油猴脚本作者的辛勤付出
- 开源社区的无私贡献

---

## 📄 许可证

本项目采用 [MIT 许可证](LICENSE) 开源。

---

<div align="center">

**如果这个项目对你有帮助，请给我们一个 ⭐️ Star！**

[![Star History Chart](https://api.star-history.com/svg?repos=Adsryen/LinuxdoToolkit&type=Date)](https://star-history.com/#Adsryen/LinuxdoToolkit&Date)

</div>
