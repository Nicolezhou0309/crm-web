-- 重置用户邀请状态的SQL脚本
-- ⚠️ 注意：这会删除该用户的所有数据，请谨慎使用

-- 设置要清理的邮箱
\set target_email 'xin_suiyuan@yeah.net'

-- 1. 删除users_profile表中的记录
DELETE FROM users_profile 
WHERE email = :'target_email';

-- 2. 删除auth.users表中的记录（如果存在）
-- 注意：这需要管理员权限
DELETE FROM auth.users 
WHERE email = :'target_email';

-- 3. 验证删除结果
SELECT 'users_profile清理结果:' as message, count(*) as remaining_records
FROM users_profile 
WHERE email = :'target_email'
UNION ALL
SELECT 'auth.users清理结果:' as message, count(*) as remaining_records
FROM auth.users 
WHERE email = :'target_email';

-- 4. 重新检查是否清理干净
SELECT 
    'users_profile' as table_name,
    count(*) as record_count
FROM users_profile 
WHERE email = :'target_email'
UNION ALL
SELECT 
    'auth.users' as table_name,
    count(*) as record_count
FROM auth.users 
WHERE email = :'target_email'; 