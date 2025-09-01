-- 检查当前数据库中实际运行的函数版本
-- 找出为什么页面结果和测试结果不一致

-- 1. 检查当前运行的calculate_metro_commute_time函数
SELECT 
  '当前函数检查' as check_type,
  proname as function_name,
  prosrc IS NOT NULL as has_source,
  CASE 
    WHEN prosrc IS NOT NULL THEN 
      CASE 
        WHEN prosrc LIKE '%v_common_line%' THEN '修复版本v3'
        WHEN prosrc LIKE '%JOIN public.metrostations m1%' THEN '修复版本v2'
        WHEN prosrc LIKE '%LIMIT 1%' THEN '原始版本'
        ELSE '其他版本'
      END
    ELSE '无源码'
  END as version_type
FROM pg_proc 
WHERE proname = 'calculate_metro_commute_time';

-- 2. 检查当前运行的generate_metro_route_summary函数
SELECT 
  '路线摘要函数检查' as check_type,
  proname as function_name,
  prosrc IS NOT NULL as has_source,
  CASE 
    WHEN prosrc IS NOT NULL THEN 
      CASE 
        WHEN prosrc LIKE '%v_common_line%' THEN '修复版本v3'
        WHEN prosrc LIKE '%JOIN public.metrostations m1%' THEN '修复版本v2'
        WHEN prosrc LIKE '%LIMIT 1%' THEN '原始版本'
        ELSE '其他版本'
      END
    ELSE '无源码'
  END as version_type
FROM pg_proc 
WHERE proname = 'generate_metro_route_summary';

-- 3. 检查函数是否被正确创建
SELECT 
  '函数存在性检查' as check_type,
  'calculate_metro_commute_time' as function_name,
  EXISTS(
    SELECT 1 FROM pg_proc 
    WHERE proname = 'calculate_metro_commute_time'
  ) as exists,
  'generate_metro_route_summary' as function_name2,
  EXISTS(
    SELECT 1 FROM pg_proc 
    WHERE proname = 'generate_metro_route_summary'
  ) as exists2;

-- 4. 检查函数权限
SELECT 
  '函数权限检查' as check_type,
  p.proname as function_name,
  p.proowner::regrole as owner,
  has_function_privilege('postgres', p.oid, 'EXECUTE') as postgres_can_execute,
  has_function_privilege('anon', p.oid, 'EXECUTE') as anon_can_execute
FROM pg_proc p
WHERE p.proname IN ('calculate_metro_commute_time', 'generate_metro_route_summary');

-- 5. 测试当前函数（如果存在）
-- 注意：这个查询可能会失败，如果函数不存在的话
DO $$
BEGIN
  IF EXISTS(SELECT 1 FROM pg_proc WHERE proname = 'calculate_metro_commute_time') THEN
    RAISE NOTICE '函数存在，可以进行测试';
  ELSE
    RAISE NOTICE '函数不存在，需要先创建';
  END IF;
END $$;
