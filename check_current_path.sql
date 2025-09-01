-- 检查当前Dijkstra算法返回的路径
-- 测试莘庄到人民广场的路径

-- 1. 检查当前metro_complete_adjacency视图状态
SELECT 
  '当前视图状态检查' as check_type,
  connection_type,
  COUNT(*) as connection_count
FROM public.metro_complete_adjacency
GROUP BY connection_type
ORDER BY connection_type;

-- 2. 测试莘庄到人民广场的路径
SELECT 
  '路径测试' as check_type,
  '莘庄到人民广场' as route;

-- 调用Dijkstra函数测试
SELECT 
  station_name,
  distance,
  previous_station,
  line_info,
  connection_type
FROM public.dijkstra_metro_shortest_path('莘庄', '人民广场')
ORDER BY distance;

-- 3. 检查返回的站点数量
SELECT 
  '路径分析' as check_type,
  COUNT(*) as total_stations,
  array_agg(station_name ORDER BY distance) as path_stations
FROM public.dijkstra_metro_shortest_path('莘庄', '人民广场');

-- 4. 检查是否包含1号线上的站点
SELECT 
  '1号线站点检查' as check_type,
  station_name,
  line_info,
  CASE 
    WHEN line_info = '1号线' THEN '✅ 1号线'
    ELSE '❌ 非1号线'
  END as line_check
FROM public.dijkstra_metro_shortest_path('莘庄', '人民广场')
ORDER BY distance;