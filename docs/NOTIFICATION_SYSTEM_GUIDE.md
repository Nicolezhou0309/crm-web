# 通知系统使用指南

## 📋 系统概述

通知系统为CRM提供了完整的公告和通知功能，包括：

- **实时通知**：基于Supabase Realtime的实时推送
- **公告管理**：面向全体用户的系统公告
- **个性化通知**：针对特定用户的个性化通知
- **权限控制**：基于角色和组织的权限管理
- **通知删除**：用户可删除自己的通知

## 🏗️ 系统架构

### 数据库表结构

#### 1. 公告表 (`announcements`)
```sql
- id: 公告ID (UUID)
- title: 公告标题
- content: 公告内容
- type: 公告类型 (info/warning/success/error)
- priority: 优先级 (0-3)
- target_roles: 目标角色数组
- target_organizations: 目标组织数组
- is_active: 是否激活
- start_time: 生效时间
- end_time: 过期时间
- created_by: 创建者ID
- created_at: 创建时间
- updated_at: 更新时间
```

#### 2. 通知表 (`notifications`)
```sql
- id: 通知ID (UUID)
- user_id: 用户ID (bigint)
- type: 通知类型 (system/lead_assignment/duplicate_customer/task_reminder)
- title: 通知标题
- content: 通知内容
- metadata: 元数据 (JSONB)
- status: 状态 (unread/read/handled)
- priority: 优先级 (0-3)
- expires_at: 过期时间
- created_at: 创建时间
- read_at: 已读时间
- handled_at: 处理时间
- related_table: 关联表名
- related_id: 关联记录ID
```

#### 3. 公告阅读记录表 (`announcement_reads`)
```sql
- id: 记录ID (UUID)
- announcement_id: 公告ID
- user_id: 用户ID
- read_at: 阅读时间
```

### 核心函数

#### 1. 通知相关函数
```sql
-- 获取用户通知
get_user_notifications(p_user_id bigint)

-- 标记通知为已读
mark_notification_read(p_notification_id uuid, p_user_id bigint)

-- 标记通知为已处理
mark_notification_handled(p_notification_id uuid, p_user_id bigint)

-- 创建通知
create_notification(p_user_id bigint, p_type text, p_title text, p_content text, p_metadata jsonb, p_priority integer)

-- 获取通知统计
get_notification_stats(p_user_id bigint)
```

#### 2. 公告相关函数
```sql
-- 获取用户公告
get_user_announcements(p_user_id bigint)

-- 标记公告为已读
mark_announcement_read(p_announcement_id uuid, p_user_id bigint)

-- 创建公告
create_announcement(p_title text, p_content text, p_type text, p_priority integer, p_target_roles text[], p_target_organizations uuid[], p_start_time timestamptz, p_end_time timestamptz, p_created_by bigint)
```

## 🔒 权限控制

### RLS策略

#### 1. 通知表权限
```sql
-- 用户查看自己的通知
CREATE POLICY "Users can view their own notifications" ON notifications
FOR SELECT USING (
  user_id = (
    SELECT id FROM users_profile 
    WHERE user_id = auth.uid()
  )
);

-- 用户插入自己的通知
CREATE POLICY "Users can insert their own notifications" ON notifications
FOR INSERT WITH CHECK (
  user_id = (
    SELECT id FROM users_profile 
    WHERE user_id = auth.uid()
  )
);

-- 用户更新自己的通知
CREATE POLICY "Users can update their own notifications" ON notifications
FOR UPDATE USING (
  user_id = (
    SELECT id FROM users_profile 
    WHERE user_id = auth.uid()
  )
) WITH CHECK (
  user_id = (
    SELECT id FROM users_profile 
    WHERE user_id = auth.uid()
  )
);

-- 用户删除自己的通知
CREATE POLICY "Users can delete their own notifications" ON notifications
FOR DELETE USING (
  user_id = (
    SELECT id FROM users_profile 
    WHERE user_id = auth.uid()
  )
);

-- 管理员管理所有通知
CREATE POLICY "Admins can manage all notifications" ON notifications
FOR ALL USING (
  EXISTS (
    SELECT 1 FROM user_roles ur
    JOIN roles r ON ur.role_id = r.id
    WHERE ur.user_id = auth.uid()
    AND r.name = 'admin'
  )
);

-- 服务角色管理所有通知
CREATE POLICY "Service role can manage all notifications" ON notifications
FOR ALL USING (
  auth.role() = 'service_role'
);
```

#### 2. 公告表权限
```sql
-- 用户查看活跃公告
CREATE POLICY "Users can view active announcements" ON announcements
FOR SELECT USING (
  is_active = true 
  AND start_time <= now() 
  AND (end_time IS NULL OR end_time > now())
);
```

#### 3. 公告阅读记录表权限
```sql
-- 用户管理自己的阅读记录
CREATE POLICY "Users can manage their own announcement reads" ON announcement_reads
FOR ALL USING (
  user_id = (
    SELECT id FROM users_profile 
    WHERE user_id = auth.uid()
  )
);
```

## 🚀 部署步骤

### 1. 数据库部署
```bash
# 连接到数据库并执行完整备份脚本
psql "postgresql://postgres.wteqgprgiylmxzszcnws:[YOUR_PASSWORD]@aws-0-ap-southeast-1.pooler.supabase.com:5432/postgres" -f notification_system_complete_backup.sql
```

### 2. Edge Function部署
```bash
# 部署通知系统API
supabase functions deploy notification-system
```

### 3. 启用Realtime
在Supabase Dashboard中：
1. 进入 **Database** → **Replication**
2. 启用以下表的实时复制：
   - `announcements`
   - `notifications`
   - `announcement_reads`

## 📝 使用示例

### 1. 前端API调用

#### 获取用户通知
```typescript
import { notificationApi } from '../api/notificationApi';

// 获取所有通知
const notifications = await notificationApi.getNotifications();

// 获取未读通知
const unreadNotifications = await notificationApi.getNotifications({ status: 'unread' });
```

#### 创建通知
```typescript
// 创建线索分配通知
await notificationApi.createNotification({
  target_user_id: 123,
  type: 'lead_assignment',
  title: '新线索分配',
  content: '线索已分配给您',
  priority: 1
});
```

#### 标记通知状态
```typescript
// 标记为已读
await notificationApi.markNotificationRead(notificationId);

// 标记为已处理
await notificationApi.markNotificationHandled(notificationId);

// 删除通知
await notificationApi.deleteNotification(notificationId);
```

#### 公告管理
```typescript
// 获取公告
const announcements = await notificationApi.getAnnouncements();

// 创建公告
await notificationApi.createAnnouncement({
  title: '系统维护通知',
  content: '系统将于今晚进行维护',
  type: 'warning',
  priority: 1
});

// 标记公告为已读
await notificationApi.markAnnouncementRead(announcementId);
```

### 2. 前端组件使用

#### 通知中心组件
```typescript
import { NotificationCenter } from '../components/NotificationCenter';

// 在页面中使用
<NotificationCenter onNotificationChange={(count) => {
  console.log('未读通知数量:', count);
}} />
```

#### 实时Hook
```typescript
import { useRealtimeNotifications } from '../hooks/useRealtimeNotifications';

// 在组件中使用
const { notifications, unreadCount, markAsRead, deleteNotification } = useRealtimeNotifications();
```

### 3. 公告管理页面
```typescript
import AnnouncementManagement from '../pages/AnnouncementManagement';

// 在路由中使用
<Route path="/announcements" element={<AnnouncementManagement />} />
```

## 🎨 界面功能

### 1. 通知中心界面
- **通知标签页**：显示个人通知
- **公告标签页**：显示系统公告
- **未读计数**：实时显示未读数量
- **状态管理**：支持标记已读/已处理/删除
- **分类过滤**：按类型过滤通知

### 2. 公告配置管理
- **公告列表**：显示所有公告
- **创建公告**：支持类型、优先级、时间设置
- **编辑公告**：修改公告内容和状态
- **删除公告**：管理员可删除公告
- **统计信息**：显示公告总数和状态分布

### 3. 通知详情
- **完整信息**：显示通知的完整内容
- **元数据**：显示相关的业务数据
- **操作按钮**：支持标记已读/已处理/删除

## 🔧 故障排除

### 常见问题

#### 1. 通知删除失败
**问题**：用户无法删除自己的通知
**解决方案**：
1. 检查RLS策略是否包含DELETE权限
2. 确认用户权限映射正确
3. 检查Edge Function是否正确部署

#### 2. 通知不显示
**问题**：用户看不到通知
**解决方案**：
1. 检查RLS策略是否正确
2. 确认用户ID映射
3. 检查Realtime是否启用

#### 3. 权限错误
**问题**：出现权限相关错误
**解决方案**：
1. 检查用户角色设置
2. 确认RLS策略配置
3. 验证API密钥权限

### 调试步骤

#### 1. 检查RLS策略
```sql
-- 查看当前策略
SELECT 
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd,
  qual,
  with_check
FROM pg_policies 
WHERE tablename IN ('notifications', 'announcements', 'announcement_reads')
ORDER BY tablename, policyname;
```

#### 2. 检查函数
```sql
-- 查看通知相关函数
SELECT routine_name, routine_type 
FROM information_schema.routines 
WHERE routine_name LIKE '%notification%' OR routine_name LIKE '%announcement%'
ORDER BY routine_name;
```

#### 3. 检查数据
```sql
-- 查看通知数据
SELECT * FROM notifications WHERE user_id = 1 LIMIT 5;

-- 查看公告数据
SELECT * FROM announcements WHERE is_active = true LIMIT 5;
```

## 📊 性能优化

### 1. 索引优化
```sql
-- 通知表索引
CREATE INDEX idx_notifications_user_status ON notifications (user_id, status);
CREATE INDEX idx_notifications_created_at ON notifications (created_at DESC);

-- 公告表索引
CREATE INDEX idx_announcements_active_time ON announcements (is_active, start_time, end_time);
CREATE INDEX idx_announcements_priority ON announcements (priority DESC);
```

### 2. 查询优化
- 使用分页查询大量数据
- 按需加载通知详情
- 缓存常用查询结果

### 3. 实时性能
- 合理使用Realtime订阅
- 避免频繁的状态更新
- 优化前端渲染性能

## 🔄 版本更新

### 当前版本功能
- ✅ 基础通知功能
- ✅ 公告管理功能
- ✅ 实时推送
- ✅ 权限控制
- ✅ 通知删除
- ✅ 统计功能

### 未来扩展
- 🔄 富文本公告内容
- 🔄 通知模板系统
- 🔄 批量操作功能
- 🔄 通知历史记录
- 🔄 高级过滤功能

## 📞 技术支持

如果遇到问题，请：

1. 检查Edge Function日志
2. 验证RLS策略状态
3. 确认数据库连接
4. 查看前端控制台错误
5. 提供具体的错误信息

---

**通知系统完整备份文件**：`notification_system_complete_backup.sql`
**使用指南**：本文档
**API文档**：参考 `src/api/notificationApi.ts` 