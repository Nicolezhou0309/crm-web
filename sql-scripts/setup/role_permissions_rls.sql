-- =============================================
-- Role Permissions 表 RLS 规则
-- 创建时间: 2025年1月
-- 说明: 为 role_permissions 表设置基于 user_manage 权限的 RLS 控制
-- =============================================

-- 启用 RLS
ALTER TABLE public.role_permissions ENABLE ROW LEVEL SECURITY;

-- =============================================
-- 1. 确保 user_manage 权限点存在
-- =============================================

-- 插入 user_manage 权限（如果不存在）
INSERT INTO permissions (name, description, resource, action)
VALUES ('user_manage', '用户管理权限', 'user', 'manage')
ON CONFLICT (name) DO NOTHING;

-- =============================================
-- 2. Role Permissions 表权限规则
-- =============================================

-- 删除现有策略
DROP POLICY IF EXISTS "role_permissions_select_policy" ON public.role_permissions;
DROP POLICY IF EXISTS "role_permissions_insert_policy" ON public.role_permissions;
DROP POLICY IF EXISTS "role_permissions_update_policy" ON public.role_permissions;
DROP POLICY IF EXISTS "role_permissions_delete_policy" ON public.role_permissions;

-- SELECT 权限：所有注册用户可以查看权限映射记录
CREATE POLICY "role_permissions_select_policy" ON public.role_permissions
FOR SELECT TO public
USING (
  auth.uid() IS NOT NULL
);

-- INSERT 权限：只有 user_manage 权限可以新增
CREATE POLICY "role_permissions_insert_policy" ON public.role_permissions
FOR INSERT TO public
WITH CHECK (
  has_permission('user', 'manage')
);

-- UPDATE 权限：只有 user_manage 权限可以修改
CREATE POLICY "role_permissions_update_policy" ON public.role_permissions
FOR UPDATE TO public
USING (
  has_permission('user', 'manage')
)
WITH CHECK (
  has_permission('user', 'manage')
);

-- DELETE 权限：只有 user_manage 权限可以删除
CREATE POLICY "role_permissions_delete_policy" ON public.role_permissions
FOR DELETE TO public
USING (
  has_permission('user', 'manage')
);

-- =============================================
-- 3. 权限验证函数
-- =============================================

-- 创建权限验证函数
CREATE OR REPLACE FUNCTION public.test_role_permissions_permissions()
RETURNS TABLE(
  user_id uuid,
  has_user_manage_permission boolean,
  can_select boolean,
  can_insert boolean,
  can_update boolean,
  can_delete boolean,
  total_records_count bigint
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  current_user_id uuid;
  has_manage_permission boolean;
  total_count bigint;
BEGIN
  current_user_id := auth.uid();
  
  -- 检查是否有 user_manage 权限
  SELECT has_permission('user', 'manage') INTO has_manage_permission;
  
  -- 计算总记录数
  SELECT COUNT(*) INTO total_count
  FROM role_permissions;
  
  RETURN QUERY
  SELECT 
    current_user_id,
    has_manage_permission,
    has_manage_permission as can_select, -- 只有 manage 权限可以查看
    has_manage_permission as can_insert, -- 只有 manage 权限可以插入
    has_manage_permission as can_update, -- 只有 manage 权限可以更新
    has_manage_permission as can_delete, -- 只有 manage 权限可以删除
    total_count;
END;
$$;

-- =============================================
-- 4. 权限管理函数
-- =============================================

-- 为用户授予 user_manage 权限
CREATE OR REPLACE FUNCTION public.grant_user_manage_permission(p_user_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  role_id uuid;
BEGIN
  -- 获取或创建 user_manager 角色
  SELECT id INTO role_id FROM roles WHERE name = 'user_manager';
  
  IF role_id IS NULL THEN
    -- 创建角色
    INSERT INTO roles (name, description)
    VALUES ('user_manager', '用户管理角色')
    RETURNING id INTO role_id;
    
    -- 为角色分配权限
    INSERT INTO role_permissions (role_id, permission_id)
    SELECT role_id, p.id
    FROM permissions p
    WHERE p.resource = 'user' AND p.action = 'manage';
  END IF;
  
  -- 为用户分配角色
  INSERT INTO user_roles (user_id, role_id)
  VALUES (p_user_id, role_id)
  ON CONFLICT (user_id, role_id) DO NOTHING;
  
  RETURN true;
END;
$$;

-- 移除用户的 user_manage 权限
CREATE OR REPLACE FUNCTION public.revoke_user_manage_permission(p_user_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  role_id uuid;
BEGIN
  -- 获取 user_manager 角色ID
  SELECT id INTO role_id FROM roles WHERE name = 'user_manager';
  
  IF role_id IS NULL THEN
    RAISE EXCEPTION 'user_manager 角色不存在';
  END IF;
  
  -- 移除用户角色
  DELETE FROM user_roles 
  WHERE user_id = p_user_id AND role_id = role_id;
  
  RETURN true;
END;
$$;

-- =============================================
-- 5. 验证脚本
-- =============================================

-- 验证 RLS 已启用
SELECT 
  schemaname,
  tablename,
  rowsecurity
FROM pg_tables 
WHERE schemaname = 'public' 
  AND tablename = 'role_permissions';

-- 验证策略已创建
SELECT 
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd
FROM pg_policies 
WHERE schemaname = 'public' 
  AND tablename = 'role_permissions'
ORDER BY policyname;

-- 检查权限配置
SELECT 
  '权限检查' as check_type,
  EXISTS (
    SELECT 1 FROM permissions WHERE resource = 'user' AND action = 'manage'
  ) as user_manage_permission_exists,
  EXISTS (
    SELECT 1 FROM roles WHERE name = 'user_manager'
  ) as user_manager_role_exists;

-- 显示权限配置总结
SELECT 
  'Role Permissions 表权限规则设置完成' as status,
  'SELECT: 仅 user_manage权限' as select_policy,
  'INSERT: 仅 user_manage权限' as insert_policy,
  'UPDATE: 仅 user_manage权限' as update_policy,
  'DELETE: 仅 user_manage权限' as delete_policy,
  '只有拥有user_manage权限的用户可以管理角色权限关联' as authorized_users;

-- =============================================
-- 6. 使用示例
-- =============================================

-- 示例：为特定用户授予 user_manage 权限
-- SELECT grant_user_manage_permission('用户UUID');

-- 示例：检查当前用户权限
-- SELECT * FROM test_role_permissions_permissions();

-- 示例：查看所有角色权限关联（需要 user_manage 权限）
-- SELECT 
--   rp.role_id,
--   r.name as role_name,
--   rp.permission_id,
--   p.name as permission_name,
--   p.resource,
--   p.action,
--   rp.created_at
-- FROM role_permissions rp
-- JOIN roles r ON rp.role_id = r.id
-- JOIN permissions p ON rp.permission_id = p.id
-- ORDER BY r.name, p.name;

-- 示例：查看有 user_manage 权限的用户
-- SELECT 
--   up.nickname,
--   r.name as role_name,
--   p.name as permission_name
-- FROM user_roles ur
-- JOIN roles r ON ur.role_id = r.id
-- JOIN role_permissions rp ON r.id = rp.role_id
-- JOIN permissions p ON rp.permission_id = p.id
-- JOIN users_profile up ON ur.user_id = up.user_id
-- WHERE p.resource = 'user' AND p.action = 'manage'
-- ORDER BY up.nickname; 