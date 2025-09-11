# 头像日志控制指南

## 概述

已为头像系统添加了详细的控制台日志，帮助调试头像加载、重试和缓存过程。所有日志都包含时间戳、组件信息和相关数据。

## 日志类型

### 🎯 初始加载日志
```
🎯 初始加载图片: { initialSrc, timestamp, hook: 'useImageRetry' }
```

### 🚀 开始加载日志
```
🚀 开始加载图片: { src, timestamp, hook: 'useImageRetry' }
```

### ✅ 成功加载日志
```
✅ 图片加载成功: { originalSrc, loadedSrc, timestamp, hook: 'useImageRetry' }
✅ 头像加载成功: { src, size, shape, timestamp, component: 'AvatarWithRetry' }
✅ 头像URL获取成功: { avatarUrl, userId, timestamp, context: 'UserContext' }
```

### ❌ 失败日志
```
❌ 图片加载最终失败: { src, error, retryCount, timestamp, hook: 'useImageRetry' }
❌ 头像加载失败: { error, src, size, shape, timestamp, component: 'AvatarWithRetry' }
❌ 获取头像URL最终失败: { error, userId, timestamp, context: 'UserContext' }
```

### 🔄 重试日志
```
🔄 图片加载失败，第1次重试: { src, error, attempt, maxRetries, delay, timestamp, hook: 'useImageRetry' }
🔄 手动重试图片: { src, previousRetryCount, timestamp, hook: 'useImageRetry' }
🔄 头像URL获取失败，第1次重试: { error, attempt, userId, delay, timestamp, context: 'UserContext' }
```

### 💾 缓存日志
```
💾 使用缓存的头像URL: { avatarUrl, cacheAge, profileId, timestamp, context: 'UserContext' }
```

### 🔧 状态变更日志
```
🔄 设置新的图片源: { previousSrc, newSrc, action, timestamp, hook: 'useImageRetry' }
🔄 重置图片状态: { previousSrc, timestamp, hook: 'useImageRetry' }
```

## 日志控制工具

### 基本使用

在浏览器控制台中，可以使用以下命令控制头像日志：

```javascript
// 启用/禁用所有头像日志
avatarLogger.enable(true);   // 启用
avatarLogger.enable(false);  // 禁用

// 设置日志级别
avatarLogger.setLogLevel('debug');  // 显示所有日志
avatarLogger.setLogLevel('info');   // 显示信息、警告和错误
avatarLogger.setLogLevel('warn');   // 只显示警告和错误
avatarLogger.setLogLevel('error');  // 只显示错误

// 添加过滤器（只显示特定组件的日志）
avatarLogger.addFilter('UserContext');     // 只显示UserContext相关日志
avatarLogger.addFilter('useImageRetry');   // 只显示useImageRetry相关日志
avatarLogger.addFilter('AvatarWithRetry'); // 只显示AvatarWithRetry相关日志

// 移除过滤器
avatarLogger.removeFilter('UserContext');

// 清空所有过滤器
avatarLogger.clearFilters();

// 查看当前配置
avatarLogger.exportConfig();
```

### 常用调试场景

#### 1. 调试头像循环加载问题
```javascript
// 只显示UserContext和useImageRetry的日志
avatarLogger.clearFilters();
avatarLogger.addFilter('UserContext');
avatarLogger.addFilter('useImageRetry');
avatarLogger.setLogLevel('debug');
```

#### 2. 调试头像重试机制
```javascript
// 只显示重试相关日志
avatarLogger.clearFilters();
avatarLogger.addFilter('重试');
avatarLogger.setLogLevel('warn');
```

#### 3. 调试缓存问题
```javascript
// 只显示缓存相关日志
avatarLogger.clearFilters();
avatarLogger.addFilter('缓存');
avatarLogger.setLogLevel('info');
```

#### 4. 调试特定页面的头像
```javascript
// 只显示AvatarWithRetry组件的日志
avatarLogger.clearFilters();
avatarLogger.addFilter('AvatarWithRetry');
avatarLogger.setLogLevel('debug');
```

## 日志数据结构

### 通用字段
- `timestamp`: ISO格式时间戳
- `component/hook/context`: 组件标识
- `src`: 图片URL
- `error`: 错误信息

### 头像特定字段
- `size`: 头像尺寸
- `shape`: 头像形状（circle/square）
- `retryCount`: 重试次数
- `isRetrying`: 是否正在重试
- `cacheAge`: 缓存年龄（毫秒）

### UserContext特定字段
- `profileId`: 用户档案ID
- `userId`: 用户ID
- `forceRefresh`: 是否强制刷新
- `avatarUrl`: 头像URL

## 调试技巧

### 1. 识别循环加载
查找重复的日志模式：
```
🎯 初始加载图片: { initialSrc: "xxx" }
🚀 开始加载图片: { src: "xxx" }
✅ 图片加载成功: { src: "xxx" }
🎯 初始加载图片: { initialSrc: "xxx" }  // 重复出现
```

### 2. 识别重试问题
查找重试失败模式：
```
🔄 图片加载失败，第1次重试: { attempt: 1 }
🔄 图片加载失败，第2次重试: { attempt: 2 }
🔄 图片加载失败，第3次重试: { attempt: 3 }
❌ 图片加载最终失败: { retryCount: 3 }
```

### 3. 识别缓存问题
查找缓存命中/未命中模式：
```
💾 使用缓存的头像URL: { cacheAge: 5000 }
🔄 开始刷新头像: { forceRefresh: true }
```

## 性能考虑

- 生产环境建议设置 `avatarLogger.setLogLevel('error')` 只记录错误
- 开发环境可以使用 `avatarLogger.setLogLevel('debug')` 查看详细信息
- 使用过滤器可以减少控制台输出，提高性能

## 故障排除

### 常见问题

1. **日志不显示**
   - 检查 `avatarLogger.enable(true)` 是否已调用
   - 检查日志级别设置是否合适

2. **日志太多**
   - 使用过滤器限制特定组件
   - 提高日志级别（如设置为 'warn' 或 'error'）

3. **找不到特定日志**
   - 使用 `avatarLogger.addFilter('关键词')` 过滤
   - 检查组件名称是否正确

### 重置配置
```javascript
// 重置为默认配置
avatarLogger.enable(true);
avatarLogger.setLogLevel('info');
avatarLogger.clearFilters();
```

## 更新历史

- **2024-01-XX** - 初始实现头像日志系统
- **2024-01-XX** - 添加日志控制工具
- **2024-01-XX** - 优化日志格式和性能
