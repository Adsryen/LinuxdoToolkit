# 话题侧栏筛选与版本检测

> Phase 4 剩余项：分类筛选 + 标签筛选 + 版本更新检测

## 背景

话题侧栏模块（`src/content/modules/side-topic/`）已实现核心功能：可拖拽/缩放面板、Feed 切换（最新/新帖/未读/排行）、定时刷新。但缺少分类筛选和标签筛选功能，原始扩展（`reference/linux-do-side-topic-v0.1.0/`）的版本更新检测也未实现。

## 需求

### 1. 分类筛选

在侧栏面板顶部添加分类下拉选择器：

- 获取 linux.do 的分类列表（通过 API 或解析页面）
- 选择分类后，话题列表仅显示该分类下的帖子
- "全部"选项显示所有分类
- 分类选择持久化到 `toolkit.module.side-topic` 的 `categoryFilter` 字段

**API 参考**：linux.do 分类页面 `/c/<category-slug>/<category-id>`，可能需要解析 `/categories` 页面获取分类列表。

### 2. 标签筛选

在侧栏面板添加标签筛选输入框：

- 支持输入标签名模糊搜索
- 选中标签后，话题列表过滤包含该标签的帖子
- 支持多标签组合（AND 逻辑）
- 标签筛选持久化到 `toolkit.module.side-topic` 的 `tagFilters` 字段

### 3. 版本更新检测

- 定期检查 GitHub Releases 是否有新版本
- 有新版本时在侧栏底部显示更新提示（版本号 + 链接）
- 检查间隔：24 小时
- 最后检查时间持久化到 `toolkit.module.side-topic` 的 `lastVersionCheck` 字段

## 关键文件

- `src/content/modules/side-topic/index.js` — 添加筛选和版本检测逻辑
- `src/content/modules/side-topic/panel.js` — 侧栏面板 UI 添加筛选控件
- `src/content/modules/side-topic/topics.js` — 话题数据层支持筛选参数
- `src/content/modules/side-topic/filters.js` — 筛选器实现（已创建文件，待实现）

## 约束

- 分类列表优先从页面 DOM 解析（避免额外 API 请求），失败时回退到 API
- 标签筛选为纯客户端过滤（不发起额外请求）
- 版本检测静默失败，不影响侧栏正常使用

## 验收标准

- [ ] 侧栏面板顶部有分类下拉选择器
- [ ] 选择分类后话题列表正确过滤
- [ ] 标签输入框可模糊搜索并添加标签
- [ ] 多标签组合过滤正确（AND 逻辑）
- [ ] 筛选条件持久化，页面刷新后保留
- [ ] 有新版本时侧栏底部显示更新提示
- [ ] 版本检测不影响侧栏性能
- [ ] `npm run build` 构建成功