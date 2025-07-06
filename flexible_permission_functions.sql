-- 灵活的权限检查函数

-- 启用RLS策略
ALTER TABLE public.permission_resources ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.permission_actions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.permission_scopes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.role_permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.permission_audit_logs ENABLE ROW LEVEL SECURITY;

-- 基础RLS策略
CREATE POLICY "permission_resources_select_policy" ON public.permission_resources
  FOR SELECT USING (true);

CREATE POLICY "permission_actions_select_policy" ON public.permission_actions
  FOR SELECT USING (true);

CREATE POLICY "permission_scopes_select_policy" ON public.permission_scopes
  FOR SELECT USING (true);

CREATE POLICY "roles_select_policy" ON public.roles
  FOR SELECT USING (true);

-- 核心权限检查函数
CREATE OR REPLACE FUNCTION check_permission(
  resource_name TEXT,
  action_name TEXT,
  scope_name TEXT DEFAULT 'global',
  user_uuid UUID DEFAULT auth.uid(),
  context_data JSONB DEFAULT '{}'
)
RETURNS BOOLEAN AS $$
DECLARE
  user_permissions RECORD;
  scope_condition JSONB;
  context_value TEXT;
  condition_key TEXT;
  condition_value TEXT;
BEGIN
  -- 获取用户的权限配置
  SELECT 
    rp.conditions,
    ps.scope_condition,
    ps.scope_type
  INTO user_permissions
  FROM public.user_roles ur
  JOIN public.roles r ON ur.role_id = r.id
  JOIN public.role_permissions rp ON r.id = rp.role_id
  JOIN public.permission_resources pr ON rp.resource_id = pr.id
  JOIN public.permission_actions pa ON rp.action_id = pa.id
  JOIN public.permission_scopes ps ON rp.scope_id = ps.id
  WHERE ur.user_id = user_uuid
    AND ur.is_active = true
    AND (ur.expires_at IS NULL OR ur.expires_at > NOW())
    AND r.is_active = true
    AND rp.is_active = true
    AND pr.name = resource_name
    AND pa.name = action_name
    AND ps.name = scope_name
  LIMIT 1;

  -- 如果没有找到权限配置，返回false
  IF user_permissions IS NULL THEN
    RETURN false;
  END IF;

  -- 检查范围条件
  scope_condition := user_permissions.scope_condition;
  
  -- 如果是全局权限，直接返回true
  IF user_permissions.scope_type = 'global' THEN
    RETURN true;
  END IF;

  -- 检查范围条件是否满足
  FOR condition_key, condition_value IN SELECT * FROM jsonb_each_text(scope_condition)
  LOOP
    -- 获取上下文中的值
    context_value := context_data ->> condition_key;
    
    -- 如果是特殊值，需要动态获取
    IF condition_value = 'current_user_id' THEN
      context_value := user_uuid::text;
    ELSIF condition_value = 'current_user_org' THEN
      SELECT organization_id::text INTO context_value
      FROM public.users_profile
      WHERE user_id = user_uuid;
    ELSIF condition_value = 'current_user_dept' THEN
      SELECT department_id::text INTO context_value
      FROM public.users_profile
      WHERE user_id = user_uuid;
    END IF;

    -- 如果条件不匹配，返回false
    IF context_value IS NULL OR context_value != condition_value THEN
      RETURN false;
    END IF;
  END LOOP;

  -- 检查额外条件
  IF user_permissions.conditions IS NOT NULL AND user_permissions.conditions != '{}' THEN
    -- 这里可以添加更复杂的条件检查逻辑
    -- 例如：检查数据状态、类型等
  END IF;

  RETURN true;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 获取用户所有权限函数
CREATE OR REPLACE FUNCTION get_user_permissions(user_uuid UUID DEFAULT auth.uid())
RETURNS TABLE(
  resource_name TEXT,
  action_name TEXT,
  scope_name TEXT,
  scope_type TEXT,
  conditions JSONB
) AS $$
BEGIN
  RETURN QUERY
  SELECT DISTINCT
    pr.name,
    pa.name,
    ps.name,
    ps.scope_type,
    rp.conditions
  FROM public.user_roles ur
  JOIN public.roles r ON ur.role_id = r.id
  JOIN public.role_permissions rp ON r.id = rp.role_id
  JOIN public.permission_resources pr ON rp.resource_id = pr.id
  JOIN public.permission_actions pa ON rp.action_id = pa.id
  JOIN public.permission_scopes ps ON rp.scope_id = ps.id
  WHERE ur.user_id = user_uuid
    AND ur.is_active = true
    AND (ur.expires_at IS NULL OR ur.expires_at > NOW())
    AND r.is_active = true
    AND rp.is_active = true
    AND pr.is_active = true
    AND pa.is_active = true
    AND ps.is_active = true;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 获取用户角色函数
CREATE OR REPLACE FUNCTION get_user_roles(user_uuid UUID DEFAULT auth.uid())
RETURNS TABLE(
  role_id UUID,
  role_name TEXT,
  role_display_name TEXT,
  granted_at TIMESTAMP WITH TIME ZONE,
  expires_at TIMESTAMP WITH TIME ZONE,
  is_active BOOLEAN
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    ur.role_id,
    r.name,
    r.display_name,
    ur.granted_at,
    ur.expires_at,
    ur.is_active
  FROM public.user_roles ur
  JOIN public.roles r ON ur.role_id = r.id
  WHERE ur.user_id = user_uuid 
    AND ur.is_active = true
    AND (ur.expires_at IS NULL OR ur.expires_at > NOW())
    AND r.is_active = true;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 检查是否为超级管理员
CREATE OR REPLACE FUNCTION is_super_admin(user_uuid UUID DEFAULT auth.uid())
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.user_roles ur
    JOIN public.roles r ON ur.role_id = r.id
    WHERE ur.user_id = user_uuid 
      AND r.name = 'super_admin'
      AND ur.is_active = true
      AND (ur.expires_at IS NULL OR ur.expires_at > NOW())
      AND r.is_active = true
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 动态数据权限过滤函数
CREATE OR REPLACE FUNCTION get_data_permission_filter(
  table_name TEXT,
  user_uuid UUID DEFAULT auth.uid()
)
RETURNS TEXT AS $$
DECLARE
  user_permissions RECORD;
  filter_conditions TEXT[] := ARRAY[]::TEXT[];
  scope_condition JSONB;
  condition_key TEXT;
  condition_value TEXT;
BEGIN
  -- 如果是超级管理员，返回空过滤条件（可以访问所有数据）
  IF is_super_admin(user_uuid) THEN
    RETURN '';
  END IF;

  -- 获取用户对该表的权限
  FOR user_permissions IN
    SELECT 
      ps.scope_condition,
      ps.scope_type,
      rp.conditions
    FROM public.user_roles ur
    JOIN public.roles r ON ur.role_id = r.id
    JOIN public.role_permissions rp ON r.id = rp.role_id
    JOIN public.permission_resources pr ON rp.resource_id = pr.id
    JOIN public.permission_scopes ps ON rp.scope_id = ps.id
    WHERE ur.user_id = user_uuid
      AND ur.is_active = true
      AND (ur.expires_at IS NULL OR ur.expires_at > NOW())
      AND r.is_active = true
      AND rp.is_active = true
      AND pr.table_name = table_name
      AND ps.is_active = true
  LOOP
    -- 根据范围类型构建过滤条件
    CASE user_permissions.scope_type
      WHEN 'personal' THEN
        filter_conditions := array_append(filter_conditions, format('user_id = %L', user_uuid));
      WHEN 'created_by' THEN
        filter_conditions := array_append(filter_conditions, format('created_by = %L', user_uuid));
      WHEN 'assigned_to' THEN
        filter_conditions := array_append(filter_conditions, format('assigned_to = %L', user_uuid));
      WHEN 'organization' THEN
        -- 获取用户所属组织
        SELECT organization_id::text INTO condition_value
        FROM public.users_profile
        WHERE user_id = user_uuid;
        IF condition_value IS NOT NULL THEN
          filter_conditions := array_append(filter_conditions, format('organization_id = %L', condition_value));
        END IF;
      WHEN 'department' THEN
        -- 获取用户所属部门
        SELECT department_id::text INTO condition_value
        FROM public.users_profile
        WHERE user_id = user_uuid;
        IF condition_value IS NOT NULL THEN
          filter_conditions := array_append(filter_conditions, format('department_id = %L', condition_value));
        END IF;
    END CASE;
  END LOOP;

  -- 返回过滤条件
  IF array_length(filter_conditions, 1) > 0 THEN
    RETURN 'WHERE ' || array_to_string(filter_conditions, ' OR ');
  ELSE
    RETURN 'WHERE false'; -- 没有权限
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 创建角色权限函数
CREATE OR REPLACE FUNCTION create_role_permission(
  role_name TEXT,
  resource_name TEXT,
  action_name TEXT,
  scope_name TEXT,
  conditions JSONB DEFAULT '{}',
  created_by_user_id UUID DEFAULT auth.uid()
)
RETURNS BOOLEAN AS $$
DECLARE
  role_uuid UUID;
  resource_uuid UUID;
  action_uuid UUID;
  scope_uuid UUID;
BEGIN
  -- 检查权限
  IF NOT is_super_admin(created_by_user_id) THEN
    RAISE EXCEPTION '权限不足：只有超级管理员可以创建角色权限';
  END IF;

  -- 获取各个ID
  SELECT id INTO role_uuid FROM public.roles WHERE name = role_name AND is_active = true;
  SELECT id INTO resource_uuid FROM public.permission_resources WHERE name = resource_name AND is_active = true;
  SELECT id INTO action_uuid FROM public.permission_actions WHERE name = action_name AND is_active = true;
  SELECT id INTO scope_uuid FROM public.permission_scopes WHERE name = scope_name AND is_active = true;

  IF role_uuid IS NULL THEN
    RAISE EXCEPTION '角色不存在：%', role_name;
  END IF;
  IF resource_uuid IS NULL THEN
    RAISE EXCEPTION '资源不存在：%', resource_name;
  END IF;
  IF action_uuid IS NULL THEN
    RAISE EXCEPTION '操作不存在：%', action_name;
  END IF;
  IF scope_uuid IS NULL THEN
    RAISE EXCEPTION '范围不存在：%', scope_name;
  END IF;

  -- 创建角色权限
  INSERT INTO public.role_permissions (role_id, resource_id, action_id, scope_id, conditions)
  VALUES (role_uuid, resource_uuid, action_uuid, scope_uuid, conditions)
  ON CONFLICT (role_id, resource_id, action_id, scope_id) 
  DO UPDATE SET conditions = EXCLUDED.conditions;

  RETURN true;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 删除角色权限函数
CREATE OR REPLACE FUNCTION delete_role_permission(
  role_name TEXT,
  resource_name TEXT,
  action_name TEXT,
  scope_name TEXT,
  deleted_by_user_id UUID DEFAULT auth.uid()
)
RETURNS BOOLEAN AS $$
DECLARE
  role_uuid UUID;
  resource_uuid UUID;
  action_uuid UUID;
  scope_uuid UUID;
BEGIN
  -- 检查权限
  IF NOT is_super_admin(deleted_by_user_id) THEN
    RAISE EXCEPTION '权限不足：只有超级管理员可以删除角色权限';
  END IF;

  -- 获取各个ID
  SELECT id INTO role_uuid FROM public.roles WHERE name = role_name AND is_active = true;
  SELECT id INTO resource_uuid FROM public.permission_resources WHERE name = resource_name AND is_active = true;
  SELECT id INTO action_uuid FROM public.permission_actions WHERE name = action_name AND is_active = true;
  SELECT id INTO scope_uuid FROM public.permission_scopes WHERE name = scope_name AND is_active = true;

  -- 删除角色权限
  DELETE FROM public.role_permissions
  WHERE role_id = role_uuid 
    AND resource_id = resource_uuid 
    AND action_id = action_uuid 
    AND scope_id = scope_uuid;

  RETURN true;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER; 