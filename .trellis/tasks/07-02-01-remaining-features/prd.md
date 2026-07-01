# 完成 LinuxdoToolkit 剩余功能开发

> 父任务 — 统筹 todo.md 中 Phase 1-5 所有未完成功能项

## 背景

LinuxdoToolkit 是一个将 Linux.do 社区多个油猴脚本融合为一站式浏览器扩展的项目。已完成 Phase 0（基础设施）、Phase 2-7 的核心功能，但各模块仍有功能待完善。本任务统筹所有剩余工作。

## 子任务

| 子任务 | Phase | 内容 | 优先级 |
|--------|-------|------|--------|
| 01a-options-form | 1 | 通用表单渲染器 + 快捷键配置 | P1 |
| 01b-credit-options | 2 | 积分模块 Options 接入 | P2 |
| 01c-auto-browse-extras | 3 | 必读文章 + 休息机制 | P2 |
| 01d-side-topic-extras | 4 | 分类/标签筛选 + 版本检测 | P2 |
| 01e-peek-extras | 5 | 摘要预览 + 收藏夹 + 页面导航 | P2 |

## 约束

- 所有修改限于 `src/` 目录，不改变构建配置
- 遵循现有 Module 基类接口（`src/content/modules/base.js`）
- 存储使用 `chrome.storage.local`，key 前缀 `toolkit.`
- 模块间通信通过 message passing（background ↔ content）

## 验收标准

- [ ] 所有子任务完成并通过各自验收
- [ ] `npm run build` 构建成功
- [ ] 扩展可在 Chrome 中正常加载，无控制台错误
- [ ] 已有功能无回归