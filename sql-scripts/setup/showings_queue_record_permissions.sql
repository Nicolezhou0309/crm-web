-- =============================================
-- Showings Queue Record 表基于 allocation_manage 权限的 RLS 规则
-- 创建时间: 2025年1月
-- 说明: 为 showings_queue_record 表设置基于 allocation_manage 权限的权限控制
-- =============================================

-- 启用 RLS
ALTER TABLE public.showings_queue_record ENABLE ROW LEVEL SECURITY;

-- =============================================
-- 1. 确保 allocation_manage 权限点存在
-- =============================================

-- 插入 allocation_manage 权限（如果不存在）
INSERT INTO permissions (name, description, resource, action)
VALUES ('allocation_manage', '分配管理权限', 'allocation', 'manage')
ON CONFLICT (name) DO NOTHING;

-- =============================================
-- 2. Showings Queue Record 表权限规则
-- =============================================

-- 删除现有策略
DROP POLICY IF EXISTS "showings_queue_record_select_policy" ON public.showings_queue_record;
DROP POLICY IF EXISTS "showings_queue_record_insert_policy" ON public.showings_queue_record;
DROP POLICY IF EXISTS "showings_queue_record_update_policy" ON public.showings_queue_record;
DROP POLICY IF EXISTS "showings_queue_record_delete_policy" ON public.showings_queue_record;

-- SELECT 权限：可以查看本人的记录；allocation_manage权限可以查看所有记录
CREATE POLICY "showings_queue_record_select_policy" ON public.showings_queue_record
FOR SELECT TO public
USING (
  -- 有 allocation_manage 权限的用户可以查看所有记录
  has_permission('allocation', 'manage')
  OR
  -- 用户查看自己的记录
  EXISTS (
    SELECT 1 FROM users_profile up
    WHERE up.user_id = auth.uid()
    AND up.id = showings_queue_record.user_id
  )
);

-- INSERT 权限：只有 allocation_manage 权限可以新增
CREATE POLICY "showings_queue_record_insert_policy" ON public.showings_queue_record
FOR INSERT TO public
WITH CHECK (
  has_permission('allocation', 'manage')
);

-- UPDATE 权限：只有 allocation_manage 权限可以修改
CREATE POLICY "showings_queue_record_update_policy" ON public.showings_queue_record
FOR UPDATE TO public
USING (
  has_permission('allocation', 'manage')
)
WITH CHECK (
  has_permission('allocation', 'manage')
);

-- DELETE 权限：只有 allocation_manage 权限可以删除
CREATE POLICY "showings_queue_record_delete_policy" ON public.showings_queue_record
FOR DELETE TO public
USING (
  has_permission('allocation', 'manage')
);

-- =============================================
-- 3. 权限验证函数
-- =============================================

-- 创建权限验证函数
CREATE OR REPLACE FUNCTION public.test_showings_queue_record_permissions()
RETURNS TABLE(
  user_id uuid,
  has_allocation_manage_permission boolean,
  can_select boolean,
  can_insert boolean,
  can_update boolean,
  can_delete boolean,
  own_records_count bigint,
  total_records_count bigint
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  current_user_id uuid;
  has_manage_permission boolean;
  own_count bigint;
  total_count bigint;
BEGIN
  current_user_id := auth.uid();
  
  -- 检查是否有 allocation_manage 权限
  SELECT has_permission('allocation', 'manage') INTO has_manage_permission;
  
  -- 计算用户自己的记录数
  SELECT COUNT(*) INTO own_count
  FROM showings_queue_record sqr
  JOIN users_profile up ON sqr.user_id = up.id
  WHERE up.user_id = current_user_id;
  
  -- 计算总记录数
  SELECT COUNT(*) INTO total_count
  FROM showings_queue_record;
  
  RETURN QUERY
  SELECT 
    current_user_id,
    has_manage_permission,
    (has_manage_permission OR own_count > 0) as can_select, -- 有 manage 权限或有自己的记录
    has_manage_permission as can_insert, -- 只有 manage 权限可以插入
    has_manage_permission as can_update, -- 只有 manage 权限可以更新
    has_manage_permission as can_delete, -- 只有 manage 权限可以删除
    own_count,
    total_count;
END;
$$;

-- =============================================
-- 4. 权限管理函数
-- =============================================

-- 为用户授予 allocation_manage 权限
CREATE OR REPLACE FUNCTION public.grant_allocation_manage_permission(p_user_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  role_id uuid;
BEGIN
  -- 获取或创建 allocation_manager 角色
  SELECT id INTO role_id FROM roles WHERE name = 'allocation_manager';
  
  IF role_id IS NULL THEN
    -- 创建角色
    INSERT INTO roles (name, description)
    VALUES ('allocation_manager', '分配管理角色')
    RETURNING id INTO role_id;
    
    -- 为角色分配权限
    INSERT INTO role_permissions (role_id, permission_id)
    SELECT role_id, p.id
    FROM permissions p
    WHERE p.resource = 'allocation' AND p.action = 'manage';
  END IF;
  
  -- 为用户分配角色
  INSERT INTO user_roles (user_id, role_id)
  VALUES (p_user_id, role_id)
  ON CONFLICT (user_id, role_id) DO NOTHING;
  
  RETURN true;
END;
$$;

-- 移除用户的 allocation_manage 权限
CREATE OR REPLACE FUNCTION public.revoke_allocation_manage_permission(p_user_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  role_id uuid;
BEGIN
  -- 获取 allocation_manager 角色ID
  SELECT id INTO role_id FROM roles WHERE name = 'allocation_manager';
  
  IF role_id IS NULL THEN
    RAISE EXCEPTION 'allocation_manager 角色不存在';
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
  AND tablename = 'showings_queue_record';

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
  AND tablename = 'showings_queue_record'
ORDER BY policyname;

-- 检查权限配置
SELECT 
  '权限检查' as check_type,
  EXISTS (
    SELECT 1 FROM permissions WHERE resource = 'allocation' AND action = 'manage'
  ) as allocation_manage_permission_exists,
  EXISTS (
    SELECT 1 FROM roles WHERE name = 'allocation_manager'
  ) as allocation_manager_role_exists;

-- 显示权限配置总结
SELECT 
  'Showings Queue Record 表权限规则设置完成' as status,
  'SELECT: 本人记录 + allocation_manage权限可查看所有' as select_policy,
  'INSERT: 仅 allocation_manage权限' as insert_policy,
  'UPDATE: 仅 allocation_manage权限' as update_policy,
  'DELETE: 仅 allocation_manage权限' as delete_policy,
  '用户可查看自己的排队记录，有allocation_manage权限的用户可管理所有记录' as authorized_users;

-- =============================================
-- 6. 使用示例
-- =============================================

-- 示例：为特定用户授予 allocation_manage 权限
-- SELECT grant_allocation_manage_permission('用户UUID');

-- 示例：检查当前用户权限
-- SELECT * FROM test_showings_queue_record_permissions();

-- 示例：查看用户自己的排队记录
-- SELECT sqr.* FROM showings_queue_record sqr
-- JOIN users_profile up ON sqr.user_id = up.id
-- WHERE up.user_id = auth.uid();

-- 示例：查看有 allocation_manage 权限的用户
-- SELECT * FROM get_users_by_permission('allocation_manage');

-- 示例：查看所有排队记录（需要 allocation_manage 权限）
-- SELECT sqr.*, up.nickname as user_name 
-- FROM showings_queue_record sqr
-- JOIN users_profile up ON sqr.user_id = up.id
-- ORDER BY sqr.created_at DESC; 