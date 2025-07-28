-- 诊断 role_permissions 表问题
-- 创建时间: 2025年1月

-- 1. 检查表是否存在
SELECT 
  table_name,
  table_type
FROM information_schema.tables 
WHERE table_schema = 'public' 
  AND table_name = 'role_permissions';

-- 2. 检查表结构
SELECT 
  column_name,
  data_type,
  is_nullable,
  column_default
FROM information_schema.columns 
WHERE table_name = 'role_permissions' 
  AND table_schema = 'public'
ORDER BY ordinal_position;

-- 3. 检查外键约束
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
  AND tc.table_schema = 'public'
  AND tc.table_name = 'role_permissions';

-- 4. 检查 RLS 状态
SELECT 
  schemaname,
  tablename,
  rowsecurity
FROM pg_tables 
WHERE schemaname = 'public' 
  AND tablename = 'role_permissions';

-- 5. 检查 RLS 策略
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

-- 6. 检查当前用户权限
SELECT 
  current_user,
  session_user,
  auth.uid() as auth_uid;

-- 7. 检查 roles 表数据
SELECT 
  id,
  name,
  description,
  created_at
FROM roles
ORDER BY name;

-- 8. 检查 permissions 表数据
SELECT 
  id,
  name,
  resource,
  action,
  description
FROM permissions
ORDER BY resource, action;

-- 9. 检查 role_permissions 表数据
SELECT 
  role_id,
  permission_id,
  created_at
FROM role_permissions
ORDER BY role_id, permission_id;

-- 10. 测试插入权限（模拟前端操作）
-- 注意：这个查询需要在有适当权限的上下文中执行
DO $$
DECLARE
  test_role_id uuid;
  test_permission_id uuid;
  insert_result record;
BEGIN
  -- 获取测试用的角色和权限ID
  SELECT id INTO test_role_id FROM roles WHERE name = 'admin' LIMIT 1;
  SELECT id INTO test_permission_id FROM permissions LIMIT 1;
  
  IF test_role_id IS NOT NULL AND test_permission_id IS NOT NULL THEN
    -- 尝试插入测试数据
    INSERT INTO role_permissions (role_id, permission_id)
    VALUES (test_role_id, test_permission_id)
    RETURNING * INTO insert_result;
    
    RAISE NOTICE '测试插入成功: role_id=%, permission_id=%', 
      insert_result.role_id, insert_result.permission_id;
    
    -- 删除测试数据
    DELETE FROM role_permissions 
    WHERE role_id = test_role_id AND permission_id = test_permission_id;
    
    RAISE NOTICE '测试数据已删除';
  ELSE
    RAISE NOTICE '无法找到测试用的角色或权限';
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE '测试插入失败: %', SQLERRM;
END $$; 