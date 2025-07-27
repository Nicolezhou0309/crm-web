-- 测试透视表函数
-- 这个脚本用于测试远程数据库的execute_pivot_analysis函数

-- 测试1: 检查函数是否存在
SELECT EXISTS (
    SELECT 1 FROM information_schema.routines 
    WHERE routine_name = 'execute_pivot_analysis' 
    AND routine_schema = 'public'
) as execute_pivot_analysis_exists;

SELECT EXISTS (
    SELECT 1 FROM information_schema.routines 
    WHERE routine_name = 'filter_all_analysis_multi' 
    AND routine_schema = 'public'
) as filter_all_analysis_multi_exists;

-- 测试2: 查看filter_all_analysis_multi函数的返回类型
SELECT 
    p.proname as function_name,
    pg_get_function_result(p.oid) as return_type
FROM pg_proc p
JOIN pg_namespace n ON p.pronamespace = n.oid
WHERE n.nspname = 'public' 
AND p.proname = 'filter_all_analysis_multi';

-- 测试3: 直接调用filter_all_analysis_multi函数（限制5条记录）
SELECT * FROM filter_all_analysis_multi() LIMIT 5;

-- 测试4: 基本的透视表查询
SELECT execute_pivot_analysis(
    'joined_data', 
    ARRAY['source'], 
    ARRAY['lead_created_at'], 
    '[{"field": "leadid", "aggregation": "count"}]'::jsonb, 
    '[]'::jsonb
); 