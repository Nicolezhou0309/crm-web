-- Supabase Auth 联动函数

-- 启用RLS策略
ALTER TABLE public.roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.role_permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.permission_audit_logs ENABLE ROW LEVEL SECURITY;

-- 角色表RLS策略
CREATE POLICY "roles_select_policy" ON public.roles
  FOR SELECT USING (true);

CREATE POLICY "roles_insert_policy" ON public.roles
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.user_roles ur
      JOIN public.roles r ON ur.role_id = r.id
      WHERE ur.user_id = auth.uid() AND r.name IN ('super_admin', 'system_admin')
    )
  );

CREATE POLICY "roles_update_policy" ON public.roles
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM public.user_roles ur
      JOIN public.roles r ON ur.role_id = r.id
      WHERE ur.user_id = auth.uid() AND r.name IN ('super_admin', 'system_admin')
    )
  );

-- 权限表RLS策略
CREATE POLICY "permissions_select_policy" ON public.permissions
  FOR SELECT USING (true);

CREATE POLICY "permissions_insert_policy" ON public.permissions
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.user_roles ur
      JOIN public.roles r ON ur.role_id = r.id
      WHERE ur.user_id = auth.uid() AND r.name IN ('super_admin', 'system_admin')
    )
  );

-- 用户角色表RLS策略
CREATE POLICY "user_roles_select_policy" ON public.user_roles
  FOR SELECT USING (
    auth.uid() = user_id OR
    EXISTS (
      SELECT 1 FROM public.user_roles ur
      JOIN public.roles r ON ur.role_id = r.id
      WHERE ur.user_id = auth.uid() AND r.name IN ('super_admin', 'system_admin')
    )
  );

CREATE POLICY "user_roles_insert_policy" ON public.user_roles
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.user_roles ur
      JOIN public.roles r ON ur.role_id = r.id
      WHERE ur.user_id = auth.uid() AND r.name IN ('super_admin', 'system_admin')
    )
  );

CREATE POLICY "user_roles_update_policy" ON public.user_roles
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM public.user_roles ur
      JOIN public.roles r ON ur.role_id = r.id
      WHERE ur.user_id = auth.uid() AND r.name IN ('super_admin', 'system_admin')
    )
  );

-- 角色权限关联表RLS策略
CREATE POLICY "role_permissions_select_policy" ON public.role_permissions
  FOR SELECT USING (true);

CREATE POLICY "role_permissions_insert_policy" ON public.role_permissions
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.user_roles ur
      JOIN public.roles r ON ur.role_id = r.id
      WHERE ur.user_id = auth.uid() AND r.name IN ('super_admin', 'system_admin')
    )
  );

-- 权限检查函数
CREATE OR REPLACE FUNCTION has_permission(
  required_permission TEXT,
  user_uuid UUID DEFAULT auth.uid()
)
RETURNS BOOLEAN AS $$
DECLARE
  user_permissions TEXT[];
BEGIN
  -- 获取用户的所有权限
  SELECT ARRAY_AGG(DISTINCT p.name) INTO user_permissions
  FROM public.user_roles ur
  JOIN public.roles r ON ur.role_id = r.id
  JOIN public.role_permissions rp ON r.id = rp.role_id
  JOIN public.permissions p ON rp.permission_id = p.id
  WHERE ur.user_id = user_uuid 
    AND ur.is_active = true
    AND (ur.expires_at IS NULL OR ur.expires_at > NOW())
    AND r.is_active = true
    AND p.is_active = true;

  -- 检查是否有超级管理员权限
  IF user_permissions IS NULL THEN
    RETURN false;
  END IF;

  -- 检查是否有通配符权限
  IF '*' = ANY(user_permissions) THEN
    RETURN true;
  END IF;

  -- 检查具体权限
  RETURN required_permission = ANY(user_permissions);
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

-- 获取用户权限函数
CREATE OR REPLACE FUNCTION get_user_permissions(user_uuid UUID DEFAULT auth.uid())
RETURNS TABLE(
  permission_name TEXT,
  permission_display_name TEXT,
  category TEXT,
  resource TEXT,
  action TEXT
) AS $$
BEGIN
  RETURN QUERY
  SELECT DISTINCT
    p.name,
    p.display_name,
    p.category,
    p.resource,
    p.action
  FROM public.user_roles ur
  JOIN public.roles r ON ur.role_id = r.id
  JOIN public.role_permissions rp ON r.id = rp.role_id
  JOIN public.permissions p ON rp.permission_id = p.id
  WHERE ur.user_id = user_uuid 
    AND ur.is_active = true
    AND (ur.expires_at IS NULL OR ur.expires_at > NOW())
    AND r.is_active = true
    AND p.is_active = true;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 检查是否为超级管理员函数
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

-- 检查是否为系统管理员函数
CREATE OR REPLACE FUNCTION is_system_admin(user_uuid UUID DEFAULT auth.uid())
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.user_roles ur
    JOIN public.roles r ON ur.role_id = r.id
    WHERE ur.user_id = user_uuid 
      AND r.name IN ('super_admin', 'system_admin')
      AND ur.is_active = true
      AND (ur.expires_at IS NULL OR ur.expires_at > NOW())
      AND r.is_active = true
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 为用户分配角色函数
CREATE OR REPLACE FUNCTION assign_role_to_user(
  target_user_id UUID,
  role_name TEXT,
  granted_by_user_id UUID DEFAULT auth.uid(),
  expires_at TIMESTAMP WITH TIME ZONE DEFAULT NULL
)
RETURNS BOOLEAN AS $$
DECLARE
  role_uuid UUID;
BEGIN
  -- 检查当前用户是否有权限分配角色
  IF NOT is_system_admin(granted_by_user_id) THEN
    RAISE EXCEPTION '权限不足：只有系统管理员可以分配角色';
  END IF;

  -- 获取角色ID
  SELECT id INTO role_uuid
  FROM public.roles
  WHERE name = role_name AND is_active = true;

  IF role_uuid IS NULL THEN
    RAISE EXCEPTION '角色不存在：%', role_name;
  END IF;

  -- 分配角色
  INSERT INTO public.user_roles (user_id, role_id, granted_by, expires_at)
  VALUES (target_user_id, role_uuid, granted_by_user_id, expires_at)
  ON CONFLICT (user_id, role_id) 
  DO UPDATE SET 
    granted_by = granted_by_user_id,
    expires_at = expires_at,
    is_active = true;

  -- 记录审计日志
  INSERT INTO public.permission_audit_logs (
    user_id, action, resource_type, resource_id, new_values
  ) VALUES (
    granted_by_user_id,
    'assign_role',
    'user_role',
    target_user_id,
    jsonb_build_object(
      'target_user_id', target_user_id,
      'role_name', role_name,
      'expires_at', expires_at
    )
  );

  RETURN true;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 移除用户角色函数
CREATE OR REPLACE FUNCTION remove_role_from_user(
  target_user_id UUID,
  role_name TEXT,
  removed_by_user_id UUID DEFAULT auth.uid()
)
RETURNS BOOLEAN AS $$
DECLARE
  role_uuid UUID;
BEGIN
  -- 检查当前用户是否有权限移除角色
  IF NOT is_system_admin(removed_by_user_id) THEN
    RAISE EXCEPTION '权限不足：只有系统管理员可以移除角色';
  END IF;

  -- 获取角色ID
  SELECT id INTO role_uuid
  FROM public.roles
  WHERE name = role_name AND is_active = true;

  IF role_uuid IS NULL THEN
    RAISE EXCEPTION '角色不存在：%', role_name;
  END IF;

  -- 移除角色（软删除）
  UPDATE public.user_roles 
  SET is_active = false
  WHERE user_id = target_user_id AND role_id = role_uuid;

  -- 记录审计日志
  INSERT INTO public.permission_audit_logs (
    user_id, action, resource_type, resource_id, old_values
  ) VALUES (
    removed_by_user_id,
    'remove_role',
    'user_role',
    target_user_id,
    jsonb_build_object(
      'target_user_id', target_user_id,
      'role_name', role_name
    )
  );

  RETURN true;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 创建触发器：用户注册时自动分配默认角色
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  -- 为新用户分配默认角色（普通员工）
  INSERT INTO public.user_roles (user_id, role_id, granted_by)
  SELECT 
    NEW.id,
    (SELECT id FROM public.roles WHERE name = 'employee'),
    NEW.id
  WHERE NOT EXISTS (
    SELECT 1 FROM public.user_roles WHERE user_id = NEW.id
  );
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 创建触发器
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- 创建触发器：记录权限变更
CREATE OR REPLACE FUNCTION log_permission_changes()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.permission_audit_logs (
      user_id, action, resource_type, resource_id, new_values
    ) VALUES (
      auth.uid(),
      'create',
      TG_TABLE_NAME,
      NEW.id,
      to_jsonb(NEW)
    );
    RETURN NEW;
  ELSIF TG_OP = 'UPDATE' THEN
    INSERT INTO public.permission_audit_logs (
      user_id, action, resource_type, resource_id, old_values, new_values
    ) VALUES (
      auth.uid(),
      'update',
      TG_TABLE_NAME,
      NEW.id,
      to_jsonb(OLD),
      to_jsonb(NEW)
    );
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    INSERT INTO public.permission_audit_logs (
      user_id, action, resource_type, resource_id, old_values
    ) VALUES (
      auth.uid(),
      'delete',
      TG_TABLE_NAME,
      OLD.id,
      to_jsonb(OLD)
    );
    RETURN OLD;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 为关键表创建审计触发器
CREATE TRIGGER audit_user_roles_changes
  AFTER INSERT OR UPDATE OR DELETE ON public.user_roles
  FOR EACH ROW EXECUTE FUNCTION log_permission_changes();

CREATE TRIGGER audit_roles_changes
  AFTER INSERT OR UPDATE OR DELETE ON public.roles
  FOR EACH ROW EXECUTE FUNCTION log_permission_changes();

CREATE TRIGGER audit_permissions_changes
  AFTER INSERT OR UPDATE OR DELETE ON public.permissions
  FOR EACH ROW EXECUTE FUNCTION log_permission_changes(); 