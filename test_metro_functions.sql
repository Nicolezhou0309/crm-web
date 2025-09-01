-- 测试上海地铁通勤时间计算函数的SQL语句
-- 注意：使用单引号，不是双引号

-- 1. 测试莘庄到人民广场（应该是1号线直达，0次换乘）
SELECT public.calculate_metro_commute_time('莘庄', '人民广场');

-- 2. 测试人民广场到莘庄（应该是1号线直达，0次换乘）
SELECT public.calculate_metro_commute_time('人民广场', '莘庄');

-- 3. 测试莘庄到徐家汇（应该是1号线直达，0次换乘）
SELECT public.calculate_metro_commute_time('莘庄', '徐家汇');

-- 4. 测试徐家汇到上海图书馆（应该是1号线直达，0次换乘）
SELECT public.calculate_metro_commute_time('徐家汇', '上海图书馆');

-- 5. 测试需要换乘的路线（如莘庄到顾村公园）
SELECT public.calculate_metro_commute_time('莘庄', '顾村公园');

-- 6. 测试相同站点
SELECT public.calculate_metro_commute_time('莘庄', '莘庄');

-- 7. 测试不存在的站点
SELECT public.calculate_metro_commute_time('不存在的站点', '人民广场');

-- 8. 检查函数是否存在
SELECT 
  proname as function_name,
  prosrc IS NOT NULL as has_source,
  CASE 
    WHEN prosrc LIKE '%v_common_line%' THEN '修复版本v3'
    WHEN prosrc LIKE '%JOIN public.metrostations m1%' THEN '修复版本v2'
    WHEN prosrc LIKE '%LIMIT 1%' THEN '原始版本'
    ELSE '其他版本'
  END as version_type
FROM pg_proc 
WHERE proname = 'calculate_metro_commute_time';

-- 9. 检查路线摘要函数是否存在
SELECT 
  proname as function_name,
  prosrc IS NOT NULL as has_source,
  CASE 
    WHEN prosrc LIKE '%v_common_line%' THEN '修复版本v3'
    WHEN prosrc LIKE '%JOIN public.metrostations m1%' THEN '修复版本v2'
    WHEN prosrc LIKE '%LIMIT 1%' THEN '原始版本'
    ELSE '其他版本'
  END as version_type
FROM pg_proc 
WHERE proname = 'generate_metro_route_summary';

-- 10. 检查站点数据
SELECT 
  name as station_name,
  line,
  station_type
FROM public.metrostations 
WHERE name IN ('莘庄', '人民广场', '徐家汇', '上海图书馆')
ORDER BY name, line;

-- 11. 检查Dijkstra算法结果
SELECT 
  station_name,
  distance,
  previous_station,
  line_info,
  connection_type
FROM public.dijkstra_metro_shortest_path('莘庄', '人民广场')
WHERE station_name = '人民广场';
