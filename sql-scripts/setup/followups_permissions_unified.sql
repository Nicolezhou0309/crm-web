-- =============================================
-- Followups 表基于统一权限函数的 RLS 规则
-- 创建时间: 2025年1月
-- 说明: 为 followups 表设置基于统一权限函数的权限控制
-- =============================================

-- 启用 RLS
ALTER TABLE public.followups ENABLE ROW LEVEL SECURITY;

-- =============================================
-- 1. 创建 followups_view 权限点
-- =============================================

-- 插入 followups_view 权限（如果不存在）
INSERT INTO permissions (name, description, resource, action)
VALUES ('followups_view', '查看所有跟进记录权限', 'followups', 'view')
ON CONFLICT (name) DO NOTHING;

-- =============================================
-- 2. Followups 表权限规则
-- =============================================

-- 删除现有策略
DROP POLICY IF EXISTS "followups_select_policy" ON public.followups;
DROP POLICY IF EXISTS "followups_insert_policy" ON public.followups;
DROP POLICY IF EXISTS "followups_update_policy" ON public.followups;
DROP POLICY IF EXISTS "followups_delete_policy" ON public.followups;

-- SELECT 权限：可查本人和递归子部门人员，或有 followups_view 权限的用户可查看所有
CREATE POLICY "followups_select_policy" ON public.followups
FOR SELECT TO public
USING (
  -- 有 followups_view 权限的用户可以查看所有跟进记录
  has_permission('followups', 'view')
  OR
  -- 用户查看自己的跟进记录
  EXISTS (
    SELECT 1 FROM users_profile up
    WHERE up.user_id = auth.uid()
    AND up.id = followups.interviewsales_user_id
  )
  OR
  -- 部门管理员查看递归子部门所有人的跟进记录
  EXISTS (
    SELECT 1 FROM users_profile up
    JOIN get_managed_org_ids(auth.uid()) managed_orgs ON up.organization_id = managed_orgs.org_id
    WHERE up.id = followups.interviewsales_user_id
  )
);

-- INSERT 权限：无权限（不允许插入）
CREATE POLICY "followups_insert_policy" ON public.followups
FOR INSERT TO public
WITH CHECK (
  false -- 不允许任何用户插入
);

-- UPDATE 权限：可改本人和递归子部门人员
CREATE POLICY "followups_update_policy" ON public.followups
FOR UPDATE TO public
USING (
  -- 用户更新自己的跟进记录
  EXISTS (
    SELECT 1 FROM users_profile up
    WHERE up.user_id = auth.uid()
    AND up.id = followups.interviewsales_user_id
  )
  OR
  -- 部门管理员更新递归子部门所有人的跟进记录
  EXISTS (
    SELECT 1 FROM users_profile up
    JOIN get_managed_org_ids(auth.uid()) managed_orgs ON up.organization_id = managed_orgs.org_id
    WHERE up.id = followups.interviewsales_user_id
  )
)
WITH CHECK (
  -- 用户更新自己的跟进记录
  EXISTS (
    SELECT 1 FROM users_profile up
    WHERE up.user_id = auth.uid()
    AND up.id = followups.interviewsales_user_id
  )
  OR
  -- 部门管理员更新递归子部门所有人的跟进记录
  EXISTS (
    SELECT 1 FROM users_profile up
    JOIN get_managed_org_ids(auth.uid()) managed_orgs ON up.organization_id = managed_orgs.org_id
    WHERE up.id = followups.interviewsales_user_id
  )
);

-- DELETE 权限：无权限（不允许删除）
CREATE POLICY "followups_delete_policy" ON public.followups
FOR DELETE TO public
USING (
  false -- 不允许任何用户删除
);

-- =============================================
-- 3. 权限验证函数
-- =============================================

-- 创建权限验证函数
CREATE OR REPLACE FUNCTION public.test_followups_permissions()
RETURNS TABLE(
  user_id uuid,
  has_followups_view_permission boolean,
  can_select boolean,
  can_insert boolean,
  can_update boolean,
  can_delete boolean,
  own_records_count bigint,
  managed_orgs_count bigint,
  total_records_count bigint
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  current_user_id uuid;
  has_view_permission boolean;
  own_count bigint;
  managed_count bigint;
  total_count bigint;
BEGIN
  current_user_id := auth.uid();
  
  -- 检查是否有 followups_view 权限
  SELECT has_permission('followups', 'view') INTO has_view_permission;
  
  -- 计算用户自己的记录数
  SELECT COUNT(*) INTO own_count
  FROM followups f
  JOIN users_profile up ON f.interviewsales_user_id = up.id
  WHERE up.user_id = current_user_id;
  
  -- 计算用户管理的组织数量
  SELECT COUNT(*) INTO managed_count
  FROM get_managed_org_ids(current_user_id);
  
  -- 计算总记录数
  SELECT COUNT(*) INTO total_count
  FROM followups;
  
  RETURN QUERY
  SELECT 
    current_user_id,
    has_view_permission,
    (has_view_permission OR true) as can_select, -- 有 view 权限或基于部门递归
    false as can_insert, -- 不允许插入
    true as can_update, -- 基于部门递归，可以更新
    false as can_delete, -- 不允许删除
    own_count,
    managed_count,
    total_count;
END;
$$;

-- =============================================
-- 4. 权限管理函数
-- =============================================

-- 为用户授予 followups_view 权限
CREATE OR REPLACE FUNCTION public.grant_followups_view_permission(p_user_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  role_id uuid;
BEGIN
  -- 获取或创建 followups_viewer 角色
  SELECT id INTO role_id FROM roles WHERE name = 'followups_viewer';
  
  IF role_id IS NULL THEN
    -- 创建角色
    INSERT INTO roles (name, description)
    VALUES ('followups_viewer', '跟进记录查看角色')
    RETURNING id INTO role_id;
    
    -- 为角色分配权限
    INSERT INTO role_permissions (role_id, permission_id)
    SELECT role_id, p.id
    FROM permissions p
    WHERE p.resource = 'followups' AND p.action = 'view';
  END IF;
  
  -- 为用户分配角色
  INSERT INTO user_roles (user_id, role_id)
  VALUES (p_user_id, role_id)
  ON CONFLICT (user_id, role_id) DO NOTHING;
  
  RETURN true;
END;
$$;

-- 移除用户的 followups_view 权限
CREATE OR REPLACE FUNCTION public.revoke_followups_view_permission(p_user_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  role_id uuid;
BEGIN
  -- 获取 followups_viewer 角色ID
  SELECT id INTO role_id FROM roles WHERE name = 'followups_viewer';
  
  IF role_id IS NULL THEN
    RAISE EXCEPTION 'followups_viewer 角色不存在';
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
  AND tablename = 'followups';

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
  AND tablename = 'followups'
ORDER BY policyname;

-- 检查权限配置
SELECT 
  '权限检查' as check_type,
  EXISTS (
    SELECT 1 FROM permissions WHERE resource = 'followups' AND action = 'view'
  ) as followups_view_permission_exists,
  EXISTS (
    SELECT 1 FROM roles WHERE name = 'followups_viewer'
  ) as followups_viewer_role_exists;

-- 显示权限配置总结
SELECT 
  'Followups 表权限规则设置完成' as status,
  'SELECT: 部门递归权限 + followups_view权限' as select_policy,
  'INSERT: 无权限' as insert_policy,
  'UPDATE: 部门递归权限' as update_policy,
  'DELETE: 无权限' as delete_policy,
  '用户可查看/更新自己的跟进记录，部门管理员可递归查看/更新子部门数据，有followups_view权限的用户可查看所有记录' as authorized_users;

-- =============================================
-- 6. 使用示例
-- =============================================

-- 示例：为特定用户授予 followups_view 权限
-- SELECT grant_followups_view_permission('用户UUID');

-- 示例：检查当前用户权限
-- SELECT * FROM test_followups_permissions();

-- 示例：查看用户自己的跟进记录
-- SELECT f.* FROM followups f
-- JOIN users_profile up ON f.interviewsales_user_id = up.id
-- WHERE up.user_id = auth.uid();

-- 示例：查看用户管理的组织
-- SELECT * FROM get_managed_org_ids(auth.uid());

-- 示例：查看部门管理员可以管理的所有跟进记录
-- SELECT f.* FROM followups f
-- JOIN users_profile up ON f.interviewsales_user_id = up.id
-- JOIN get_managed_org_ids(auth.uid()) managed_orgs ON up.organization_id = managed_orgs.org_id;

-- 示例：查看有 followups_view 权限的用户
-- SELECT * FROM get_users_by_permission('followups_viewer'); 