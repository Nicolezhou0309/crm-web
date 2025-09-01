# 📱 小红书自动发布功能集成

## 🎯 功能概述

本项目已成功集成小红书自动发布测试功能，支持：

- ✅ 自动唤端小红书App
- ✅ 自动打开发帖页面
- ✅ 自动填充文案内容
- ✅ 智能降级到网页版
- ✅ 多图片上传和预览
- ✅ 响应式设计，支持移动端

## 🚀 使用方法

### 1. 访问功能页面

#### 桌面端
在项目侧边栏菜单中找到 **"小红书工具"** → **"自动发布测试"**

#### 移动端
在底部导航栏中点击 **"小红书"** 标签页

或者直接访问：`/xiaohongshu-test`

### 2. 填写内容

- **标题**：输入笔记标题
- **内容**：输入笔记正文内容
- **话题标签**：用逗号分隔多个话题
- **图片上传**：支持拖拽上传多张图片
- **发布方式**：选择App、网页版或两者都尝试

### 3. 执行测试

点击 **"🚀 测试小红书发布"** 按钮，系统将：

1. 自动复制内容到剪贴板
2. 尝试唤端小红书App
3. 如果App未安装，自动打开网页版
4. 提供实时状态反馈

## ⌨️ 快捷键

- **Ctrl/Cmd + Enter**：快速执行测试
- **Ctrl/Cmd + C**：复制内容到剪贴板

## 🔧 技术实现

### 核心功能

```typescript
// 自动唤端
const tryOpenApp = async () => {
  const urlSchemes = [
    'xiaohongshu://publish',
    'xhs://publish', 
    'xhs://compose'
  ];
  // 尝试多种URL Scheme
};

// 智能降级
const executePublishStrategy = async (publishMethod: string) => {
  if (publishMethod === 'app' || publishMethod === 'both') {
    const appOpened = await tryOpenApp();
    if (!appOpened && publishMethod === 'app') {
      openWebVersion(); // 自动降级
    }
  }
};
```

### 设备检测

```typescript
const detectDevice = () => {
  const userAgent = navigator.userAgent;
  if (/iPhone|iPad|iPod/.test(userAgent)) {
    setDeviceType('iOS');
  } else if (/Android/.test(userAgent)) {
    setDeviceType('Android');
  } else {
    setDeviceType('Desktop');
  }
};
```

## 📱 移动端支持

- **响应式设计**：完美适配手机和平板
- **触摸优化**：支持触摸操作和手势
- **设备检测**：针对移动设备优化唤端策略
- **底部导航**：集成到移动端底部导航栏
- **移动端优化**：按钮垂直排列，图片上传适配移动端

## 🌐 浏览器兼容性

- **现代浏览器**：Chrome、Firefox、Safari、Edge
- **移动端浏览器**：iOS Safari、Android Chrome
- **剪贴板API**：支持现代剪贴板API，自动降级

## 🔍 故障排除

### 常见问题

1. **唤端失败**
   - 确保已安装小红书App
   - 检查设备权限设置
   - 尝试手动打开小红书App

2. **剪贴板复制失败**
   - 检查浏览器权限
   - 尝试手动复制
   - 使用降级方案

3. **图片上传问题**
   - 检查图片格式（支持JPG、PNG、GIF）
   - 确保图片大小合理
   - 尝试重新上传

### 调试信息

打开浏览器控制台查看详细日志：

```javascript
// 设备类型检测
console.log('检测到设备类型:', deviceType);

// 唤端状态
console.log('页面隐藏 - 可能已切换到小红书App');
console.log('页面显示 - 回到测试页面');
```

## 📋 更新日志

### v1.0.0 (2025-01-XX)
- ✨ 新增小红书自动发布测试功能
- ✨ 支持多种URL Scheme唤端
- ✨ 智能降级到网页版
- ✨ 多图片上传和预览
- ✨ 响应式设计和移动端支持
- ✨ 键盘快捷键支持
- ✨ 集成到移动端底部导航栏
- ✨ 移动端UI优化（按钮垂直排列、图片上传适配）

## 🤝 贡献指南

如需改进此功能，请：

1. Fork项目
2. 创建功能分支
3. 提交更改
4. 创建Pull Request

## 📄 许可证

本项目基于MIT许可证开源。

---

**注意**：此功能仅用于测试和学习目的，请遵守小红书平台的使用条款和相关法律法规。
