-- 调试工作地点匹配问题 - 优化版本
-- 一次性查询返回所有相关调试信息

WITH worklocation_analysis AS (
  -- 基础统计信息
  SELECT 
    COUNT(*) as total_records,
    COUNT(CASE WHEN worklocation IS NOT NULL AND worklocation != '' THEN 1 END) as has_worklocation,
    COUNT(CASE WHEN worklocation IS NULL OR worklocation = '' THEN 1 END) as no_worklocation
  FROM public.followups
),
worklocation_values AS (
  -- 所有不重复的工作地点值
  SELECT 
    worklocation,
    LENGTH(worklocation) as char_length,
    COUNT(*) as count
  FROM public.followups 
  WHERE worklocation IS NOT NULL 
    AND worklocation != ''
  GROUP BY worklocation, LENGTH(worklocation)
),
target_matches AS (
  -- 目标筛选条件的匹配情况
  SELECT 
    '联航路' as target_value,
    COUNT(CASE WHEN worklocation = '联航路' THEN 1 END) as exact_match,
    COUNT(CASE WHEN worklocation ILIKE '%联航路%' THEN 1 END) as like_match,
    COUNT(CASE WHEN worklocation ILIKE '%联航%' THEN 1 END) as partial_match
  FROM public.followups 
  WHERE worklocation IS NOT NULL 
    AND worklocation != ''
),
filter_array_test AS (
  -- 测试前端传递的筛选数组
  SELECT 
    COUNT(*) as total_with_worklocation,
    COUNT(CASE WHEN worklocation = ANY(ARRAY[
      '联航路', '东方体育中心', '中兴路', '中华艺术宫', '人民广场', 
      '凌兆新村', '四平路', '大世界', '嫩江路', '市光路', 
      '延吉中路', '成山路', '曲阜路', '曲阳路', '杨思', 
      '江月路', '江浦路', '沈杜公路', '浦江镇', '翔殷路', 
      '耀华路', '老西门', '芦恒路', '虹口足球场', '西藏北路', 
      '西藏南路', '陆家浜路', '鞍山新村', '黄兴公园', '黄兴路'
    ]) THEN 1 END) as array_match_count
  FROM public.followups 
  WHERE worklocation IS NOT NULL 
    AND worklocation != ''
),
sample_records AS (
  -- 包含目标工作地点的样本记录
  SELECT 
    id, leadid, worklocation, created_at, updated_at, invalid
  FROM public.followups 
  WHERE worklocation ILIKE '%联航%'
  ORDER BY created_at DESC
  LIMIT 10
),
worklocation_format_analysis AS (
  -- 工作地点格式分析
  SELECT 
    CASE 
      WHEN worklocation LIKE '%号线%' THEN '包含线路信息'
      WHEN worklocation LIKE '%站%' THEN '包含站点信息'
      WHEN worklocation LIKE '%地铁%' THEN '包含地铁信息'
      WHEN worklocation LIKE '%路%' THEN '包含路名信息'
      ELSE '其他格式'
    END as format_type,
    COUNT(*) as count,
    STRING_AGG(DISTINCT worklocation, ', ' ORDER BY worklocation) as examples
  FROM public.followups 
  WHERE worklocation IS NOT NULL 
    AND worklocation != ''
  GROUP BY 
    CASE 
      WHEN worklocation LIKE '%号线%' THEN '包含线路信息'
      WHEN worklocation LIKE '%站%' THEN '包含站点信息'
      WHEN worklocation LIKE '%地铁%' THEN '包含地铁信息'
      WHEN worklocation LIKE '%路%' THEN '包含路名信息'
      ELSE '其他格式'
    END
)
-- 主查询：一次性返回所有分析结果
SELECT 
  -- 基础统计
  (SELECT total_records FROM worklocation_analysis) as total_records,
  (SELECT has_worklocation FROM worklocation_analysis) as has_worklocation,
  (SELECT no_worklocation FROM worklocation_analysis) as no_worklocation,
  
  -- 目标匹配统计
  (SELECT exact_match FROM target_matches) as exact_match_count,
  (SELECT like_match FROM target_matches) as like_match_count,
  (SELECT partial_match FROM target_matches) as partial_match_count,
  
  -- 筛选数组测试
  (SELECT total_with_worklocation FROM filter_array_test) as total_with_worklocation,
  (SELECT array_match_count FROM filter_array_test) as array_match_count,
  
  -- 格式分析
  (SELECT json_agg(format_type || ': ' || count || '个 (' || examples || ')') FROM worklocation_format_analysis) as format_analysis,
  
  -- 样本记录
  (SELECT json_agg(
    json_build_object(
      'id', id,
      'leadid', leadid,
      'worklocation', worklocation,
      'created_at', created_at,
      'invalid', invalid
    )
  ) FROM sample_records) as sample_records,
  
  -- 工作地点值统计
  (SELECT json_agg(
    json_build_object(
      'value', worklocation,
      'length', char_length,
      'count', count
    )
  ) FROM (
    SELECT worklocation, char_length, count 
    FROM worklocation_values 
    ORDER BY char_length, worklocation 
    LIMIT 20
  ) AS sorted_values) as worklocation_values_sample,
  
  -- 调试建议
  CASE 
    WHEN (SELECT exact_match FROM target_matches) = 0 THEN '❌ 数据库中不存在精确匹配的"联航路"记录'
    ELSE '✅ 数据库中存在精确匹配的"联航路"记录'
  END as exact_match_status,
  
  CASE 
    WHEN (SELECT like_match FROM target_matches) > 0 THEN '✅ 使用ILIKE可以找到相关记录'
    ELSE '❌ 使用ILIKE也无法找到相关记录'
  END as like_match_status,
  
  CASE 
    WHEN (SELECT array_match_count FROM filter_array_test) = 0 THEN '❌ 筛选数组无法匹配任何记录'
    ELSE '✅ 筛选数组可以匹配到记录'
  END as array_match_status,
  
  -- 时间戳
  NOW() as query_timestamp;
