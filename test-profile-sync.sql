-- ========================================
-- users_profile 联动逻辑测试脚本
-- ========================================

-- 1. 检查函数是否存在
SELECT '检查函数存在性' as test_step;

SELECT 
    proname as function_name,
    CASE 
        WHEN proname IS NOT NULL THEN '✅ 存在'
        ELSE '❌ 不存在'
    END as status
FROM pg_proc 
WHERE proname IN (
    'sync_user_profile_on_auth_insert',
    'sync_user_profile_on_email_confirmed', 
    'sync_user_profile_on_metadata_update',
    'manual_sync_all_users_profile',
    'check_profile_sync_status'
);

-- 2. 检查触发器是否存在
SELECT '检查触发器存在性' as test_step;

SELECT 
    trigger_name,
    event_manipulation,
    CASE 
        WHEN trigger_name IS NOT NULL THEN '✅ 存在'
        ELSE '❌ 不存在'
    END as status
FROM information_schema.triggers 
WHERE trigger_name LIKE 'sync_profile%'
ORDER BY trigger_name;

-- 3. 检查当前同步状态
SELECT '检查当前同步状态' as test_step;

SELECT 
    COUNT(*) as total_users,
    COUNT(CASE WHEN sync_status = 'synced' THEN 1 END) as synced_users,
    COUNT(CASE WHEN sync_status = 'profile_not_linked' THEN 1 END) as unlinked_profiles,
    COUNT(CASE WHEN sync_status = 'auth_user_not_found' THEN 1 END) as missing_auth_users,
    COUNT(CASE WHEN sync_status = 'mismatch' THEN 1 END) as mismatched_users
FROM check_profile_sync_status();

-- 4. 显示同步状态详情（前10条）
SELECT '同步状态详情（前10条）' as test_step;

SELECT 
    auth_email,
    profile_email,
    auth_confirmed,
    profile_status,
    sync_status
FROM check_profile_sync_status()
LIMIT 10;

-- 5. 检查未同步的记录
SELECT '未同步记录详情' as test_step;

SELECT 
    auth_email,
    profile_email,
    sync_status,
    CASE 
        WHEN auth_user_id IS NULL THEN '缺少auth用户'
        WHEN profile_user_id IS NULL THEN '缺少profile关联'
        WHEN auth_user_id != profile_user_id THEN 'user_id不匹配'
        ELSE '其他问题'
    END as issue_description
FROM check_profile_sync_status()
WHERE sync_status != 'synced'
LIMIT 10;

-- 6. 测试手动同步函数（可选）
-- 注意：这会修改数据，请在测试环境中运行
-- SELECT '执行手动同步' as test_step;
-- SELECT manual_sync_all_users_profile();

-- 7. 检查表结构
SELECT '检查users_profile表结构' as test_step;

SELECT 
    column_name,
    data_type,
    is_nullable,
    column_default
FROM information_schema.columns 
WHERE table_name = 'users_profile' 
    AND table_schema = 'public'
ORDER BY ordinal_position;

-- 8. 检查外键约束
SELECT '检查外键约束' as test_step;

SELECT 
    tc.constraint_name,
    tc.table_name,
    kcu.column_name,
    ccu.table_name AS foreign_table_name,
    ccu.column_name AS foreign_column_name
FROM information_schema.table_constraints AS tc 
JOIN information_schema.key_column_usage AS kcu
    ON tc.constraint_name = kcu.constraint_name
    AND tc.table_schema = kcu.table_schema
JOIN information_schema.constraint_column_usage AS ccu
    ON ccu.constraint_name = tc.constraint_name
    AND ccu.table_schema = tc.table_schema
WHERE tc.constraint_type = 'FOREIGN KEY' 
    AND tc.table_name = 'users_profile';

-- 9. 检查索引
SELECT '检查索引' as test_step;

SELECT 
    indexname,
    indexdef
FROM pg_indexes 
WHERE tablename = 'users_profile'
ORDER BY indexname;

-- 10. 性能检查
SELECT '性能检查' as test_step;

-- 检查表大小
SELECT 
    schemaname,
    tablename,
    attname,
    n_distinct,
    correlation
FROM pg_stats 
WHERE tablename = 'users_profile'
ORDER BY attname;

-- 11. 触发器函数测试（模拟）
SELECT '触发器函数测试' as test_step;

-- 注意：这些是模拟测试，实际触发需要真实的auth.users操作
SELECT 
    'sync_user_profile_on_auth_insert' as function_name,
    '需要INSERT到auth.users触发' as test_note;

SELECT 
    'sync_user_profile_on_email_confirmed' as function_name,
    '需要UPDATE auth.users.email_confirmed_at触发' as test_note;

SELECT 
    'sync_user_profile_on_metadata_update' as function_name,
    '需要UPDATE auth.users.raw_user_meta_data触发' as test_note;

-- 12. 总结报告
SELECT '测试总结' as test_step;

WITH summary AS (
    SELECT 
        COUNT(*) as total_users,
        COUNT(CASE WHEN sync_status = 'synced' THEN 1 END) as synced_users,
        COUNT(CASE WHEN sync_status != 'synced' THEN 1 END) as unsynced_users
    FROM check_profile_sync_status()
)
SELECT 
    total_users,
    synced_users,
    unsynced_users,
    CASE 
        WHEN total_users = 0 THEN '无用户数据'
        WHEN synced_users = total_users THEN '✅ 所有用户已同步'
        WHEN synced_users > 0 THEN '⚠️ 部分用户已同步'
        ELSE '❌ 无用户同步'
    END as sync_status
FROM summary; 