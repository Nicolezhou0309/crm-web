 # Token管理统一化指南

## 概述

为了解决登录时不停刷新的问题，我们将分散的token管理统一到一个模块中，避免多重认证检查和重复的token操作。

## 问题分析

### 之前的问题
1. **分散的Token管理** - token操作分散在多个文件中
2. **多重认证状态监听** - 3个地方同时监听认证状态变化
3. **重复的Token操作** - 多个文件都在调用相同的Supabase认证方法
4. **循环刷新** - 多重监听器导致认证状态变化时触发多次刷新

### 统一化后的优势
1. **单一职责** - 所有token操作都通过TokenManager进行
2. **避免重复** - 只有一个认证状态监听器
3. **智能刷新** - 统一的token刷新策略
4. **更好的错误处理** - 集中的错误处理逻辑

## 核心文件

### 1. `src/utils/tokenManager.ts` - 统一Token管理器

```typescript
class TokenManager {
  // 获取当前会话
  async getSession()
  
  // 获取当前用户
  async getUser()
  
  // 智能token刷新
  async smartTokenRefresh()
  
  // 安全登出
  async safeSignOut()
  
  // 添加认证状态监听器
  addAuthStateListener()
  
  // 启动自动token监控
  startAutoRefresh()
}
```

### 2. 更新的组件

#### `src/context/UserContext.tsx`
- 使用 `tokenManager.getSession()` 替代 `checkAuthStatus()`
- 使用 `tokenManager.getUser()` 替代 `supabase.auth.getUser()`
- 使用 `tokenManager.addAuthStateListener()` 替代直接监听
- 使用 `tokenManager.safeSignOut()` 替代 `safeSignOut()`

#### `src/components/AuthErrorHandler.tsx`
- 使用统一的token管理器进行认证检查
- 移除重复的认证状态监听

#### `src/App.tsx`
- 使用 `tokenManager.safeSignOut()` 进行登出操作

## 主要改进

### 1. 统一的Token操作
```typescript
// 之前：分散在多个文件中
const { data: { session } } = await supabase.auth.getSession();
const { data: { user } } = await supabase.auth.getUser();
await supabase.auth.signOut();

// 现在：统一通过TokenManager
const { session, error } = await tokenManager.getSession();
const { user, error } = await tokenManager.getUser();
await tokenManager.safeSignOut();
```

### 2. 智能Token刷新
```typescript
// 防止频繁刷新：至少间隔5分钟
if (now - this.state.lastRefreshTime < 5 * 60 * 1000) {
  return { success: true, skipped: true };
}

// 只在token即将过期时刷新
if (timeUntilExpiry <= this.config.refreshThresholdMs) {
  await supabase.auth.getSession(); // 触发刷新
  return { success: true, refreshed: true };
}
```

### 3. 统一的认证状态监听
```typescript
// 之前：3个地方监听认证状态
supabase.auth.onAuthStateChange() // 在多个文件中

// 现在：统一监听
tokenManager.addAuthStateListener((event, session) => {
  // 统一处理认证状态变化
});
```

### 4. 安全的登出机制
```typescript
async safeSignOut(navigate?: any): Promise<void> {
  // 清除本地存储
  localStorage.removeItem('last_activity_timestamp');
  localStorage.removeItem('supabase.auth.token');
  
  // 调用Supabase登出
  await supabase.auth.signOut();
  
  // 重置状态
  this.state.lastRefreshTime = 0;
  
  // 导航到登录页
  if (navigate) {
    navigate('/login', { replace: true });
  } else {
    window.location.href = '/login';
  }
}
```

## 配置选项

TokenManager支持以下配置：

```typescript
interface TokenConfig {
  refreshThresholdMs: number; // token过期前多少毫秒开始刷新 (默认30分钟)
  maxRetryAttempts: number;   // 最大重试次数 (默认3次)
  retryDelayMs: number;       // 重试延迟 (默认5秒)
  checkIntervalMs: number;    // 检查间隔 (默认10分钟)
}
```

## 使用指南

### 1. 获取用户信息
```typescript
import { tokenManager } from '../utils/tokenManager';

const { user, error } = await tokenManager.getUser();
if (error) {
  console.error('获取用户失败:', error);
}
```

### 2. 获取会话信息
```typescript
const { session, error } = await tokenManager.getSession();
if (error || !session) {
  console.error('获取会话失败:', error);
}
```

### 3. 智能刷新Token
```typescript
const result = await tokenManager.smartTokenRefresh();
if (result.success && result.refreshed) {
  console.log('Token已刷新');
}
```

### 4. 安全登出
```typescript
// 使用React Router导航
await tokenManager.safeSignOut(navigate);

// 或使用页面刷新
await tokenManager.safeSignOut();
```

### 5. 添加认证状态监听
```typescript
const unsubscribe = tokenManager.addAuthStateListener((event, session) => {
  if (event === 'SIGNED_IN') {
    console.log('用户登录');
  } else if (event === 'SIGNED_OUT') {
    console.log('用户登出');
  }
});

// 清理监听器
unsubscribe();
```

## 迁移指南

### 需要更新的文件
1. 所有直接调用 `supabase.auth.*` 的地方
2. 所有使用 `checkAuthStatus` 的地方
3. 所有使用 `safeSignOut` 的地方
4. 所有直接监听 `onAuthStateChange` 的地方

### 迁移步骤
1. 导入 `tokenManager`
2. 替换直接的Supabase调用
3. 使用统一的监听器
4. 测试认证流程

## 注意事项

1. **单例模式** - TokenManager使用单例模式，确保全局只有一个实例
2. **错误处理** - 所有方法都包含适当的错误处理
3. **性能优化** - 防止频繁刷新和重复调用
4. **向后兼容** - 保持与现有代码的兼容性

## 测试建议

1. **登录流程** - 测试正常登录和异常登录
2. **Token刷新** - 测试自动token刷新
3. **登出流程** - 测试安全登出
4. **错误处理** - 测试网络错误和认证错误
5. **性能测试** - 确保没有内存泄漏和性能问题