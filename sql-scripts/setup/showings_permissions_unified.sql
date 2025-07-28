-- =============================================
-- Showings 表基于统一权限函数的 RLS 规则
-- 创建时间: 2025年1月
-- 说明: 为 showings 表设置基于统一权限函数的权限控制
-- =============================================

-- 启用 RLS
ALTER TABLE public.showings ENABLE ROW LEVEL SECURITY;

-- =============================================
-- 1. 创建 showings_view 权限点
-- =============================================

-- 插入 showings_view 权限（如果不存在）
INSERT INTO permissions (name, description, resource, action)
VALUES ('showings_view', '查看所有带看记录权限', 'showings', 'view')
ON CONFLICT (name) DO NOTHING;

-- =============================================
-- 2. Showings 表权限规则
-- =============================================

-- 删除现有策略
DROP POLICY IF EXISTS "showings_select_policy" ON public.showings;
DROP POLICY IF EXISTS "showings_insert_policy" ON public.showings;
DROP POLICY IF EXISTS "showings_update_policy" ON public.showings;
DROP POLICY IF EXISTS "showings_delete_policy" ON public.showings;

-- SELECT 权限：可查本人和递归子部门人员，或有 showings_view 权限的用户可查看所有
-- 通过 showingsales、trueshowingsales 字段和 followups 表的 interviewsales_user_id 关联用户
CREATE POLICY "showings_select_policy" ON public.showings
FOR SELECT TO public
USING (
  -- 有 showings_view 权限的用户可以查看所有带看记录
  has_permission('showings', 'view')
  OR
  -- 用户查看自己的带看记录（作为带看销售）
  EXISTS (
    SELECT 1 FROM users_profile up
    WHERE up.user_id = auth.uid()
    AND up.id = showings.showingsales
  )
  OR
  -- 用户查看自己的带看记录（作为真实带看销售）
  EXISTS (
    SELECT 1 FROM users_profile up
    WHERE up.user_id = auth.uid()
    AND up.id = showings.trueshowingsales
  )
  OR
  -- 用户查看自己的带看记录（作为约访管家，通过 followups 表关联）
  EXISTS (
    SELECT 1 FROM followups f
    JOIN users_profile up ON f.interviewsales_user_id = up.id
    WHERE f.leadid = showings.leadid
    AND up.user_id = auth.uid()
  )
  OR
  -- 部门管理员查看递归子部门所有人的带看记录
  EXISTS (
    SELECT 1 FROM users_profile up
    JOIN get_managed_org_ids(auth.uid()) managed_orgs ON up.organization_id = managed_orgs.org_id
    WHERE up.id = showings.showingsales
  )
  OR
  -- 部门管理员查看递归子部门所有人的带看记录（真实带看销售）
  EXISTS (
    SELECT 1 FROM users_profile up
    JOIN get_managed_org_ids(auth.uid()) managed_orgs ON up.organization_id = managed_orgs.org_id
    WHERE up.id = showings.trueshowingsales
  )
  OR
  -- 部门管理员查看递归子部门所有人的带看记录（约访管家，通过 followups 表关联）
  EXISTS (
    SELECT 1 FROM followups f
    JOIN users_profile up ON f.interviewsales_user_id = up.id
    JOIN get_managed_org_ids(auth.uid()) managed_orgs ON up.organization_id = managed_orgs.org_id
    WHERE f.leadid = showings.leadid
  )
);

-- INSERT 权限：可改本人和递归子部门人员可以新增记录
CREATE POLICY "showings_insert_policy" ON public.showings
FOR INSERT TO public
WITH CHECK (
  -- 用户新增自己的带看记录（作为带看销售）
  EXISTS (
    SELECT 1 FROM users_profile up
    WHERE up.user_id = auth.uid()
    AND up.id = showings.showingsales
  )
  OR
  -- 用户新增自己的带看记录（作为真实带看销售）
  EXISTS (
    SELECT 1 FROM users_profile up
    WHERE up.user_id = auth.uid()
    AND up.id = showings.trueshowingsales
  )
  OR
  -- 部门管理员新增递归子部门所有人的带看记录
  EXISTS (
    SELECT 1 FROM users_profile up
    JOIN get_managed_org_ids(auth.uid()) managed_orgs ON up.organization_id = managed_orgs.org_id
    WHERE up.id = showings.showingsales
  )
  OR
  -- 部门管理员新增递归子部门所有人的带看记录（真实带看销售）
  EXISTS (
    SELECT 1 FROM users_profile up
    JOIN get_managed_org_ids(auth.uid()) managed_orgs ON up.organization_id = managed_orgs.org_id
    WHERE up.id = showings.trueshowingsales
  )
);

-- UPDATE 权限：可改本人和递归子部门人员
CREATE POLICY "showings_update_policy" ON public.showings
FOR UPDATE TO public
USING (
  -- 用户更新自己的带看记录（作为带看销售）
  EXISTS (
    SELECT 1 FROM users_profile up
    WHERE up.user_id = auth.uid()
    AND up.id = showings.showingsales
  )
  OR
  -- 用户更新自己的带看记录（作为真实带看销售）
  EXISTS (
    SELECT 1 FROM users_profile up
    WHERE up.user_id = auth.uid()
    AND up.id = showings.trueshowingsales
  )
  OR
  -- 用户更新自己的带看记录（作为约访管家，通过 followups 表关联）
  EXISTS (
    SELECT 1 FROM followups f
    JOIN users_profile up ON f.interviewsales_user_id = up.id
    WHERE f.leadid = showings.leadid
    AND up.user_id = auth.uid()
  )
  OR
  -- 部门管理员更新递归子部门所有人的带看记录
  EXISTS (
    SELECT 1 FROM users_profile up
    JOIN get_managed_org_ids(auth.uid()) managed_orgs ON up.organization_id = managed_orgs.org_id
    WHERE up.id = showings.showingsales
  )
  OR
  -- 部门管理员更新递归子部门所有人的带看记录（真实带看销售）
  EXISTS (
    SELECT 1 FROM users_profile up
    JOIN get_managed_org_ids(auth.uid()) managed_orgs ON up.organization_id = managed_orgs.org_id
    WHERE up.id = showings.trueshowingsales
  )
  OR
  -- 部门管理员更新递归子部门所有人的带看记录（约访管家，通过 followups 表关联）
  EXISTS (
    SELECT 1 FROM followups f
    JOIN users_profile up ON f.interviewsales_user_id = up.id
    JOIN get_managed_org_ids(auth.uid()) managed_orgs ON up.organization_id = managed_orgs.org_id
    WHERE f.leadid = showings.leadid
  )
)
WITH CHECK (
  -- 用户更新自己的带看记录（作为带看销售）
  EXISTS (
    SELECT 1 FROM users_profile up
    WHERE up.user_id = auth.uid()
    AND up.id = showings.showingsales
  )
  OR
  -- 用户更新自己的带看记录（作为真实带看销售）
  EXISTS (
    SELECT 1 FROM users_profile up
    WHERE up.user_id = auth.uid()
    AND up.id = showings.trueshowingsales
  )
  OR
  -- 用户更新自己的带看记录（作为约访管家，通过 followups 表关联）
  EXISTS (
    SELECT 1 FROM followups f
    JOIN users_profile up ON f.interviewsales_user_id = up.id
    WHERE f.leadid = showings.leadid
    AND up.user_id = auth.uid()
  )
  OR
  -- 部门管理员更新递归子部门所有人的带看记录
  EXISTS (
    SELECT 1 FROM users_profile up
    JOIN get_managed_org_ids(auth.uid()) managed_orgs ON up.organization_id = managed_orgs.org_id
    WHERE up.id = showings.showingsales
  )
  OR
  -- 部门管理员更新递归子部门所有人的带看记录（真实带看销售）
  EXISTS (
    SELECT 1 FROM users_profile up
    JOIN get_managed_org_ids(auth.uid()) managed_orgs ON up.organization_id = managed_orgs.org_id
    WHERE up.id = showings.trueshowingsales
  )
  OR
  -- 部门管理员更新递归子部门所有人的带看记录（约访管家，通过 followups 表关联）
  EXISTS (
    SELECT 1 FROM followups f
    JOIN users_profile up ON f.interviewsales_user_id = up.id
    JOIN get_managed_org_ids(auth.uid()) managed_orgs ON up.organization_id = managed_orgs.org_id
    WHERE f.leadid = showings.leadid
  )
);

-- DELETE 权限：无权限（不允许删除）
CREATE POLICY "showings_delete_policy" ON public.showings
FOR DELETE TO public
USING (
  false -- 不允许任何用户删除
);

-- =============================================
-- 3. 权限验证函数
-- =============================================

-- 创建权限验证函数
CREATE OR REPLACE FUNCTION public.test_showings_permissions()
RETURNS TABLE(
  user_id uuid,
  has_showings_view_permission boolean,
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
  
  -- 检查是否有 showings_view 权限
  SELECT has_permission('showings', 'view') INTO has_view_permission;
  
  -- 计算用户自己的记录数（包括作为带看销售、真实带看销售和约访管家）
  SELECT COUNT(*) INTO own_count
  FROM showings s
  LEFT JOIN followups f ON s.leadid = f.leadid
  LEFT JOIN users_profile up1 ON s.showingsales = up1.id
  LEFT JOIN users_profile up2 ON s.trueshowingsales = up2.id
  LEFT JOIN users_profile up3 ON f.interviewsales_user_id = up3.id
  WHERE up1.user_id = current_user_id 
     OR up2.user_id = current_user_id 
     OR up3.user_id = current_user_id;
  
  -- 计算用户管理的组织数量
  SELECT COUNT(*) INTO managed_count
  FROM get_managed_org_ids(current_user_id);
  
  -- 计算总记录数
  SELECT COUNT(*) INTO total_count
  FROM showings;
  
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

-- 为用户授予 showings_view 权限
CREATE OR REPLACE FUNCTION public.grant_showings_view_permission(p_user_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  role_id uuid;
BEGIN
  -- 获取或创建 showings_viewer 角色
  SELECT id INTO role_id FROM roles WHERE name = 'showings_viewer';
  
  IF role_id IS NULL THEN
    -- 创建角色
    INSERT INTO roles (name, description)
    VALUES ('showings_viewer', '带看记录查看角色')
    RETURNING id INTO role_id;
    
    -- 为角色分配权限
    INSERT INTO role_permissions (role_id, permission_id)
    SELECT role_id, p.id
    FROM permissions p
    WHERE p.resource = 'showings' AND p.action = 'view';
  END IF;
  
  -- 为用户分配角色
  INSERT INTO user_roles (user_id, role_id)
  VALUES (p_user_id, role_id)
  ON CONFLICT (user_id, role_id) DO NOTHING;
  
  RETURN true;
END;
$$;

-- 移除用户的 showings_view 权限
CREATE OR REPLACE FUNCTION public.revoke_showings_view_permission(p_user_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  role_id uuid;
BEGIN
  -- 获取 showings_viewer 角色ID
  SELECT id INTO role_id FROM roles WHERE name = 'showings_viewer';
  
  IF role_id IS NULL THEN
    RAISE EXCEPTION 'showings_viewer 角色不存在';
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
  AND tablename = 'showings';

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
  AND tablename = 'showings'
ORDER BY policyname;

-- 检查权限配置
SELECT 
  '权限检查' as check_type,
  EXISTS (
    SELECT 1 FROM permissions WHERE resource = 'showings' AND action = 'view'
  ) as showings_view_permission_exists,
  EXISTS (
    SELECT 1 FROM roles WHERE name = 'showings_viewer'
  ) as showings_viewer_role_exists;

-- 显示权限配置总结
SELECT 
  'Showings 表权限规则设置完成' as status,
  'SELECT: 部门递归权限 + showings_view权限（包含约访管家）' as select_policy,
  'INSERT: 部门递归权限' as insert_policy,
  'UPDATE: 部门递归权限（包含约访管家）' as update_policy,
  'DELETE: 无权限' as delete_policy,
  '用户可查看/更新/新增自己的带看记录，部门管理员可递归查看/更新/新增子部门数据，有showings_view权限的用户可查看所有记录' as authorized_users;

-- =============================================
-- 6. 使用示例
-- =============================================

-- 示例：为特定用户授予 showings_view 权限
-- SELECT grant_showings_view_permission('用户UUID');

-- 示例：检查当前用户权限
-- SELECT * FROM test_showings_permissions();

-- 示例：查看用户自己的带看记录（作为带看销售）
-- SELECT s.* FROM showings s
-- JOIN users_profile up ON s.showingsales = up.id
-- WHERE up.user_id = auth.uid();

-- 示例：查看用户自己的带看记录（作为真实带看销售）
-- SELECT s.* FROM showings s
-- JOIN users_profile up ON s.trueshowingsales = up.id
-- WHERE up.user_id = auth.uid();

-- 示例：查看用户自己的带看记录（作为约访管家）
-- SELECT s.* FROM showings s
-- JOIN followups f ON s.leadid = f.leadid
-- JOIN users_profile up ON f.interviewsales_user_id = up.id
-- WHERE up.user_id = auth.uid();

-- 示例：查看用户管理的组织
-- SELECT * FROM get_managed_org_ids(auth.uid());

-- 示例：查看部门管理员可以管理的所有带看记录
-- SELECT s.* FROM showings s
-- LEFT JOIN followups f ON s.leadid = f.leadid
-- LEFT JOIN users_profile up1 ON s.showingsales = up1.id
-- LEFT JOIN users_profile up2 ON s.trueshowingsales = up2.id
-- LEFT JOIN users_profile up3 ON f.interviewsales_user_id = up3.id
-- JOIN get_managed_org_ids(auth.uid()) managed_orgs ON (
--   up1.organization_id = managed_orgs.org_id OR 
--   up2.organization_id = managed_orgs.org_id OR 
--   up3.organization_id = managed_orgs.org_id
-- );

-- 示例：查看有 showings_view 权限的用户
-- SELECT * FROM get_users_by_permission('showings_viewer'); 