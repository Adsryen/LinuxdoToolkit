# 贡献指南

感谢你对 LinuxdoToolkit 项目的关注！我们欢迎所有形式的贡献。

## 🤝 如何贡献

### 报告 Bug

使用 [GitHub Issues](https://github.com/Adsryen/LinuxdoToolkit/issues) 报告 bug，请包含：

1. **清晰的标题** - 简要描述问题
2. **详细的描述** - 问题的详细说明
3. **复现步骤** - 如何重现这个问题
4. **预期行为** - 你期望发生什么
5. **实际行为** - 实际发生了什么
6. **环境信息**
   - 浏览器版本（Chrome/Firefox/Edge）
   - 操作系统
   - 扩展版本
7. **截图或录屏** - 如果可能的话

### 提出新功能

使用 [GitHub Issues](https://github.com/Adsryen/LinuxdoToolkit/issues) 提出新功能建议，请包含：

1. **功能描述** - 你想要什么功能
2. **使用场景** - 为什么需要这个功能
3. **实现建议** - 如果有的话
4. **替代方案** - 你考虑过的其他方案

### 提交代码

1. **Fork 项目**

   ```bash
   # 点击 GitHub 页面右上角的 Fork 按钮
   ```

2. **克隆你的 Fork**

   ```bash
   git clone https://github.com/你的用户名/LinuxdoToolkit.git
   cd LinuxdoToolkit
   ```

3. **创建功能分支**

   ```bash
   git checkout -b feature/你的功能名称
   ```

4. **进行修改**

   - 编写代码
   - 添加测试（如果适用）
   - 更新文档

5. **提交更改**

   ```bash
   git add .
   git commit -m "feat: 添加某某功能"
   ```

6. **推送到 GitHub**

   ```bash
   git push origin feature/你的功能名称
   ```

7. **创建 Pull Request**

   - 访问你的 Fork 页面
   - 点击 "New Pull Request" 按钮
   - 填写 PR 描述

## 📝 代码规范

### Git 提交规范

我们使用 [Conventional Commits](https://www.conventionalcommits.org/) 规范：

```
<type>(<scope>): <subject>

<body>

<footer>
```

**类型（type）：**

- `feat`: 新功能
- `fix`: Bug 修复
- `docs`: 文档更新
- `style`: 代码格式（不影响功能）
- `refactor`: 重构
- `perf`: 性能优化
- `test`: 测试
- `chore`: 构建/工具变动

**示例：**

```
feat(ui): 添加暗黑模式切换功能

- 实现暗黑模式 CSS 变量
- 添加切换按钮
- 保存用户偏好设置

Closes #123
```

### JavaScript 代码规范

- 使用 ES6+ 语法
- 使用 `const` 和 `let`，避免 `var`
- 使用箭头函数
- 使用模板字符串
- 使用解构赋值
- 添加适当的注释
- 保持函数简洁

**示例：**

```javascript
// 好的示例
const getUserSettings = async (userId) => {
  try {
    const response = await fetch(`/api/settings/${userId}`)
    return await response.json()
  } catch (error) {
    logger.error('获取用户设置失败:', error)
    throw error
  }
}

// 避免的示例
function getUserSettings(userId, callback) {
  fetch('/api/settings/' + userId)
    .then(function(response) {
      return response.json()
    })
    .then(function(data) {
      callback(null, data)
    })
    .catch(function(error) {
      callback(error)
    })
}
```

### CSS 代码规范

- 使用 CSS 变量
- 使用 BEM 命名规范
- 避免使用 `!important`
- 保持选择器简洁

**示例：**

```css
/* 好的示例 */
.module-card {
  background: var(--bg-color);
  border-radius: 8px;
  padding: 16px;
}

.module-card__title {
  font-size: 16px;
  font-weight: 600;
}

.module-card--highlighted {
  border: 2px solid var(--primary-color);
}

/* 避免的示例 */
#module .card .title {
  font-size: 16px !important;
}
```

## 🧪 测试

### 运行测试

```bash
npm test
```

### 编写测试

- 为新功能添加测试
- 为 Bug 修复添加回归测试
- 保持测试简洁明了

**示例：**

```javascript
import { describe, it, expect } from 'vitest'
import { debounce } from '../utils'

describe('debounce', () => {
  it('应该延迟执行函数', async () => {
    let count = 0
    const fn = debounce(() => count++, 100)
    
    fn()
    fn()
    fn()
    
    expect(count).toBe(0)
    
    await new Promise(resolve => setTimeout(resolve, 150))
    expect(count).toBe(1)
  })
})
```

## 📚 开发环境

### 环境要求

- Node.js >= 16.0.0
- npm >= 8.0.0 或 yarn >= 1.22.0 或 pnpm >= 7.0.0

### 设置开发环境

```bash
# 1. Fork 并克隆项目
git clone https://github.com/你的用户名/LinuxdoToolkit.git
cd LinuxdoToolkit

# 2. 安装依赖
npm install

# 3. 启动开发模式
npm run dev

# 4. 在浏览器中加载扩展
# Chrome: chrome://extensions/ -> 开发者模式 -> 加载已解压的扩展程序
```

### 开发命令

```bash
npm run dev          # 启动开发服务器（热更新）
npm run build        # 构建生产版本
npm run lint         # 代码检查
npm run lint:fix     # 自动修复代码问题
npm run format       # 代码格式化
npm run test         # 运行测试
npm run test:ui      # 运行测试（带 UI）
npm run clean        # 清理构建文件
```

## 🎯 项目结构

```
LinuxdoToolkit/
├── src/
│   ├── manifest.json        # 扩展配置
│   ├── background/          # 后台脚本
│   ├── content/             # 内容脚本
│   │   └── modules/         # 功能模块
│   ├── popup/               # 弹出窗口
│   ├── options/             # 设置页面
│   ├── components/          # 公共组件
│   ├── utils/               # 工具函数
│   └── styles/              # 公共样式
├── public/                  # 静态资源
├── reference/               # 参考脚本
├── tests/                   # 测试文件
└── scripts/                 # 构建脚本
```

## 📋 Pull Request 检查清单

在提交 PR 之前，请确保：

- [ ] 代码符合项目规范
- [ ] 已添加必要的测试
- [ ] 所有测试通过
- [ ] 已更新相关文档
- [ ] 提交信息符合规范
- [ ] 没有语法错误
- [ ] 没有 console.log 调试代码

## 🏷️ Issue 标签

我们使用以下标签分类 Issue：

- `bug` - Bug 报告
- `enhancement` - 功能增强
- `documentation` - 文档相关
- `good first issue` - 适合新手
- `help wanted` - 需要帮助
- `question` - 问题咨询

## 📞 联系我们

如果你有任何问题，可以通过以下方式联系我们：

- [GitHub Issues](https://github.com/Adsryen/LinuxdoToolkit/issues)
- [GitHub Discussions](https://github.com/Adsryen/LinuxdoToolkit/discussions)

## 🙏 致谢

感谢所有贡献者的付出！

[![Contributors](https://contrib.rocks/image?repo=Adsryen/LinuxdoToolkit)](https://github.com/Adsryen/LinuxdoToolkit/graphs/contributors)
