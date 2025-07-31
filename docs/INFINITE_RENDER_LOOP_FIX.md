# 无限渲染循环修复指南

## 问题描述

在登录页面和主页面切换时，出现了无限渲染循环，导致页面不断刷新loading状态。

## 问题分析

### 根本原因
1. **循环依赖**: `shouldShowLoading` 的计算依赖于 `loading` 和 `isPageVisible`
2. **useEffect依赖**: 在useEffect的依赖数组中包含了会导致重新计算的变量
3. **状态同步**: App.tsx和UserContext.tsx之间的状态同步导致连锁反应

### 具体问题点

#### App.tsx中的问题
```typescript
// 问题代码
const shouldShowLoading = loading && isPageVisible;

// 问题useEffect
React.useEffect(() => {
  // 日志记录
}, [loading, location.pathname, isPublicPage, shouldShowLoading]); // shouldShowLoading导致循环
```

#### UserContext.tsx中的问题
```typescript
// 问题代码
const isSilentMode = !isPageVisible;
const isVisibilityCheck = timeSinceLastChange < 1000;

// 问题useEffect
React.useEffect(() => {
  // 日志记录
}, [loading, user, profile, isVisibilityCheck, isSilentMode, isPageVisible]); // 过多依赖
```

## 修复方案

### 1. 使用useMemo稳定计算
```typescript
// 修复后的App.tsx
const shouldShowLoading = React.useMemo(() => loading && isPageVisible, [loading, isPageVisible]);

// 修复后的UserContext.tsx
const isSilentMode = React.useMemo(() => !isPageVisible, [isPageVisible]);
const isVisibilityCheck = React.useMemo(() => timeSinceLastChange < 1000, [timeSinceLastChange]);
```

### 2. 移除循环依赖
```typescript
// 修复后的useEffect
React.useEffect(() => {
  if (loading) {
    console.log('🔄 [App] Loading状态变化', {
      // 日志内容
    });
  }
}, [loading, location.pathname, isPublicPage]); // 移除shouldShowLoading依赖
```

### 3. 优化依赖数组
```typescript
// 修复后的UserContext.tsx useEffect
React.useEffect(() => {
  // 日志记录
}, [loading, user, profile]); // 只保留必要的依赖
```

## 修复效果

### 修复前
- 页面进入时出现无限loading循环
- 控制台大量重复日志
- 用户体验差，页面卡顿

### 修复后
- 页面正常加载，无无限循环
- 日志输出正常，无重复
- 用户体验流畅

## 预防措施

1. **避免循环依赖**: 在useEffect依赖数组中不要包含会因该effect而改变的值
2. **使用useMemo**: 对于复杂计算，使用useMemo来稳定结果
3. **最小化依赖**: 只保留真正需要的依赖项
4. **状态分离**: 将不同功能的状态分开管理，避免相互影响

## 相关文件

- `src/App.tsx`: 主应用组件，处理路由和loading状态
- `src/context/UserContext.tsx`: 用户上下文，管理用户状态
- `src/utils/loadingUtils.ts`: 工具函数，提供防抖和可见性管理

## 测试验证

1. 访问登录页面，确认无无限循环
2. 登录后进入主页面，确认loading正常
3. 切换标签页，确认可见性检测正常
4. 检查控制台日志，确认无重复输出 