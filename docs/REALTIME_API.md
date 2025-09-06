# Realtime API 参考

## useRealtime Hook

### 基本用法

```typescript
import { useRealtime } from '../hooks/useRealtime';

const { isConnected, error, subscribe, unsubscribe, unsubscribeAll } = useRealtime();
```

### 返回值

| 属性 | 类型 | 描述 |
|------|------|------|
| `isConnected` | `boolean` | 连接状态 |
| `isSubscribed` | `boolean` | 订阅状态 |
| `error` | `string \| null` | 错误信息 |
| `stats` | `any` | 统计信息 |
| `subscribe` | `function` | 订阅方法 |
| `unsubscribe` | `function` | 取消订阅方法 |
| `unsubscribeAll` | `function` | 取消所有订阅方法 |

### subscribe 方法

```typescript
subscribe(options: UseRealtimeOptions): Promise<string>
```

#### 参数

| 参数 | 类型 | 必需 | 默认值 | 描述 |
|------|------|------|--------|------|
| `table` | `string` | ✅ | - | 数据库表名 |
| `event` | `'INSERT' \| 'UPDATE' \| 'DELETE' \| '*'` | ✅ | - | 事件类型 |
| `filter` | `string` | ❌ | - | 过滤条件 (SQL WHERE 子句) |
| `source` | `string` | ❌ | - | 订阅来源标识 |
| `connectionType` | `'page' \| 'long-term'` | ❌ | `'page'` | 连接类型 |
| `onData` | `(payload: any) => void` | ❌ | - | 数据回调函数 |
| `onError` | `(error: any) => void` | ❌ | - | 错误回调函数 |

#### 返回值

- `Promise<string>`: 订阅ID，用于后续取消订阅

#### 示例

```typescript
// 页面连接 - 直播报名
const subscriptionId = await subscribe({
  table: 'live_stream_schedules',
  event: '*',
  source: 'LiveStreamPage',
  connectionType: 'page',
  onData: (payload) => {
    console.log('直播安排更新:', payload);
  }
});

// 长期连接 - 系统通知
const notificationId = await subscribe({
  table: 'notifications',
  event: 'INSERT',
  filter: `user_id=eq.${userId}`,
  source: 'NotificationService',
  connectionType: 'long-term',
  onData: (payload) => {
    showNotification(payload.new);
  }
});
```

### unsubscribe 方法

```typescript
unsubscribe(subscriptionId: string): void
```

取消指定的订阅。

#### 参数

| 参数 | 类型 | 描述 |
|------|------|------|
| `subscriptionId` | `string` | 订阅ID |

#### 示例

```typescript
const subscriptionId = await subscribe({...});
// 取消订阅
unsubscribe(subscriptionId);
```

### unsubscribeAll 方法

```typescript
unsubscribeAll(): void
```

取消当前用户的所有订阅。

#### 示例

```typescript
// 组件卸载时清理所有订阅
useEffect(() => {
  return () => {
    unsubscribeAll();
  };
}, []);
```

## RealtimeManager

### 基本用法

```typescript
import { realtimeManager } from '../services/RealtimeManager';
```

### 主要方法

#### subscribe

```typescript
async subscribe(userId: string, subscription: RealtimeSubscription): Promise<string>
```

创建新的数据库订阅。

#### unsubscribe

```typescript
unsubscribe(subscriptionId: string): void
```

取消指定的订阅。

#### unsubscribeAll

```typescript
unsubscribeAll(userId: string): void
```

取消指定用户的所有订阅。

#### getStats

```typescript
getStats(): RealtimeStats
```

获取连接池统计信息。

**返回值结构**:
```typescript
interface RealtimeStats {
  totalConnections: number;
  activeSubscriptions: number;
  reconnects: number;
  errors: number;
  isConnected: boolean;
  config: RealtimeConfig;
  subscriptions: Array<{
    id: string;
    table: string;
    event: string;
    source: string;
    userId: string;
  }>;
  connectionPool: {
    totalConnections: number;
    activeConnections: number;
    idleConnections: number;
    queuedRequests: number;
    poolHits: number;
    poolMisses: number;
    connections: Array<{
      id: string;
      userId: string;
      source: string;
      isActive: boolean;
      subscriptionCount: number;
      createdAt: number;
      lastUsed: number;
      age: number;
      idleTime: number;
    }>;
  };
}
```

#### setEnabled

```typescript
setEnabled(enabled: boolean): void
```

启用或禁用 Realtime 功能。

#### cleanup

```typescript
cleanup(): void
```

清理所有连接和订阅。

## 类型定义

### UseRealtimeOptions

```typescript
interface UseRealtimeOptions {
  table: string;
  event: 'INSERT' | 'UPDATE' | 'DELETE' | '*';
  filter?: string;
  source?: string;
  connectionType?: 'page' | 'long-term';
  onData?: (payload: any) => void;
  onError?: (error: any) => void;
}
```

### RealtimeSubscription

```typescript
interface RealtimeSubscription {
  id: string;
  table: string;
  event: 'INSERT' | 'UPDATE' | 'DELETE' | '*';
  filter?: string;
  callback: (payload: any) => void;
  userId: string;
  createdAt: number;
  source?: string;
  connectionType?: 'page' | 'long-term';
}
```

### ConnectionInfo

```typescript
interface ConnectionInfo {
  id: string;
  channel: any;
  userId: string;
  createdAt: number;
  lastUsed: number;
  isActive: boolean;
  subscriptionCount: number;
  source: string;
  connectionType: 'page' | 'long-term';
}
```

## 事件类型

### 数据库事件

| 事件 | 描述 | 触发时机 |
|------|------|----------|
| `INSERT` | 插入事件 | 新记录插入时 |
| `UPDATE` | 更新事件 | 记录更新时 |
| `DELETE` | 删除事件 | 记录删除时 |
| `*` | 所有事件 | 任何变化时 |

### 连接状态

| 状态 | 描述 |
|------|------|
| `isConnected: true` | 已连接到 Realtime 服务 |
| `isConnected: false` | 未连接或连接断开 |
| `isSubscribed: true` | 有活跃的订阅 |
| `isSubscribed: false` | 没有活跃的订阅 |

## 错误处理

### 常见错误

1. **连接错误**
   ```typescript
   if (error) {
     console.error('连接错误:', error);
   }
   ```

2. **订阅错误**
   ```typescript
   subscribe({
     table: 'my_table',
     event: '*',
     onError: (error) => {
       console.error('订阅错误:', error);
     }
   });
   ```

3. **超时错误**
   - 检查网络连接
   - 确认 Supabase 服务状态
   - 查看连接池配置

## 性能优化

### 连接池配置

- **最大连接数**: 5
- **最小连接数**: 1
- **页面连接空闲超时**: 1分钟
- **长期连接空闲超时**: 30分钟

### 最佳实践

1. **合理使用连接类型**
   - 页面功能使用 `page` 连接
   - 系统服务使用 `long-term` 连接

2. **及时清理订阅**
   ```typescript
   useEffect(() => {
     const subscriptionId = subscribe({...});
     return () => unsubscribe(subscriptionId);
   }, []);
   ```

3. **避免重复订阅**
   ```typescript
   // 检查是否已订阅
   if (!isSubscribed) {
     const id = await subscribe({...});
   }
   ```

4. **使用过滤条件**
   ```typescript
   subscribe({
     table: 'notifications',
     event: 'INSERT',
     filter: `user_id=eq.${userId}`, // 只监听当前用户的通知
     onData: (payload) => {...}
   });
   ```
