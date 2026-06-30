# 图标说明

本目录存放扩展的图标文件。

## 需要的图标尺寸

为了确保在不同场景下都能正常显示，需要以下尺寸的图标：

| 文件名 | 尺寸 | 用途 |
|--------|------|------|
| `icon16.png` | 16x16 | 扩展管理页面、标签页图标 |
| `icon32.png` | 32x32 | 扩展管理页面、Windows 任务栏 |
| `icon48.png` | 48x48 | 扩展管理页面、Chrome Web Store |
| `icon128.png` | 128x128 | Chrome Web Store、安装时显示 |

## 图标设计规范

### 设计要求

1. **简洁明了** - 图标应该简单易识别
2. **品牌一致** - 与项目品牌形象保持一致
3. **可识别性** - 在小尺寸下也能清晰辨认
4. **专业感** - 体现工具的专业性

### 设计建议

- 使用与 Linux.do 社区相关的元素
- 考虑使用工具箱、扳手、齿轮等工具类图标
- 颜色建议使用蓝色系（#1890ff）
- 避免过多细节，保持简洁

### 推荐工具

- [Figma](https://www.figma.com/) - 在线设计工具
- [Adobe Illustrator](https://www.adobe.com/products/illustrator.html) - 专业矢量设计
- [Inkscape](https://inkscape.org/) - 免费开源矢量设计
- [IconKitchen](https://icon.kitchen/) - 在线图标生成器

## 如何添加图标

1. 设计图标（建议使用 SVG 格式作为源文件）
2. 导出为 PNG 格式，分别生成上述 4 种尺寸
3. 将文件放入此目录
4. 确保文件名与 `manifest.json` 中的配置一致

## 临时图标

在正式图标设计完成之前，可以使用以下方式生成临时图标：

### 使用 Canvas 生成简单图标

```javascript
function generateIcon(size) {
  const canvas = document.createElement('canvas')
  canvas.width = size
  canvas.height = size
  const ctx = canvas.getContext('2d')

  // 背景
  ctx.fillStyle = '#1890ff'
  ctx.beginPath()
  ctx.arc(size / 2, size / 2, size / 2, 0, Math.PI * 2)
  ctx.fill()

  // 文字
  ctx.fillStyle = '#ffffff'
  ctx.font = `bold ${size * 0.4}px Arial`
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillText('LT', size / 2, size / 2)

  return canvas.toDataURL('image/png')
}
```

## 许可证

图标文件遵循项目主许可证（MIT License）。
