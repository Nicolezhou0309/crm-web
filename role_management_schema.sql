-- 角色管理系统数据库架构

-- 1. 角色表
CREATE TABLE IF NOT EXISTS public.roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(50) NOT NULL UNIQUE,
  display_name VARCHAR(100) NOT NULL,
  description TEXT,
  permissions JSONB DEFAULT '[]',
  is_system BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. 权限表
CREATE TABLE IF NOT EXISTS public.permissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(100) NOT NULL UNIQUE,
  display_name VARCHAR(200) NOT NULL,
  description TEXT,
  resource VARCHAR(50) NOT NULL,
  action VARCHAR(50) NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 3. 用户角色关联表
CREATE TABLE IF NOT EXISTS public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role_id UUID NOT NULL REFERENCES public.roles(id) ON DELETE CASCADE,
  organization_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE,
  granted_by UUID REFERENCES auth.users(id),
  granted_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  expires_at TIMESTAMP WITH TIME ZONE,
  is_active BOOLEAN DEFAULT true,
  UNIQUE(user_id, role_id, organization_id)
);

-- 4. 角色继承表
CREATE TABLE IF NOT EXISTS public.role_inheritance (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  parent_role_id UUID NOT NULL REFERENCES public.roles(id) ON DELETE CASCADE,
  child_role_id UUID NOT NULL REFERENCES public.roles(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(parent_role_id, child_role_id)
);

-- 5. 操作日志表
CREATE TABLE IF NOT EXISTS public.role_audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id),
  action VARCHAR(50) NOT NULL,
  resource_type VARCHAR(50) NOT NULL,
  resource_id UUID,
  old_values JSONB,
  new_values JSONB,
  ip_address INET,
  user_agent TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 创建索引
CREATE INDEX IF NOT EXISTS idx_user_roles_user_id ON public.user_roles(user_id);
CREATE INDEX IF NOT EXISTS idx_user_roles_role_id ON public.user_roles(role_id);
CREATE INDEX IF NOT EXISTS idx_user_roles_org_id ON public.user_roles(organization_id);
CREATE INDEX IF NOT EXISTS idx_role_audit_logs_user_id ON public.role_audit_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_role_audit_logs_created_at ON public.role_audit_logs(created_at);

-- 插入基础角色数据
INSERT INTO public.roles (name, display_name, description, permissions, is_system) VALUES
('super_admin', '超级管理员', '系统最高权限，可以管理所有功能和用户', 
 '["*"]', true),
('system_admin', '系统管理员', '可以管理系统配置和用户角色', 
 '["user:read", "user:write", "role:read", "role:write", "organization:read", "organization:write"]', true),
('department_admin', '部门管理员', '可以管理指定部门的成员和资源', 
 '["user:read", "user:write", "organization:read", "department:manage"]', true),
('team_lead', '团队负责人', '可以管理团队成员和项目', 
 '["user:read", "project:read", "project:write", "team:manage"]', true),
('employee', '普通员工', '基础用户权限', 
 '["user:read", "project:read"]', true),
('guest', '访客', '只读权限', 
 '["user:read"]', true);

-- 插入基础权限数据
INSERT INTO public.permissions (name, display_name, description, resource, action) VALUES
('user:read', '查看用户', '查看用户信息', 'user', 'read'),
('user:write', '管理用户', '创建、编辑、删除用户', 'user', 'write'),
('role:read', '查看角色', '查看角色信息', 'role', 'read'),
('role:write', '管理角色', '创建、编辑、删除角色', 'role', 'write'),
('organization:read', '查看组织', '查看组织信息', 'organization', 'read'),
('organization:write', '管理组织', '创建、编辑、删除组织', 'organization', 'write'),
('department:manage', '管理部门', '管理指定部门', 'department', 'manage'),
('project:read', '查看项目', '查看项目信息', 'project', 'read'),
('project:write', '管理项目', '创建、编辑、删除项目', 'project', 'write'),
('team:manage', '管理团队', '管理团队成员', 'team', 'manage');

-- 设置角色继承关系
INSERT INTO public.role_inheritance (parent_role_id, child_role_id) VALUES
((SELECT id FROM public.roles WHERE name = 'super_admin'), (SELECT id FROM public.roles WHERE name = 'system_admin')),
((SELECT id FROM public.roles WHERE name = 'system_admin'), (SELECT id FROM public.roles WHERE name = 'department_admin')),
((SELECT id FROM public.roles WHERE name = 'department_admin'), (SELECT id FROM public.roles WHERE name = 'team_lead')),
((SELECT id FROM public.roles WHERE name = 'team_lead'), (SELECT id FROM public.roles WHERE name = 'employee')),
((SELECT id FROM public.roles WHERE name = 'employee'), (SELECT id FROM public.roles WHERE name = 'guest'));

-- 创建RLS策略
ALTER TABLE public.roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.role_inheritance ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.role_audit_logs ENABLE ROW LEVEL SECURITY;

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

-- 创建权限检查函数
CREATE OR REPLACE FUNCTION has_permission(
  required_permission TEXT,
  target_user_id UUID DEFAULT NULL,
  target_organization_id UUID DEFAULT NULL
)
RETURNS BOOLEAN AS $$
DECLARE
  user_permissions JSONB;
  user_roles UUID[];
BEGIN
  -- 获取用户的所有角色
  SELECT ARRAY_AGG(ur.role_id) INTO user_roles
  FROM public.user_roles ur
  WHERE ur.user_id = auth.uid() AND ur.is_active = true
    AND (ur.expires_at IS NULL OR ur.expires_at > NOW());

  -- 获取角色的所有权限
  SELECT COALESCE(
    (SELECT jsonb_agg(DISTINCT r.permissions) 
     FROM public.roles r 
     WHERE r.id = ANY(user_roles)), 
    '[]'::jsonb
  ) INTO user_permissions;

  -- 检查是否有超级管理员权限
  IF user_permissions ? '*' THEN
    RETURN true;
  END IF;

  -- 检查具体权限
  RETURN user_permissions ? required_permission;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 创建获取用户角色函数
CREATE OR REPLACE FUNCTION get_user_roles(user_uuid UUID DEFAULT auth.uid())
RETURNS TABLE(
  role_id UUID,
  role_name TEXT,
  role_display_name TEXT,
  organization_id UUID,
  granted_at TIMESTAMP WITH TIME ZONE,
  expires_at TIMESTAMP WITH TIME ZONE
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    ur.role_id,
    r.name,
    r.display_name,
    ur.organization_id,
    ur.granted_at,
    ur.expires_at
  FROM public.user_roles ur
  JOIN public.roles r ON ur.role_id = r.id
  WHERE ur.user_id = user_uuid 
    AND ur.is_active = true
    AND (ur.expires_at IS NULL OR ur.expires_at > NOW());
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 创建检查是否为超级管理员函数
CREATE OR REPLACE FUNCTION is_super_admin()
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.user_roles ur
    JOIN public.roles r ON ur.role_id = r.id
    WHERE ur.user_id = auth.uid() 
      AND r.name = 'super_admin'
      AND ur.is_active = true
      AND (ur.expires_at IS NULL OR ur.expires_at > NOW())
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;