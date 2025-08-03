-- 修复 log_schedule_change 函数中的 UUID 到 bigint 转换问题

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