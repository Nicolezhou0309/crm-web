-- ========================================
-- 通勤时间计算功能完整测试脚本
-- 一次性复制执行，测试所有场景
-- ========================================

-- 步骤1: 获取测试数据
WITH test_data AS (
  SELECT 
    f.id as followup_id,
    f.leadid,
    f.worklocation,
    f.extended_data->>'commute_times' as existing_commute_times
  FROM public.followups f
  WHERE f.worklocation IS NOT NULL 
    AND f.worklocation != ''
  ORDER BY f.created_at DESC 
  LIMIT 1
),
-- 步骤2: 获取可用的地铁站
metro_stations AS (
  SELECT name as station_name
  FROM public.metrostations 
  WHERE name IS NOT NULL
  ORDER BY created_at DESC 
  LIMIT 5
),
-- 步骤3: 获取社区数据
community_data AS (
  SELECT 
    community,
    metrostation,
    COUNT(*) as count
  FROM public.community_keywords 
  WHERE metrostation IS NOT NULL
  GROUP BY community, metrostation
  ORDER BY count DESC
  LIMIT 10
)

-- 主测试查询
SELECT 
  '=== 测试数据概览 ===' as test_section,
  NULL as result;

-- 显示测试数据
SELECT 
  '测试跟进记录' as test_type,
  followup_id::text as followup_id,
  leadid,
  worklocation,
  CASE 
    WHEN existing_commute_times IS NOT NULL THEN '已有通勤数据'
    ELSE '无通勤数据'
  END as commute_status
FROM test_data;

-- 显示可用地铁站
SELECT 
  '可用地铁站' as test_type,
  station_name,
  NULL as followup_id,
  NULL as leadid,
  NULL as worklocation,
  NULL as commute_status
FROM metro_stations;

-- 显示社区数据
SELECT 
  '社区数据' as test_type,
  community as station_name,
  metrostation as followup_id,
  count::text as leadid,
  NULL as worklocation,
  NULL as commute_status
FROM community_data;

-- 步骤4: 执行通勤时间计算测试
SELECT 
  '=== 开始通勤时间计算测试 ===' as test_section,
  NULL as result;

-- 测试1: 正常情况 - 使用第一个有效的跟进记录
SELECT 
  '测试1: 正常计算' as test_name,
  public.calculate_commute_times_for_worklocation(
    (SELECT followup_id FROM test_data LIMIT 1),
    (SELECT worklocation FROM test_data LIMIT 1)
  ) as result;

-- 测试2: 参数验证 - 空followup_id
SELECT 
  '测试2: 空followup_id' as test_name,
  public.calculate_commute_times_for_worklocation(
    NULL::uuid,
    '国贸站'
  ) as result;

-- 测试3: 参数验证 - 空工作地点
SELECT 
  '测试3: 空工作地点' as test_name,
  public.calculate_commute_times_for_worklocation(
    (SELECT followup_id FROM test_data LIMIT 1),
    ''
  ) as result;

-- 测试4: 参数验证 - 只有空格的工作地点
SELECT 
  '测试4: 空格工作地点' as test_name,
  public.calculate_commute_times_for_worklocation(
    (SELECT followup_id FROM test_data LIMIT 1),
    '   '
  ) as result;

-- 测试5: 单个地铁站通勤时间计算
SELECT 
  '测试5: 单站通勤计算' as test_name,
  public.calculate_metro_commute_time(
    '国贸站',
    '天安门东站'
  ) as result;

-- 测试6: 错误情况 - 不存在的地铁站
SELECT 
  '测试6: 错误站点' as test_name,
  public.calculate_metro_commute_time(
    '不存在的站点',
    '天安门东站'
  ) as result;

-- 步骤5: 查看计算结果
SELECT 
  '=== 查看计算结果 ===' as test_section,
  NULL as result;

-- 查看更新后的跟进记录
SELECT 
  '更新后的跟进记录' as test_name,
  jsonb_build_object(
    'id', f.id,
    'leadid', f.leadid,
    'worklocation', f.worklocation,
    'commute_times', f.extended_data->'commute_times',
    'updated_at', f.updated_at
  ) as result
FROM public.followups f
WHERE f.id = (SELECT followup_id FROM test_data LIMIT 1);

-- 步骤6: 统计信息
SELECT 
  '=== 统计信息 ===' as test_section,
  NULL as result;

-- 通勤时间计算统计
SELECT 
  '通勤时间统计' as test_name,
  jsonb_build_object(
    'total_followups', COUNT(*),
    'with_commute_times', COUNT(CASE WHEN extended_data->>'commute_times' IS NOT NULL THEN 1 END),
    'without_commute_times', COUNT(CASE WHEN extended_data->>'commute_times' IS NULL THEN 1 END)
  ) as result
FROM public.followups 
WHERE worklocation IS NOT NULL;

-- 社区数量分布
SELECT 
  '社区数量分布' as test_name,
  jsonb_build_object(
    'communities_count', jsonb_array_length(jsonb_object_keys(extended_data->'commute_times')),
    'followup_count', COUNT(*)
  ) as result
FROM public.followups 
WHERE extended_data->>'commute_times' IS NOT NULL
GROUP BY jsonb_array_length(jsonb_object_keys(extended_data->'commute_times'))
ORDER BY jsonb_array_length(jsonb_object_keys(extended_data->'commute_times'))
LIMIT 5;

-- 步骤7: 测试完成
SELECT 
  '=== 测试完成 ===' as test_section,
  '所有测试已执行完毕，请查看上述结果' as result;
