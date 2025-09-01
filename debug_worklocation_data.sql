-- 调试工作地点数据格式问题
-- 检查数据库中 worklocation 字段的实际值

-- 1. 查看所有不重复的工作地点值
SELECT DISTINCT worklocation, COUNT(*) as count
FROM public.followups 
WHERE worklocation IS NOT NULL 
  AND worklocation != ''
ORDER BY worklocation;

-- 2. 查看包含"联航路"的工作地点记录
SELECT id, leadid, worklocation, created_at
FROM public.followups 
WHERE worklocation ILIKE '%联航路%'
ORDER BY created_at DESC;

-- 3. 查看包含"联航路站"的工作地点记录
SELECT id, leadid, worklocation, created_at
FROM public.followups 
WHERE worklocation ILIKE '%联航路站%'
ORDER BY created_at DESC;

-- 4. 查看工作地点字段的长度分布
SELECT 
  LENGTH(worklocation) as char_length,
  COUNT(*) as count,
  MIN(worklocation) as example_min,
  MAX(worklocation) as example_max
FROM public.followups 
WHERE worklocation IS NOT NULL 
  AND worklocation != ''
GROUP BY LENGTH(worklocation)
ORDER BY char_length;

-- 5. 查看工作地点字段的前缀和后缀
SELECT 
  LEFT(worklocation, 10) as prefix_10,
  RIGHT(worklocation, 10) as suffix_10,
  COUNT(*) as count
FROM public.followups 
WHERE worklocation IS NOT NULL 
  AND worklocation != ''
GROUP BY LEFT(worklocation, 10), RIGHT(worklocation, 10)
ORDER BY count DESC
LIMIT 20;

-- 6. 测试筛选函数的实际行为
-- 模拟前端传递的参数
SELECT id, leadid, worklocation, created_at
FROM public.followups 
WHERE worklocation = ANY(ARRAY['联航路站', '联航路', '联航路地铁站'])
ORDER BY created_at DESC;

-- 7. 查看地铁站相关的数据结构
SELECT DISTINCT 
  CASE 
    WHEN worklocation LIKE '%号线%' THEN '包含线路信息'
    WHEN worklocation LIKE '%站%' THEN '包含站点信息'
    WHEN worklocation LIKE '%地铁%' THEN '包含地铁信息'
    ELSE '其他格式'
  END as format_type,
  COUNT(*) as count
FROM public.followups 
WHERE worklocation IS NOT NULL 
  AND worklocation != ''
GROUP BY 
  CASE 
    WHEN worklocation LIKE '%号线%' THEN '包含线路信息'
    WHEN worklocation LIKE '%站%' THEN '包含站点信息'
    WHEN worklocation LIKE '%地铁%' THEN '包含地铁信息'
    ELSE '其他格式'
  END;
