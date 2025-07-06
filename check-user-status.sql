-- 检查用户状态的SQL查询
-- 使用方法：在Supabase SQL编辑器中运行

-- 1. 检查auth.users表中的用户状态
SELECT 
    id,
    email,
    email_confirmed_at,
    created_at,
    updated_at,
    raw_user_meta_data,
    confirmation_token,
    email_change_token_current
FROM auth.users 
WHERE email = 'xin_suiyuan@yeah.net';

-- 2. 检查users_profile表中的用户状态
SELECT 
    user_id,
    email,
    nickname,
    status,
    organization_id,
    created_at,
    updated_at
FROM users_profile 
WHERE email = 'xin_suiyuan@yeah.net';

-- 3. 检查是否有重复的邀请记录
SELECT 
    up.email,
    up.status,
    up.created_at as profile_created,
    au.email_confirmed_at,
    au.created_at as auth_created
FROM users_profile up
LEFT JOIN auth.users au ON up.user_id = au.id
WHERE up.email = 'xin_suiyuan@yeah.net'
ORDER BY up.created_at DESC; 