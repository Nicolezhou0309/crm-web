-- 修复 live_stream_schedules 表的默认值问题

-- 修复 status 字段的默认值
ALTER TABLE live_stream_schedules ALTER COLUMN status SET DEFAULT 'editing';

-- 确保 participant_ids 字段的默认值正确
ALTER TABLE live_stream_schedules ALTER COLUMN participant_ids SET DEFAULT '{}';

-- 确保 lock_type 字段的默认值正确
ALTER TABLE live_stream_schedules ALTER COLUMN lock_type SET DEFAULT 'none';

-- 添加状态约束检查
ALTER TABLE live_stream_schedules DROP CONSTRAINT IF EXISTS live_stream_schedules_status_check;
ALTER TABLE live_stream_schedules ADD CONSTRAINT live_stream_schedules_status_check
  CHECK (status IN ('available', 'booked', 'completed', 'cancelled', 'editing', 'locked'));

-- 添加注释
COMMENT ON COLUMN live_stream_schedules.status IS '状态：editing(编辑中-默认), available(可报名), booked(已报名), completed(已完成), cancelled(已取消), locked(锁定)'; 