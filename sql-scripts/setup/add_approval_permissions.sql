-- 添加审批管理权限
-- 这个脚本用于添加审批流管理相关的权限

-- 1. 添加审批管理权限到权限表
INSERT INTO public.permissions (name, description, resource, action) 
VALUES 
  ('approval_manage', '审批流管理权限', 'approval', 'manage'),
  ('approval_view', '审批查看权限', 'approval', 'view'),
  ('approval_create', '审批创建权限', 'approval', 'create'),
  ('approval_edit', '审批编辑权限', 'approval', 'edit'),
  ('approval_delete', '审批删除权限', 'approval', 'delete')
ON CONFLICT (name) DO NOTHING;

-- 2. 为管理员角色分配审批管理权限
-- 首先获取管理员角色ID
DO $$
DECLARE
    admin_role_id uuid;
    approval_manage_permission_id uuid;
BEGIN
    -- 获取管理员角色ID
    SELECT id INTO admin_role_id FROM public.roles WHERE name = 'admin' LIMIT 1;
    
    -- 获取审批管理权限ID
    SELECT id INTO approval_manage_permission_id FROM public.permissions WHERE name = 'approval_manage' LIMIT 1;
    
    -- 如果都找到了，则分配权限
    IF admin_role_id IS NOT NULL AND approval_manage_permission_id IS NOT NULL THEN
        INSERT INTO public.role_permissions (role_id, permission_id)
        VALUES (admin_role_id, approval_manage_permission_id)
        ON CONFLICT (role_id, permission_id) DO NOTHING;
        
        RAISE NOTICE '已为管理员角色分配审批管理权限';
    ELSE
        RAISE NOTICE '未找到管理员角色或审批管理权限';
    END IF;
END $$;

-- 3. 为超级管理员角色分配审批管理权限
DO $$
DECLARE
    super_admin_role_id uuid;
    approval_manage_permission_id uuid;
BEGIN
    -- 获取超级管理员角色ID
    SELECT id INTO super_admin_role_id FROM public.roles WHERE name = 'super_admin' LIMIT 1;
    
    -- 获取审批管理权限ID
    SELECT id INTO approval_manage_permission_id FROM public.permissions WHERE name = 'approval_manage' LIMIT 1;
    
    -- 如果都找到了，则分配权限
    IF super_admin_role_id IS NOT NULL AND approval_manage_permission_id IS NOT NULL THEN
        INSERT INTO public.role_permissions (role_id, permission_id)
        VALUES (super_admin_role_id, approval_manage_permission_id)
        ON CONFLICT (role_id, permission_id) DO NOTHING;
        
        RAISE NOTICE '已为超级管理员角色分配审批管理权限';
    ELSE
        RAISE NOTICE '未找到超级管理员角色或审批管理权限';
    END IF;
END $$;

-- 4. 验证权限是否添加成功
SELECT 
    p.name as permission_name,
    p.description,
    r.name as role_name,
    rp.created_at
FROM public.permissions p
JOIN public.role_permissions rp ON p.id = rp.permission_id
JOIN public.roles r ON rp.role_id = r.id
WHERE p.name LIKE 'approval%'
ORDER BY p.name, r.name; 