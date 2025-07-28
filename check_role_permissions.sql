-- 检查 role_permissions 表的数据
-- 创建时间: 2025年1月

-- 1. 检查表结构
SELECT 
  column_name,
  data_type,
  is_nullable
FROM information_schema.columns 
WHERE table_name = 'role_permissions' 
  AND table_schema = 'public'
ORDER BY ordinal_position;

-- 2. 检查 RLS 状态
SELECT 
  schemaname,
  tablename,
  rowsecurity
FROM pg_tables 
WHERE schemaname = 'public' 
  AND tablename = 'role_permissions';

-- 3. 检查策略
SELECT 
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd
FROM pg_policies 
WHERE schemaname = 'public' 
  AND tablename = 'role_permissions'
ORDER BY policyname;

-- 4. 检查所有 role_permissions 数据
SELECT 
  rp.role_id,
  rp.permission_id,
  r.name as role_name,
  p.name as permission_name,
  p.resource,
  p.action,
  rp.created_at
FROM role_permissions rp
JOIN roles r ON rp.role_id = r.id
JOIN permissions p ON rp.permission_id = p.id
ORDER BY r.name, p.name;

-- 5. 检查特定角色的权限
SELECT 
  r.name as role_name,
  p.name as permission_name,
  p.resource,
  p.action,
  rp.created_at
FROM role_permissions rp
JOIN roles r ON rp.role_id = r.id
JOIN permissions p ON rp.permission_id = p.id
WHERE r.name = 'admin'
ORDER BY p.name;

-- 6. 统计每个角色的权限数量
SELECT 
  r.name as role_name,
  COUNT(rp.permission_id) as permission_count
FROM roles r
LEFT JOIN role_permissions rp ON r.id = rp.role_id
GROUP BY r.id, r.name
ORDER BY r.name; 