# 带看分配日志系统使用指南

## 概述

带看分配日志系统用于记录每次带看分配的执行情况，包括分配方法、队列类型、卡片消耗情况、质量控制结果等详细信息。该系统有助于监控和分析带看分配的性能和效果。

## 系统组件

### 1. 日志表结构

**表名**: `public.showings_allocation_logs`

**字段说明**:
- `id`: 日志记录唯一标识 (UUID)
- `community`: 社区标识
- `assigned_user_id`: 分配的带看人ID
- `allocation_method`: 分配方法
  - `assigned`: 指定人带看
  - `direct`: 直通队列分配
  - `basic`: 基础队列分配
- `queue_type`: 队列类型
  - `direct`: 直通队列
  - `skip`: 轮空队列
  - `basic`: 基础队列
- `processing_details`: 处理详情JSON
- `created_at`: 创建时间
- `skip_card_consumed`: 是否消耗了轮空卡
- `direct_card_consumed`: 是否消耗了直通卡
- `quality_check_passed`: 质量控制是否通过
- `remark`: 备注信息

### 2. 索引支持

系统提供了完整的索引支持，便于高效查询：

- `idx_showings_allocation_logs_user_date`: 用户ID和创建时间索引
- `idx_showings_allocation_logs_community`: 社区索引
- `idx_showings_allocation_logs_method`: 分配方法索引
- `idx_showings_allocation_logs_queue_type`: 队列类型索引
- `idx_showings_allocation_logs_created_at`: 创建时间索引

## 日志记录场景

### 1. 指定人带看 (assigned)

**触发条件**: 调用函数时传入 `p_assigned_user_id` 参数

**记录内容**:
- 检查指定人是否有直通卡
- 如果有直通卡，消耗直通卡并分配
- 如果没有直通卡，添加轮空卡作为补偿
- 记录分配结果和消耗情况

### 2. 直通队列分配 (direct)

**触发条件**: 指定人带看失败或无指定人时

**记录内容**:
- 随机选择直通队列中的候选人
- 检查是否有轮空卡
- 如果有轮空卡，同时消耗轮空卡和直通卡
- 如果没有轮空卡，进行质量控制
- 记录分配结果和消耗情况

### 3. 基础队列分配 (basic)

**触发条件**: 直通队列分配失败时

**记录内容**:
- 按顺序遍历基础队列
- 检查是否有轮空卡
- 进行质量控制
- 记录分配结果和消耗情况

## 查询示例

### 1. 查看最近的分配记录

```sql
SELECT 
    created_at,
    assigned_user_id,
    allocation_method,
    queue_type,
    skip_card_consumed,
    direct_card_consumed,
    quality_check_passed,
    remark
FROM public.showings_allocation_logs
ORDER BY created_at DESC
LIMIT 20;
```

### 2. 查看特定用户的分配历史

```sql
SELECT 
    created_at,
    allocation_method,
    queue_type,
    skip_card_consumed,
    direct_card_consumed,
    quality_check_passed,
    remark
FROM public.showings_allocation_logs
WHERE assigned_user_id = 123
ORDER BY created_at DESC;
```

### 3. 查看分配成功率统计

```sql
SELECT 
    allocation_method,
    queue_type,
    COUNT(*) as total_attempts,
    COUNT(CASE WHEN assigned_user_id IS NOT NULL THEN 1 END) as successful_allocations,
    ROUND(
        COUNT(CASE WHEN assigned_user_id IS NOT NULL THEN 1 END) * 100.0 / COUNT(*), 
        2
    ) as success_rate
FROM public.showings_allocation_logs
WHERE created_at >= NOW() - INTERVAL '30 days'
GROUP BY allocation_method, queue_type
ORDER BY allocation_method, queue_type;
```

### 4. 查看卡片消耗统计

```sql
SELECT 
    DATE(created_at) as allocation_date,
    COUNT(*) as total_allocations,
    COUNT(CASE WHEN skip_card_consumed THEN 1 END) as skip_cards_consumed,
    COUNT(CASE WHEN direct_card_consumed THEN 1 END) as direct_cards_consumed,
    COUNT(CASE WHEN skip_card_consumed AND direct_card_consumed THEN 1 END) as both_cards_consumed
FROM public.showings_allocation_logs
WHERE created_at >= NOW() - INTERVAL '7 days'
GROUP BY DATE(created_at)
ORDER BY allocation_date DESC;
```

### 5. 查看质量控制统计

```sql
SELECT 
    allocation_method,
    COUNT(*) as total_attempts,
    COUNT(CASE WHEN quality_check_passed THEN 1 END) as passed_quality_check,
    COUNT(CASE WHEN NOT quality_check_passed THEN 1 END) as failed_quality_check,
    ROUND(
        COUNT(CASE WHEN quality_check_passed THEN 1 END) * 100.0 / COUNT(*), 
        2
    ) as quality_pass_rate
FROM public.showings_allocation_logs
WHERE created_at >= NOW() - INTERVAL '30 days'
GROUP BY allocation_method
ORDER BY allocation_method;
```

## 部署说明

### 1. 执行部署脚本

```bash
chmod +x deploy-showings-allocation-logs.sh
./deploy-showings-allocation-logs.sh
```

### 2. 手动部署

如果自动部署失败，可以手动执行：

```bash
# 1. 创建日志表
psql -h db.supabase.co -p 5432 -d postgres -U postgres -f create_showings_allocation_logs.sql

# 2. 更新分配函数
psql -h db.supabase.co -p 5432 -d postgres -U postgres -f fix_direct_queue_consumption.sql
```

### 3. 验证部署

```sql
-- 检查表是否存在
SELECT EXISTS (
    SELECT FROM information_schema.tables 
    WHERE table_schema = 'public' 
    AND table_name = 'showings_allocation_logs'
);

-- 检查函数是否存在
SELECT EXISTS (
    SELECT FROM pg_proc 
    WHERE proname = 'assign_showings_user'
);
```

## 注意事项

1. **性能影响**: 日志记录会增加少量性能开销，但通过索引优化可以最小化影响
2. **存储空间**: 日志表会随时间增长，建议定期清理旧数据
3. **数据一致性**: 日志记录在事务中进行，确保数据一致性
4. **错误处理**: 日志记录失败不会影响主要的分配逻辑

## 故障排除

### 1. 日志表不存在

```sql
-- 重新创建表
\i create_showings_allocation_logs.sql
```

### 2. 函数更新失败

```sql
-- 重新更新函数
\i fix_direct_queue_consumption.sql
```

### 3. 索引缺失

```sql
-- 重新创建索引
CREATE INDEX IF NOT EXISTS idx_showings_allocation_logs_user_date 
ON public.showings_allocation_logs USING btree (assigned_user_id, created_at);

CREATE INDEX IF NOT EXISTS idx_showings_allocation_logs_community 
ON public.showings_allocation_logs USING btree (community);
```

## 更新日志

- **2025-01-15**: 初始版本，创建带看分配日志系统
- 支持指定人带看、直通队列、基础队列的日志记录
- 提供完整的索引支持和查询示例 