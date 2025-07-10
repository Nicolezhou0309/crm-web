-- 测试 users_list 表的状态
-- 1. 检查表是否存在
SELECT 
    table_name,
    table_schema,
    table_type
FROM information_schema.tables 
WHERE table_name = 'users_list' 
AND table_schema = 'public';

-- 2. 检查表结构
SELECT 
    column_name,
    data_type,
    is_nullable,
    column_default
FROM information_schema.columns 
WHERE table_name = 'users_list' 
AND table_schema = 'public'
ORDER BY ordinal_position;

-- 3. 检查是否有数据
SELECT COUNT(*) as total_records FROM users_list;

-- 4. 检查示例数据
SELECT * FROM users_list LIMIT 5;

-- 5. 检查权限
SELECT 
    grantee,
    privilege_type,
    is_grantable
FROM information_schema.role_table_grants 
WHERE table_name = 'users_list' 
AND table_schema = 'public';

-- 6. 检查RLS策略
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