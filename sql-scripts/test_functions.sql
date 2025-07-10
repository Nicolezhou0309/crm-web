-- 测试数据库函数是否正常工作
-- 请将此脚本在Supabase SQL编辑器中运行

-- 1. 测试get_user_roles函数
SELECT 'Testing get_user_roles function...' as test_name;

-- 替换为实际的用户ID
SELECT * FROM get_user_roles('f060cbb0-5799-4279-a60d-e41eae7531db');

-- 2. 测试get_managed_org_ids函数
SELECT 'Testing get_managed_org_ids function...' as test_name;

-- 替换为实际的用户ID
SELECT * FROM get_managed_org_ids('f060cbb0-5799-4279-a60d-e41eae7531db');

-- 3. 测试has_permission函数
SELECT 'Testing has_permission function...' as test_name;

-- 测试lead管理权限
SELECT has_permission('lead', 'manage') as has_lead_manage;

-- 测试permissions管理权限
SELECT has_permission('permissions', 'manage') as has_permissions_manage;

-- 4. 检查用户角色表
SELECT 'Checking user_roles table...' as test_name;

SELECT 
    ur.user_id,
    r.name as role_name,
    r.description as role_description
FROM user_roles ur
JOIN roles r ON ur.role_id = r.id
WHERE ur.user_id = 'f060cbb0-5799-4279-a60d-e41eae7531db';

-- 5. 检查组织表
SELECT 'Checking organizations table...' as test_name;

SELECT 
    id,
    name,
    admin,
    parent_id
FROM organizations
WHERE admin = 'f060cbb0-5799-4279-a60d-e41eae7531db';

-- 6. 检查用户档案
SELECT 'Checking users_profile table...' as test_name;

SELECT 
    id,
    user_id,
    organization_id,
    nickname,
    email,
    status
FROM users_profile
WHERE user_id = 'f060cbb0-5799-4279-a60d-e41eae7531db'; 