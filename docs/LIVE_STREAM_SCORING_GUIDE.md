# 直播报名&评分系统使用指南

## 概述

直播报名&评分系统基于 `live_stream_schedules` 表实现，支持直播安排的创建、报名、评分和状态管理。

## 数据库表结构

### live_stream_schedules 表

```sql
CREATE TABLE public.live_stream_schedules (
  id bigserial NOT NULL,
  date date NOT NULL,
  time_slot_id text NOT NULL,
  participant_ids bigint[] NULL DEFAULT '{}'::bigint[],
  location text NULL,
  notes text NULL,
  status text NULL DEFAULT 'editing'::text,
  created_by bigint NULL,
  created_at timestamp with time zone NULL DEFAULT now(),
  updated_at timestamp with time zone NULL DEFAULT now(),
  editing_by bigint NULL,
  editing_at timestamp with time zone NULL,
  editing_expires_at timestamp with time zone NULL,
  lock_type text NULL DEFAULT 'none'::text,
  lock_reason text NULL,
  lock_end_time timestamp with time zone NULL,
  average_score numeric(3, 1) NULL,
  scoring_data jsonb NULL,
  scoring_status text NULL DEFAULT 'not_scored'::text,
  scored_by bigint NULL,
  scored_at timestamp with time zone NULL,
  CONSTRAINT live_stream_schedules_pkey PRIMARY KEY (id),
  CONSTRAINT live_stream_schedules_date_time_slot_unique UNIQUE (date, time_slot_id)
);
```

## 状态说明

### 直播状态 (status)
- `available`: 可报名
- `booked`: 已报名
- `completed`: 已完成
- `cancelled`: 已取消
- `editing`: 编辑中
- `locked`: 已锁定

### 评分状态 (scoring_status)
- `not_scored`: 未评分
- `scoring_in_progress`: 评分中
- `scored`: 已评分
- `approved`: 已确认

### 锁定类型 (lock_type)
- `none`: 无锁定
- `manual`: 手动锁定
- `system`: 系统锁定
- `maintenance`: 维护锁定

## 功能特性

### 1. 直播安排管理
- 按周查看直播安排
- 显示参与人员、地点、状态等信息
- 支持不同状态的筛选和显示

### 2. 评分系统
- 支持多维度评分
- 自动计算综合评分
- 评分状态跟踪
- 评分历史记录

### 3. 锁定机制
- 防止并发编辑冲突
- 支持手动和系统锁定
- 锁定原因记录

### 4. 实时更新
- 使用 Supabase 实时订阅
- 自动刷新数据
- 状态变更通知

## 使用流程

### 1. 创建直播安排
1. 进入直播管理页面
2. 选择"直播报名&评分"标签
3. 点击"添加"按钮
4. 填写日期、时间段、地点等信息
5. 保存安排

### 2. 报名参与
1. 在可报名的时段点击"报名"
2. 选择参与人员
3. 确认报名信息
4. 等待审核

### 3. 进行评分
1. 选择已完成的直播安排
2. 点击"查看评分"按钮
3. 在评分抽屉中进行评分
4. 保存评分结果

### 4. 评分确认
1. 查看评分结果
2. 确认评分准确性
3. 点击"确认"按钮
4. 评分状态更新为"已确认"

## 测试数据

运行以下命令插入测试数据：

```bash
./deploy-test-live-stream-data.sh
```

测试数据包括：
- 不同状态的直播安排
- 已评分和未评分的记录
- 各种锁定状态
- 完整的评分数据

## API 接口

### 获取周安排
```typescript
getWeeklySchedule(weekStart: string, weekEnd: string): Promise<LiveStreamSchedule[]>
```

### 创建安排
```typescript
createLiveStreamSchedule(schedule: Omit<LiveStreamSchedule, 'id' | 'createdAt' | 'updatedAt'>): Promise<LiveStreamSchedule>
```

### 更新安排
```typescript
updateLiveStreamSchedule(scheduleId: string, updates: Partial<LiveStreamSchedule>): Promise<LiveStreamSchedule>
```

### 删除安排
```typescript
deleteLiveStreamSchedule(scheduleId: string): Promise<void>
```

## 注意事项

1. **并发控制**: 系统使用编辑锁定机制防止并发冲突
2. **数据完整性**: 所有状态变更都有相应的约束检查
3. **权限控制**: 基于用户角色的权限管理
4. **实时同步**: 使用 Supabase 实时功能保持数据同步

## 故障排除

### 常见问题

1. **数据不显示**
   - 检查日期范围是否正确
   - 确认用户权限
   - 查看浏览器控制台错误

2. **评分失败**
   - 确认直播状态为"已完成"
   - 检查评分维度配置
   - 验证用户权限

3. **锁定问题**
   - 等待锁定过期
   - 联系管理员解除锁定
   - 检查锁定原因

### 日志查看

```bash
# 查看直播安排变更日志
SELECT * FROM schedule_change_logs WHERE table_name = 'live_stream_schedules' ORDER BY created_at DESC;
```

## 更新日志

- 2025-01-15: 初始版本，支持基本的直播安排和评分功能
- 2025-01-16: 添加锁定机制和并发控制
- 2025-01-17: 优化评分界面和用户体验 