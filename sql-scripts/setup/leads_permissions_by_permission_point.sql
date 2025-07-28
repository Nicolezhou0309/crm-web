-- =============================================
-- Leads 表基于权限点的 RLS 规则
-- 创建时间: 2025年1月
-- 说明: 为 leads 表设置基于 lead_manage 权限点的权限控制
-- =============================================

-- 启用 RLS
ALTER TABLE public.leads ENABLE ROW LEVEL SECURITY;

-- =============================================
-- 1. 权限检查函数
-- =============================================

-- 创建权限检查函数
CREATE OR REPLACE FUNCTION public.has_lead_manage_permission()
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  current_user_id uuid;
  has_permission boolean := false;
BEGIN
  -- 获取当前用户ID
  current_user_id := auth.uid();
  
  -- 检查是否为超级管理员
  IF EXISTS (
    SELECT 1 FROM auth.users 
    WHERE id = current_user_id 
    AND raw_user_meta_data->>'role' = 'service_role'
  ) THEN
    RETURN true;
  END IF;
  
  -- 检查是否有 lead_manage 权限
  SELECT EXISTS (
    SELECT 1 FROM user_permissions up
    JOIN permissions p ON up.permission_id = p.id
    WHERE up.user_id = current_user_id
      AND p.name = 'lead_manage'
      AND up.is_active = true
  ) INTO has_permission;
  
  RETURN has_permission;
END;
$$;

-- =============================================
-- 2. 90天范围检查函数
-- =============================================

-- 创建90天范围检查函数
CREATE OR REPLACE FUNCTION public.is_within_90_days(p_date timestamptz)
RETURNS boolean
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN p_date >= (CURRENT_TIMESTAMP - INTERVAL '90 days');
END;
$$;

-- =============================================
-- 3. Leads 表权限规则
-- =============================================

-- 删除现有策略
DROP POLICY IF EXISTS "leads_select_policy" ON public.leads;
DROP POLICY IF EXISTS "leads_insert_policy" ON public.leads;
DROP POLICY IF EXISTS "leads_update_policy" ON public.leads;
DROP POLICY IF EXISTS "leads_delete_policy" ON public.leads;

-- SELECT 权限：有 lead_manage 权限的用户可以查看90天内的记录
CREATE POLICY "leads_select_policy" ON public.leads
FOR SELECT TO public
USING (
  -- 超级管理员可以查看所有记录
  EXISTS (
    SELECT 1 FROM auth.users 
    WHERE id = auth.uid() 
    AND raw_user_meta_data->>'role' = 'service_role'
  )
  OR
  -- 有 lead_manage 权限的用户可以查看90天内的记录
  (has_lead_manage_permission() AND is_within_90_days(created_at))
);

-- INSERT 权限：有 lead_manage 权限的用户可以创建记录
CREATE POLICY "leads_insert_policy" ON public.leads
FOR INSERT TO public
WITH CHECK (
  -- 超级管理员可以创建所有记录
  EXISTS (
    SELECT 1 FROM auth.users 
    WHERE id = auth.uid() 
    AND raw_user_meta_data->>'role' = 'service_role'
  )
  OR
  -- 有 lead_manage 权限的用户可以创建记录
  has_lead_manage_permission()
);

-- UPDATE 权限：有 lead_manage 权限的用户可以更新90天内的记录
CREATE POLICY "leads_update_policy" ON public.leads
FOR UPDATE TO public
USING (
  -- 超级管理员可以更新所有记录
  EXISTS (
    SELECT 1 FROM auth.users 
    WHERE id = auth.uid() 
    AND raw_user_meta_data->>'role' = 'service_role'
  )
  OR
  -- 有 lead_manage 权限的用户可以更新90天内的记录
  (has_lead_manage_permission() AND is_within_90_days(created_at))
)
WITH CHECK (
  -- 超级管理员可以更新所有记录
  EXISTS (
    SELECT 1 FROM auth.users 
    WHERE id = auth.uid() 
    AND raw_user_meta_data->>'role' = 'service_role'
  )
  OR
  -- 有 lead_manage 权限的用户可以更新90天内的记录
  (has_lead_manage_permission() AND is_within_90_days(created_at))
);

-- DELETE 权限：不允许删除操作（只有超级管理员可以删除）
CREATE POLICY "leads_delete_policy" ON public.leads
FOR DELETE TO public
USING (
  EXISTS (
    SELECT 1 FROM auth.users 
    WHERE id = auth.uid() 
    AND raw_user_meta_data->>'role' = 'service_role'
  )
);

-- =============================================
-- 4. 权限验证函数
-- =============================================

-- 创建权限验证函数
CREATE OR REPLACE FUNCTION public.test_leads_permissions()
RETURNS TABLE(
  user_id uuid,
  has_lead_manage_permission boolean,
  is_super_admin boolean,
  can_select boolean,
  can_insert boolean,
  can_update boolean,
  can_delete boolean,
  records_in_90_days bigint
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  current_user_id uuid;
  has_permission boolean;
  is_super boolean;
  records_count bigint;
BEGIN
  current_user_id := auth.uid();
  
  -- 检查权限
  SELECT has_lead_manage_permission() INTO has_permission;
  
  -- 检查是否为超级管理员
  SELECT EXISTS (
    SELECT 1 FROM auth.users 
    WHERE id = current_user_id 
    AND raw_user_meta_data->>'role' = 'service_role'
  ) INTO is_super;
  
  -- 计算90天内的记录数
  SELECT COUNT(*) INTO records_count
  FROM leads
  WHERE created_at >= (CURRENT_TIMESTAMP - INTERVAL '90 days');
  
  RETURN QUERY
  SELECT 
    current_user_id,
    has_permission,
    is_super,
    (is_super OR has_permission) as can_select,
    (is_super OR has_permission) as can_insert,
    (is_super OR has_permission) as can_update,
    is_super as can_delete,
    records_count;
END;
$$;

-- =============================================
-- 5. 权限管理函数
-- =============================================

-- 为用户授予 lead_manage 权限
CREATE OR REPLACE FUNCTION public.grant_lead_manage_permission(p_user_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  permission_id uuid;
BEGIN
  -- 获取 lead_manage 权限ID
  SELECT id INTO permission_id FROM permissions WHERE name = 'lead_manage';
  
  IF permission_id IS NULL THEN
    RAISE EXCEPTION 'lead_manage 权限不存在';
  END IF;
  
  -- 授予权限
  INSERT INTO user_permissions (user_id, permission_id, is_active)
  VALUES (p_user_id, permission_id, true)
  ON CONFLICT (user_id, permission_id) 
  DO UPDATE SET is_active = true;
  
  RETURN true;
END;
$$;

-- 移除用户的 lead_manage 权限
CREATE OR REPLACE FUNCTION public.revoke_lead_manage_permission(p_user_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  permission_id uuid;
BEGIN
  -- 获取 lead_manage 权限ID
  SELECT id INTO permission_id FROM permissions WHERE name = 'lead_manage';
  
  IF permission_id IS NULL THEN
    RAISE EXCEPTION 'lead_manage 权限不存在';
  END IF;
  
  -- 移除权限
  UPDATE user_permissions 
  SET is_active = false
  WHERE user_id = p_user_id AND permission_id = permission_id;
  
  RETURN true;
END;
$$;

-- =============================================
-- 6. 验证脚本
-- =============================================

-- 验证 RLS 已启用
SELECT 
  schemaname,
  tablename,
  rowsecurity
FROM pg_tables 
WHERE schemaname = 'public' 
  AND tablename = 'leads';

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
  AND tablename = 'leads'
ORDER BY policyname;

-- 检查 lead_manage 权限是否存在
SELECT 
  '权限检查' as check_type,
  EXISTS (
    SELECT 1 FROM permissions WHERE name = 'lead_manage'
  ) as lead_manage_permission_exists;

-- 显示权限配置总结
SELECT 
  'Leads 表权限规则设置完成' as status,
  '基于 lead_manage 权限点' as permission_type,
  '90天范围内增改查' as operation_scope,
  '不允许删除操作' as delete_policy,
  '超级管理员、有 lead_manage 权限的用户' as authorized_users;

-- =============================================
-- 7. 使用示例
-- =============================================

-- 示例：为特定用户授予权限
-- SELECT grant_lead_manage_permission('用户UUID');

-- 示例：检查当前用户权限
-- SELECT * FROM test_leads_permissions();

-- 示例：查看90天内的记录
-- SELECT COUNT(*) FROM leads WHERE created_at >= (CURRENT_TIMESTAMP - INTERVAL '90 days'); 