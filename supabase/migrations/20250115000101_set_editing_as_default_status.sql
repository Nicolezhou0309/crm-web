-- 设置editing为live_stream_schedules表的默认状态
ALTER TABLE live_stream_schedules ALTER COLUMN status SET DEFAULT 'editing';

-- 更新注释
COMMENT ON COLUMN live_stream_schedules.status IS '状态：editing(编辑中-默认), available(可报名), booked(已报名), completed(已完成), cancelled(已取消), locked(锁定)'; 