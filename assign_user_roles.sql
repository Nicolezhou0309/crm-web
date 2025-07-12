-- 用户角色分配脚本
-- 在Supabase SQL编辑器中执行此脚本

-- =====================================
-- 1. 查看现有用户
-- =====================================

SELECT '=== 现有用户列表 ===' as info;
SELECT 
    up.id,
    up.nickname,
    up.email,
    up.status,
    o.name as organization_name
FROM users_profile up
LEFT JOIN organizations o ON up.organization_id = o.id
WHERE up.status = 'active'
ORDER BY up.nickname;

-- =====================================
-- 2. 查看现有角色
-- =====================================

SELECT '=== 现有角色列表 ===' as info;
SELECT id, name, description FROM roles ORDER BY name;

-- =====================================
-- 3. 查看现有用户角色分配
-- =====================================

SELECT '=== 现有用户角色分配 ===' as info;
SELECT 
    up.nickname,
    up.email,
    r.name as role_name,
    r.description as role_description
FROM user_roles ur
JOIN users_profile up ON ur.user_id = up.user_id
JOIN roles r ON ur.role_id = r.id
ORDER BY up.nickname, r.name;

-- =====================================
-- 4. 为用户分配角色的示例
-- =====================================

-- 注意：请根据实际用户ID和需求修改以下语句

-- 示例1：为特定用户分配admin角色
-- INSERT INTO user_roles (user_id, role_id)
-- SELECT 
--     up.user_id,
--     r.id
-- FROM users_profile up
-- CROSS JOIN roles r
-- WHERE up.email = 'admin@example.com'  -- 替换为实际邮箱
--     AND r.name = 'admin'
-- ON CONFLICT (user_id, role_id) DO NOTHING;

-- 示例2：为特定用户分配manager角色
-- INSERT INTO user_roles (user_id, role_id)
-- SELECT 
--     up.user_id,
--     r.id
-- FROM users_profile up
-- CROSS JOIN roles r
-- WHERE up.email = 'manager@example.com'  -- 替换为实际邮箱
--     AND r.name = 'manager'
-- ON CONFLICT (user_id, role_id) DO NOTHING;

-- 示例3：为所有活跃用户分配user角色（如果没有角色）
-- INSERT INTO user_roles (user_id, role_id)
-- SELECT 
--     up.user_id,
--     r.id
-- FROM users_profile up
-- CROSS JOIN roles r
-- WHERE up.status = 'active'
--     AND r.name = 'user'
--     AND NOT EXISTS (
--         SELECT 1 FROM user_roles ur2 
--         WHERE ur2.user_id = up.user_id
--     )
-- ON CONFLICT (user_id, role_id) DO NOTHING;

-- =====================================
-- 5. 批量分配角色的函数
-- =====================================

-- 创建分配角色的函数
CREATE OR REPLACE FUNCTION assign_role_to_user_by_email(
    user_email text,
    role_name text
)
RETURNS boolean
LANGUAGE plpgsql
AS $$
DECLARE
    target_user_id uuid;
    target_role_id uuid;
BEGIN
    -- 获取用户ID
    SELECT user_id INTO target_user_id
    FROM users_profile
    WHERE email = user_email;
    
    IF target_user_id IS NULL THEN
        RAISE EXCEPTION '用户不存在: %', user_email;
    END IF;
    
    -- 获取角色ID
    SELECT id INTO target_role_id
    FROM roles
    WHERE name = role_name;
    
    IF target_role_id IS NULL THEN
        RAISE EXCEPTION '角色不存在: %', role_name;
    END IF;
    
    -- 分配角色
    INSERT INTO user_roles (user_id, role_id)
    VALUES (target_user_id, target_role_id)
    ON CONFLICT (user_id, role_id) DO NOTHING;
    
    RETURN true;
END;
$$;

-- =====================================
-- 6. 使用示例
-- =====================================

SELECT '=== 使用示例 ===' as info;
SELECT 
    '1. 为单个用户分配角色：' as example
UNION ALL
SELECT 
    '   SELECT assign_role_to_user_by_email(''user@example.com'', ''admin'');' as example
UNION ALL
SELECT 
    '2. 为多个用户分配角色：' as example
UNION ALL
SELECT 
    '   SELECT assign_role_to_user_by_email(''user1@example.com'', ''manager'');' as example
UNION ALL
SELECT 
    '   SELECT assign_role_to_user_by_email(''user2@example.com'', ''user'');' as example
UNION ALL
SELECT 
    '3. 查看用户权限：' as example
UNION ALL
SELECT 
    '   SELECT * FROM get_user_roles(''user_id'');' as example;

-- =====================================
-- 7. 验证分配结果
-- =====================================

SELECT '=== 验证分配结果 ===' as info;
SELECT 
    up.nickname,
    up.email,
    string_agg(r.name, ', ') as roles
FROM users_profile up
LEFT JOIN user_roles ur ON up.user_id = ur.user_id
LEFT JOIN roles r ON ur.role_id = r.id
WHERE up.status = 'active'
GROUP BY up.id, up.nickname, up.email
ORDER BY up.nickname;

SELECT '✅ 用户角色分配脚本准备完成！' as completion; 