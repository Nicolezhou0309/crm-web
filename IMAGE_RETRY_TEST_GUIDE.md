# 图片重试机制测试指南

## 功能概述

已为系统实现了完整的图片重试机制，包括：

1. **通用图片重试Hook** (`useImageRetry`)
2. **头像重试组件** (`AvatarWithRetry`)
3. **UserContext集成重试** (头像URL获取)
4. **全页面头像重试** (Profile、MobileProfile、App导航栏)

## 重试机制特性

### 🔄 自动重试
- **最大重试次数**: 3次
- **重试延迟**: 1秒（指数退避）
- **重试条件**: 网络错误、超时、服务器错误等

### 🎯 智能错误检测
```javascript
const retryableErrors = [
  'NetworkError',
  'TimeoutError', 
  'ConnectionError',
  'fetch failed',
  'Failed to fetch',
  'net::ERR_',
  '404', '403', '500', '502', '503', '504'
];
```

### 📱 多场景支持
- **桌面端Profile页面**: 显示重试按钮
- **移动端Profile页面**: 显示重试按钮
- **导航栏头像**: 不显示重试按钮（空间限制）

## 测试场景

### 1. 网络中断测试

#### 测试步骤：
1. 打开浏览器开发者工具
2. 切换到 Network 标签
3. 选择 "Offline" 模式
4. 刷新页面或上传新头像
5. 观察重试行为

#### 预期结果：
- 头像加载失败时显示加载失败状态
- 自动进行3次重试
- 每次重试间隔递增（1s, 2s, 4s）
- 重试失败后显示重试按钮

### 2. 服务器错误测试

#### 测试步骤：
1. 修改头像URL为无效地址
2. 观察重试行为
3. 恢复正确URL
4. 观察是否自动重试

#### 预期结果：
- 检测到404/500等错误
- 自动重试3次
- 失败后显示重试按钮
- 手动点击重试按钮可重新尝试

### 3. 超时测试

#### 测试步骤：
1. 使用网络限制工具（如Chrome DevTools）
2. 设置极慢的网络速度
3. 观察图片加载超时处理

#### 预期结果：
- 10秒超时后触发重试
- 重试过程中显示"重试中"状态
- 显示当前重试次数

### 4. 缓存测试

#### 测试步骤：
1. 成功加载头像后
2. 断开网络
3. 刷新页面
4. 观察是否使用缓存

#### 预期结果：
- 优先使用缓存的头像URL
- 缓存失效时才进行网络请求
- 网络请求失败时使用重试机制

## 组件使用示例

### 基础用法
```tsx
import AvatarWithRetry from './components/AvatarWithRetry';

<AvatarWithRetry
  src={avatarUrl}
  size={80}
  shape="circle"
  retryOptions={{
    maxRetries: 3,
    delay: 1000,
    backoff: 'exponential',
    showRetryButton: true
  }}
/>
```

### 高级配置
```tsx
<AvatarWithRetry
  src={avatarUrl}
  size={64}
  shape="circle"
  retryOptions={{
    maxRetries: 5,
    delay: 500,
    backoff: 'fixed',
    showRetryButton: true,
    retryButtonText: '重新加载',
    onLoadSuccess: (src) => console.log('加载成功:', src),
    onLoadError: (error) => console.error('加载失败:', error)
  }}
  onLoad={() => console.log('图片加载完成')}
  onError={() => console.log('图片加载失败')}
/>
```

## 调试信息

### 控制台日志
重试过程中会在控制台输出详细信息：

```
✅ 头像加载成功: https://example.com/avatar.jpg
❌ 头像加载失败: Error: 图片加载失败
⚠️ 头像URL获取失败，第1次重试: { error: "NetworkError", attempt: 1 }
```

### 状态监控
可以通过以下方式监控重试状态：

```tsx
const { 
  src, 
  isLoading, 
  hasError, 
  retryCount, 
  isRetrying, 
  canRetry 
} = useImageRetry(avatarUrl, options);
```

## 性能优化

### 1. 请求去重
- 相同URL的并发请求会被合并
- 避免重复的网络请求

### 2. 缓存策略
- 成功加载的图片会被缓存
- 缓存时长：1年（头像很少变化）

### 3. 懒加载
- 图片在视口内才开始加载
- 减少不必要的网络请求

## 故障排除

### 常见问题

1. **重试按钮不显示**
   - 检查 `showRetryButton` 配置
   - 确认 `canRetry` 状态

2. **重试次数不足**
   - 检查 `maxRetries` 配置
   - 确认错误类型是否可重试

3. **重试延迟异常**
   - 检查 `delay` 和 `backoff` 配置
   - 确认网络状态

### 调试工具

```javascript
// 手动触发重试
const { retry } = useImageRetry(src, options);
retry();

// 重置状态
const { reset } = useImageRetry(src, options);
reset();

// 设置新的图片源
const { setSrc } = useImageRetry(src, options);
setSrc(newSrc);
```

## 测试检查清单

- [ ] 网络中断时自动重试
- [ ] 服务器错误时自动重试
- [ ] 超时时自动重试
- [ ] 重试按钮功能正常
- [ ] 重试次数限制生效
- [ ] 重试延迟递增正确
- [ ] 缓存机制工作正常
- [ ] 控制台日志输出正确
- [ ] 不同页面重试一致
- [ ] 移动端重试正常

## 更新历史

- **2024-01-XX** - 初始实现图片重试机制
- **2024-01-XX** - 集成到所有头像显示组件
- **2024-01-XX** - 优化重试策略和用户体验
