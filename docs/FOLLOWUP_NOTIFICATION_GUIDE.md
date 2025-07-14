# Followups通知功能部署指南

## 📋 功能概述

本功能为CRM系统新增了自动通知机制，当新增或更新followups记录时，会自动向对应的interviewsales用户发送通知。

### 主要特性

- **自动通知**：新增followups记录时自动发送通知
- **重新分配通知**：当线索重新分配时发送通知
- **详细信息**：通知包含线索ID、联系方式、来源等信息
- **实时推送**：基于Supabase Realtime的实时通知
- **元数据支持**：通知包含完整的线索和分配信息

## 🚀 部署步骤

### 1. 执行触发器脚本

```bash
# 连接到Supabase数据库
psql "postgresql://postgres.wteqgprgiylmxzszcnws:[gAC5Yqi01wh3eISR]@aws-0-ap-southeast-1.pooler.supabase.com:5432/postgres"

# 执行触发器脚本
\i create_followup_notification_trigger.sql
```

### 2. 验证部署

```sql
-- 检查触发器
SELECT 
  trigger_name,
  event_manipulation,
  action_timing
FROM information_schema.triggers 
WHERE trigger_name LIKE '%followup%';

-- 检查函数
SELECT routine_name, routine_type 
FROM information_schema.routines 
WHERE routine_name LIKE '%followup%' OR routine_name LIKE '%notification%';
```

### 3. 运行测试

```bash
# 运行测试脚本
node test_followup_notification.js
```

## 🏗️ 系统架构

### 触发器函数

#### 1. `notify_followup_assignment()`
- **触发时机**：INSERT操作后
- **功能**：为新增的followups记录创建通知
- **通知类型**：`followup_assignment`
- **优先级**：1

#### 2. `notify_followup_reassignment()`
- **触发时机**：UPDATE操作后
- **功能**：当分配用户变更时创建通知
- **通知类型**：`followup_reassignment`
- **优先级**：2

### 通知内容结构

#### 新增分配通知
```json
{
  "title": "新线索分配通知",
  "content": "您有新的线索需要跟进：25J00001 (联系方式：电话：13800138000，微信：test_wechat)",
  "type": "followup_assignment",
  "priority": 1,
  "metadata": {
    "leadid": "25J00001",
    "leadtype": "长租",
    "source": "抖音",
    "phone": "13800138000",
    "wechat": "test_wechat",
    "followupstage": "待接收",
    "assigned_user_id": 1,
    "assigned_user_nickname": "张三",
    "created_at": "2024-12-01T10:00:00Z"
  }
}
```

#### 重新分配通知
```json
{
  "title": "线索重新分配通知",
  "content": "线索 25J00001 已重新分配给您 (联系方式：电话：13800138000，微信：test_wechat)",
  "type": "followup_reassignment",
  "priority": 2,
  "metadata": {
    "leadid": "25J00001",
    "leadtype": "长租",
    "source": "抖音",
    "phone": "13800138000",
    "wechat": "test_wechat",
    "followupstage": "待接收",
    "old_assigned_user_id": 1,
    "old_assigned_user_nickname": "张三",
    "new_assigned_user_id": 2,
    "new_assigned_user_nickname": "李四",
    "updated_at": "2024-12-01T10:00:00Z"
  }
}
```

## 📱 前端集成

### 1. 通知类型常量

```typescript
// src/constants/notificationTypes.ts
export const NOTIFICATION_TYPES = {
  FOLLOWUP_ASSIGNMENT: 'followup_assignment',
  FOLLOWUP_REASSIGNMENT: 'followup_reassignment',
  // ... 其他类型
} as const;
```

### 2. 通知处理组件

```typescript
// src/components/FollowupNotificationHandler.tsx
import React from 'react';
import { useRealtimeNotifications } from '../hooks/useRealtimeNotifications';

export const FollowupNotificationHandler: React.FC = () => {
  const { notifications } = useRealtimeNotifications();
  
  const followupNotifications = notifications.filter(
    n => n.type === 'followup_assignment' || n.type === 'followup_reassignment'
  );
  
  return (
    <div>
      {followupNotifications.map(notification => (
        <div key={notification.id} className="notification-item">
          <h4>{notification.title}</h4>
          <p>{notification.content}</p>
          {notification.metadata && (
            <div className="notification-metadata">
              <span>线索ID: {notification.metadata.leadid}</span>
              <span>类型: {notification.metadata.leadtype}</span>
              <span>来源: {notification.metadata.source}</span>
            </div>
          )}
        </div>
      ))}
    </div>
  );
};
```

### 3. 通知中心集成

```typescript
// src/components/NotificationCenter.tsx
import { FollowupNotificationHandler } from './FollowupNotificationHandler';

export const NotificationCenter: React.FC = () => {
  return (
    <div className="notification-center">
      <h3>通知中心</h3>
      <FollowupNotificationHandler />
      {/* 其他通知类型处理 */}
    </div>
  );
};
```

## 🔧 配置选项

### 1. 通知优先级

```sql
-- 修改通知优先级
UPDATE notifications 
SET priority = 3 
WHERE type = 'followup_assignment' AND priority = 1;
```

### 2. 通知内容模板

```sql
-- 自定义通知内容（需要修改触发器函数）
-- 在 notify_followup_assignment() 函数中修改 v_content 的构建逻辑
```

### 3. 通知过滤

```sql
-- 只发送给特定角色的用户
-- 在触发器函数中添加角色检查逻辑
```

## 📊 监控和维护

### 1. 通知统计

```sql
-- 查看通知统计
SELECT 
  type,
  COUNT(*) as count,
  COUNT(*) FILTER (WHERE status = 'unread') as unread_count,
  COUNT(*) FILTER (WHERE status = 'read') as read_count
FROM notifications 
WHERE type IN ('followup_assignment', 'followup_reassignment')
GROUP BY type;
```

### 2. 性能监控

```sql
-- 查看触发器执行情况
SELECT 
  schemaname,
  tablename,
  trigger_name,
  action_timing,
  action_statement
FROM information_schema.triggers 
WHERE trigger_name LIKE '%followup%';
```

### 3. 错误日志

```sql
-- 查看最近的错误日志
SELECT 
  log_time,
  log_level,
  message
FROM pg_stat_statements 
WHERE query LIKE '%notify_followup%'
ORDER BY log_time DESC;
```

## 🚨 故障排除

### 1. 触发器未触发

**问题**：新增followups记录但没有收到通知

**解决方案**：
```sql
-- 检查触发器是否存在
SELECT trigger_name FROM information_schema.triggers 
WHERE trigger_name LIKE '%followup%';

-- 重新创建触发器
\i create_followup_notification_trigger.sql
```

### 2. 通知内容为空

**问题**：通知创建成功但内容为空

**解决方案**：
```sql
-- 检查用户和线索数据
SELECT 
  f.leadid,
  f.interviewsales_user_id,
  up.nickname,
  l.phone,
  l.wechat
FROM followups f
LEFT JOIN users_profile up ON f.interviewsales_user_id = up.id
LEFT JOIN leads l ON f.leadid = l.leadid
WHERE f.leadid = '你的线索ID';
```

### 3. 性能问题

**问题**：大量通知导致性能下降

**解决方案**：
```sql
-- 清理旧通知
DELETE FROM notifications 
WHERE created_at < NOW() - INTERVAL '30 days'
AND type IN ('followup_assignment', 'followup_reassignment');

-- 优化索引
CREATE INDEX CONCURRENTLY idx_notifications_type_created 
ON notifications (type, created_at DESC);
```

## 📈 扩展功能

### 1. 批量通知

```sql
-- 为多个用户同时发送通知
CREATE OR REPLACE FUNCTION notify_multiple_users(
  p_user_ids bigint[],
  p_type text,
  p_title text,
  p_content text
) RETURNS void AS $$
DECLARE
  user_id bigint;
BEGIN
  FOREACH user_id IN ARRAY p_user_ids
  LOOP
    PERFORM create_notification(user_id, p_type, p_title, p_content);
  END LOOP;
END;
$$ LANGUAGE plpgsql;
```

### 2. 通知模板

```sql
-- 创建通知模板表
CREATE TABLE notification_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  type text NOT NULL,
  title_template text NOT NULL,
  content_template text NOT NULL,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now()
);
```

### 3. 通知规则

```sql
-- 创建通知规则表
CREATE TABLE notification_rules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  rule_name text NOT NULL,
  trigger_condition jsonb NOT NULL,
  notification_template_id uuid REFERENCES notification_templates(id),
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now()
);
```

## ✅ 部署检查清单

- [ ] 执行触发器脚本
- [ ] 验证触发器创建成功
- [ ] 验证函数创建成功
- [ ] 运行测试脚本
- [ ] 检查通知表结构
- [ ] 验证RLS策略
- [ ] 测试前端集成
- [ ] 配置实时订阅
- [ ] 设置监控告警
- [ ] 文档更新完成

## 🎯 总结

通过部署这个通知功能，您的CRM系统现在具备了：

1. **自动化通知**：无需手动操作，系统自动发送通知
2. **实时响应**：基于数据库触发器的即时通知
3. **详细信息**：通知包含完整的线索和分配信息
4. **可扩展性**：支持多种通知类型和自定义规则
5. **性能优化**：高效的数据库操作和索引优化

这个功能将显著提升用户体验，确保销售人员能够及时获知新的线索分配和变更情况。 