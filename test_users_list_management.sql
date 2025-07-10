-- 测试 users_list 表的管理功能
-- 1. 检查表结构
SELECT 
    column_name,
    data_type,
    is_nullable,
    column_default
FROM information_schema.columns 
WHERE table_name = 'users_list' 
AND table_schema = 'public'
ORDER BY ordinal_position;

-- 2. 检查现有数据
SELECT 
    id,
    groupname,
    list,
    allocation,
    enable_quality_control,
    enable_community_matching,
    created_at
FROM users_list 
ORDER BY id;

-- 3. 测试插入新销售组
INSERT INTO users_list (
    groupname,
    list,
    description,
    allocation,
    enable_quality_control,
    enable_community_matching
) VALUES (
    '测试销售组',
    ARRAY[1, 2, 3]::bigint[],
    '测试用的销售组',
    'round_robin',
    true,
    true
) RETURNING *;

-- 4. 测试更新销售组
UPDATE users_list 
SET 
    list = ARRAY[1, 2, 3, 4]::bigint[],
    description = '更新后的测试销售组'
WHERE groupname = '测试销售组'
RETURNING *;

-- 5. 测试删除销售组
DELETE FROM users_list 
WHERE groupname = '测试销售组'
RETURNING *;

-- 6. 检查触发器是否存在
SELECT 
    trigger_name,
    event_manipulation,
    action_statement
FROM information_schema.triggers 
WHERE event_object_table = 'users_list'
AND trigger_schema = 'public';

-- 7. 检查约束
SELECT 
    constraint_name,
    constraint_type,
    table_name
FROM information_schema.table_constraints 
WHERE table_name = 'users_list'
AND table_schema = 'public';

-- 8. 检查索引
SELECT 
    indexname,
    indexdef
FROM pg_indexes 
WHERE tablename = 'users_list'
AND schemaname = 'public'; 