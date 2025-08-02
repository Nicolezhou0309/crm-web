-- 修复直播安排表的状态约束，添加editing状态支持
-- 删除旧的CHECK约束
ALTER TABLE live_stream_schedules DROP CONSTRAINT IF EXISTS live_stream_schedules_status_check;

-- 添加新的CHECK约束，包含editing状态
ALTER TABLE live_stream_schedules ADD CONSTRAINT live_stream_schedules_status_check 
  CHECK (status IN ('available', 'booked', 'completed', 'cancelled', 'editing', 'locked'));

-- 更新默认值注释
COMMENT ON COLUMN live_stream_schedules.status IS '状态：available(可报名), booked(已报名), completed(已完成), cancelled(已取消), editing(编辑中), locked(锁定)'; 