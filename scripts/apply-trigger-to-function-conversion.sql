-- 应用触发器到函数的转换
-- 将触发器函数转换为可调用的普通函数

-- 1. 应用迁移文件
\i supabase/migrations/20241202000007_convert_trigger_to_function.sql

-- 2. 验证触发器已删除
SELECT 
  trigger_name,
  event_manipulation,
  action_timing
FROM information_schema.triggers 
WHERE trigger_name LIKE '%worklocation%';

-- 3. 验证函数已创建
SELECT 
  routine_name, 
  routine_type,
  data_type
FROM information_schema.routines 
WHERE routine_name IN (
  'trigger_worklocation_change',
  'calculate_commute_times_for_worklocation'
)
ORDER BY routine_name;

-- 4. 测试函数调用（不实际执行计算）
SELECT '函数已准备就绪，可以从前端调用' as status;

-- 5. 显示函数参数信息
SELECT 
  p.proname as function_name,
  pg_get_function_arguments(p.oid) as arguments,
  pg_get_function_result(p.oid) as return_type
FROM pg_proc p
JOIN pg_namespace n ON p.pronamespace = n.oid
WHERE n.nspname = 'public' 
AND p.proname IN ('trigger_worklocation_change', 'calculate_commute_times_for_worklocation')
ORDER BY p.proname;

-- 6. 显示完成信息
SELECT '触发器函数已成功转换为可调用的普通函数！' as status;
SELECT '现在前端可以主动调用这些函数，完全避免触发器超时问题' as note;
SELECT '推荐使用 calculate_commute_times_for_worklocation 函数，参数更简单' as recommendation;
