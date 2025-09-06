# Realtime 使用文档

## 概述

Realtime 系统提供两种连接类型来满足不同的业务需求：
- **页面连接 (page)**: 用于页面相关功能，如直播报名，根据页面可见性管理
- **长期连接 (long-term)**: 用于系统通知等全局功能，持续保持连接

## 核心组件

### 1. RealtimeManager
统一的 Realtime 连接管理器，采用单例模式，负责管理所有连接和订阅。

### 2. useRealtime Hook
React Hook，提供简洁的订阅接口，支持两种连接类型。

## 快速开始

### 基础使用

```typescript
import { useRealtime } from '../hooks/useRealtime';

const MyComponent = () => {
  const { isConnected, error, subscribe, unsubscribe } = useRealtime();

  const handleSubscribe = async () => {
    const subscriptionId = await subscribe({
      table: 'live_stream_schedules',
      event: '*',
      source: 'LiveStreamPage',
      connectionType: 'page', // 页面连接（默认）
      onData: (payload) => {
        console.log('收到数据:', payload);
      }
    });
  };

  return (
    <div>
      <p>连接状态: {isConnected ? '已连接' : '未连接'}</p>
      {error && <p>错误: {error}</p>}
      <button onClick={handleSubscribe}>开始订阅</button>
    </div>
  );
};
```

## 连接类型详解

### 页面连接 (page) - 默认类型

**用途**: 直播报名等页面相关功能
**特点**: 根据页面可见性管理连接
**生命周期**: 页面不可见时快速释放

```typescript
const { subscribe } = useRealtime();

// 直播报名监听
const subscriptionId = await subscribe({
  table: 'live_stream_schedules',
  event: '*',
  source: 'LiveStreamPage',
  connectionType: 'page', // 可省略，默认为 page
  onData: (payload) => {
    console.log('直播安排更新:', payload);
  }
});
```

**配置参数**:
- 空闲超时: 1分钟
- 最大年龄: 5分钟

### 长期连接 (long-term)

**用途**: 系统通知等全局功能
**特点**: 长期保持，不易被清理
**生命周期**: 持续保持，直到手动取消

```typescript
const { subscribe } = useRealtime();

// 系统通知监听
const subscriptionId = await subscribe({
  table: 'notifications',
  event: '*',
  filter: `user_id=eq.${userId}`,
  source: 'NotificationService',
  connectionType: 'long-term',
  onData: (payload) => {
    console.log('收到通知:', payload);
  }
});
```

**配置参数**:
- 空闲超时: 30分钟
- 最大年龄: 2小时

## API 参考

### useRealtime Hook

#### 返回值

```typescript
interface UseRealtimeReturn {
  isConnected: boolean;        // 连接状态
  isSubscribed: boolean;       // 订阅状态
  error: string | null;        // 错误信息
  stats: any;                  // 统计信息
  subscribe: (options: UseRealtimeOptions) => Promise<string>;  // 订阅方法
  unsubscribe: (subscriptionId: string) => void;               // 取消订阅
  unsubscribeAll: () => void;  // 取消所有订阅
}
```

#### 订阅选项

```typescript
interface UseRealtimeOptions {
  table: string;                    // 表名
  event: 'INSERT' | 'UPDATE' | 'DELETE' | '*';  // 事件类型
  filter?: string;                  // 过滤条件
  source?: string;                  // 订阅来源
  connectionType?: 'page' | 'long-term';  // 连接类型
  onData?: (payload: any) => void;  // 数据回调
  onError?: (error: any) => void;   // 错误回调
}
```

### RealtimeManager

#### 主要方法

```typescript
// 订阅数据库变化
async subscribe(userId: string, subscription: RealtimeSubscription): Promise<string>

// 取消订阅
unsubscribe(subscriptionId: string): void

// 清理用户所有订阅
unsubscribeAll(userId: string): void

// 获取统计信息
getStats(): RealtimeStats

// 启用/禁用功能
setEnabled(enabled: boolean): void

// 清理所有连接
cleanup(): void
```

## 使用示例

### 1. 直播报名页面

```typescript
import { useRealtime } from '../hooks/useRealtime';
import { useEffect, useState } from 'react';

const LiveStreamPage = () => {
  const { subscribe, unsubscribe, isConnected, error } = useRealtime();
  const [subscriptionId, setSubscriptionId] = useState<string>('');

  useEffect(() => {
    // 页面加载时开始订阅
    const startSubscription = async () => {
      const id = await subscribe({
        table: 'live_stream_schedules',
        event: '*',
        source: 'LiveStreamPage',
        connectionType: 'page',
        onData: (payload) => {
          console.log('直播安排更新:', payload);
          // 处理数据更新
        },
        onError: (error) => {
          console.error('订阅错误:', error);
        }
      });
      setSubscriptionId(id);
    };

    startSubscription();

    // 页面卸载时取消订阅
    return () => {
      if (subscriptionId) {
        unsubscribe(subscriptionId);
      }
    };
  }, []);

  return (
    <div>
      <h1>直播报名</h1>
      <p>连接状态: {isConnected ? '已连接' : '未连接'}</p>
      {error && <p>错误: {error}</p>}
    </div>
  );
};
```

### 2. 系统通知

```typescript
import { useRealtime } from '../hooks/useRealtime';
import { useEffect } from 'react';

const NotificationService = () => {
  const { subscribe, unsubscribe } = useRealtime();
  const { user } = useUser();

  useEffect(() => {
    if (!user?.id) return;

    // 系统通知使用长期连接
    const subscriptionId = subscribe({
      table: 'notifications',
      event: '*',
      filter: `user_id=eq.${user.id}`,
      source: 'NotificationService',
      connectionType: 'long-term',
      onData: (payload) => {
        if (payload.eventType === 'INSERT') {
          // 显示新通知
          showNotification(payload.new);
        }
      }
    });

    return () => {
      unsubscribe(subscriptionId);
    };
  }, [user?.id]);

  return null; // 这是一个服务组件
};
```

### 3. 多订阅管理

```typescript
import { useRealtime } from '../hooks/useRealtime';
import { useEffect, useState } from 'react';

const MultiSubscriptionComponent = () => {
  const { subscribe, unsubscribeAll } = useRealtime();
  const [subscriptions, setSubscriptions] = useState<string[]>([]);

  useEffect(() => {
    const startSubscriptions = async () => {
      const ids = await Promise.all([
        // 页面连接 - 直播数据
        subscribe({
          table: 'live_stream_schedules',
          event: '*',
          source: 'LiveStreamData',
          connectionType: 'page',
          onData: (payload) => console.log('直播数据:', payload)
        }),
        // 长期连接 - 系统通知
        subscribe({
          table: 'notifications',
          event: 'INSERT',
          source: 'SystemNotifications',
          connectionType: 'long-term',
          onData: (payload) => console.log('系统通知:', payload)
        })
      ]);
      
      setSubscriptions(ids.filter(id => id));
    };

    startSubscriptions();

    return () => {
      unsubscribeAll();
    };
  }, []);

  return (
    <div>
      <p>活跃订阅数: {subscriptions.length}</p>
    </div>
  );
};
```

## 最佳实践

### 1. 连接类型选择

- **页面功能** → 使用 `page` 连接
- **系统服务** → 使用 `long-term` 连接

### 2. 错误处理

```typescript
const { subscribe } = useRealtime();

const handleSubscribe = async () => {
  try {
    const subscriptionId = await subscribe({
      table: 'my_table',
      event: '*',
      onData: (payload) => {
        // 处理数据
      },
      onError: (error) => {
        console.error('订阅错误:', error);
        // 处理错误
      }
    });
  } catch (error) {
    console.error('订阅失败:', error);
  }
};
```

### 3. 资源清理

```typescript
useEffect(() => {
  const subscriptionId = subscribe({...});

  // 组件卸载时清理
  return () => {
    if (subscriptionId) {
      unsubscribe(subscriptionId);
    }
  };
}, []);
```

### 4. 性能优化

- 避免重复订阅相同的数据
- 及时取消不需要的订阅
- 使用合适的连接类型
- 合理设置过滤条件

## 配置说明

当前配置已硬编码，无需环境变量：

- **最大连接数**: 5
- **最小连接数**: 1
- **页面连接空闲超时**: 1分钟
- **页面连接最大年龄**: 5分钟
- **长期连接空闲超时**: 30分钟
- **长期连接最大年龄**: 2小时

## 故障排除

### 常见问题

1. **连接失败**
   - 检查网络连接
   - 确认 Supabase 配置正确
   - 查看控制台错误信息

2. **订阅无响应**
   - 确认表名和事件类型正确
   - 检查过滤条件
   - 验证数据库权限

3. **连接被清理**
   - 检查连接类型设置
   - 确认连接使用频率
   - 查看空闲时间配置

### 调试技巧

```typescript
// 获取连接统计信息
import { realtimeManager } from '../services/RealtimeManager';

const stats = realtimeManager.getStats();
console.log('连接池统计:', stats.connectionPool);
```

## 更新日志

- **v1.0.0**: 初始版本，支持页面连接和长期连接
- 简化配置，移除环境变量依赖
- 优化连接池管理
- 提供完整的 TypeScript 支持
