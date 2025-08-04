# 直播报名&评分数据库指南

## 概述

直播报名&评分系统已成功集成到 `live_stream_schedules` 表中，支持完整的直播安排管理、报名、评分和状态跟踪功能。

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
  CONSTRAINT live_stream_schedules_date_time_slot_unique UNIQUE (date, time_slot_id),
  CONSTRAINT live_stream_schedules_created_by_fkey FOREIGN KEY (created_by) REFERENCES users_profile (id) ON DELETE SET NULL,
  CONSTRAINT live_stream_schedules_editing_by_fkey FOREIGN KEY (editing_by) REFERENCES users_profile (id),
  CONSTRAINT live_stream_schedules_scored_by_fkey FOREIGN KEY (scored_by) REFERENCES users_profile (id) ON DELETE SET NULL
);
```

## 索引优化

```sql
-- 日期索引
CREATE INDEX idx_live_stream_schedules_date ON public.live_stream_schedules USING btree (date);

-- 时间段索引
CREATE INDEX idx_live_stream_schedules_time_slot ON public.live_stream_schedules USING btree (time_slot_id);

-- 状态索引
CREATE INDEX idx_live_stream_schedules_status ON public.live_stream_schedules USING btree (status);

-- 评分相关索引
CREATE INDEX idx_live_stream_schedules_average_score ON public.live_stream_schedules USING btree (average_score);
CREATE INDEX idx_live_stream_schedules_scoring_status ON public.live_stream_schedules USING btree (scoring_status);
CREATE INDEX idx_live_stream_schedules_scored_by ON public.live_stream_schedules USING btree (scored_by);
CREATE INDEX idx_live_stream_schedules_scoring_data ON public.live_stream_schedules USING gin (scoring_data);

-- 并发控制索引
CREATE INDEX idx_live_stream_schedules_editing_by ON public.live_stream_schedules USING btree (editing_by);
CREATE INDEX idx_live_stream_schedules_editing_expires_at ON public.live_stream_schedules USING btree (editing_expires_at);

-- 参与者索引
CREATE INDEX idx_live_stream_schedules_participant_ids ON public.live_stream_schedules USING gin (participant_ids);
```

## 触发器

```sql
-- 记录变更日志
CREATE TRIGGER trigger_log_schedule_changes
  AFTER INSERT OR DELETE OR UPDATE ON live_stream_schedules
  FOR EACH ROW
  EXECUTE FUNCTION log_schedule_change();

-- 自动更新更新时间
CREATE TRIGGER trigger_update_live_stream_schedules_updated_at
  BEFORE UPDATE ON live_stream_schedules
  FOR EACH ROW
  EXECUTE FUNCTION update_live_stream_schedules_updated_at();

-- 自动更新评分状态
CREATE TRIGGER trigger_update_scoring_status
  BEFORE INSERT OR UPDATE ON live_stream_schedules
  FOR EACH ROW
  EXECUTE FUNCTION update_scoring_status();

-- 自动计算加权评分
CREATE TRIGGER trigger_update_weighted_score
  BEFORE UPDATE ON live_stream_schedules
  FOR EACH ROW
  EXECUTE FUNCTION update_weighted_score();
```

## 状态约束

### 直播状态约束
```sql
CONSTRAINT live_stream_schedules_status_check CHECK (
  status = ANY (ARRAY[
    'available'::text,
    'booked'::text,
    'completed'::text,
    'cancelled'::text,
    'editing'::text,
    'locked'::text
  ])
)
```

### 评分状态约束
```sql
CONSTRAINT live_stream_schedules_scoring_status_check CHECK (
  scoring_status = ANY (ARRAY[
    'not_scored'::text,
    'scoring_in_progress'::text,
    'scored'::text,
    'approved'::text
  ])
)
```

### 锁定类型约束
```sql
CONSTRAINT live_stream_schedules_lock_type_check CHECK (
  lock_type = ANY (ARRAY[
    'none'::text,
    'manual'::text,
    'system'::text,
    'maintenance'::text
  ])
)
```

## 前端集成

### API 更新

`getWeeklySchedule` 函数已更新，包含所有评分相关字段：

```typescript
// 转换为前端需要的格式
return (data || []).map(schedule => ({
  id: schedule.id.toString(),
  date: schedule.date,
  timeSlotId: schedule.time_slot_id,
  managers: (schedule.participant_ids && Array.isArray(schedule.participant_ids) ? schedule.participant_ids : []).map((id: number) => {
    const participant = participantsMap.get(id);
    return {
      id: id.toString(),
      name: participant ? (participant.nickname || participant.email) : '未知用户',
      department: '',
      avatar: undefined
    };
  }),
  location: {
    id: schedule.location || 'default',
    name: schedule.location || ''
  },
  propertyType: {
    id: schedule.notes || '',
    name: schedule.notes || ''
  },
  status: schedule.status,
  createdAt: schedule.created_at,
  updatedAt: schedule.updated_at,
  createdBy: schedule.created_by,
  editingBy: schedule.editing_by,
  editingAt: schedule.editing_at,
  editingExpiresAt: schedule.editing_expires_at,
  lockType: schedule.lock_type,
  lockReason: schedule.lock_reason,
  lockEndTime: schedule.lock_end_time,
  // 评分相关字段
  scoring_status: schedule.scoring_status,
  average_score: schedule.average_score,
  scored_by: schedule.scored_by,
  scored_at: schedule.scored_at,
  scoring_data: schedule.scoring_data,
}));
```

### 界面更新

直播管理页面已更新，包含以下新列：

1. **评分状态**: 显示当前评分状态
2. **综合评分**: 显示平均评分
3. **锁定状态**: 显示锁定类型和原因
4. **评分时间**: 显示最后评分时间

## 测试数据

### 插入测试数据

运行以下命令插入测试数据：

```bash
./deploy-test-live-stream-data.sh
```

### 测试数据包括

- 不同状态的直播安排（可报名、已报名、已完成、已取消、编辑中、已锁定）
- 不同评分状态的记录（未评分、评分中、已评分、已确认）
- 各种锁定状态（无锁定、手动锁定、系统锁定、维护锁定）
- 完整的评分数据（包含评分人、评分时间、评分详情）

## 性能优化

### 查询优化

1. **分页查询**: 使用 LIMIT 和 OFFSET 进行分页
2. **索引优化**: 为常用查询字段创建索引
3. **JSONB 查询**: 使用 GIN 索引优化 JSONB 字段查询
4. **数组查询**: 使用 GIN 索引优化数组字段查询

### 实时更新

使用 Supabase 实时订阅功能：

```typescript
const channel = supabase
  .channel('live_stream_schedules')
  .on('postgres_changes', {
    event: '*',
    schema: 'public',
    table: 'live_stream_schedules'
  }, (payload) => {
    // 处理实时更新
    handleScheduleUpdate(payload);
  })
  .subscribe();
```

## 监控和维护

### 日志监控

```sql
-- 查看直播安排变更日志
SELECT * FROM schedule_change_logs 
WHERE table_name = 'live_stream_schedules' 
ORDER BY created_at DESC 
LIMIT 100;
```

### 性能监控

```sql
-- 查看表大小
SELECT 
  schemaname,
  tablename,
  attname,
  n_distinct,
  correlation
FROM pg_stats 
WHERE tablename = 'live_stream_schedules';

-- 查看索引使用情况
SELECT 
  schemaname,
  tablename,
  indexname,
  idx_scan,
  idx_tup_read,
  idx_tup_fetch
FROM pg_stat_user_indexes 
WHERE tablename = 'live_stream_schedules';
```

## 安全考虑

1. **权限控制**: 使用 RLS (Row Level Security) 控制数据访问
2. **输入验证**: 前端和后端都进行输入验证
3. **SQL 注入防护**: 使用参数化查询
4. **并发控制**: 使用锁定机制防止并发冲突

## 扩展性

### 未来扩展

1. **评分模板**: 支持多种评分模板
2. **批量操作**: 支持批量评分和状态更新
3. **统计分析**: 添加评分统计和分析功能
4. **通知系统**: 集成通知系统，及时通知状态变更

### 数据迁移

如果需要修改表结构，建议使用以下步骤：

1. 创建新表结构
2. 迁移现有数据
3. 更新应用程序
4. 验证功能正常
5. 删除旧表

## 总结

直播报名&评分系统已成功集成到现有数据库中，提供了完整的直播安排管理、报名、评分和状态跟踪功能。系统具有良好的性能、安全性和扩展性，可以满足当前和未来的业务需求。 