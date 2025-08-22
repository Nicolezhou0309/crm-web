# CRM通知系统设计文档

## 📋 概述

本文档描述CRM系统通知功能的设计架构，包括当前实现和未来扩展规划。

## 🏗️ 当前架构

### 数据库设计

#### 重复客户通知表
```sql
CREATE TABLE duplicate_notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  new_leadid text NOT NULL,
  original_leadid text,
  assigned_user_id bigint,
  duplicate_type text CHECK (duplicate_type IN ('phone', 'wechat', 'both')),
  customer_phone text,
  customer_wechat text,
  notification_status text DEFAULT 'pending',
  created_at timestamptz DEFAULT now(),
  handled_at timestamptz
);
```

#### 状态流转
```
pending → read → handled
   ↓       ↓       ↓
待处理   已查看   已处理
```

### 前端组件架构

#### 核心组件
- `DuplicateNotificationCenter`: 重复客户通知中心
- `NotificationAPI`: 通知相关API封装
- 类型定义和常量配置

#### 设计特点
- 模块化组件设计
- 标准化状态管理
- 响应式UI更新
- 自动刷新机制

## 🔮 未来扩展规划

### 阶段一：向后兼容扩展（推荐）

#### 1. 保持现有结构
```sql
-- 保留现有表，添加新的通用通知表
CREATE TABLE notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id bigint NOT NULL,
  type text NOT NULL,  -- 'duplicate_customer', 'lead_assignment', 'system_alert'
  title text NOT NULL,
  content text,
  metadata jsonb,  -- 存储类型特定数据
  status text DEFAULT 'unread',
  priority integer DEFAULT 0,
  expires_at timestamptz,
  created_at timestamptz DEFAULT now(),
  read_at timestamptz,
  handled_at timestamptz,
  
  -- 关联到具体通知表
  related_table text,  -- 'duplicate_notifications'
  related_id uuid     -- 关联记录的ID
);
```

#### 2. 创建适配器模式
```typescript
interface NotificationAdapter {
  type: string;
  convertToGeneric(specificData: any): GenericNotification;
  convertFromGeneric(genericData: GenericNotification): any;
}

class DuplicateCustomerAdapter implements NotificationAdapter {
  type = 'duplicate_customer';
  
  convertToGeneric(data: DuplicateNotification): GenericNotification {
    return {
      id: data.id,
      type: 'duplicate_customer',
      title: '重复客户通知',
      content: `发现重复客户：${data.customer_phone}`,
      metadata: data,
      status: data.notification_status,
      created_at: data.created_at
    };
  }
}
```

#### 3. 统一前端接口
```typescript
class UnifiedNotificationService {
  private adapters = new Map<string, NotificationAdapter>();
  
  registerAdapter(adapter: NotificationAdapter) {
    this.adapters.set(adapter.type, adapter);
  }
  
  async getNotifications(userId: number): Promise<GenericNotification[]> {
    // 从统一表和各个专用表获取通知
    const [generic, duplicateCustomer] = await Promise.all([
      this.getGenericNotifications(userId),
      this.getDuplicateCustomerNotifications(userId)
    ]);
    
    return [...generic, ...duplicateCustomer];
  }
}
```

### 阶段二：完全重构（长期规划）

#### 1. 事件驱动架构
```sql
-- 通知事件表
CREATE TABLE notification_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_type text NOT NULL,
  source_table text,
  source_id text,
  event_data jsonb,
  created_at timestamptz DEFAULT now()
);

-- 通知规则表
CREATE TABLE notification_rules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_type text NOT NULL,
  conditions jsonb,
  template text,
  recipients jsonb,
  is_active boolean DEFAULT true
);
```

#### 2. 插件化通知处理器
```typescript
interface NotificationProcessor {
  eventType: string;
  process(event: NotificationEvent): Promise<Notification[]>;
}

class DuplicateCustomerProcessor implements NotificationProcessor {
  eventType = 'lead.duplicate_detected';
  
  async process(event: NotificationEvent): Promise<Notification[]> {
    // 处理重复客户事件，生成通知
  }
}
```

## 🛠️ 迁移策略

### 当前使用建议
**✅ 可以放心使用当前设计，因为：**

1. **数据结构稳定**：当前表结构设计良好，字段完整
2. **接口标准化**：API接口设计规范，易于扩展
3. **组件模块化**：前端组件独立，可以平滑升级
4. **向后兼容**：未来扩展不会破坏现有功能

### 迁移路径

#### 短期（1-3个月）
- 继续使用现有架构
- 根据业务需求添加新的通知类型
- 优化现有功能和性能

#### 中期（3-6个月）
- 引入统一通知表
- 实现适配器模式
- 逐步迁移新功能到统一架构

#### 长期（6个月以上）
- 完全重构为事件驱动架构
- 实现插件化处理器
- 支持复杂的通知规则和模板

## 🔧 扩展示例

### 添加新通知类型
```typescript
// 1. 定义新的通知类型
interface LeadAssignmentNotification {
  id: string;
  leadid: string;
  assigned_user_id: number;
  assigned_by: number;
  assignment_reason: string;
  created_at: string;
}

// 2. 创建对应的处理器
class LeadAssignmentHandler {
  async createNotification(data: LeadAssignmentNotification) {
    // 创建通知逻辑
  }
}

// 3. 注册到通知系统
notificationSystem.registerType('lead_assignment', {
  handler: LeadAssignmentHandler,
  icon: '👤',
  color: 'blue'
});
```

## 📊 性能考虑

### 当前性能优化
- 索引优化：`idx_duplicate_notifications_user`
- 分页查询：避免一次性加载大量通知
- 定时清理：自动清理过期通知

### 未来性能优化
- 分表策略：按时间或用户分表
- 缓存机制：Redis缓存热点通知
- 推送服务：WebSocket实时推送

## 🎯 总结

当前通知系统设计良好，**完全可以放心使用**。主要优势：

1. **架构合理**：模块化设计，易于扩展
2. **接口标准**：API设计规范，向后兼容
3. **数据完整**：字段设计完善，支持复杂场景
4. **迁移友好**：未来升级不会影响现有功能

建议采用**渐进式扩展**策略，在现有基础上逐步完善，确保系统稳定性和业务连续性。 