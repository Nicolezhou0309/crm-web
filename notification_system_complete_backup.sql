-- =============================================
-- 通知系统完整备份脚本
-- 包含数据库表结构、函数、索引、RLS策略和初始数据
-- 创建时间: 2024年12月
-- =============================================

BEGIN;

-- =============================================
-- 1. 创建通知相关表
-- =============================================

-- 1.1 创建公告表
CREATE TABLE IF NOT EXISTS announcements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  content text NOT NULL,
  type text NOT NULL DEFAULT 'info' CHECK (type IN ('info', 'warning', 'success', 'error')),
  priority integer DEFAULT 0,
  target_roles text[], -- 目标角色，空数组表示所有用户
  target_organizations uuid[], -- 目标组织
  is_active boolean DEFAULT true,
  start_time timestamptz DEFAULT now(),
  end_time timestamptz, -- 过期时间，null表示永不过期
  created_by bigint REFERENCES users_profile(id),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- 1.2 创建通知表
CREATE TABLE IF NOT EXISTS notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id bigint NOT NULL REFERENCES users_profile(id),
  type text NOT NULL, -- 'system', 'lead_assignment', 'duplicate_customer', 'task_reminder'
  title text NOT NULL,
  content text,
  metadata jsonb, -- 存储类型特定数据
  status text DEFAULT 'unread' CHECK (status IN ('unread', 'read', 'handled')),
  priority integer DEFAULT 0,
  expires_at timestamptz,
  created_at timestamptz DEFAULT now(),
  read_at timestamptz,
  handled_at timestamptz,
  
  -- 关联到具体通知表（向后兼容）
  related_table text, -- 'duplicate_notifications'
  related_id uuid
);

-- 1.3 创建用户公告阅读记录表
CREATE TABLE IF NOT EXISTS announcement_reads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  announcement_id uuid REFERENCES announcements(id) ON DELETE CASCADE,
  user_id bigint REFERENCES users_profile(id),
  read_at timestamptz DEFAULT now(),
  UNIQUE(announcement_id, user_id)
);

-- =============================================
-- 2. 创建索引
-- =============================================

CREATE INDEX IF NOT EXISTS idx_announcements_active_time ON announcements (is_active, start_time, end_time);
CREATE INDEX IF NOT EXISTS idx_announcements_priority ON announcements (priority DESC);
CREATE INDEX IF NOT EXISTS idx_notifications_user_status ON notifications (user_id, status);
CREATE INDEX IF NOT EXISTS idx_notifications_created_at ON notifications (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_announcement_reads_user ON announcement_reads (user_id);

-- =============================================
-- 3. 启用RLS（行级安全）
-- =============================================

ALTER TABLE announcements ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE announcement_reads ENABLE ROW LEVEL SECURITY;

-- =============================================
-- 4. 创建RLS策略
-- =============================================

-- 4.1 公告表策略
CREATE POLICY "Users can view active announcements" ON announcements
FOR SELECT USING (
  is_active = true 
  AND start_time <= now() 
  AND (end_time IS NULL OR end_time > now())
);

-- 4.2 通知表策略
CREATE POLICY "Users can view their own notifications" ON notifications
FOR SELECT USING (
  user_id = (
    SELECT id FROM users_profile 
    WHERE user_id = auth.uid()
  )
);

CREATE POLICY "Users can insert their own notifications" ON notifications
FOR INSERT WITH CHECK (
  user_id = (
    SELECT id FROM users_profile 
    WHERE user_id = auth.uid()
  )
);

CREATE POLICY "Users can update their own notifications" ON notifications
FOR UPDATE USING (
  user_id = (
    SELECT id FROM users_profile 
    WHERE user_id = auth.uid()
  )
) WITH CHECK (
  user_id = (
    SELECT id FROM users_profile 
    WHERE user_id = auth.uid()
  )
);

-- 用户删除自己的通知
CREATE POLICY "Users can delete their own notifications" ON notifications
FOR DELETE USING (
  user_id = (
    SELECT id FROM users_profile 
    WHERE user_id = auth.uid()
  )
);

-- 管理员可以管理所有通知
CREATE POLICY "Admins can manage all notifications" ON notifications
FOR ALL USING (
  EXISTS (
    SELECT 1 FROM user_roles ur
    JOIN roles r ON ur.role_id = r.id
    WHERE ur.user_id = auth.uid()
    AND r.name = 'admin'
  )
);

-- 服务角色可以管理所有通知（用于API和函数）
CREATE POLICY "Service role can manage all notifications" ON notifications
FOR ALL USING (
  auth.role() = 'service_role'
);

-- 4.3 公告阅读记录表策略
CREATE POLICY "Users can manage their own announcement reads" ON announcement_reads
FOR ALL USING (
  user_id = (
    SELECT id FROM users_profile 
    WHERE user_id = auth.uid()
  )
);

-- =============================================
-- 5. 创建通知系统函数
-- =============================================

-- 5.1 获取用户的通知
CREATE OR REPLACE FUNCTION get_user_notifications(p_user_id bigint)
RETURNS TABLE (
  id uuid,
  user_id bigint,
  type text,
  title text,
  content text,
  metadata jsonb,
  status text,
  priority integer,
  expires_at timestamptz,
  created_at timestamptz,
  read_at timestamptz,
  handled_at timestamptz
) LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  RETURN QUERY
  SELECT 
    n.id,
    n.user_id,
    n.type,
    n.title,
    n.content,
    n.metadata,
    n.status,
    n.priority,
    n.expires_at,
    n.created_at,
    n.read_at,
    n.handled_at
  FROM notifications n
  WHERE n.user_id = p_user_id
  ORDER BY n.created_at DESC;
END;
$$;

-- 5.2 获取用户有权限的公告
CREATE OR REPLACE FUNCTION get_user_announcements(p_user_id bigint)
RETURNS TABLE (
  id uuid,
  title text,
  content text,
  type text,
  priority integer,
  target_roles text[],
  target_organizations uuid[],
  is_active boolean,
  start_time timestamptz,
  end_time timestamptz,
  created_by bigint,
  created_at timestamptz,
  is_read boolean
) LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  RETURN QUERY
  SELECT 
    a.id,
    a.title,
    a.content,
    a.type,
    a.priority,
    a.target_roles,
    a.target_organizations,
    a.is_active,
    a.start_time,
    a.end_time,
    a.created_by,
    a.created_at,
    ar.id IS NOT NULL as is_read
  FROM announcements a
  LEFT JOIN announcement_reads ar ON a.id = ar.announcement_id AND ar.user_id = p_user_id
  WHERE a.is_active = true 
    AND a.start_time <= now() 
    AND (a.end_time IS NULL OR a.end_time > now())
  ORDER BY a.priority DESC, a.created_at DESC;
END;
$$;

-- 5.3 标记通知为已读
CREATE OR REPLACE FUNCTION mark_notification_read(p_notification_id uuid, p_user_id bigint)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  UPDATE notifications 
  SET status = 'read', read_at = now()
  WHERE id = p_notification_id AND user_id = p_user_id;
  
  RETURN FOUND;
END;
$$;

-- 5.4 标记通知为已处理
CREATE OR REPLACE FUNCTION mark_notification_handled(p_notification_id uuid, p_user_id bigint)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  UPDATE notifications 
  SET status = 'handled', handled_at = now()
  WHERE id = p_notification_id AND user_id = p_user_id;
  
  RETURN FOUND;
END;
$$;

-- 5.5 标记公告为已读
CREATE OR REPLACE FUNCTION mark_announcement_read(p_announcement_id uuid, p_user_id bigint)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  INSERT INTO announcement_reads (announcement_id, user_id)
  VALUES (p_announcement_id, p_user_id)
  ON CONFLICT (announcement_id, user_id) DO NOTHING;
  
  RETURN FOUND;
END;
$$;

-- 5.6 创建通知
CREATE OR REPLACE FUNCTION create_notification(
  p_user_id bigint,
  p_type text,
  p_title text,
  p_content text,
  p_metadata jsonb DEFAULT NULL,
  p_priority integer DEFAULT 0
)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_notification_id uuid;
BEGIN
  INSERT INTO notifications (
    user_id, type, title, content, metadata, priority
  ) VALUES (
    p_user_id, p_type, p_title, p_content, p_metadata, p_priority
  ) RETURNING id INTO v_notification_id;
  
  RETURN v_notification_id;
END;
$$;

-- 5.7 创建公告
CREATE OR REPLACE FUNCTION create_announcement(
  p_title text,
  p_content text,
  p_type text DEFAULT 'info',
  p_priority integer DEFAULT 0,
  p_target_roles text[] DEFAULT NULL,
  p_target_organizations uuid[] DEFAULT NULL,
  p_start_time timestamptz DEFAULT now(),
  p_end_time timestamptz DEFAULT NULL,
  p_created_by bigint DEFAULT NULL
)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_announcement_id uuid;
BEGIN
  INSERT INTO announcements (
    title, content, type, priority, target_roles, target_organizations,
    start_time, end_time, created_by
  ) VALUES (
    p_title, p_content, p_type, p_priority, p_target_roles, p_target_organizations,
    p_start_time, p_end_time, p_created_by
  ) RETURNING id INTO v_announcement_id;
  
  RETURN v_announcement_id;
END;
$$;

-- 5.8 获取通知统计
CREATE OR REPLACE FUNCTION get_notification_stats(p_user_id bigint)
RETURNS TABLE (
  total bigint,
  unread bigint,
  read bigint,
  handled bigint
) LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  RETURN QUERY
  SELECT 
    COUNT(*)::bigint as total,
    COUNT(*) FILTER (WHERE status = 'unread')::bigint as unread,
    COUNT(*) FILTER (WHERE status = 'read')::bigint as read,
    COUNT(*) FILTER (WHERE status = 'handled')::bigint as handled
  FROM notifications
  WHERE user_id = p_user_id;
END;
$$;

-- =============================================
-- 6. 插入示例数据
-- =============================================

-- 6.1 创建示例公告
INSERT INTO announcements (title, content, type, priority, target_roles, target_organizations) VALUES
('系统维护通知', '系统将于今晚22:00-24:00进行维护，期间可能影响正常使用。', 'warning', 1, NULL, NULL),
('新功能上线', '线索分配功能已正式上线，支持智能分配和手动指定。', 'success', 2, NULL, NULL),
('重要提醒', '请及时处理重复客户通知，避免客户流失。', 'info', 0, NULL, NULL)
ON CONFLICT DO NOTHING;

-- 6.2 创建示例通知（如果有用户ID为1的用户）
INSERT INTO notifications (user_id, type, title, content, priority) VALUES
(1, 'system', '欢迎使用CRM系统', '感谢您使用我们的客户关系管理系统！', 0),
(1, 'info', '系统更新', '系统已更新到最新版本，新增了多项功能。', 1)
ON CONFLICT DO NOTHING;

-- =============================================
-- 7. 验证部署
-- =============================================

-- 验证表结构
SELECT '表结构验证:' as info;
SELECT 
  table_name,
  column_name,
  data_type
FROM information_schema.columns 
WHERE table_name IN ('announcements', 'notifications', 'announcement_reads')
ORDER BY table_name, ordinal_position;

-- 验证函数
SELECT '函数验证:' as info;
SELECT routine_name, routine_type 
FROM information_schema.routines 
WHERE routine_name LIKE '%notification%' OR routine_name LIKE '%announcement%'
ORDER BY routine_name;

-- 验证RLS策略
SELECT 'RLS策略验证:' as info;
SELECT 
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd,
  qual,
  with_check
FROM pg_policies 
WHERE tablename IN ('notifications', 'announcements', 'announcement_reads')
ORDER BY tablename, policyname;

COMMIT;

-- =============================================
-- 8. 部署完成
-- =============================================

SELECT '通知系统完整备份部署完成！' as status;
SELECT '所有表、函数、策略和示例数据已创建' as message; 