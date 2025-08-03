 -- =============================================
-- 独立的直播安排日志表
-- 记录：人员列表、操作人、操作时间
-- =============================================

-- 1. 创建独立的日志表
CREATE TABLE IF NOT EXISTS public.live_stream_schedule_logs (
  id bigserial PRIMARY KEY,
  schedule_id bigint NOT NULL REFERENCES live_stream_schedules(id) ON DELETE CASCADE,
  operator_id bigint REFERENCES users_profile(id) ON DELETE SET NULL,
  operator_name text NOT NULL,
  operation_time timestamptz DEFAULT now(),
  participants bigint[] NOT NULL DEFAULT '{}'::bigint[],
  created_at timestamptz DEFAULT now()
);

-- 2. 创建索引
CREATE INDEX IF NOT EXISTS idx_live_stream_logs_schedule_id ON live_stream_schedule_logs(schedule_id);
CREATE INDEX IF NOT EXISTS idx_live_stream_logs_operator_id ON live_stream_schedule_logs(operator_id);
CREATE INDEX IF NOT EXISTS idx_live_stream_logs_operation_time ON live_stream_schedule_logs(operation_time);

-- 3. 创建记录日志的函数
CREATE OR REPLACE FUNCTION log_schedule_change()
RETURNS TRIGGER AS $$
DECLARE
  v_user_id bigint;
  v_user_name text;
BEGIN
  -- 获取当前用户信息
  v_user_id := current_setting('app.current_user_id', true)::bigint;
  
  IF v_user_id IS NULL THEN
    v_user_id := auth.uid()::bigint;
  END IF;
  
  -- 获取用户昵称
  SELECT nickname INTO v_user_name 
  FROM users_profile 
  WHERE id = v_user_id;
  
  IF v_user_name IS NULL THEN
    v_user_name := '未知用户';
  END IF;
  
  -- 插入日志记录
  INSERT INTO live_stream_schedule_logs (
    schedule_id,
    operator_id,
    operator_name,
    operation_time,
    participants
  ) VALUES (
    COALESCE(NEW.id, OLD.id),
    v_user_id,
    v_user_name,
    now(),
    COALESCE(NEW.participant_ids, OLD.participant_ids)
  );
  
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 4. 创建触发器
DROP TRIGGER IF EXISTS trigger_log_schedule_changes ON live_stream_schedules;

CREATE TRIGGER trigger_log_schedule_changes
  AFTER INSERT OR UPDATE OR DELETE ON live_stream_schedules
  FOR EACH ROW
  EXECUTE FUNCTION log_schedule_change();

-- 5. 创建获取日志的函数
CREATE OR REPLACE FUNCTION get_schedule_logs(
  p_schedule_id bigint,
  p_limit integer DEFAULT 50
)
RETURNS TABLE(
  id bigint,
  operator_name text,
  operation_time timestamptz,
  participants bigint[]
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    l.id,
    l.operator_name,
    l.operation_time,
    l.participants
  FROM live_stream_schedule_logs l
  WHERE l.schedule_id = p_schedule_id
  ORDER BY l.operation_time DESC
  LIMIT p_limit;
END;
$$;

-- 6. 创建清理旧日志的函数
CREATE OR REPLACE FUNCTION cleanup_old_logs(
  p_days_to_keep integer DEFAULT 90
)
RETURNS integer
LANGUAGE plpgsql
AS $$
DECLARE
  v_deleted_count integer;
BEGIN
  DELETE FROM live_stream_schedule_logs
  WHERE operation_time < now() - interval '1 day' * p_days_to_keep;
  
  GET DIAGNOSTICS v_deleted_count = ROW_COUNT;
  
  RETURN v_deleted_count;
END;
$$;

-- 7. 设置RLS策略
ALTER TABLE live_stream_schedule_logs ENABLE ROW LEVEL SECURITY;

-- 允许用户查看相关日志
CREATE POLICY "Users can view related logs" ON live_stream_schedule_logs
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM live_stream_schedules s
      WHERE s.id = live_stream_schedule_logs.schedule_id
      AND (s.created_by = auth.uid()::bigint OR 
           auth.uid()::bigint = ANY(s.participant_ids))
    )
  );

-- 8. 添加注释
COMMENT ON TABLE live_stream_schedule_logs IS '直播安排操作日志表';
COMMENT ON COLUMN live_stream_schedule_logs.schedule_id IS '关联的直播安排ID';
COMMENT ON COLUMN live_stream_schedule_logs.operator_id IS '操作人ID';
COMMENT ON COLUMN live_stream_schedule_logs.operator_name IS '操作人姓名';
COMMENT ON COLUMN live_stream_schedule_logs.operation_time IS '操作时间';
COMMENT ON COLUMN live_stream_schedule_logs.participants IS '操作后的参与者列表';
COMMENT ON FUNCTION log_schedule_change IS '记录直播安排变更的触发器函数';
COMMENT ON FUNCTION get_schedule_logs IS '获取特定安排的操作日志';
COMMENT ON FUNCTION cleanup_old_logs IS '清理旧日志记录';

-- 9. 使用示例
-- 查看特定安排的所有日志
-- SELECT * FROM get_schedule_logs(1);

-- 查看特定安排最近的10条日志
-- SELECT * FROM get_schedule_logs(1, 10);

-- 查看所有日志（按时间倒序）
-- SELECT * FROM live_stream_schedule_logs ORDER BY operation_time DESC LIMIT 20;

-- 查看特定用户的操作日志
-- SELECT * FROM live_stream_schedule_logs WHERE operator_id = 1 ORDER BY operation_time DESC;

-- 清理90天前的日志
-- SELECT cleanup_old_logs(90);