-- 修改审批触发器，传递操作编号而不是实例ID
CREATE OR REPLACE FUNCTION public.notify_approver_on_step_insert()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
DECLARE
  v_target_id text;
BEGIN
  RAISE NOTICE 'Trigger fired for id: %, status: %, approver_id: %', NEW.id, NEW.status, NEW.approver_id;
  
  IF NEW.status = 'pending' THEN
    -- 获取操作编号（target_id）
    SELECT ai.target_id INTO v_target_id
    FROM approval_instances ai
    WHERE ai.id = NEW.instance_id;
    
    -- 如果没有找到target_id，使用instance_id作为备选
    IF v_target_id IS NULL THEN
      v_target_id := NEW.instance_id::text;
    END IF;
    
    INSERT INTO notifications (
      user_id, type, title, content, status, priority, created_at, related_table, related_id
    )
    VALUES (
      NEW.approver_id,
      'approval',
      '有新的审批待处理',
      '你有一条新的审批待处理，操作编号：' || v_target_id || '，请及时处理。',
      'unread',
      1,
      now(),
      'approval_steps',
      NEW.id::text
    );
    RAISE NOTICE 'Notification inserted for approver_id: % with operation_id: %', NEW.approver_id, v_target_id;
  END IF;
  RETURN NEW;
END;
$function$; 