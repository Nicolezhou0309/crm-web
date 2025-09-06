# Realtime 快速入门

## 5分钟上手

### 1. 基础订阅

```typescript
import { useRealtime } from '../hooks/useRealtime';

const MyComponent = () => {
  const { subscribe, isConnected, error } = useRealtime();

  useEffect(() => {
    const startSubscription = async () => {
      await subscribe({
        table: 'live_stream_schedules',
        event: '*',
        onData: (payload) => {
          console.log('数据更新:', payload);
        }
      });
    };

    startSubscription();
  }, []);

  return (
    <div>
      <p>状态: {isConnected ? '已连接' : '未连接'}</p>
      {error && <p>错误: {error}</p>}
    </div>
  );
};
```

### 2. 直播报名监听

```typescript
import { useRealtime } from '../hooks/useRealtime';

const LiveStreamPage = () => {
  const { subscribe, unsubscribe } = useRealtime();
  const [subscriptionId, setSubscriptionId] = useState<string>('');

  useEffect(() => {
    const startLiveStreamSubscription = async () => {
      const id = await subscribe({
        table: 'live_stream_schedules',
        event: '*',
        source: 'LiveStreamPage',
        connectionType: 'page', // 页面连接，根据可见性管理
        onData: (payload) => {
          if (payload.eventType === 'INSERT') {
            console.log('新直播安排:', payload.new);
          } else if (payload.eventType === 'UPDATE') {
            console.log('直播安排更新:', payload.new);
          }
        }
      });
      setSubscriptionId(id);
    };

    startLiveStreamSubscription();

    return () => {
      if (subscriptionId) {
        unsubscribe(subscriptionId);
      }
    };
  }, []);

  return <div>直播报名页面</div>;
};
```

### 3. 系统通知监听

```typescript
import { useRealtime } from '../hooks/useRealtime';
import { useUser } from '../context/UserContext';

const NotificationService = () => {
  const { subscribe } = useRealtime();
  const { user } = useUser();

  useEffect(() => {
    if (!user?.id) return;

    const id = subscribe({
      table: 'notifications',
      event: 'INSERT',
      filter: `user_id=eq.${user.id}`,
      source: 'NotificationService',
      connectionType: 'long-term', // 长期连接，持续保持
      onData: (payload) => {
        // 显示新通知
        showNotification({
          title: payload.new.title,
          content: payload.new.content
        });
      }
    });

    return () => unsubscribe(id);
  }, [user?.id]);

  return null; // 服务组件
};
```

## 连接类型选择

### 页面连接 (page) - 默认
- **用途**: 直播报名、页面数据监听
- **特点**: 页面不可见时自动释放
- **配置**: 1分钟空闲超时，5分钟最大年龄

```typescript
subscribe({
  table: 'live_stream_schedules',
  event: '*',
  connectionType: 'page', // 可省略，默认为 page
  onData: (payload) => {...}
});
```

### 长期连接 (long-term)
- **用途**: 系统通知、全局状态监听
- **特点**: 持续保持，不易被清理
- **配置**: 30分钟空闲超时，2小时最大年龄

```typescript
subscribe({
  table: 'notifications',
  event: '*',
  connectionType: 'long-term',
  onData: (payload) => {...}
});
```

## 常用模式

### 1. 页面数据监听

```typescript
const PageComponent = () => {
  const { subscribe, unsubscribe } = useRealtime();
  const [data, setData] = useState([]);

  useEffect(() => {
    const id = subscribe({
      table: 'my_table',
      event: '*',
      source: 'PageComponent',
      onData: (payload) => {
        if (payload.eventType === 'INSERT') {
          setData(prev => [payload.new, ...prev]);
        } else if (payload.eventType === 'UPDATE') {
          setData(prev => prev.map(item => 
            item.id === payload.new.id ? payload.new : item
          ));
        } else if (payload.eventType === 'DELETE') {
          setData(prev => prev.filter(item => item.id !== payload.old.id));
        }
      }
    });

    return () => unsubscribe(id);
  }, []);

  return <div>{/* 渲染数据 */}</div>;
};
```

### 2. 实时通知

```typescript
const NotificationComponent = () => {
  const { subscribe } = useRealtime();
  const { user } = useUser();

  useEffect(() => {
    if (!user?.id) return;

    subscribe({
      table: 'notifications',
      event: 'INSERT',
      filter: `user_id=eq.${user.id}`,
      source: 'NotificationComponent',
      connectionType: 'long-term',
      onData: (payload) => {
        // 显示通知
        message.success(payload.new.title);
      }
    });
  }, [user?.id]);

  return null;
};
```

### 3. 多订阅管理

```typescript
const MultiSubscriptionComponent = () => {
  const { subscribe, unsubscribeAll } = useRealtime();

  useEffect(() => {
    // 同时订阅多个表
    const subscriptions = [
      subscribe({
        table: 'live_stream_schedules',
        event: '*',
        source: 'LiveStreamData',
        onData: (payload) => console.log('直播数据:', payload)
      }),
      subscribe({
        table: 'notifications',
        event: 'INSERT',
        source: 'Notifications',
        connectionType: 'long-term',
        onData: (payload) => console.log('通知:', payload)
      })
    ];

    return () => {
      unsubscribeAll(); // 清理所有订阅
    };
  }, []);

  return <div>多订阅组件</div>;
};
```

## 错误处理

### 基础错误处理

```typescript
const { subscribe, error } = useRealtime();

useEffect(() => {
  const id = subscribe({
    table: 'my_table',
    event: '*',
    onData: (payload) => {...},
    onError: (error) => {
      console.error('订阅错误:', error);
      // 处理错误
    }
  });
}, []);

if (error) {
  return <div>连接错误: {error}</div>;
}
```

### 重试机制

```typescript
const [retryCount, setRetryCount] = useState(0);
const maxRetries = 3;

const subscribeWithRetry = async () => {
  try {
    const id = await subscribe({
      table: 'my_table',
      event: '*',
      onData: (payload) => {...}
    });
    setRetryCount(0); // 重置重试计数
  } catch (error) {
    if (retryCount < maxRetries) {
      setRetryCount(prev => prev + 1);
      setTimeout(subscribeWithRetry, 1000 * retryCount);
    } else {
      console.error('订阅失败，已达到最大重试次数');
    }
  }
};
```

## 调试技巧

### 1. 查看连接状态

```typescript
const { isConnected, isSubscribed, stats } = useRealtime();

console.log('连接状态:', { isConnected, isSubscribed });
console.log('统计信息:', stats);
```

### 2. 监控连接池

```typescript
import { realtimeManager } from '../services/RealtimeManager';

// 获取详细统计
const stats = realtimeManager.getStats();
console.log('连接池状态:', stats.connectionPool);
```

### 3. 启用调试日志

在浏览器控制台中查看详细的连接和订阅日志，包括：
- 连接建立和断开
- 订阅创建和取消
- 数据接收和处理
- 错误和重连信息

## 常见问题

### Q: 为什么订阅没有响应？
A: 检查以下几点：
1. 表名和事件类型是否正确
2. 是否有数据库权限
3. 过滤条件是否正确
4. 连接是否正常

### Q: 连接被过早清理？
A: 确认连接类型设置：
- 页面功能使用 `page` 连接
- 系统服务使用 `long-term` 连接

### Q: 如何优化性能？
A: 建议：
1. 使用合适的连接类型
2. 设置精确的过滤条件
3. 及时取消不需要的订阅
4. 避免重复订阅

### Q: 如何处理网络断开？
A: 系统会自动重连，也可以手动处理：
```typescript
const { isConnected, error } = useRealtime();

if (!isConnected && error) {
  // 显示重连提示
  console.log('连接断开，正在重连...');
}
```

## 下一步

- 查看 [完整使用文档](./REALTIME_USAGE.md)
- 参考 [API 文档](./REALTIME_API.md)
- 了解连接池配置和优化
- 学习高级用法和最佳实践
