-- =============================================
-- 测试联合分析函数的实际返回字段
-- 测试时间: 2025年1月15日
-- 目的: 验证 filter_all_analysis_multi 函数的实际返回字段
-- =============================================

-- 1. 测试基本查询，查看所有字段
SELECT '=== 测试1: 查看所有返回字段 ===' as test_name;
SELECT * FROM filter_all_analysis_multi() LIMIT 1;

-- 2. 测试特定字段查询
SELECT '=== 测试2: 测试特定字段查询 ===' as test_name;
SELECT 
  leadid,
  source,
  lead_created_at,
  followupstage,
  showing_community,
  deal_community
FROM filter_all_analysis_multi() 
LIMIT 5;

-- 3. 测试透视表函数生成的SQL
SELECT '=== 测试3: 测试透视表SQL ===' as test_name;

-- 模拟透视表函数生成的SQL
SELECT 
  source, 
  lead_created_at, 
  COUNT(leadid) as leadid_count 
FROM filter_all_analysis_multi() 
GROUP BY source, lead_created_at 
LIMIT 5;

-- 4. 检查字段是否存在
SELECT '=== 测试4: 检查字段是否存在 ===' as test_name;
SELECT 
  CASE WHEN EXISTS (
    SELECT 1 FROM filter_all_analysis_multi() 
    WHERE lead_created_at IS NOT NULL
  ) THEN 'lead_created_at 字段存在' ELSE 'lead_created_at 字段不存在' END as field_check;

-- 5. 查看所有字段名
SELECT '=== 测试5: 查看所有字段名 ===' as test_name;
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'filter_all_analysis_multi' 
ORDER BY ordinal_position;

-- 6. 测试透视表函数
SELECT '=== 测试6: 测试透视表函数 ===' as test_name;
SELECT execute_pivot_analysis(
  'joined_data',
  ARRAY['source'],
  ARRAY['lead_created_at'],
  '[{"field": "leadid", "aggregation": "count"}]',
  '[]'
);

SELECT '=== 测试完成 ===' as test_name; 