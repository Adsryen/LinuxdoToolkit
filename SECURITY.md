# 安全政策

## 支持的版本

| 版本 | 支持状态 |
| --- | --- |
| 1.0.x | ✅ 支持 |
| < 1.0 | ❌ 不支持 |

## 报告漏洞

我们非常重视安全问题。如果你发现了安全漏洞，请**不要**通过公开的 Issue 报告。

### 如何报告

1. **通过 GitHub Security Advisories（推荐）**
   
   访问 [GitHub Security](https://github.com/Adsryen/LinuxdoToolkit/security/advisories/new) 提交安全报告。

2. **通过邮件**
   
   发送邮件至项目维护者，邮件标题请包含 `[Security]` 前缀。

### 报告内容

请包含以下信息：

- 漏洞的详细描述
- 复现步骤
- 影响范围
- 可能的修复建议（如果有）

### 响应时间

- **确认收到**：24 小时内
- **初步评估**：72 小时内
- **修复发布**：根据严重程度，7-30 天内

### 严重程度分类

| 严重程度 | 描述 | 响应时间 |
|---------|------|---------|
| 🔴 严重 | 远程代码执行、数据泄露 | 24 小时内修复 |
| 🟠 高危 | 权限提升、敏感信息泄露 | 72 小时内修复 |
| 🟡 中危 | 功能绕过、信息泄露 | 7 天内修复 |
| 🟢 低危 | 非敏感信息泄露、UI 问题 | 30 天内修复 |

## 安全最佳实践

### 对于用户

1. **保持更新** - 始终使用最新版本
2. **权限审查** - 定期检查扩展权限
3. **来源可信** - 只从官方渠道安装

### 对于开发者

1. **代码审查** - 所有 PR 需要审查
2. **依赖检查** - 定期更新依赖，检查已知漏洞
3. **最小权限** - 只请求必要的权限
4. **输入验证** - 验证所有用户输入
5. **内容安全** - 使用 CSP 防止 XSS

## 安全相关配置

### Content Security Policy

本扩展使用严格的 CSP：

```json
{
  "content_security_policy": {
    "extension_pages": "script-src 'self'; object-src 'self'"
  }
}
```

### 权限说明

| 权限 | 用途 | 必要性 |
|------|------|--------|
| `storage` | 存储用户设置 | 必需 |
| `activeTab` | 访问当前标签页 | 必需 |
| `notifications` | 显示桌面通知 | 可选 |

## 安全更新

安全更新会通过以下方式通知：

1. **GitHub Security Advisories** - 自动通知
2. **Release Notes** - 标注安全修复
3. **README** - 重大安全更新

## 致谢

感谢所有报告安全问题的研究人员！

## 相关链接

- [GitHub Security Policy](https://github.com/Adsryen/LinuxdoToolkit/security/policy)
- [Chrome 扩展安全最佳实践](https://developer.chrome.com/docs/extensions/mv3/security/)
- [Firefox 扩展安全指南](https://extensionworkshop.com/documentation/develop/add-on-security-guidelines/)
