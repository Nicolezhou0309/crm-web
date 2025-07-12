-- 基础角色和权限数据设置脚本
-- 在Supabase SQL编辑器中执行此脚本

-- =====================================
-- 1. 清空现有数据（可选）
-- =====================================

-- 注意：如果表中已有重要数据，请跳过这部分
-- DELETE FROM role_permissions;
-- DELETE FROM user_roles;
-- DELETE FROM permissions;
-- DELETE FROM roles;

-- =====================================
-- 2. 插入基础角色
-- =====================================

-- 插入系统角色
INSERT INTO roles (name, description) VALUES
('admin', '系统管理员 - 拥有所有权限'),
('manager', '部门经理 - 可以管理指定部门'),
('user', '普通用户 - 基础功能权限')
ON CONFLICT (name) DO NOTHING;

-- =====================================
-- 3. 插入基础权限
-- =====================================

-- 线索管理权限
INSERT INTO permissions (name, resource, action, description) VALUES
('lead_view', 'lead', 'view', '查看线索'),
('lead_create', 'lead', 'create', '创建线索'),
('lead_edit', 'lead', 'edit', '编辑线索'),
('lead_delete', 'lead', 'delete', '删除线索'),
('lead_manage', 'lead', 'manage', '管理线索（包含所有操作）')
ON CONFLICT (resource, action) DO NOTHING;

-- 跟进记录权限
INSERT INTO permissions (name, resource, action, description) VALUES
('followup_view', 'followup', 'view', '查看跟进记录'),
('followup_create', 'followup', 'create', '创建跟进记录'),
('followup_edit', 'followup', 'edit', '编辑跟进记录'),
('followup_delete', 'followup', 'delete', '删除跟进记录'),
('followup_manage', 'followup', 'manage', '管理跟进记录（包含所有操作）')
ON CONFLICT (resource, action) DO NOTHING;

-- 成交管理权限
INSERT INTO permissions (name, resource, action, description) VALUES
('deal_view', 'deal', 'view', '查看成交记录'),
('deal_create', 'deal', 'create', '创建成交记录'),
('deal_edit', 'deal', 'edit', '编辑成交记录'),
('deal_delete', 'deal', 'delete', '删除成交记录'),
('deal_manage', 'deal', 'manage', '管理成交记录（包含所有操作）')
ON CONFLICT (resource, action) DO NOTHING;

-- 部门管理权限
INSERT INTO permissions (name, resource, action, description) VALUES
('department_view', 'department', 'view', '查看部门信息'),
('department_create', 'department', 'create', '创建部门'),
('department_edit', 'department', 'edit', '编辑部门'),
('department_delete', 'department', 'delete', '删除部门'),
('department_manage', 'department', 'manage', '管理部门（包含所有操作）')
ON CONFLICT (resource, action) DO NOTHING;

-- 用户管理权限
INSERT INTO permissions (name, resource, action, description) VALUES
('user_view', 'user', 'view', '查看用户信息'),
('user_create', 'user', 'create', '创建用户'),
('user_edit', 'user', 'edit', '编辑用户'),
('user_delete', 'user', 'delete', '删除用户'),
('user_manage', 'user', 'manage', '管理用户（包含所有操作）')
ON CONFLICT (resource, action) DO NOTHING;

-- 角色权限管理
INSERT INTO permissions (name, resource, action, description) VALUES
('role_view', 'role', 'view', '查看角色'),
('role_create', 'role', 'create', '创建角色'),
('role_edit', 'role', 'edit', '编辑角色'),
('role_delete', 'role', 'delete', '删除角色'),
('role_manage', 'role', 'manage', '管理角色（包含所有操作）')
ON CONFLICT (resource, action) DO NOTHING;

-- 权限管理
INSERT INTO permissions (name, resource, action, description) VALUES
('permission_view', 'permission', 'view', '查看权限'),
('permission_assign', 'permission', 'assign', '分配权限'),
('permission_manage', 'permission', 'manage', '管理权限（包含所有操作）')
ON CONFLICT (resource, action) DO NOTHING;

-- 分配管理权限
INSERT INTO permissions (name, resource, action, description) VALUES
('allocation_view', 'allocation', 'view', '查看分配规则'),
('allocation_create', 'allocation', 'create', '创建分配规则'),
('allocation_edit', 'allocation', 'edit', '编辑分配规则'),
('allocation_delete', 'allocation', 'delete', '删除分配规则'),
('allocation_manage', 'allocation', 'manage', '管理分配规则（包含所有操作）')
ON CONFLICT (resource, action) DO NOTHING;

-- 报表查看权限
INSERT INTO permissions (name, resource, action, description) VALUES
('report_view', 'report', 'view', '查看报表'),
('report_export', 'report', 'export', '导出报表'),
('report_manage', 'report', 'manage', '管理报表（包含所有操作）')
ON CONFLICT (resource, action) DO NOTHING;

-- 积分管理权限
INSERT INTO permissions (name, resource, action, description) VALUES
('points_view', 'points', 'view', '查看积分'),
('points_award', 'points', 'award', '奖励积分'),
('points_deduct', 'points', 'deduct', '扣除积分'),
('points_manage', 'points', 'manage', '管理积分（包含所有操作）')
ON CONFLICT (resource, action) DO NOTHING;

-- =====================================
-- 4. 为角色分配权限
-- =====================================

-- 为admin角色分配所有权限
INSERT INTO role_permissions (role_id, permission_id)
SELECT 
    r.id as role_id,
    p.id as permission_id
FROM roles r
CROSS JOIN permissions p
WHERE r.name = 'admin'
ON CONFLICT (role_id, permission_id) DO NOTHING;

-- 为manager角色分配管理权限
INSERT INTO role_permissions (role_id, permission_id)
SELECT 
    r.id as role_id,
    p.id as permission_id
FROM roles r
CROSS JOIN permissions p
WHERE r.name = 'manager'
    AND p.name IN (
        'lead_view', 'lead_create', 'lead_edit', 'lead_manage',
        'followup_view', 'followup_create', 'followup_edit', 'followup_manage',
        'deal_view', 'deal_create', 'deal_edit', 'deal_manage',
        'department_view', 'department_create', 'department_edit',
        'user_view', 'user_edit',
        'allocation_view', 'allocation_create', 'allocation_edit',
        'report_view',
        'points_view', 'points_award'
    )
ON CONFLICT (role_id, permission_id) DO NOTHING;

-- 为user角色分配基础权限
INSERT INTO role_permissions (role_id, permission_id)
SELECT 
    r.id as role_id,
    p.id as permission_id
FROM roles r
CROSS JOIN permissions p
WHERE r.name = 'user'
    AND p.name IN (
        'lead_view', 'lead_create', 'lead_edit',
        'followup_view', 'followup_create', 'followup_edit',
        'deal_view', 'deal_create', 'deal_edit',
        'department_view',
        'report_view',
        'points_view'
    )
ON CONFLICT (role_id, permission_id) DO NOTHING;

-- =====================================
-- 5. 验证数据插入结果
-- =====================================

-- 显示角色数据
SELECT '=== 角色数据 ===' as info;
SELECT id, name, description, created_at FROM roles ORDER BY name;

-- 显示权限数据
SELECT '=== 权限数据 ===' as info;
SELECT id, name, resource, action, description FROM permissions ORDER BY resource, action;

-- 显示角色权限分配
SELECT '=== 角色权限分配 ===' as info;
SELECT 
    r.name as role_name,
    p.name as permission_name,
    p.resource,
    p.action
FROM role_permissions rp
JOIN roles r ON rp.role_id = r.id
JOIN permissions p ON rp.permission_id = p.id
ORDER BY r.name, p.resource, p.action;

-- 显示统计信息
SELECT '=== 统计信息 ===' as info;
SELECT 
    '角色数量' as type,
    COUNT(*) as count
FROM roles
UNION ALL
SELECT 
    '权限数量' as type,
    COUNT(*) as count
FROM permissions
UNION ALL
SELECT 
    '角色权限分配数量' as type,
    COUNT(*) as count
FROM role_permissions;

-- =====================================
-- 6. 使用说明
-- =====================================

SELECT '=== 使用说明 ===' as info;
SELECT 
    '1. admin角色：拥有所有权限，适合系统管理员' as instruction
UNION ALL
SELECT 
    '2. manager角色：拥有管理权限，适合部门经理' as instruction
UNION ALL
SELECT 
    '3. user角色：拥有基础权限，适合普通用户' as instruction
UNION ALL
SELECT 
    '4. 可以通过user_roles表为用户分配角色' as instruction
UNION ALL
SELECT 
    '5. 可以通过role_permissions表为角色分配权限' as instruction;

SELECT '✅ 基础角色和权限数据设置完成！' as completion; 