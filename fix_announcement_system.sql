-- 修复公告系统
-- 创建时间: 2024年12月

BEGIN;

-- 1. 确保公告表存在
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

-- 2. 确保公告阅读记录表存在
CREATE TABLE IF NOT EXISTS announcement_reads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  announcement_id uuid REFERENCES announcements(id) ON DELETE CASCADE,
  user_id bigint REFERENCES users_profile(id),
  read_at timestamptz DEFAULT now(),
  UNIQUE(announcement_id, user_id)
);

-- 3. 创建索引
CREATE INDEX IF NOT EXISTS idx_announcements_active_time ON announcements (is_active, start_time, end_time);
CREATE INDEX IF NOT EXISTS idx_announcements_priority ON announcements (priority DESC);
CREATE INDEX IF NOT EXISTS idx_announcement_reads_user ON announcement_reads (user_id);

-- 4. 启用RLS
ALTER TABLE announcements ENABLE ROW LEVEL SECURITY;
ALTER TABLE announcement_reads ENABLE ROW LEVEL SECURITY;

-- 5. 创建RLS策略
DROP POLICY IF EXISTS "Users can view active announcements" ON announcements;
CREATE POLICY "Users can view active announcements" ON announcements
FOR SELECT USING (
  is_active = true 
  AND start_time <= now() 
  AND (end_time IS NULL OR end_time > now())
);

DROP POLICY IF EXISTS "Admins can manage all announcements" ON announcements;
CREATE POLICY "Admins can manage all announcements" ON announcements
FOR ALL USING (
  EXISTS (
    SELECT 1 FROM user_roles ur
    JOIN roles r ON ur.role_id = r.id
    WHERE ur.user_id = auth.uid()
    AND r.name IN ('super_admin', 'system_admin', 'department_admin')
  )
);

DROP POLICY IF EXISTS "Service role can manage all announcements" ON announcements;
CREATE POLICY "Service role can manage all announcements" ON announcements
FOR ALL USING (
  auth.role() = 'service_role'
);

DROP POLICY IF EXISTS "Users can manage their own announcement reads" ON announcement_reads;
CREATE POLICY "Users can manage their own announcement reads" ON announcement_reads
FOR ALL USING (
  user_id = (
    SELECT id FROM users_profile 
    WHERE user_id = auth.uid()
  )
);

-- 6. 创建公告相关函数
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

CREATE OR REPLACE FUNCTION get_all_announcements()
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
  updated_at timestamptz
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
    a.updated_at
  FROM announcements a
  ORDER BY a.created_at DESC;
END;
$$;

CREATE OR REPLACE FUNCTION mark_announcement_read(p_announcement_id uuid, p_user_id bigint)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  INSERT INTO announcement_reads (announcement_id, user_id)
  VALUES (p_announcement_id, p_user_id)
  ON CONFLICT (announcement_id, user_id) DO NOTHING;
  
  RETURN FOUND;
END;
$$;

-- 7. 添加公告管理权限（如果不存在）
INSERT INTO permissions (name, description, resource, action)
VALUES ('manage_announcements', '公告管理', 'announcement', 'manage')
ON CONFLICT (name) DO NOTHING;

-- 8. 为系统管理员分配公告管理权限
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r, permissions p
WHERE r.name = 'system_admin' AND p.name = 'manage_announcements'
ON CONFLICT DO NOTHING;

-- 9. 验证部署
SELECT '公告系统修复完成' as status;

-- 验证表结构
SELECT '表结构验证:' as info;
SELECT 
  table_name,
  column_name,
  data_type
FROM information_schema.columns 
WHERE table_name IN ('announcements', 'announcement_reads')
ORDER BY table_name, ordinal_position;

-- 验证函数
SELECT '函数验证:' as info;
SELECT routine_name, routine_type 
FROM information_schema.routines 
WHERE routine_name IN ('create_announcement', 'get_user_announcements', 'get_all_announcements', 'mark_announcement_read')
ORDER BY routine_name;

-- 验证权限
SELECT '权限验证:' as info;
SELECT p.name as permission_name, r.name as role_name
FROM permissions p
JOIN role_permissions rp ON p.id = rp.permission_id
JOIN roles r ON rp.role_id = r.id
WHERE p.name = 'manage_announcements';

COMMIT;

SELECT '公告系统修复部署完成！' as final_status; 