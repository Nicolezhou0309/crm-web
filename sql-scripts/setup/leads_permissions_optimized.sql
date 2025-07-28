-- =============================================
-- Leads 表优化权限策略
-- 创建时间: 2025年1月
-- 说明: 基于新的权限规则优化leads表的RLS权限控制
-- =============================================

-- 启用 RLS
ALTER TABLE public.leads ENABLE ROW LEVEL SECURITY;

-- =============================================
-- 1. 权限检查说明
-- =============================================

-- 使用现有的 has_permission('leads', 'manage') 函数
-- 该函数检查用户是否有 leads 表的 manage 权限
-- 同时支持超级管理员和普通权限用户

-- =============================================
-- 2. Leads 表权限规则
-- =============================================

-- 删除现有策略
DROP POLICY IF EXISTS "leads_select_policy" ON public.leads;
DROP POLICY IF EXISTS "leads_insert_policy" ON public.leads;
DROP POLICY IF EXISTS "leads_update_policy" ON public.leads;
DROP POLICY IF EXISTS "leads_delete_policy" ON public.leads;

-- SELECT 权限：
-- 1. leads.manage权限用户可查看所有记录
-- 2. 普通用户可查看join followups.interviewsales本人的记录和递归组织管理权限的记录
CREATE POLICY "leads_select_policy" ON public.leads
FOR SELECT TO public
USING (
  -- 超级管理员或有leads.manage权限的用户可以查看所有记录
  has_permission('leads', 'manage')
  OR
  -- 普通用户只能查看有权限的线索（基于followups关联）
  EXISTS (
    SELECT 1 FROM followups f
    JOIN users_profile up ON f.interviewsales_user_id = up.id
    WHERE f.leadid = leads.leadid
    AND (
      -- 用户本人负责的线索
      up.user_id = auth.uid()
      OR
      -- 用户管理的组织及其子组织的线索
      EXISTS (
        SELECT 1 FROM get_managed_org_ids(auth.uid()) managed_orgs
        WHERE up.organization_id = managed_orgs.org_id
      )
    )
  )
);

-- INSERT 权限：只有leads.manage权限用户可以创建记录
CREATE POLICY "leads_insert_policy" ON public.leads
FOR INSERT TO public
WITH CHECK (
  has_permission('leads', 'manage')
);

-- UPDATE 权限：只有leads.manage权限用户可以更新记录
CREATE POLICY "leads_update_policy" ON public.leads
FOR UPDATE TO public
USING (
  has_permission('leads', 'manage')
)
WITH CHECK (
  has_permission('leads', 'manage')
);

-- DELETE 权限：任何人不允许删除
CREATE POLICY "leads_delete_policy" ON public.leads
FOR DELETE TO public
USING (false);
