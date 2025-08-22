# 通知系统使用指南

## 📋 系统概述

本通知系统为您的CRM提供了完整的公告和通知功能，包括：

- **实时通知**：基于Supabase Realtime的实时推送
- **公告管理**：面向全体用户的系统公告
- **个性化通知**：针对特定用户的个性化通知
- **权限控制**：基于角色和组织的权限管理

## 🚀 快速部署

### 1. 数据库部署

```bash
# 连接到您的Supabase数据库
psql "postgresql://postgres.wteqgprgiylmxzszcnws:[gAC5Yqi01wh3eISR]@aws-0-ap-southeast-1.pooler.supabase.com:5432/postgres"

# 执行部署脚本
\i deploy_notification_system.sql
```

### 2. 启用Realtime

在Supabase Dashboard中：
1. 进入 **Database** → **Replication**
2. 启用以下表的实时复制：
   - `announcements`
   - `notifications`
   - `announcement_reads`

### 3. 部署Edge Function

```bash
# 部署通知系统API
supabase functions deploy notification-system
```

## 🏗️ 系统架构

### 数据库表结构

#### 1. 公告表 (`announcements`)
```sql
- id: 公告ID
- title: 公告标题
- content: 公告内容
- type: 公告类型 (info/warning/success/error)
- priority: 优先级
- target_roles: 目标角色
- target_organizations: 目标组织
- is_active: 是否激活
- start_time: 生效时间
- end_time: 过期时间
- created_by: 创建者
- created_at: 创建时间
- updated_at: 更新时间
```

#### 2. 通知表 (`notifications`)
```sql
- id: 通知ID
- user_id: 用户ID
- type: 通知类型
- title: 通知标题
- content: 通知内容
- metadata: 元数据
- status: 状态 (unread/read/handled)
- priority: 优先级
- expires_at: 过期时间
- created_at: 创建时间
- read_at: 已读时间
- handled_at: 处理时间
```

#### 3. 公告阅读记录表 (`announcement_reads`)
```sql
- id: 记录ID
- announcement_id: 公告ID
- user_id: 用户ID
- read_at: 阅读时间
```

### 前端组件

#### 1. 通知中心组件
```typescript
import { NotificationCenter } from '../components/NotificationCenter';

// 在页面中使用
<NotificationCenter onNotificationChange={(count) => {
  console.log('未读通知数量:', count);
}} />
```

#### 2. 实时Hook
```typescript
import { useRealtimeNotifications } from '../hooks/useRealtimeNotifications';
import { useRealtimeAnnouncements } from '../hooks/useRealtimeAnnouncements';

// 在组件中使用
const { notifications, unreadCount, markAsRead } = useRealtimeNotifications();
const { announcements, unreadAnnouncements } = useRealtimeAnnouncements();
```

## 📝 使用示例

### 1. 创建通知

```typescript
import { notificationApi } from '../api/notificationApi';

// 创建线索分配通知
await notificationApi.createLeadAssignmentNotification(userId, leadId);

// 创建重复客户通知
await notificationApi.createDuplicateCustomerNotification(userId, duplicateData);

// 创建自定义通知
await notificationApi.createNotification({
  target_user_id: 123,
  type: 'task_reminder',
  title: '任务提醒',
  content: '您有一个待处理的任务',
  priority: 1
});
```

### 2. 创建公告

```typescript
// 创建系统公告
await notificationApi.createSystemAnnouncement({
  title: '系统维护通知',
  content: '系统将于今晚进行维护',
  type: 'warning',
  priority: 1
});

// 创建针对特定组织的公告
await notificationApi.createAnnouncement({
  title: '部门会议通知',
  content: '明天下午2点召开部门会议',
  type: 'info',
  target_organizations: ['org-id-1', 'org-id-2']
});
```

### 3. 标记通知状态

```typescript
// 标记为已读
await notificationApi.markNotificationRead(notificationId);

// 标记为已处理
await notificationApi.markNotificationHandled(notificationId);

// 标记公告为已读
await notificationApi.markAnnouncementRead(announcementId);
```

## 🔧 API接口

### 通知相关接口

#### 获取通知列表
```typescript
GET /functions/v1/notification-system?action=notifications&status=unread&limit=50
```

#### 创建通知
```typescript
POST /functions/v1/notification-system?action=create_notification
{
  "target_user_id": 123,
  "type": "lead_assignment",
  "title": "新线索分配",
  "content": "线索已分配给您",
  "priority": 1
}
```

#### 标记通知状态
```typescript
POST /functions/v1/notification-system?action=mark_read
{
  "notification_id": "uuid"
}
```

### 公告相关接口

#### 获取公告列表
```typescript
GET /functions/v1/notification-system?action=announcements&unread_only=true
```

#### 创建公告
```typescript
POST /functions/v1/notification-system?action=create_announcement
{
  "title": "系统公告",
  "content": "公告内容",
  "type": "info",
  "priority": 0
}
```

#### 更新公告
```typescript
PUT /functions/v1/notification-system?action=update_announcement
{
  "id": "uuid",
  "title": "更新后的标题",
  "content": "更新后的内容"
}
```

## 🎨 界面功能

### 1. 通知中心界面

- **通知标签页**：显示个人通知
- **公告标签页**：显示系统公告
- **未读计数**：实时显示未读数量
- **状态管理**：支持标记已读/已处理

### 2. 通知详情

- **完整信息**：显示通知的完整内容
- **元数据**：显示相关的业务数据
- **操作按钮**：支持标记已读/已处理

### 3. 公告详情

- **富文本内容**：支持格式化的公告内容
- **时间信息**：显示发布时间和有效期
- **权限控制**：管理员可以编辑/删除公告

## 🔒 权限控制

### 1. 通知权限

- 用户只能查看自己的通知
- 基于RLS策略自动过滤
- 支持通知的创建、读取、更新

### 2. 公告权限

- 所有用户都可以查看有权限的公告
- 管理员可以创建、编辑、删除公告
- 支持基于角色和组织的权限控制

### 3. 阅读记录

- 自动记录用户的阅读状态
- 防止重复标记已读
- 支持阅读统计

## 🚀 实时功能

### 1. Realtime订阅

```typescript
// 订阅通知变化
const channel = supabase
  .channel('notifications')
  .on('postgres_changes', {
    event: 'INSERT',
    schema: 'public',
    table: 'notifications',
    filter: `user_id=eq.${userId}`
  }, (payload) => {
    // 处理新通知
    console.log('收到新通知:', payload.new);
  })
  .subscribe();
```

### 2. 桌面通知

```typescript
// 显示桌面通知
if ('Notification' in window && Notification.permission === 'granted') {
  new Notification(title, {
    body: content,
    icon: '/favicon.ico'
  });
}
```

## 📊 性能优化

### 1. 数据库优化

- 创建了合适的索引
- 使用RLS策略减少数据传输
- 支持分页查询

### 2. 前端优化

- 使用React Hook缓存数据
- 实现虚拟滚动（大量数据时）
- 支持懒加载

### 3. 实时优化

- 使用过滤器减少不必要的数据
- 支持连接重试机制
- 实现错误处理

## 🛠️ 故障排除

### 1. 常见问题

**Q: 通知没有实时推送？**
A: 检查Realtime是否已启用，确保表已添加到复制列表中。

**Q: 权限错误？**
A: 检查RLS策略是否正确配置，确保用户有相应权限。

**Q: 通知数量不准确？**
A: 检查Hook中的状态更新逻辑，确保正确计算未读数量。

### 2. 调试技巧

```typescript
// 启用调试日志
console.log('通知数据:', notifications);
console.log('公告数据:', announcements);

// 检查Realtime连接状态
supabase.channel('debug').subscribe((status) => {
  console.log('连接状态:', status);
});
```

## 📈 扩展功能

### 1. 通知模板

```typescript
// 创建通知模板
const notificationTemplates = {
  lead_assignment: {
    title: '新线索分配',
    content: '线索 {leadId} 已分配给您',
    icon: '🎯',
    color: '#1890ff'
  },
  duplicate_customer: {
    title: '重复客户提醒',
    content: '发现重复客户：{newLeadId} 与 {originalLeadId}',
    icon: '🔄',
    color: '#fa8c16'
  }
};
```

### 2. 批量操作

```typescript
// 批量标记已读
const markAllAsRead = async () => {
  const unreadNotifications = notifications.filter(n => n.status === 'unread');
  await Promise.all(
    unreadNotifications.map(n => markAsRead(n.id))
  );
};
```

### 3. 通知统计

```typescript
// 获取通知统计
const stats = await notificationApi.getNotificationStats();
console.log('通知统计:', stats);
// { total: 10, unread: 3, read: 5, handled: 2 }
```

## 🎯 最佳实践

### 1. 通知设计

- 使用清晰的标题和内容
- 设置合适的优先级
- 包含必要的元数据

### 2. 公告管理

- 定期清理过期公告
- 使用合适的公告类型
- 控制公告数量

### 3. 性能考虑

- 避免发送过多通知
- 使用批量操作
- 定期清理旧数据

## 📞 技术支持

如果您在使用过程中遇到问题，请：

1. 检查浏览器控制台的错误信息
2. 查看Supabase Dashboard的日志
3. 确认数据库连接和权限设置
4. 参考本文档的故障排除部分

---

**恭喜！** 您已成功部署了完整的通知系统。现在您的CRM系统具备了强大的实时通知和公告功能。 