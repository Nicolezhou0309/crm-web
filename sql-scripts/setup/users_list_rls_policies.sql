-- 启用 RLS 策略
ALTER TABLE public.users_list ENABLE ROW LEVEL SECURITY;

-- 删除现有的策略（如果存在）
DROP POLICY IF EXISTS "users_list_insert_policy" ON public.users_list;
DROP POLICY IF EXISTS "users_list_delete_policy" ON public.users_list;
DROP POLICY IF EXISTS "users_list_update_policy" ON public.users_list;
DROP POLICY IF EXISTS "users_list_select_policy" ON public.users_list;

-- 插入策略：允许 allocation_manage 权限的用户
CREATE POLICY "users_list_insert_policy" ON public.users_list
    FOR INSERT
    WITH CHECK (
        has_permission('users_list', 'allocation_manage')
    );

-- 删除策略：允许 allocation_manage 权限的用户
CREATE POLICY "users_list_delete_policy" ON public.users_list
    FOR DELETE
    USING (
        has_permission('users_list', 'allocation_manage')
    );

-- 更新策略：允许所有注册用户
CREATE POLICY "users_list_update_policy" ON public.users_list
    FOR UPDATE
    USING (
        auth.role() = 'authenticated'
    )
    WITH CHECK (
        auth.role() = 'authenticated'
    );

-- 查询策略：允许所有注册用户
CREATE POLICY "users_list_select_policy" ON public.users_list
    FOR SELECT
    USING (
        auth.role() = 'authenticated'
    );

-- 验证策略创建
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
WHERE tablename = 'users_list'; 