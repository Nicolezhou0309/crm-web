-- 完全可配置的权限系统数据库表结构

-- 1. 权限资源表（定义系统中的所有资源）
CREATE TABLE IF NOT EXISTS public.permission_resources (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(100) NOT NULL UNIQUE,
  display_name VARCHAR(200) NOT NULL,
  description TEXT,
  resource_type VARCHAR(50) NOT NULL, -- 'table', 'api', 'page', 'function'
  table_name VARCHAR(100), -- 如果是数据库表
  api_path VARCHAR(200), -- 如果是API路径
  page_path VARCHAR(200), -- 如果是页面路径
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. 权限操作表（定义所有可能的操作）
CREATE TABLE IF NOT EXISTS public.permission_actions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(100) NOT NULL UNIQUE,
  display_name VARCHAR(200) NOT NULL,
  description TEXT,
  action_type VARCHAR(50) NOT NULL, -- 'read', 'write', 'delete', 'create', 'export', 'import'
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 3. 权限范围表（定义权限的作用范围）
CREATE TABLE IF NOT EXISTS public.permission_scopes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(100) NOT NULL UNIQUE,
  display_name VARCHAR(200) NOT NULL,
  description TEXT,
  scope_type VARCHAR(50) NOT NULL, -- 'global', 'organization', 'department', 'team', 'personal'
  scope_condition JSONB, -- 存储范围条件，如 {"organization_id": "current_user_org"}
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 4. 角色表（完全自定义）
CREATE TABLE IF NOT EXISTS public.roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(50) NOT NULL UNIQUE,
  display_name VARCHAR(100) NOT NULL,
  description TEXT,
  is_system BOOLEAN DEFAULT false,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 5. 角色权限表（核心权限配置）
CREATE TABLE IF NOT EXISTS public.role_permissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  role_id UUID NOT NULL REFERENCES public.roles(id) ON DELETE CASCADE,
  resource_id UUID NOT NULL REFERENCES public.permission_resources(id) ON DELETE CASCADE,
  action_id UUID NOT NULL REFERENCES public.permission_actions(id) ON DELETE CASCADE,
  scope_id UUID NOT NULL REFERENCES public.permission_scopes(id) ON DELETE CASCADE,
  conditions JSONB DEFAULT '{}', -- 额外的权限条件，如 {"status": "active", "type": "public"}
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(role_id, resource_id, action_id, scope_id)
);

-- 6. 用户角色表
CREATE TABLE IF NOT EXISTS public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role_id UUID NOT NULL REFERENCES public.roles(id) ON DELETE CASCADE,
  granted_by UUID REFERENCES auth.users(id),
  granted_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  expires_at TIMESTAMP WITH TIME ZONE,
  is_active BOOLEAN DEFAULT true,
  UNIQUE(user_id, role_id)
);

-- 7. 权限审计日志表
CREATE TABLE IF NOT EXISTS public.permission_audit_logs (
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
CREATE INDEX IF NOT EXISTS idx_permission_resources_name ON public.permission_resources(name);
CREATE INDEX IF NOT EXISTS idx_permission_resources_type ON public.permission_resources(resource_type);
CREATE INDEX IF NOT EXISTS idx_permission_actions_name ON public.permission_actions(name);
CREATE INDEX IF NOT EXISTS idx_permission_scopes_name ON public.permission_scopes(name);
CREATE INDEX IF NOT EXISTS idx_role_permissions_role_id ON public.role_permissions(role_id);
CREATE INDEX IF NOT EXISTS idx_role_permissions_resource_id ON public.role_permissions(resource_id);
CREATE INDEX IF NOT EXISTS idx_user_roles_user_id ON public.user_roles(user_id);
CREATE INDEX IF NOT EXISTS idx_user_roles_role_id ON public.user_roles(role_id);

-- 插入基础权限资源
INSERT INTO public.permission_resources (name, display_name, description, resource_type, table_name) VALUES
-- 用户管理资源
('users_profile', '用户档案', '用户基本信息管理', 'table', 'users_profile'),
('auth_users', '认证用户', '用户认证信息', 'table', 'auth.users'),
('user_roles', '用户角色', '用户角色分配', 'table', 'user_roles'),

-- 部门管理资源
('organizations', '部门组织', '部门结构管理', 'table', 'organizations'),
('department_members', '部门成员', '部门成员管理', 'table', 'department_members'),

-- 项目管理资源
('projects', '项目', '项目管理', 'table', 'projects'),
('project_members', '项目成员', '项目成员管理', 'table', 'project_members'),
('project_tasks', '项目任务', '项目任务管理', 'table', 'project_tasks'),

-- 数据管理资源
('leads', '潜在客户', '潜在客户数据', 'table', 'leads'),
('deals', '交易', '交易数据', 'table', 'deals'),
('followups', '跟进记录', '客户跟进记录', 'table', 'followups'),

-- 系统管理资源
('roles', '角色', '角色管理', 'table', 'roles'),
('permissions', '权限', '权限配置', 'table', 'permissions'),
('system_config', '系统配置', '系统配置管理', 'table', 'system_config');

-- 插入基础权限操作
INSERT INTO public.permission_actions (name, display_name, description, action_type) VALUES
-- 基础操作
('read', '查看', '查看数据', 'read'),
('create', '创建', '创建新数据', 'create'),
('update', '编辑', '修改数据', 'update'),
('delete', '删除', '删除数据', 'delete'),

-- 高级操作
('export', '导出', '导出数据', 'export'),
('import', '导入', '导入数据', 'import'),
('approve', '审批', '审批操作', 'approve'),
('assign', '分配', '分配操作', 'assign'),
('manage', '管理', '管理操作', 'manage');

-- 插入基础权限范围
INSERT INTO public.permission_scopes (name, display_name, description, scope_type, scope_condition) VALUES
('global', '全局', '系统全局权限', 'global', '{}'),
('organization', '组织', '当前用户所属组织', 'organization', '{"organization_id": "current_user_org"}'),
('department', '部门', '当前用户所属部门', 'department', '{"department_id": "current_user_dept"}'),
('team', '团队', '当前用户所属团队', 'team', '{"team_id": "current_user_team"}'),
('personal', '个人', '仅限个人数据', 'personal', '{"user_id": "current_user_id"}'),
('created_by', '我创建的', '仅限自己创建的数据', 'created_by', '{"created_by": "current_user_id"}'),
('assigned_to', '分配给我的', '仅限分配给我的数据', 'assigned_to', '{"assigned_to": "current_user_id"}');

-- 插入基础角色（可完全自定义）
INSERT INTO public.roles (name, display_name, description, is_system) VALUES
('super_admin', '超级管理员', '系统最高权限，可以管理所有功能和用户', true),
('system_admin', '系统管理员', '可以管理系统配置和用户角色', true),
('department_admin', '部门管理员', '可以管理指定部门的成员和资源', true),
('team_lead', '团队负责人', '可以管理团队成员和项目', true),
('employee', '普通员工', '基础用户权限', true),
('guest', '访客', '只读权限', true);

-- 为超级管理员分配全局权限（示例）
INSERT INTO public.role_permissions (role_id, resource_id, action_id, scope_id)
SELECT 
  (SELECT id FROM public.roles WHERE name = 'super_admin'),
  r.id,
  a.id,
  s.id
FROM public.permission_resources r
CROSS JOIN public.permission_actions a
CROSS JOIN public.permission_scopes s
WHERE r.is_active = true 
  AND a.is_active = true 
  AND s.is_active = true
  AND s.name = 'global';

-- 为普通员工分配基础权限（示例）
INSERT INTO public.role_permissions (role_id, resource_id, action_id, scope_id)
SELECT 
  (SELECT id FROM public.roles WHERE name = 'employee'),
  r.id,
  a.id,
  s.id
FROM public.permission_resources r
CROSS JOIN public.permission_actions a
CROSS JOIN public.permission_scopes s
WHERE r.name IN ('users_profile', 'projects', 'leads', 'deals')
  AND a.name IN ('read')
  AND s.name IN ('personal', 'assigned_to', 'created_by'); 