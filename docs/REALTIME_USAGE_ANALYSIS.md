# Realtime 回调使用情况分析

## 当前使用 Realtime 回调的页面组件

### 1. 主要组件

#### `LiveStreamRegistrationBase.tsx` - 直播报名主组件
- **Hook**: `useRealtimeConcurrencyControl`
- **用途**: 直播场次的实时并发控制
- **回调功能**:
  - 监听 `live_stream_schedules` 表的数据变化
  - 处理 INSERT/UPDATE/DELETE 事件
  - 实时更新卡片状态
  - 显示编辑锁定通知
  - 处理用户报名通知

```typescript
const { 
  editLocks, 
  timeSlotLocks, 
  currentUserLocks, 
  isConnected,
  acquireEditLock, 
  releaseEditLock 
} = useRealtimeConcurrencyControl({
  onDataChange: (change) => {
    // 根据事件类型进行精确更新
    if (change.eventType === 'INSERT') {
      updateSingleSchedule(change.scheduleId);
    } else if (change.eventType === 'UPDATE') {
      updateSingleSchedule(change.scheduleId);
    } else if (change.eventType === 'DELETE') {
      // 处理删除事件
    }
  }
});
```

### 2. 页面组件

#### `LiveStreamRegistration.tsx` - 直播报名页面
- **直接使用**: `realtimeManager.subscribe()`
- **用途**: 创建直播报名相关的订阅
- **回调功能**: 创建订阅但不处理具体业务逻辑（由 Hook 处理）

```typescript
const subscriptionId = await realtimeManager.subscribe(user.id, {
  table: 'live_stream_schedules',
  event: '*',
  source: 'LiveStreamRegistration',
  callback: (payload: any) => {
    // 数据变化会通过 RealtimeManager 的数据变化监听器通知到 useRealtimeConcurrencyControl
  }
});
```

### 3. 通用 Hook

#### `useRealtime.ts` - 通用 Realtime Hook
- **用途**: 提供通用的 Realtime 订阅功能
- **回调功能**: 支持自定义数据变化回调

```typescript
const { subscribe, unsubscribe, unsubscribeAll, isConnected, error } = useRealtime();

// 使用示例
await subscribe({
  table: 'some_table',
  event: '*',
  source: 'SomeComponent',
  onData: (payload) => {
    // 处理数据变化
  },
  onError: (error) => {
    // 处理错误
  }
});
```

### 4. 通知相关

#### `useRealtimeNotifications.ts` - 通知 Hook
- **状态**: 当前被注释掉，未实际使用 Realtime
- **用途**: 管理用户通知（目前使用轮询方式）

#### `App.tsx` - 主应用组件
- **使用**: `useRealtimeNotifications` Hook
- **用途**: 全局通知管理

## 数据流分析

### 1. 主要数据流
```
数据库变化 → Supabase Realtime → RealtimeManager → useRealtimeConcurrencyControl → LiveStreamRegistrationBase
```

### 2. 订阅管理
- **RealtimeManager**: 统一管理所有订阅和连接
- **防重复机制**: 避免重复创建相同的订阅
- **自动清理**: 组件卸载时自动清理订阅

### 3. 回调处理
- **直接回调**: 通过 `realtimeManager.subscribe()` 的直接回调参数
- **Hook 回调**: 通过 `useRealtimeConcurrencyControl` 的 `onDataChange` 参数
- **防重复处理**: RealtimeManager 内置防重复事件处理机制

## 性能优化

### 1. 订阅优化
- **连接池**: RealtimeManager 使用连接池管理连接
- **防重复订阅**: 检查重复订阅，避免资源浪费
- **自动清理**: 及时清理不需要的订阅

### 2. 回调优化
- **精确更新**: 只更新发生变化的单个卡片
- **防抖处理**: 避免频繁更新
- **错误处理**: 完善的错误处理机制

## 监控和调试

### 1. 日志系统
- **详细日志**: 每个步骤都有详细的日志记录
- **性能监控**: 记录处理耗时
- **状态跟踪**: 跟踪连接和订阅状态

### 2. 统计信息
- **连接统计**: 总连接数、活跃连接数
- **订阅统计**: 活跃订阅数、订阅来源
- **监听器统计**: 监听器数量、处理事件数

## 总结

当前系统中有 **2 个主要组件** 在使用 Realtime 回调：

1. **LiveStreamRegistrationBase** - 主要的业务组件，处理直播场次的实时更新
2. **LiveStreamRegistration** - 页面组件，创建订阅但不处理具体逻辑

**1 个通用 Hook** 提供 Realtime 功能：
- **useRealtime** - 通用的 Realtime 订阅 Hook

**架构特点**：
- 统一的订阅管理（RealtimeManager）
- 清晰的职责分离（页面组件 vs 业务逻辑）
- 完善的错误处理和性能优化
- 详细的监控和调试信息
