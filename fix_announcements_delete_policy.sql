-- =============================================
-- 修复 announcements 表权限策略
-- 创建时间: 2025年1月
-- 说明: 为 announcements 表添加完整的权限策略
-- 规则: user_manage权限可以增改删，所有用户可以查看
-- =============================================

-- 启用 RLS（如果未启用）
ALTER TABLE public.announcements ENABLE ROW LEVEL SECURITY;

-- =============================================
-- 1. 删除现有的策略（如果存在）
-- =============================================

DROP POLICY IF EXISTS "announcements_delete_policy" ON public.announcements;
DROP POLICY IF EXISTS "announcements_insert_policy" ON public.announcements;
DROP POLICY IF EXISTS "announcements_update_policy" ON public.announcements;

-- =============================================
-- 2. 创建权限策略
-- =============================================

-- INSERT 权限：有 user_manage 权限的用户可以创建公告
CREATE POLICY "announcements_insert_policy" ON public.announcements
FOR INSERT TO public
WITH CHECK (
  has_permission('user', 'manage')
);

-- UPDATE 权限：有 user_manage 权限的用户可以更新公告
CREATE POLICY "announcements_update_policy" ON public.announcements
FOR UPDATE TO public
USING (
  has_permission('user', 'manage')
)
WITH CHECK (
  has_permission('user', 'manage')
);

-- DELETE 权限：有 user_manage 权限的用户可以删除公告
CREATE POLICY "announcements_delete_policy" ON public.announcements
FOR DELETE TO public
USING (
  has_permission('user', 'manage')
);

-- =============================================
-- 3. 验证策略创建
-- =============================================

-- 查看 announcements 表的所有策略
SELECT 
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd,
  qual,
  with_check
FROM pg_policies 
WHERE tablename = 'announcements'
ORDER BY policyname; 