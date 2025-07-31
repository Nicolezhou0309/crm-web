# 页面刷新优化指南

## 问题分析

切换页签时项目会刷新的主要原因：

### 1. 页面可见性变化处理过于频繁
- **问题**: `UserContext.tsx` 中的 `handleVisibilityChange` 函数在页面可见性变化时频繁触发
- **影响**: 每次切换页签都会触发会话检查和状态更新

### 2. 会话超时检查频率过高
- **问题**: 每30秒检查一次会话状态
- **影响**: 频繁的状态更新可能导致组件重新渲染

### 3. 活动监听器无节流
- **问题**: 用户活动监听器（鼠标、键盘、滚动等）没有节流控制
- **影响**: 任何用户操作都可能触发状态更新

### 4. Token刷新机制过于激进
- **问题**: 静默认证Hook检查频率过高
- **影响**: 频繁的token检查和刷新

## 解决方案

### 1. 优化页面可见性处理

```typescript
// 优化前
const handleVisibilityChange = () => {
  // 每5秒检查一次
  if (now - lastCheckTime > 5000) {
    checkSessionTimeout();
  }
}, 100); // 100ms延迟

// 优化后
const handleVisibilityChange = () => {
  // 每10秒检查一次
  if (now - lastCheckTime > 10000) {
    isProcessing = true;
    checkSessionTimeout();
    // 重置处理状态
    setTimeout(() => {
      isProcessing = false;
    }, 1000);
  }
}, 200); // 200ms延迟
```

### 2. 减少会话检查频率

```typescript
// 优化前
const checkInterval = setInterval(() => {
  checkSessionTimeout();
}, 30000); // 30秒

// 优化后
const checkInterval = setInterval(() => {
  checkSessionTimeout();
}, 60000); // 60秒
```

### 3. 添加活动监听器节流

```typescript
// 优化前
const handleActivity = () => {
  updateActivity();
};

// 优化后
const handleActivity = () => {
  const now = Date.now();
  // 只在距离上次活动超过5秒时才更新
  if (now - lastActivityTime > 5000) {
    updateActivity();
    lastActivityTime = now;
  }
};
```

### 4. 优化状态更新阈值

```typescript
// 优化前
if (Math.abs(timeRemaining - sessionTimeRemaining) > 1000) {
  setSessionTimeRemaining(timeRemaining);
}

// 优化后
if (Math.abs(timeRemaining - sessionTimeRemaining) > 5000) {
  setSessionTimeRemaining(timeRemaining);
}
```

### 5. 优化静默认证频率

```typescript
// 优化前
const thresholdMs = 30 * 60 * 1000; // 30分钟阈值
refreshIntervalRef.current = setInterval(() => {
  checkTokenSilently();
}, 60 * 60 * 1000); // 60分钟检查

// 优化后
const thresholdMs = 60 * 60 * 1000; // 60分钟阈值
refreshIntervalRef.current = setInterval(() => {
  checkTokenSilently();
}, 120 * 60 * 1000); // 120分钟检查
```

## 实施效果

### 优化前的问题
- 切换页签时频繁触发状态更新
- 每30秒检查会话状态
- 用户活动无节流控制
- Token检查过于频繁

### 优化后的改进
- 页面可见性变化处理增加延迟和节流
- 会话检查频率降低到60秒
- 活动监听器增加5秒节流
- Token检查频率降低到120分钟
- 状态更新阈值从1秒增加到5秒

## 监控建议

1. **性能监控**: 使用浏览器开发者工具监控页面性能
2. **状态变化监控**: 在开发环境下监控状态变化频率
3. **用户反馈**: 收集用户关于页面刷新问题的反馈

## 注意事项

1. **平衡性能与安全性**: 在减少检查频率的同时确保安全性
2. **渐进式优化**: 逐步调整参数，观察效果
3. **用户测试**: 在不同设备和网络环境下测试优化效果

## 相关文件

- `src/context/UserContext.tsx` - 用户上下文管理
- `src/hooks/useSilentAuth.ts` - 静默认证Hook
- `src/utils/authUtils.ts` - 认证工具函数 