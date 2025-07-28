-- =============================================
-- 线索类权限 RLS 规则安全设置
-- 创建时间: 2025年1月
-- 说明: 为 leads、followups、showings、deals 四个表设置安全的 RLS 权限
-- =============================================

-- 首先检查表结构
DO $$
DECLARE
  leads_has_created_by boolean;
  followups_has_interviewsales_user_id boolean;
  showings_has_showingsales boolean;
  showings_has_trueshowingsales boolean;
BEGIN
  -- 检查 leads 表是否有 created_by 字段
  SELECT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'leads' 
      AND column_name = 'created_by'
      AND table_schema = 'public'
  ) INTO leads_has_created_by;
  
  -- 检查 followups 表是否有 interviewsales_user_id 字段
  SELECT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'followups' 
      AND column_name = 'interviewsales_user_id'
      AND table_schema = 'public'
  ) INTO followups_has_interviewsales_user_id;
  
  -- 检查 showings 表字段
  SELECT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'showings' 
      AND column_name = 'showingsales'
      AND table_schema = 'public'
  ) INTO showings_has_showingsales;
  
  SELECT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'showings' 
      AND column_name = 'trueshowingsales'
      AND table_schema = 'public'
  ) INTO showings_has_trueshowingsales;
  
  -- 输出检查结果
  RAISE NOTICE '表结构检查结果:';
  RAISE NOTICE 'leads.created_by: %', leads_has_created_by;
  RAISE NOTICE 'followups.interviewsales_user_id: %', followups_has_interviewsales_user_id;
  RAISE NOTICE 'showings.showingsales: %', showings_has_showingsales;
  RAISE NOTICE 'showings.trueshowingsales: %', showings_has_trueshowingsales;
END $$;

-- 启用 RLS
ALTER TABLE public.leads ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.followups ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.showings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.deals ENABLE ROW LEVEL SECURITY;

-- =============================================
-- 1. LEADS 表权限规则（简化版）
-- =============================================

-- 删除现有策略
DROP POLICY IF EXISTS "leads_select_policy" ON public.leads;
DROP POLICY IF EXISTS "leads_insert_policy" ON public.leads;
DROP POLICY IF EXISTS "leads_update_policy" ON public.leads;
DROP POLICY IF EXISTS "leads_delete_policy" ON public.leads;

-- SELECT 权限：超级管理员可以查看所有，普通用户暂时可以查看所有（需要根据实际字段调整）
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
  -- 暂时允许所有用户查看（后续根据实际字段调整）
  true
);

-- INSERT 权限：允许所有用户创建线索
CREATE POLICY "leads_insert_policy" ON public.leads
FOR INSERT TO public
WITH CHECK (true);

-- UPDATE 权限：允许所有用户更新线索
CREATE POLICY "leads_update_policy" ON public.leads
FOR UPDATE TO public
USING (true)
WITH CHECK (true);

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
-- 2. FOLLOWUPS 表权限规则（简化版）
-- =============================================

-- 删除现有策略
DROP POLICY IF EXISTS "followups_select_policy" ON public.followups;
DROP POLICY IF EXISTS "followups_insert_policy" ON public.followups;
DROP POLICY IF EXISTS "followups_update_policy" ON public.followups;
DROP POLICY IF EXISTS "followups_delete_policy" ON public.followups;

-- SELECT 权限：超级管理员可以查看所有，普通用户暂时可以查看所有
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
  -- 暂时允许所有用户查看（后续根据实际字段调整）
  true
);

-- INSERT 权限：允许所有用户创建跟进记录
CREATE POLICY "followups_insert_policy" ON public.followups
FOR INSERT TO public
WITH CHECK (true);

-- UPDATE 权限：允许所有用户更新跟进记录
CREATE POLICY "followups_update_policy" ON public.followups
FOR UPDATE TO public
USING (true)
WITH CHECK (true);

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
-- 3. SHOWINGS 表权限规则（简化版）
-- =============================================

-- 删除现有策略
DROP POLICY IF EXISTS "showings_select_policy" ON public.showings;
DROP POLICY IF EXISTS "showings_insert_policy" ON public.showings;
DROP POLICY IF EXISTS "showings_update_policy" ON public.showings;
DROP POLICY IF EXISTS "showings_delete_policy" ON public.showings;

-- SELECT 权限：超级管理员可以查看所有，普通用户暂时可以查看所有
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
  -- 暂时允许所有用户查看（后续根据实际字段调整）
  true
);

-- INSERT 权限：允许所有用户创建带看记录
CREATE POLICY "showings_insert_policy" ON public.showings
FOR INSERT TO public
WITH CHECK (true);

-- UPDATE 权限：允许所有用户更新带看记录
CREATE POLICY "showings_update_policy" ON public.showings
FOR UPDATE TO public
USING (true)
WITH CHECK (true);

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
-- 4. DEALS 表权限规则（简化版）
-- =============================================

-- 删除现有策略
DROP POLICY IF EXISTS "deals_select_policy" ON public.deals;
DROP POLICY IF EXISTS "deals_insert_policy" ON public.deals;
DROP POLICY IF EXISTS "deals_update_policy" ON public.deals;
DROP POLICY IF EXISTS "deals_delete_policy" ON public.deals;

-- SELECT 权限：超级管理员可以查看所有，普通用户暂时可以查看所有
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
  -- 暂时允许所有用户查看（后续根据实际字段调整）
  true
);

-- INSERT 权限：允许所有用户创建成交记录
CREATE POLICY "deals_insert_policy" ON public.deals
FOR INSERT TO public
WITH CHECK (true);

-- UPDATE 权限：允许所有用户更新成交记录
CREATE POLICY "deals_update_policy" ON public.deals
FOR UPDATE TO public
USING (true)
WITH CHECK (true);

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
-- 5. 验证脚本
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
  '线索类权限 RLS 规则基础设置完成' as status,
  'leads, followups, showings, deals' as tables_configured,
  '基础权限控制' as permission_type,
  '超级管理员、普通用户' as user_types,
  '注意：需要根据实际表结构调整权限规则' as note; 