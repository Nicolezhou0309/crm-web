-- 通知模板表
create table if not exists notification_templates (
  id serial primary key,
  type text not null,
  title text not null,
  content text not null,
  metadata jsonb,
  is_active boolean default true,
  created_at timestamp with time zone default now()
); 


-- 审批节点插入时自动通知审批人
CREATE OR REPLACE FUNCTION notify_approver_on_step_insert()
RETURNS TRIGGER AS $$
BEGIN
  -- 仅在新插入节点为待审批时插入通知
  IF NEW.status = 'pending' THEN
    INSERT INTO notifications (user_id, type, title, content, status, priority, created_at)
    VALUES (
      NEW.approver_id,
      'approval_pending',
      '有新的审批待处理',
      '你有一条新的审批待处理，操作编号：' || COALESCE(NEW.instance_id::text, '') || '，请及时处理。',
      'unread',
      1,
      now()
    );
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 创建触发器（如已存在则先删除再创建）
DROP TRIGGER IF EXISTS approval_steps_notify ON approval_steps;
CREATE TRIGGER approval_steps_notify
AFTER INSERT ON approval_steps
FOR EACH ROW
EXECUTE FUNCTION notify_approver_on_step_insert();