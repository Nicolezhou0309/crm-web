-- 修复 live_stream_schedule_logs 表的外键约束问题

-- 1. 删除现有的外键约束
ALTER TABLE live_stream_schedule_logs 
DROP CONSTRAINT IF EXISTS live_stream_schedule_logs_schedule_id_fkey;

-- 2. 重新创建外键约束，添加级联删除
ALTER TABLE live_stream_schedule_logs 
ADD CONSTRAINT live_stream_schedule_logs_schedule_id_fkey 
FOREIGN KEY (schedule_id) 
REFERENCES live_stream_schedules(id) 
ON DELETE CASCADE;

-- 3. 修改 log_schedule_change 函数，在删除操作时先记录日志再删除
CREATE OR REPLACE FUNCTION log_schedule_change()
RETURNS TRIGGER AS $$
DECLARE
  v_user_id bigint;
  v_user_name text;
  v_auth_user_id uuid;
BEGIN
  -- 获取当前用户信息
  v_user_id := current_setting('app.current_user_id', true)::bigint;
  
  IF v_user_id IS NULL THEN
    -- 获取认证用户ID（UUID类型）
    v_auth_user_id := auth.uid();
    
    -- 从users_profile表获取对应的bigint ID
    IF v_auth_user_id IS NOT NULL THEN
      SELECT id INTO v_user_id 
      FROM users_profile 
      WHERE user_id = v_auth_user_id;
    END IF;
  END IF;
  
  -- 获取用户昵称
  SELECT nickname INTO v_user_name 
  FROM users_profile 
  WHERE id = v_user_id;
  
  IF v_user_name IS NULL THEN
    v_user_name := '未知用户';
  END IF;
  
  -- 对于删除操作，在记录删除前先插入日志
  IF TG_OP = 'DELETE' THEN
    INSERT INTO live_stream_schedule_logs (
      schedule_id,
      operator_id,
      operator_name,
      operation_time,
      participants
    ) VALUES (
      OLD.id,
      v_user_id,
      v_user_name,
      now(),
      OLD.participant_ids
    );
    RETURN OLD;
  END IF;
  
  -- 对于插入和更新操作，正常插入日志
  INSERT INTO live_stream_schedule_logs (
    schedule_id,
    operator_id,
    operator_name,
    operation_time,
    participants
  ) VALUES (
    NEW.id,
    v_user_id,
    v_user_name,
    now(),
    NEW.participant_ids
  );
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER; 