# 用户缓存和会话管理功能指南

## 功能概述

本系统实现了完整的用户信息缓存和会话管理功能，包括：

1. **本地用户信息缓存** - 减少重复的网络请求
2. **页面关闭后重新登录** - 提高安全性
3. **30分钟无操作自动登出** - 防止会话泄露

## 功能特性

### 1. 本地用户信息缓存

#### 缓存机制
- **缓存时长**: 5分钟
- **缓存内容**: 用户认证信息和用户档案信息
- **缓存位置**: localStorage
- **自动清除**: 过期后自动清除缓存

#### 缓存键值
```javascript
const CACHE_KEYS = {
  USER: 'user_cache',           // 用户认证信息
  PROFILE: 'profile_cache',      // 用户档案信息
  TIMESTAMP: 'user_cache_timestamp',  // 缓存时间戳
  LAST_ACTIVITY: 'last_activity_timestamp',  // 最后活动时间
  SESSION_ID: 'session_id'      // 会话ID
};
```

#### 缓存策略
1. **首次加载**: 从服务器获取用户信息并缓存
2. **后续加载**: 优先使用缓存数据，提高加载速度
3. **缓存失效**: 5分钟后自动清除，重新从服务器获取
4. **手动清除**: 支持手动清除缓存功能

### 2. 页面关闭后重新登录

#### 实现机制
- **页面关闭监听**: 监听 `beforeunload` 事件
- **缓存清除**: 页面关闭时自动清除所有用户缓存
- **安全保证**: 确保页面关闭后需要重新登录

#### 触发时机
```javascript
// 页面关闭时清除会话
window.addEventListener('beforeunload', () => {
  cacheManager.clearUserCache();
});
```

### 3. 30分钟无操作自动登出

#### 会话超时机制
- **超时时间**: 30分钟无操作
- **警告时间**: 剩余5分钟时显示警告
- **活动检测**: 监听鼠标、键盘、触摸等用户活动

#### 活动监听事件
```javascript
const events = [
  'mousedown',    // 鼠标点击
  'mousemove',    // 鼠标移动
  'keypress',     // 键盘输入
  'scroll',       // 页面滚动
  'touchstart',   // 触摸开始
  'click'         // 点击事件
];
```

#### 会话状态检查
- **检查频率**: 每10秒检查一次会话状态
- **自动登出**: 超时后自动登出并跳转到登录页面
- **状态更新**: 实时更新会话剩余时间

## 用户界面

### 会话超时警告

当会话即将过期时（剩余5分钟），系统会显示警告对话框：

- **倒计时显示**: 实时显示剩余时间
- **进度条**: 可视化显示会话进度
- **操作按钮**: 
  - "继续使用" - 延长会话时间
  - "立即登出" - 主动登出

## 技术实现

### 核心类：UserCacheManager

```typescript
class UserCacheManager {
  // 设置用户缓存
  setUserCache(user: any, profile: UserProfile | null)
  
  // 获取用户缓存
  getUserCache(): { user: any | null; profile: UserProfile | null } | null
  
  // 清除用户缓存
  clearUserCache()
  
  // 更新最后活动时间
  updateLastActivity()
  
  // 检查会话是否超时
  isSessionExpired(): boolean
  
  // 获取会话剩余时间
  getSessionTimeRemaining(): number
}
```

### 会话管理流程

1. **用户登录**
   ```javascript
   // 获取用户信息并缓存
   const userData = await supabase.auth.getUser();
   cacheManager.setUserCache(userData.user, profileData);
   ```

2. **活动监听**
   ```javascript
   // 监听用户活动并更新活动时间
   document.addEventListener('click', () => {
     cacheManager.updateLastActivity();
   });
   ```

3. **会话检查**
   ```javascript
   // 定期检查会话状态
   setInterval(() => {
     if (cacheManager.isSessionExpired()) {
       handleLogout();
     }
   }, 10000);
   ```

4. **页面关闭**
   ```javascript
   // 页面关闭时清除缓存
   window.addEventListener('beforeunload', () => {
     cacheManager.clearUserCache();
   });
   ```

## 配置参数

### 时间配置
```typescript
const CACHE_DURATION = 5 * 60 * 1000;        // 缓存时长：5分钟
const SESSION_TIMEOUT = 30 * 60 * 1000;       // 会话超时：30分钟
const WARNING_THRESHOLD = 5 * 60 * 1000;      // 警告阈值：5分钟
```

### 检查频率
```typescript
const CHECK_INTERVAL = 10000;  // 会话检查间隔：10秒
```

## 安全考虑

### 1. 数据安全
- **敏感信息**: 不在缓存中存储密码等敏感信息
- **加密存储**: 考虑对缓存数据进行加密
- **定期清理**: 自动清理过期缓存

### 2. 会话安全
- **超时机制**: 防止会话被长期占用
- **活动检测**: 确保用户真实在线
- **自动登出**: 超时后强制登出

### 3. 缓存安全
- **过期策略**: 缓存数据有过期时间
- **清除机制**: 支持手动和自动清除
- **错误处理**: 缓存错误时降级到服务器请求

## 性能优化

### 1. 缓存策略
- **智能缓存**: 只在必要时更新缓存
- **增量更新**: 只更新变化的数据
- **压缩存储**: 减少localStorage占用

### 2. 网络优化
- **减少请求**: 缓存减少重复请求
- **并行加载**: 用户信息和档案并行获取
- **错误重试**: 网络错误时自动重试

### 3. 用户体验
- **快速加载**: 缓存提供快速响应
- **无缝体验**: 用户无感知的缓存更新
- **状态同步**: 多标签页状态同步

## 故障排除

### 常见问题

#### 1. 缓存不生效
**症状**: 每次刷新都重新请求用户信息
**解决方案**: 
- 检查localStorage是否可用
- 确认缓存键值是否正确
- 查看控制台错误信息

#### 2. 会话提前过期
**症状**: 用户活动但会话仍过期
**解决方案**:
- 检查活动监听器是否正常工作
- 确认时间戳更新逻辑
- 验证会话超时配置

#### 3. 警告不显示
**症状**: 会话即将过期但没有警告
**解决方案**:
- 检查警告阈值配置
- 确认倒计时组件正常工作
- 验证事件监听器

### 调试方法

#### 1. 使用调试面板
在开发环境中，打开调试面板查看：
- 缓存状态
- 会话剩余时间
- 最后活动时间

#### 2. 控制台日志
查看控制台输出：
```javascript
console.log('[USER] 使用缓存用户信息');
console.log('[SESSION] 会话已超时，自动登出');
console.log('[SESSION] 会话已延长');
```

#### 3. 手动测试
```javascript
// 在控制台执行
// 清除所有缓存
localStorage.clear();

// 查看缓存状态
console.log('用户缓存:', localStorage.getItem('user_cache'));
console.log('最后活动:', localStorage.getItem('last_activity_timestamp'));
```

## 最佳实践

### 1. 开发环境
- 启用调试面板监控缓存状态
- 定期测试会话超时功能
- 验证多标签页状态同步

### 2. 生产环境
- 监控缓存命中率
- 跟踪会话超时频率
- 收集用户反馈

### 3. 维护建议
- 定期检查缓存配置
- 监控localStorage使用量
- 更新安全策略

## 更新日志

### v1.0.0 (2024-01-15)
- ✅ 实现本地用户信息缓存
- ✅ 添加页面关闭后重新登录功能
- ✅ 实现30分钟无操作自动登出
- ✅ 添加会话超时警告界面
- ✅ 集成调试面板（开发环境）
- ✅ 完善错误处理和日志记录 