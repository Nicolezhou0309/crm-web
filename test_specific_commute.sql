-- ========================================
-- 测试特定跟进记录的通勤时间计算
-- 跟进记录ID: 25S00001
-- 工作地点: 莘庄
-- ========================================

-- 步骤1: 查找跟进记录
SELECT 
  '=== 查找跟进记录 ===' as test_section,
  NULL as result;

SELECT 
  '跟进记录信息' as test_name,
  jsonb_build_object(
    'id', f.id,
    'leadid', f.leadid,
    'worklocation', f.worklocation,
    'existing_commute_times', f.extended_data->'commute_times',
    'created_at', f.created_at,
    'updated_at', f.updated_at
  ) as result
FROM public.followups f
WHERE f.leadid = '25S00001';

-- 步骤2: 检查莘庄地铁站是否存在
SELECT 
  '=== 检查地铁站 ===' as test_section,
  NULL as result;

SELECT 
  '莘庄地铁站信息' as test_name,
  jsonb_build_object(
    'name', m.name,
    'line', m.line,
    'exists', CASE WHEN m.name IS NOT NULL THEN true ELSE false END
  ) as result
FROM public.metrostations m
WHERE m.name LIKE '%莘庄%' OR m.name = '莘庄';

-- 步骤3: 查看相关社区数据
SELECT 
  '=== 相关社区数据 ===' as test_section,
  NULL as result;

SELECT 
  '社区数据' as test_name,
  jsonb_build_object(
    'community', ck.community,
    'metrostation', ck.metrostation,
    'created_at', ck.created_at
  ) as result
FROM public.community_keywords ck
WHERE ck.metrostation IS NOT NULL
ORDER BY ck.created_at DESC
LIMIT 10;

-- 步骤4: 执行通勤时间计算
SELECT 
  '=== 执行通勤时间计算 ===' as test_section,
  NULL as result;

-- 测试通勤时间计算
SELECT 
  '通勤时间计算结果' as test_name,
  public.calculate_commute_times_for_worklocation(
    (SELECT id FROM public.followups WHERE leadid = '25S00001' LIMIT 1),
    '莘庄'
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
WHERE f.leadid = '25S00001';

-- 步骤6: 测试单个通勤时间计算（莘庄到其他站点）
SELECT 
  '=== 测试莘庄到其他站点 ===' as test_section,
  NULL as result;

-- 测试莘庄到几个主要站点的通勤时间
SELECT 
  '莘庄到国贸站' as test_name,
  public.calculate_metro_commute_time('莘庄', '国贸站') as result;

SELECT 
  '莘庄到天安门东站' as test_name,
  public.calculate_metro_commute_time('莘庄', '天安门东站') as result;

SELECT 
  '莘庄到人民广场站' as test_name,
  public.calculate_metro_commute_time('莘庄', '人民广场站') as result;

-- 步骤7: 查看通勤时间数据详情
SELECT 
  '=== 通勤时间数据详情 ===' as test_section,
  NULL as result;

-- 解析通勤时间数据
SELECT 
  '通勤时间详情' as test_name,
  jsonb_build_object(
    'total_communities', jsonb_array_length(jsonb_object_keys(f.extended_data->'commute_times')),
    'commute_times', f.extended_data->'commute_times',
    'min_time', (
      SELECT MIN(value::integer) 
      FROM jsonb_each(f.extended_data->'commute_times') 
      WHERE value::integer < 999
    ),
    'max_time', (
      SELECT MAX(value::integer) 
      FROM jsonb_each(f.extended_data->'commute_times') 
      WHERE value::integer < 999
    ),
    'failed_calculations', (
      SELECT COUNT(*) 
      FROM jsonb_each(f.extended_data->'commute_times') 
      WHERE value::integer = 999
    )
  ) as result
FROM public.followups f
WHERE f.leadid = '25S00001' 
  AND f.extended_data->>'commute_times' IS NOT NULL;

-- 步骤8: 测试完成
SELECT 
  '=== 测试完成 ===' as test_section,
  '25S00001 莘庄 通勤时间计算测试完成' as result;
