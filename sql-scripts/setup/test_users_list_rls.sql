-- 测试 users_list 表的 RLS 策略

-- 1. 测试查询权限（所有注册用户都应该可以查询）
SELECT '测试查询权限' as test_name;
SELECT COUNT(*) as total_records FROM public.users_list;

-- 2. 测试插入权限（需要 allocation_manage 权限）
SELECT '测试插入权限' as test_name;
-- 这个测试需要具有 allocation_manage 权限的用户
-- INSERT INTO public.users_list (groupname, list, description) 
-- VALUES ('test_group', ARRAY[1,2,3], '测试组');

-- 3. 测试更新权限（所有注册用户都应该可以更新）
SELECT '测试更新权限' as test_name;
-- 这个测试需要实际的用户登录
-- UPDATE public.users_list SET description = '更新测试' WHERE id = 1;

-- 4. 测试删除权限（需要 allocation_manage 权限）
SELECT '测试删除权限' as test_name;
-- 这个测试需要具有 allocation_manage 权限的用户
-- DELETE FROM public.users_list WHERE groupname = 'test_group';

-- 5. 验证策略是否存在
SELECT '验证策略存在性' as test_name;
SELECT 
    policyname,
    cmd,
    CASE 
        WHEN cmd = 'INSERT' THEN '需要 allocation_manage 权限'
        WHEN cmd = 'DELETE' THEN '需要 allocation_manage 权限'
        WHEN cmd = 'UPDATE' THEN '允许所有注册用户'
        WHEN cmd = 'SELECT' THEN '允许所有注册用户'
    END as permission_summary
FROM pg_policies 
WHERE tablename = 'users_list'
ORDER BY cmd;

-- 6. 检查 RLS 是否启用
SELECT '检查 RLS 状态' as test_name;
SELECT 
    schemaname,
    tablename,
    rowsecurity
FROM pg_tables 
WHERE tablename = 'users_list'; 