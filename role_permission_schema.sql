-- 角色权限管理系统数据库表结构

-- 1. 角色表
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

-- 2. 权限表
CREATE TABLE IF NOT EXISTS public.permissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(100) NOT NULL UNIQUE,
  display_name VARCHAR(200) NOT NULL,
  description TEXT,
  category VARCHAR(50) NOT NULL,
  resource VARCHAR(50) NOT NULL,
  action VARCHAR(50) NOT NULL,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 3. 角色权限关联表
CREATE TABLE IF NOT EXISTS public.role_permissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  role_id UUID NOT NULL REFERENCES public.roles(id) ON DELETE CASCADE,
  permission_id UUID NOT NULL REFERENCES public.permissions(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(role_id, permission_id)
);

-- 4. 用户角色关联表
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

-- 5. 权限审计日志表
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
CREATE INDEX IF NOT EXISTS idx_roles_name ON public.roles(name);
CREATE INDEX IF NOT EXISTS idx_roles_active ON public.roles(is_active);
CREATE INDEX IF NOT EXISTS idx_permissions_name ON public.permissions(name);
CREATE INDEX IF NOT EXISTS idx_permissions_category ON public.permissions(category);
CREATE INDEX IF NOT EXISTS idx_user_roles_user_id ON public.user_roles(user_id);
CREATE INDEX IF NOT EXISTS idx_user_roles_role_id ON public.user_roles(role_id);
CREATE INDEX IF NOT EXISTS idx_user_roles_active ON public.user_roles(is_active);
CREATE INDEX IF NOT EXISTS idx_role_permissions_role_id ON public.role_permissions(role_id);
CREATE INDEX IF NOT EXISTS idx_role_permissions_permission_id ON public.role_permissions(permission_id);
CREATE INDEX IF NOT EXISTS idx_permission_audit_logs_user_id ON public.permission_audit_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_permission_audit_logs_created_at ON public.permission_audit_logs(created_at);

-- 插入系统预设角色
INSERT INTO public.roles (name, display_name, description, is_system) VALUES
('super_admin', '超级管理员', '系统最高权限，可以管理所有功能和用户', true),
('system_admin', '系统管理员', '可以管理系统配置和用户角色', true),
('department_admin', '部门管理员', '可以管理指定部门的成员和资源', true),
('team_lead', '团队负责人', '可以管理团队成员和项目', true),
('employee', '普通员工', '基础用户权限', true),
('guest', '访客', '只读权限', true);

-- 插入基础权限数据
INSERT INTO public.permissions (name, display_name, description, category, resource, action) VALUES
-- 用户管理权限
('user:read', '查看用户', '查看用户信息', 'user_management', 'user', 'read'),
('user:create', '创建用户', '创建新用户', 'user_management', 'user', 'create'),
('user:update', '编辑用户', '修改用户信息', 'user_management', 'user', 'update'),
('user:delete', '删除用户', '删除用户账户', 'user_management', 'user', 'delete'),

-- 角色管理权限
('role:read', '查看角色', '查看角色信息', 'role_management', 'role', 'read'),
('role:create', '创建角色', '创建新角色', 'role_management', 'role', 'create'),
('role:update', '编辑角色', '修改角色信息', 'role_management', 'role', 'update'),
('role:delete', '删除角色', '删除角色', 'role_management', 'role', 'delete'),
('role:assign', '分配角色', '为用户分配角色', 'role_management', 'role', 'assign'),

-- 部门管理权限
('department:read', '查看部门', '查看部门信息', 'department_management', 'department', 'read'),
('department:create', '创建部门', '创建新部门', 'department_management', 'department', 'create'),
('department:update', '编辑部门', '修改部门信息', 'department_management', 'department', 'update'),
('department:delete', '删除部门', '删除部门', 'department_management', 'department', 'delete'),

-- 项目管理权限
('project:read', '查看项目', '查看项目信息', 'project_management', 'project', 'read'),
('project:create', '创建项目', '创建新项目', 'project_management', 'project', 'create'),
('project:update', '编辑项目', '修改项目信息', 'project_management', 'project', 'update'),
('project:delete', '删除项目', '删除项目', 'project_management', 'project', 'delete'),

-- 数据管理权限
('data:read', '查看数据', '查看系统数据', 'data_management', 'data', 'read'),
('data:export', '导出数据', '导出系统数据', 'data_management', 'data', 'export'),
('data:import', '导入数据', '导入系统数据', 'data_management', 'data', 'import'),

-- 系统配置权限
('system:config', '系统配置', '管理系统配置', 'system_management', 'system', 'config'),
('system:backup', '系统备份', '执行系统备份', 'system_management', 'system', 'backup'),
('system:log', '查看日志', '查看系统日志', 'system_management', 'system', 'log');

-- 为系统角色分配权限
-- 超级管理员：所有权限
INSERT INTO public.role_permissions (role_id, permission_id)
SELECT 
  (SELECT id FROM public.roles WHERE name = 'super_admin'),
  id
FROM public.permissions;

-- 系统管理员：用户管理、角色管理、部门管理、项目管理权限
INSERT INTO public.role_permissions (role_id, permission_id)
SELECT 
  (SELECT id FROM public.roles WHERE name = 'system_admin'),
  p.id
FROM public.permissions p
WHERE p.category IN ('user_management', 'role_management', 'department_management', 'project_management');

-- 部门管理员：用户管理、部门管理、项目管理权限
INSERT INTO public.role_permissions (role_id, permission_id)
SELECT 
  (SELECT id FROM public.roles WHERE name = 'department_admin'),
  p.id
FROM public.permissions p
WHERE p.category IN ('user_management', 'department_management', 'project_management');

-- 团队负责人：项目管理权限
INSERT INTO public.role_permissions (role_id, permission_id)
SELECT 
  (SELECT id FROM public.roles WHERE name = 'team_lead'),
  p.id
FROM public.permissions p
WHERE p.category IN ('project_management');

-- 普通员工：基础查看权限
INSERT INTO public.role_permissions (role_id, permission_id)
SELECT 
  (SELECT id FROM public.roles WHERE name = 'employee'),
  p.id
FROM public.permissions p
WHERE p.name IN ('user:read', 'project:read', 'data:read');

-- 访客：只读权限
INSERT INTO public.role_permissions (role_id, permission_id)
SELECT 
  (SELECT id FROM public.roles WHERE name = 'guest'),
  p.id
FROM public.permissions p
WHERE p.name IN ('user:read', 'project:read'); 