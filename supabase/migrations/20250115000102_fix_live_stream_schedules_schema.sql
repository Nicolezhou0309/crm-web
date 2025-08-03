-- 修复 live_stream_schedules 表结构以匹配 API 代码期望
-- 添加缺失的字段并修改现有字段

-- 添加 participant_ids 字段（用于存储参与者ID数组）
ALTER TABLE live_stream_schedules ADD COLUMN IF NOT EXISTS participant_ids INTEGER[];

-- 添加 location 字段（用于存储地点名称）
ALTER TABLE live_stream_schedules ADD COLUMN IF NOT EXISTS location TEXT;

-- 添加 notes 字段（用于存储户型信息）
ALTER TABLE live_stream_schedules ADD COLUMN IF NOT EXISTS notes TEXT;

-- 添加 editing_by 字段（用于并发控制）
ALTER TABLE live_stream_schedules ADD COLUMN IF NOT EXISTS editing_by INTEGER REFERENCES users_profile(id);

-- 添加 editing_at 字段（编辑开始时间）
ALTER TABLE live_stream_schedules ADD COLUMN IF NOT EXISTS editing_at TIMESTAMP WITH TIME ZONE;

-- 添加 editing_expires_at 字段（编辑过期时间）
ALTER TABLE live_stream_schedules ADD COLUMN IF NOT EXISTS editing_expires_at TIMESTAMP WITH TIME ZONE;

-- 添加 lock_type 字段（锁定类型）
ALTER TABLE live_stream_schedules ADD COLUMN IF NOT EXISTS lock_type VARCHAR(50);

-- 添加 lock_reason 字段（锁定原因）
ALTER TABLE live_stream_schedules ADD COLUMN IF NOT EXISTS lock_reason TEXT;

-- 添加 lock_end_time 字段（锁定结束时间）
ALTER TABLE live_stream_schedules ADD COLUMN IF NOT EXISTS lock_end_time TIMESTAMP WITH TIME ZONE;

-- 修改 created_by 字段类型从 UUID 改为 INTEGER
ALTER TABLE live_stream_schedules ALTER COLUMN created_by TYPE INTEGER USING created_by::TEXT::INTEGER;

-- 添加 created_by 的外键约束
ALTER TABLE live_stream_schedules ADD CONSTRAINT IF NOT EXISTS live_stream_schedules_created_by_fkey 
  FOREIGN KEY (created_by) REFERENCES users_profile(id);

-- 更新状态约束以包含 'editing' 状态
ALTER TABLE live_stream_schedules DROP CONSTRAINT IF EXISTS live_stream_schedules_status_check;
ALTER TABLE live_stream_schedules ADD CONSTRAINT live_stream_schedules_status_check
  CHECK (status IN ('available', 'booked', 'completed', 'cancelled', 'editing', 'locked'));

-- 添加注释
COMMENT ON COLUMN live_stream_schedules.participant_ids IS '参与者ID数组';
COMMENT ON COLUMN live_stream_schedules.location IS '地点名称';
COMMENT ON COLUMN live_stream_schedules.notes IS '户型信息';
COMMENT ON COLUMN live_stream_schedules.editing_by IS '当前编辑者ID';
COMMENT ON COLUMN live_stream_schedules.editing_at IS '编辑开始时间';
COMMENT ON COLUMN live_stream_schedules.editing_expires_at IS '编辑过期时间';
COMMENT ON COLUMN live_stream_schedules.lock_type IS '锁定类型';
COMMENT ON COLUMN live_stream_schedules.lock_reason IS '锁定原因';
COMMENT ON COLUMN live_stream_schedules.lock_end_time IS '锁定结束时间';
COMMENT ON COLUMN live_stream_schedules.status IS '状态：editing(编辑中), available(可报名), booked(已报名), completed(已完成), cancelled(已取消), locked(锁定)'; 