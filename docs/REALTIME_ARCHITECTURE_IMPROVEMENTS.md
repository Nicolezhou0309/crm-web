# Realtime 架构改进说明

## 问题分析

### 原有问题
1. **页面组件直接创建监听器**：`useRealtimeConcurrencyControl.ts` 中直接调用 `realtimeManager.registerDataChangeListener()`
2. **缺乏清理逻辑**：组件卸载时没有正确清理监听器
3. **重复创建**：每次组件重新渲染都可能创建新的监听器
4. **架构混乱**：监听器管理分散在多个地方

### 根本原因
- 监听器应该由 RealtimeManager 统一管理，而不是由页面组件直接创建
- 缺乏清晰的订阅-监听器生命周期管理

## 改进方案

### 1. 统一订阅管理
- **RealtimeManager 负责所有订阅和监听器管理**
- **页面组件只负责订阅数据变化，不直接创建监听器**
- **订阅创建时自动建立监听器，订阅取消时自动清理**

### 2. 新的订阅流程
```typescript
// 页面组件通过 RealtimeManager 订阅
realtimeManager.subscribe(
  userId,
  {
    table: 'live_stream_schedules',
    event: '*',
    source: 'ConcurrencyControl'
  },
  handleDataChange // 直接回调函数
)
```

### 3. 自动清理机制
- **组件卸载时自动取消订阅**
- **订阅取消时自动清理相关监听器**
- **防重复订阅机制**

## 具体改进

### RealtimeManager 改进
1. **增强订阅方法**：`subscribe()` 方法现在接受可选的 `dataChangeCallback` 参数
2. **自动监听器管理**：订阅创建时自动建立监听器，取消时自动清理
3. **防重复机制**：检查重复订阅，避免重复创建
4. **统一清理**：提供多种清理方法

### useRealtimeConcurrencyControl 改进
1. **移除直接监听器创建**：不再调用 `registerDataChangeListener()`
2. **使用订阅机制**：通过 `realtimeManager.subscribe()` 订阅数据变化
3. **自动清理**：组件卸载时自动取消订阅

## 优势

### 1. 架构清晰
- **单一职责**：RealtimeManager 负责所有实时连接管理
- **统一接口**：页面组件只需要调用订阅方法
- **自动管理**：监听器生命周期自动管理

### 2. 性能优化
- **防重复**：避免重复创建相同的订阅和监听器
- **自动清理**：及时清理不需要的资源
- **内存优化**：减少内存泄漏风险

### 3. 维护性
- **集中管理**：所有实时功能集中在 RealtimeManager
- **易于调试**：统一的日志和状态管理
- **易于扩展**：新增功能只需要修改 RealtimeManager

## 使用示例

### 页面组件订阅数据变化
```typescript
useEffect(() => {
  if (!profile?.id) return;
  
  let subscriptionId: string | null = null;
  
  const handleDataChange = async (payload: any) => {
    // 处理数据变化
  };
  
  // 通过 RealtimeManager 订阅
  realtimeManager.subscribe(
    profile.id.toString(),
    {
      table: 'live_stream_schedules',
      event: '*',
      source: 'ConcurrencyControl'
    },
    handleDataChange
  ).then(id => {
    subscriptionId = id;
  });
  
  return () => {
    if (subscriptionId) {
      realtimeManager.unsubscribe(subscriptionId);
    }
  };
}, [profile?.id]);
```

### RealtimeManager 统计信息
```typescript
const stats = realtimeManager.getStats();
console.log('订阅数量:', stats.activeSubscriptions);
console.log('监听器数量:', stats.dataChangeListeners.totalListeners);
console.log('连接数量:', stats.totalConnections);
```

## 注意事项

1. **向后兼容**：保留了原有的 `registerDataChangeListener` 方法，确保现有代码不受影响
2. **错误处理**：订阅失败时会抛出错误，需要适当的错误处理
3. **性能监控**：可以通过 `getStats()` 方法监控订阅和监听器状态

## 总结

这次改进解决了监听器重复创建和缺乏清理的问题，建立了清晰的订阅-监听器管理架构。RealtimeManager 现在能够更好地管理所有实时连接和监听器，页面组件只需要关注业务逻辑，不需要直接管理底层连接。
