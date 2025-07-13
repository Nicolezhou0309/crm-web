-- 部署公告管理相关函数
-- 创建时间: 2024年12月

-- 1. 创建公告函数
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

-- 2. 获取用户公告函数
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

-- 3. 标记公告为已读函数
CREATE OR REPLACE FUNCTION mark_announcement_read(p_announcement_id uuid, p_user_id bigint)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  INSERT INTO announcement_reads (announcement_id, user_id)
  VALUES (p_announcement_id, p_user_id)
  ON CONFLICT (announcement_id, user_id) DO NOTHING;
  
  RETURN FOUND;
END;
$$;

-- 4. 获取所有公告函数（管理员用）
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

-- 5. 验证函数是否创建成功
SELECT '函数部署完成' as status;
SELECT routine_name, routine_type 
FROM information_schema.routines 
WHERE routine_name IN ('create_announcement', 'get_user_announcements', 'mark_announcement_read', 'get_all_announcements')
ORDER BY routine_name; 