-- 检查线索类表的详细结构
-- 这个脚本用于在 Supabase SQL 编辑器中执行

-- 1. 检查 leads 表结构
SELECT 
  'leads' as table_name,
  column_name,
  data_type,
  is_nullable,
  column_default
FROM information_schema.columns 
WHERE table_name = 'leads' 
  AND table_schema = 'public'
ORDER BY ordinal_position;

-- 2. 检查 followups 表结构
SELECT 
  'followups' as table_name,
  column_name,
  data_type,
  is_nullable,
  column_default
FROM information_schema.columns 
WHERE table_name = 'followups' 
  AND table_schema = 'public'
ORDER BY ordinal_position;

-- 3. 检查 showings 表结构
SELECT 
  'showings' as table_name,
  column_name,
  data_type,
  is_nullable,
  column_default
FROM information_schema.columns 
WHERE table_name = 'showings' 
  AND table_schema = 'public'
ORDER BY ordinal_position;

-- 4. 检查 deals 表结构
SELECT 
  'deals' as table_name,
  column_name,
  data_type,
  is_nullable,
  column_default
FROM information_schema.columns 
WHERE table_name = 'deals' 
  AND table_schema = 'public'
ORDER BY ordinal_position;

-- 5. 检查 organizations 表结构
SELECT 
  'organizations' as table_name,
  column_name,
  data_type,
  is_nullable,
  column_default
FROM information_schema.columns 
WHERE table_name = 'organizations' 
  AND table_schema = 'public'
ORDER BY ordinal_position;

-- 6. 检查 users_profile 表结构
SELECT 
  'users_profile' as table_name,
  column_name,
  data_type,
  is_nullable,
  column_default
FROM information_schema.columns 
WHERE table_name = 'users_profile' 
  AND table_schema = 'public'
ORDER BY ordinal_position;

-- 7. 检查现有的 RLS 策略
SELECT 
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd,
  qual,
  with_check
FROM pg_policies 
WHERE schemaname = 'public' 
  AND tablename IN ('leads', 'followups', 'showings', 'deals', 'organizations', 'users_profile')
ORDER BY tablename, policyname;

-- 8. 检查外键关系
SELECT 
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
  AND tc.table_name IN ('leads', 'followups', 'showings', 'deals', 'organizations', 'users_profile')
ORDER BY tc.table_name, kcu.column_name;

-- 9. 检查权限相关函数
SELECT 
  routine_name,
  routine_type,
  data_type
FROM information_schema.routines 
WHERE routine_schema = 'public'
  AND routine_name LIKE '%permission%'
  OR routine_name LIKE '%admin%'
  OR routine_name LIKE '%org%'
ORDER BY routine_name;

-- 10. 检查枚举类型
SELECT 
  t.typname as enum_name,
  e.enumlabel as enum_value
FROM pg_type t
JOIN pg_enum e ON t.oid = e.enumtypid
WHERE t.typname IN ('source', 'followupstage', 'customerprofile', 'userrating', 'community')
ORDER BY t.typname, e.enumsortorder; 