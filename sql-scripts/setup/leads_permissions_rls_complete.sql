-- =============================================
-- 线索类权限 RLS 规则完整设置
-- 创建时间: 2025年1月
-- 说明: 为 leads、followups、showings、deals 四个表设置完整的 RLS 权限
-- =============================================

-- 启用 RLS
ALTER TABLE public.leads ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.followups ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.showings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.deals ENABLE ROW LEVEL SECURITY;

-- =============================================
-- 1. LEADS 表权限规则
-- =============================================

-- 删除现有策略
DROP POLICY IF EXISTS "leads_select_policy" ON public.leads;
DROP POLICY IF EXISTS "leads_insert_policy" ON public.leads;
DROP POLICY IF EXISTS "leads_update_policy" ON public.leads;
DROP POLICY IF EXISTS "leads_delete_policy" ON public.leads;

-- SELECT 权限：用户可以查看自己创建的线索，管理员可以查看管理的组织及其子组织的线索
CREATE POLICY "leads_select_policy" ON public.leads
FOR SELECT TO public
USING (
  -- 超级管理员可以查看所有线索
  EXISTS (
    SELECT 1 FROM auth.users 
    WHERE id = auth.uid() 
    AND raw_user_meta_data->>'role' = 'service_role'
  )
  OR
  -- 普通用户可以查看自己创建的线索
  EXISTS (
    SELECT 1 FROM users_profile 
    WHERE user_id = auth.uid() 
    AND id = leads.created_by
  )
  OR
  -- 部门管理员可以查看管理的组织及其子组织成员的线索
  EXISTS (
    SELECT 1 FROM get_managed_org_ids(auth.uid()) managed_orgs
    JOIN users_profile up ON up.organization_id = managed_orgs.org_id
    WHERE up.id = leads.created_by
  )
);

-- INSERT 权限：用户可以创建线索，管理员可以为管理的组织成员创建线索
CREATE POLICY "leads_insert_policy" ON public.leads
FOR INSERT TO public
WITH CHECK (
  -- 超级管理员可以创建所有线索
  EXISTS (
    SELECT 1 FROM auth.users 
    WHERE id = auth.uid() 
    AND raw_user_meta_data->>'role' = 'service_role'
  )
  OR
  -- 普通用户可以创建自己的线索
  created_by = (
    SELECT id FROM users_profile 
    WHERE user_id = auth.uid()
  )
  OR
  -- 部门管理员可以为管理的组织成员创建线索
  EXISTS (
    SELECT 1 FROM get_managed_org_ids(auth.uid()) managed_orgs
    JOIN users_profile up ON up.organization_id = managed_orgs.org_id
    WHERE up.id = created_by
  )
);

-- UPDATE 权限：用户可以更新自己创建的线索，管理员可以更新管理的组织及其子组织成员的线索
CREATE POLICY "leads_update_policy" ON public.leads
FOR UPDATE TO public
USING (
  -- 超级管理员可以更新所有线索
  EXISTS (
    SELECT 1 FROM auth.users 
    WHERE id = auth.uid() 
    AND raw_user_meta_data->>'role' = 'service_role'
  )
  OR
  -- 普通用户可以更新自己创建的线索
  created_by = (
    SELECT id FROM users_profile 
    WHERE user_id = auth.uid()
  )
  OR
  -- 部门管理员可以更新管理的组织及其子组织成员的线索
  EXISTS (
    SELECT 1 FROM get_managed_org_ids(auth.uid()) managed_orgs
    JOIN users_profile up ON up.organization_id = managed_orgs.org_id
    WHERE up.id = created_by
  )
)
WITH CHECK (
  -- 超级管理员可以更新所有线索
  EXISTS (
    SELECT 1 FROM auth.users 
    WHERE id = auth.uid() 
    AND raw_user_meta_data->>'role' = 'service_role'
  )
  OR
  -- 普通用户可以更新自己创建的线索
  created_by = (
    SELECT id FROM users_profile 
    WHERE user_id = auth.uid()
  )
  OR
  -- 部门管理员可以更新管理的组织及其子组织成员的线索
  EXISTS (
    SELECT 1 FROM get_managed_org_ids(auth.uid()) managed_orgs
    JOIN users_profile up ON up.organization_id = managed_orgs.org_id
    WHERE up.id = created_by
  )
);

-- DELETE 权限：只有超级管理员可以删除线索
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
-- 2. FOLLOWUPS 表权限规则
-- =============================================

-- 删除现有策略
DROP POLICY IF EXISTS "followups_select_policy" ON public.followups;
DROP POLICY IF EXISTS "followups_insert_policy" ON public.followups;
DROP POLICY IF EXISTS "followups_update_policy" ON public.followups;
DROP POLICY IF EXISTS "followups_delete_policy" ON public.followups;

-- SELECT 权限：用户可以查看自己负责的跟进记录，管理员可以查看管理的组织及其子组织的跟进记录
CREATE POLICY "followups_select_policy" ON public.followups
FOR SELECT TO public
USING (
  -- 超级管理员可以查看所有跟进记录
  EXISTS (
    SELECT 1 FROM auth.users 
    WHERE id = auth.uid() 
    AND raw_user_meta_data->>'role' = 'service_role'
  )
  OR
  -- 普通用户可以查看自己负责的跟进记录
  interviewsales_user_id = (
    SELECT id FROM users_profile 
    WHERE user_id = auth.uid()
  )
  OR
  -- 部门管理员可以查看管理的组织及其子组织成员的跟进记录
  EXISTS (
    SELECT 1 FROM get_managed_org_ids(auth.uid()) managed_orgs
    JOIN users_profile up ON up.organization_id = managed_orgs.org_id
    WHERE up.id = interviewsales_user_id
  )
);

-- INSERT 权限：用户可以创建自己负责的跟进记录，管理员可以为管理的组织成员创建跟进记录
CREATE POLICY "followups_insert_policy" ON public.followups
FOR INSERT TO public
WITH CHECK (
  -- 超级管理员可以创建所有跟进记录
  EXISTS (
    SELECT 1 FROM auth.users 
    WHERE id = auth.uid() 
    AND raw_user_meta_data->>'role' = 'service_role'
  )
  OR
  -- 普通用户可以创建自己负责的跟进记录
  interviewsales_user_id = (
    SELECT id FROM users_profile 
    WHERE user_id = auth.uid()
  )
  OR
  -- 部门管理员可以为管理的组织成员创建跟进记录
  EXISTS (
    SELECT 1 FROM get_managed_org_ids(auth.uid()) managed_orgs
    JOIN users_profile up ON up.organization_id = managed_orgs.org_id
    WHERE up.id = interviewsales_user_id
  )
);

-- UPDATE 权限：用户可以更新自己负责的跟进记录，管理员可以更新管理的组织及其子组织的跟进记录
CREATE POLICY "followups_update_policy" ON public.followups
FOR UPDATE TO public
USING (
  -- 超级管理员可以更新所有跟进记录
  EXISTS (
    SELECT 1 FROM auth.users 
    WHERE id = auth.uid() 
    AND raw_user_meta_data->>'role' = 'service_role'
  )
  OR
  -- 普通用户可以更新自己负责的跟进记录
  interviewsales_user_id = (
    SELECT id FROM users_profile 
    WHERE user_id = auth.uid()
  )
  OR
  -- 部门管理员可以更新管理的组织及其子组织成员的跟进记录
  EXISTS (
    SELECT 1 FROM get_managed_org_ids(auth.uid()) managed_orgs
    JOIN users_profile up ON up.organization_id = managed_orgs.org_id
    WHERE up.id = interviewsales_user_id
  )
)
WITH CHECK (
  -- 超级管理员可以更新所有跟进记录
  EXISTS (
    SELECT 1 FROM auth.users 
    WHERE id = auth.uid() 
    AND raw_user_meta_data->>'role' = 'service_role'
  )
  OR
  -- 普通用户可以更新自己负责的跟进记录
  interviewsales_user_id = (
    SELECT id FROM users_profile 
    WHERE user_id = auth.uid()
  )
  OR
  -- 部门管理员可以更新管理的组织及其子组织成员的跟进记录
  EXISTS (
    SELECT 1 FROM get_managed_org_ids(auth.uid()) managed_orgs
    JOIN users_profile up ON up.organization_id = managed_orgs.org_id
    WHERE up.id = interviewsales_user_id
  )
);

-- DELETE 权限：只有超级管理员可以删除跟进记录
CREATE POLICY "followups_delete_policy" ON public.followups
FOR DELETE TO public
USING (
  EXISTS (
    SELECT 1 FROM auth.users 
    WHERE id = auth.uid() 
    AND raw_user_meta_data->>'role' = 'service_role'
  )
);

-- =============================================
-- 3. SHOWINGS 表权限规则
-- =============================================

-- 删除现有策略
DROP POLICY IF EXISTS "showings_select_policy" ON public.showings;
DROP POLICY IF EXISTS "showings_insert_policy" ON public.showings;
DROP POLICY IF EXISTS "showings_update_policy" ON public.showings;
DROP POLICY IF EXISTS "showings_delete_policy" ON public.showings;

-- SELECT 权限：用户可以查看自己负责的带看记录，管理员可以查看管理的组织及其子组织的带看记录
CREATE POLICY "showings_select_policy" ON public.showings
FOR SELECT TO public
USING (
  -- 超级管理员可以查看所有带看记录
  EXISTS (
    SELECT 1 FROM auth.users 
    WHERE id = auth.uid() 
    AND raw_user_meta_data->>'role' = 'service_role'
  )
  OR
  -- 普通用户可以查看自己负责的带看记录
  (showingsales = (
    SELECT id FROM users_profile 
    WHERE user_id = auth.uid()
  ) OR trueshowingsales = (
    SELECT id FROM users_profile 
    WHERE user_id = auth.uid()
  ))
  OR
  -- 部门管理员可以查看管理的组织及其子组织成员的带看记录
  EXISTS (
    SELECT 1 FROM get_managed_org_ids(auth.uid()) managed_orgs
    JOIN users_profile up ON up.organization_id = managed_orgs.org_id
    WHERE up.id = showingsales OR up.id = trueshowingsales
  )
);

-- INSERT 权限：用户可以创建自己负责的带看记录，管理员可以为管理的组织成员创建带看记录
CREATE POLICY "showings_insert_policy" ON public.showings
FOR INSERT TO public
WITH CHECK (
  -- 超级管理员可以创建所有带看记录
  EXISTS (
    SELECT 1 FROM auth.users 
    WHERE id = auth.uid() 
    AND raw_user_meta_data->>'role' = 'service_role'
  )
  OR
  -- 普通用户可以创建自己负责的带看记录
  (showingsales = (
    SELECT id FROM users_profile 
    WHERE user_id = auth.uid()
  ) OR trueshowingsales = (
    SELECT id FROM users_profile 
    WHERE user_id = auth.uid()
  ))
  OR
  -- 部门管理员可以为管理的组织成员创建带看记录
  EXISTS (
    SELECT 1 FROM get_managed_org_ids(auth.uid()) managed_orgs
    JOIN users_profile up ON up.organization_id = managed_orgs.org_id
    WHERE up.id = showingsales OR up.id = trueshowingsales
  )
);

-- UPDATE 权限：用户可以更新自己负责的带看记录，管理员可以更新管理的组织及其子组织的带看记录
CREATE POLICY "showings_update_policy" ON public.showings
FOR UPDATE TO public
USING (
  -- 超级管理员可以更新所有带看记录
  EXISTS (
    SELECT 1 FROM auth.users 
    WHERE id = auth.uid() 
    AND raw_user_meta_data->>'role' = 'service_role'
  )
  OR
  -- 普通用户可以更新自己负责的带看记录
  (showingsales = (
    SELECT id FROM users_profile 
    WHERE user_id = auth.uid()
  ) OR trueshowingsales = (
    SELECT id FROM users_profile 
    WHERE user_id = auth.uid()
  ))
  OR
  -- 部门管理员可以更新管理的组织及其子组织成员的带看记录
  EXISTS (
    SELECT 1 FROM get_managed_org_ids(auth.uid()) managed_orgs
    JOIN users_profile up ON up.organization_id = managed_orgs.org_id
    WHERE up.id = showingsales OR up.id = trueshowingsales
  )
)
WITH CHECK (
  -- 超级管理员可以更新所有带看记录
  EXISTS (
    SELECT 1 FROM auth.users 
    WHERE id = auth.uid() 
    AND raw_user_meta_data->>'role' = 'service_role'
  )
  OR
  -- 普通用户可以更新自己负责的带看记录
  (showingsales = (
    SELECT id FROM users_profile 
    WHERE user_id = auth.uid()
  ) OR trueshowingsales = (
    SELECT id FROM users_profile 
    WHERE user_id = auth.uid()
  ))
  OR
  -- 部门管理员可以更新管理的组织及其子组织成员的带看记录
  EXISTS (
    SELECT 1 FROM get_managed_org_ids(auth.uid()) managed_orgs
    JOIN users_profile up ON up.organization_id = managed_orgs.org_id
    WHERE up.id = showingsales OR up.id = trueshowingsales
  )
);

-- DELETE 权限：只有超级管理员可以删除带看记录
CREATE POLICY "showings_delete_policy" ON public.showings
FOR DELETE TO public
USING (
  EXISTS (
    SELECT 1 FROM auth.users 
    WHERE id = auth.uid() 
    AND raw_user_meta_data->>'role' = 'service_role'
  )
);

-- =============================================
-- 4. DEALS 表权限规则
-- =============================================

-- 删除现有策略
DROP POLICY IF EXISTS "deals_select_policy" ON public.deals;
DROP POLICY IF EXISTS "deals_insert_policy" ON public.deals;
DROP POLICY IF EXISTS "deals_update_policy" ON public.deals;
DROP POLICY IF EXISTS "deals_delete_policy" ON public.deals;

-- SELECT 权限：用户可以查看自己负责的成交记录，管理员可以查看管理的组织及其子组织的成交记录
CREATE POLICY "deals_select_policy" ON public.deals
FOR SELECT TO public
USING (
  -- 超级管理员可以查看所有成交记录
  EXISTS (
    SELECT 1 FROM auth.users 
    WHERE id = auth.uid() 
    AND raw_user_meta_data->>'role' = 'service_role'
  )
  OR
  -- 普通用户可以查看自己负责的成交记录（通过关联的跟进记录）
  EXISTS (
    SELECT 1 FROM followups f
    JOIN users_profile up ON up.id = f.interviewsales_user_id
    WHERE f.leadid = deals.leadid
    AND up.user_id = auth.uid()
  )
  OR
  -- 部门管理员可以查看管理的组织及其子组织成员的成交记录
  EXISTS (
    SELECT 1 FROM followups f
    JOIN get_managed_org_ids(auth.uid()) managed_orgs ON managed_orgs.org_id = (
      SELECT organization_id FROM users_profile WHERE id = f.interviewsales_user_id
    )
    WHERE f.leadid = deals.leadid
  )
);

-- INSERT 权限：用户可以创建自己负责的成交记录，管理员可以为管理的组织成员创建成交记录
CREATE POLICY "deals_insert_policy" ON public.deals
FOR INSERT TO public
WITH CHECK (
  -- 超级管理员可以创建所有成交记录
  EXISTS (
    SELECT 1 FROM auth.users 
    WHERE id = auth.uid() 
    AND raw_user_meta_data->>'role' = 'service_role'
  )
  OR
  -- 普通用户可以创建自己负责的成交记录（通过关联的跟进记录）
  EXISTS (
    SELECT 1 FROM followups f
    JOIN users_profile up ON up.id = f.interviewsales_user_id
    WHERE f.leadid = deals.leadid
    AND up.user_id = auth.uid()
  )
  OR
  -- 部门管理员可以为管理的组织成员创建成交记录
  EXISTS (
    SELECT 1 FROM followups f
    JOIN get_managed_org_ids(auth.uid()) managed_orgs ON managed_orgs.org_id = (
      SELECT organization_id FROM users_profile WHERE id = f.interviewsales_user_id
    )
    WHERE f.leadid = deals.leadid
  )
);

-- UPDATE 权限：用户可以更新自己负责的成交记录，管理员可以更新管理的组织及其子组织的成交记录
CREATE POLICY "deals_update_policy" ON public.deals
FOR UPDATE TO public
USING (
  -- 超级管理员可以更新所有成交记录
  EXISTS (
    SELECT 1 FROM auth.users 
    WHERE id = auth.uid() 
    AND raw_user_meta_data->>'role' = 'service_role'
  )
  OR
  -- 普通用户可以更新自己负责的成交记录（通过关联的跟进记录）
  EXISTS (
    SELECT 1 FROM followups f
    JOIN users_profile up ON up.id = f.interviewsales_user_id
    WHERE f.leadid = deals.leadid
    AND up.user_id = auth.uid()
  )
  OR
  -- 部门管理员可以更新管理的组织及其子组织成员的成交记录
  EXISTS (
    SELECT 1 FROM followups f
    JOIN get_managed_org_ids(auth.uid()) managed_orgs ON managed_orgs.org_id = (
      SELECT organization_id FROM users_profile WHERE id = f.interviewsales_user_id
    )
    WHERE f.leadid = deals.leadid
  )
)
WITH CHECK (
  -- 超级管理员可以更新所有成交记录
  EXISTS (
    SELECT 1 FROM auth.users 
    WHERE id = auth.uid() 
    AND raw_user_meta_data->>'role' = 'service_role'
  )
  OR
  -- 普通用户可以更新自己负责的成交记录（通过关联的跟进记录）
  EXISTS (
    SELECT 1 FROM followups f
    JOIN users_profile up ON up.id = f.interviewsales_user_id
    WHERE f.leadid = deals.leadid
    AND up.user_id = auth.uid()
  )
  OR
  -- 部门管理员可以更新管理的组织及其子组织成员的成交记录
  EXISTS (
    SELECT 1 FROM followups f
    JOIN get_managed_org_ids(auth.uid()) managed_orgs ON managed_orgs.org_id = (
      SELECT organization_id FROM users_profile WHERE id = f.interviewsales_user_id
    )
    WHERE f.leadid = deals.leadid
  )
);

-- DELETE 权限：只有超级管理员可以删除成交记录
CREATE POLICY "deals_delete_policy" ON public.deals
FOR DELETE TO public
USING (
  EXISTS (
    SELECT 1 FROM auth.users 
    WHERE id = auth.uid() 
    AND raw_user_meta_data->>'role' = 'service_role'
  )
);

-- =============================================
-- 5. 权限验证函数
-- =============================================

-- 创建权限验证函数
CREATE OR REPLACE FUNCTION public.check_leads_permissions(
  p_user_id uuid,
  p_operation text DEFAULT 'select'
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  is_super_admin boolean := false;
  is_department_admin boolean := false;
BEGIN
  -- 检查是否为超级管理员
  SELECT EXISTS (
    SELECT 1 FROM auth.users 
    WHERE id = p_user_id 
    AND raw_user_meta_data->>'role' = 'service_role'
  ) INTO is_super_admin;
  
  IF is_super_admin THEN
    RETURN true;
  END IF;
  
  -- 检查是否为部门管理员
  SELECT EXISTS (
    SELECT 1 FROM get_managed_org_ids(p_user_id)
  ) INTO is_department_admin;
  
  -- 根据操作类型返回权限
  CASE p_operation
    WHEN 'select', 'insert', 'update' THEN
      RETURN true; -- 普通用户和部门管理员都有这些权限
    WHEN 'delete' THEN
      RETURN is_super_admin; -- 只有超级管理员可以删除
    ELSE
      RETURN false;
  END CASE;
END;
$$;

-- =============================================
-- 6. 权限测试函数
-- =============================================

-- 创建权限测试函数
CREATE OR REPLACE FUNCTION public.test_leads_permissions(p_user_id uuid)
RETURNS TABLE(
  table_name text,
  can_select boolean,
  can_insert boolean,
  can_update boolean,
  can_delete boolean
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    'leads'::text as table_name,
    check_leads_permissions(p_user_id, 'select') as can_select,
    check_leads_permissions(p_user_id, 'insert') as can_insert,
    check_leads_permissions(p_user_id, 'update') as can_update,
    check_leads_permissions(p_user_id, 'delete') as can_delete
  UNION ALL
  SELECT 
    'followups'::text as table_name,
    check_leads_permissions(p_user_id, 'select') as can_select,
    check_leads_permissions(p_user_id, 'insert') as can_insert,
    check_leads_permissions(p_user_id, 'update') as can_update,
    check_leads_permissions(p_user_id, 'delete') as can_delete
  UNION ALL
  SELECT 
    'showings'::text as table_name,
    check_leads_permissions(p_user_id, 'select') as can_select,
    check_leads_permissions(p_user_id, 'insert') as can_insert,
    check_leads_permissions(p_user_id, 'update') as can_update,
    check_leads_permissions(p_user_id, 'delete') as can_delete
  UNION ALL
  SELECT 
    'deals'::text as table_name,
    check_leads_permissions(p_user_id, 'select') as can_select,
    check_leads_permissions(p_user_id, 'insert') as can_insert,
    check_leads_permissions(p_user_id, 'update') as can_update,
    check_leads_permissions(p_user_id, 'delete') as can_delete;
END;
$$;

-- =============================================
-- 7. 验证脚本
-- =============================================

-- 验证 RLS 已启用
SELECT 
  schemaname,
  tablename,
  rowsecurity
FROM pg_tables 
WHERE schemaname = 'public' 
  AND tablename IN ('leads', 'followups', 'showings', 'deals')
ORDER BY tablename;

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
  AND tablename IN ('leads', 'followups', 'showings', 'deals')
ORDER BY tablename, policyname;

-- 显示权限配置总结
SELECT 
  '线索类权限 RLS 规则设置完成' as status,
  'leads, followups, showings, deals' as tables_configured,
  '递归组织管理权限' as permission_type,
  '超级管理员、部门管理员、普通用户' as user_types; 