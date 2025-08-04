-- 简化的测试函数
-- 测试数据库函数是否正常工作

-- 1. 测试最简单的调用
SELECT 'Testing simple function call...' as test_name;

SELECT * FROM get_filtered_live_stream_schedules_with_users(
  p_page := 1,
  p_page_size := 5
) LIMIT 1;

-- 2. 测试只带日期范围
SELECT 'Testing with date range...' as test_name;

SELECT * FROM get_filtered_live_stream_schedules_with_users(
  p_date_range_start := '2024-01-01',
  p_date_range_end := '2024-12-31',
  p_page := 1,
  p_page_size := 3
) LIMIT 1;

-- 3. 检查函数参数
SELECT 'Checking function parameters...' as test_name;

SELECT 
  parameter_name,
  parameter_mode,
  data_type,
  parameter_default
FROM information_schema.parameters 
WHERE specific_name IN (
  SELECT specific_name 
  FROM information_schema.routines 
  WHERE routine_name = 'get_filtered_live_stream_schedules_with_users'
)
ORDER BY ordinal_position;

-- 4. 检查表是否有数据
SELECT 'Checking table data...' as test_name;

SELECT COUNT(*) as total_records FROM live_stream_schedules;

SELECT COUNT(*) as total_users FROM users_profile;

-- 5. 测试基础查询
SELECT 'Testing basic query...' as test_name;

SELECT 
  lss.id,
  lss.date,
  lss.time_slot_id,
  lss.status,
  lss.participant_ids
FROM live_stream_schedules lss
LIMIT 3; 