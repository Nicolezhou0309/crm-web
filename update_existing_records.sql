-- 更新现有的editing状态记录，设置默认的编辑者信息
-- 这个脚本用于修复现有数据，确保editing状态的记录有正确的编辑者信息

-- 1. 查找所有editing状态但editing_by为null的记录
SELECT 
    id,
    date,
    time_slot_id,
    status,
    editing_by,
    editing_at,
    editing_expires_at,
    created_by
FROM live_stream_schedules 
WHERE status = 'editing' 
    AND (editing_by IS NULL OR editing_at IS NULL OR editing_expires_at IS NULL);

-- 2. 更新这些记录，将created_by设置为editing_by（假设创建者就是编辑者）
UPDATE live_stream_schedules 
SET 
    editing_by = created_by,
    editing_at = created_at,
    editing_expires_at = created_at + INTERVAL '5 minutes'
WHERE status = 'editing' 
    AND (editing_by IS NULL OR editing_at IS NULL OR editing_expires_at IS NULL)
    AND created_by IS NOT NULL;

-- 3. 对于没有created_by的记录，设置为available状态
UPDATE live_stream_schedules 
SET 
    status = 'available',
    editing_by = NULL,
    editing_at = NULL,
    editing_expires_at = NULL
WHERE status = 'editing' 
    AND (editing_by IS NULL OR editing_at IS NULL OR editing_expires_at IS NULL)
    AND created_by IS NULL;

-- 4. 验证更新结果
SELECT 
    id,
    date,
    time_slot_id,
    status,
    editing_by,
    editing_at,
    editing_expires_at,
    created_by
FROM live_stream_schedules 
WHERE status = 'editing';

-- 5. 显示清理后的统计信息
SELECT 
    status,
    COUNT(*) as count
FROM live_stream_schedules 
GROUP BY status
ORDER BY status; 