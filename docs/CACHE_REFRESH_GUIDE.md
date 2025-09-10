# 缓存强制刷新功能指南

## 功能概述

本系统实现了完整的缓存强制刷新功能，确保在应用更新时用户能够获得最新的数据和功能。

## 核心功能

### 1. 版本控制缓存管理

#### 缓存管理器 (`cacheManager`)
- **位置**: `src/utils/cacheManager.ts`
- **功能**: 统一管理所有应用缓存，支持版本控制
- **特性**:
  - 自动检测版本更新
  - 版本不匹配时自动清除缓存
  - 支持TTL（生存时间）控制
  - 提供强制刷新功能

#### 版本号配置
```typescript
// 在 cacheManager.ts 中修改版本号
private readonly CURRENT_VERSION = '1.0.0'; // 每次更新时修改这个版本号
```

### 2. 自动版本检测

#### 版本检查Hook (`useVersionCheck`)
- **位置**: `src/hooks/useVersionCheck.ts`
- **功能**: 自动检测版本更新并提示用户
- **特性**:
  - 应用启动时自动检查
  - 每5分钟定期检查
  - 页面重新获得焦点时检查
  - 支持忽略更新（24小时内不再提示）

### 3. 用户界面组件

#### 缓存刷新按钮 (`CacheRefreshButton`)
- **位置**: `src/components/CacheRefreshButton.tsx`
- **功能**: 提供手动刷新缓存的用户界面
- **特性**:
  - 确认对话框防止误操作
  - 显示版本信息
  - 支持图标按钮和文字按钮

#### 版本更新提示模态框 (`VersionUpdateModal`)
- **位置**: `src/hooks/useVersionCheck.ts`
- **功能**: 自动弹出提示用户有版本更新
- **特性**:
  - 显示版本对比信息
  - 提供立即更新和稍后提醒选项

## 使用方法

### 1. 更新应用版本

当您需要发布新版本时：

1. **修改版本号**:
   ```typescript
   // 在 src/utils/cacheManager.ts 中
   private readonly CURRENT_VERSION = '1.0.1'; // 更新版本号
   ```

2. **重新构建和部署**:
   ```bash
   npm run build
   # 部署到服务器
   ```

3. **用户访问时自动处理**:
   - 系统自动检测版本更新
   - 弹出更新提示对话框
   - 用户确认后清除所有缓存并刷新页面

### 2. 手动刷新缓存

#### 方法一：使用缓存刷新按钮
```tsx
import CacheRefreshButton from './components/CacheRefreshButton';

// 在任意组件中使用
<CacheRefreshButton 
  type="primary" 
  size="middle" 
  iconOnly={false} 
/>
```

#### 方法二：编程方式刷新
```typescript
import { cacheManager } from './utils/cacheManager';

// 强制刷新所有缓存
cacheManager.forceRefreshAll();

// 清除特定缓存
cacheManager.removeCache('metro_stations');

// 设置缓存
cacheManager.setCache('my_data', data, 5 * 60 * 1000); // 5分钟TTL

// 获取缓存
const data = cacheManager.getCache('my_data', 5 * 60 * 1000);
```

### 3. 集成到现有服务

#### 更新地铁数据服务
```typescript
// 使用缓存管理器的新方法
const metroService = MetroDataService.getInstance();
const stations = await metroService.getStationsWithCacheManager();
```

## 缓存策略

### 1. 缓存类型

| 缓存类型 | 键名 | TTL | 说明 |
|---------|------|-----|------|
| 用户信息 | `user_cache` | 5分钟 | 用户认证和档案信息 |
| 地铁数据 | `metro_stations` | 24小时 | 地铁站点数据 |
| 频率控制 | `frequency_check` | 10秒 | 操作频率检查 |
| 其他数据 | `crm_cache_*` | 自定义 | 应用数据缓存 |

### 2. 缓存清除策略

#### 自动清除
- 版本更新时自动清除所有缓存
- TTL过期时自动清除对应缓存
- 页面关闭时清除会话相关缓存

#### 手动清除
- 用户点击刷新缓存按钮
- 管理员强制刷新
- 程序调用清除方法

## 配置选项

### 1. 版本检查配置

```typescript
// 在 useVersionCheck.ts 中
const ignoreDuration = 24 * 60 * 60 * 1000; // 24小时忽略期
const checkInterval = 5 * 60 * 1000; // 5分钟检查间隔
```

### 2. 缓存配置

```typescript
// 在 cacheManager.ts 中
private readonly CACHE_PREFIX = 'crm_cache_'; // 缓存键前缀
private readonly CACHE_VERSION_KEY = 'app_cache_version'; // 版本键名
```

## 最佳实践

### 1. 版本发布流程

1. **开发阶段**: 保持版本号不变
2. **测试阶段**: 可以临时修改版本号测试缓存刷新
3. **生产发布**: 正式更新版本号并部署

### 2. 缓存使用建议

- **短期数据**: 使用较短的TTL（如5分钟）
- **长期数据**: 使用较长的TTL（如24小时）
- **用户数据**: 优先使用缓存管理器
- **敏感数据**: 避免缓存或使用极短TTL

### 3. 错误处理

- 缓存操作失败时不影响主要功能
- 提供降级方案（直接访问数据库）
- 记录缓存操作日志便于调试

## 故障排除

### 1. 缓存不刷新

**问题**: 更新版本后缓存没有自动清除

**解决方案**:
1. 检查版本号是否正确更新
2. 清除浏览器localStorage
3. 手动调用 `cacheManager.forceRefreshAll()`

### 2. 频繁提示更新

**问题**: 用户频繁收到更新提示

**解决方案**:
1. 检查版本检查逻辑
2. 调整忽略期设置
3. 检查版本号格式

### 3. 缓存数据过期

**问题**: 缓存数据没有及时更新

**解决方案**:
1. 检查TTL设置
2. 使用 `refreshStations()` 等强制刷新方法
3. 检查缓存键名是否正确

## 监控和调试

### 1. 控制台日志

系统会输出详细的缓存操作日志：

```
🔄 [CacheManager] 检测到版本更新: 1.0.0 -> 1.0.1
🧹 [CacheManager] 清除所有应用缓存...
✅ [CacheManager] 已清除 15 个缓存项
📦 [MetroDataService] 从缓存管理器获取地铁站点数据
```

### 2. 版本信息查看

```typescript
// 获取当前版本信息
const versionInfo = cacheManager.getStoredVersionInfo();
console.log('当前版本:', cacheManager.getCurrentVersion());
console.log('存储版本:', versionInfo?.version);
console.log('最后更新:', new Date(versionInfo?.timestamp || 0));
```

## 总结

通过这套缓存强制刷新系统，您可以：

1. **自动管理缓存**: 版本更新时自动清除过期缓存
2. **提升用户体验**: 用户无需手动清除缓存
3. **保证数据一致性**: 确保用户获得最新数据
4. **灵活控制**: 支持手动刷新和自动检测
5. **易于维护**: 统一的缓存管理接口

记住在每次发布新版本时更新 `CURRENT_VERSION` 版本号，系统会自动处理其余工作。
