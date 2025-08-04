-- 测试直播数据筛选函数
-- 验证函数是否正常工作

-- 1. 测试基础筛选函数
SELECT 'Testing get_filtered_live_stream_schedules function...' as test_name;

SELECT * FROM get_filtered_live_stream_schedules(
  p_date_range_start := '2024-01-01',
  p_date_range_end := '2024-12-31',
  p_page := 1,
  p_page_size := 5
) LIMIT 1;

-- 2. 测试优化版本筛选函数
SELECT 'Testing get_filtered_live_stream_schedules_with_users function...' as test_name;

SELECT * FROM get_filtered_live_stream_schedules_with_users(
  p_date_range_start := '2024-01-01',
  p_date_range_end := '2024-12-31',
  p_page := 1,
  p_page_size := 5
) LIMIT 1;

-- 3. 测试带筛选条件的查询
SELECT 'Testing with filters...' as test_name;

SELECT * FROM get_filtered_live_stream_schedules_with_users(
  p_statuses := ARRAY['completed', 'scored'],
  p_scoring_statuses := ARRAY['scored', 'approved'],
  p_score_min := 7.0,
  p_score_max := 10.0,
  p_page := 1,
  p_page_size := 3
) LIMIT 1;

-- 4. 检查函数是否存在
SELECT 
  routine_name,
  routine_type,
  data_type
FROM information_schema.routines 
WHERE routine_name IN (
  'get_filtered_live_stream_schedules',
  'get_filtered_live_stream_schedules_with_users'
)
AND routine_schema = 'public';

-- 5. 检查表结构
SELECT 
  column_name,
  data_type,
  is_nullable
FROM information_schema.columns 
WHERE table_name = 'live_stream_schedules'
ORDER BY ordinal_position;

-- 6. 检查索引
SELECT 
  indexname,
  indexdef
FROM pg_indexes 
WHERE tablename = 'live_stream_schedules'; 