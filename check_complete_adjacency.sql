-- 检查metro_complete_adjacency视图是否正确包含了所有1号线连接

-- 1. 检查metro_adjacency_view中的1号线连接
SELECT 
  'metro_adjacency_view中的1号线连接' as check_type,
  COUNT(*) as total_connections
FROM public.metro_adjacency_view
WHERE line = '1号线';

-- 2. 检查metro_complete_adjacency中的1号线连接
SELECT 
  'metro_complete_adjacency中的1号线连接' as check_type,
  COUNT(*) as total_connections
FROM public.metro_complete_adjacency
WHERE line_info = '1号线';

-- 3. 对比两个视图中的1号线连接
SELECT 
  '连接对比' as check_type,
  '检查是否有1号线连接丢失' as focus;

-- 检查metro_adjacency_view中有但metro_complete_adjacency中没有的连接
SELECT 
  '缺失的连接' as status,
  mav.station_name,
  mav.next_station,
  mav.travel_time
FROM public.metro_adjacency_view mav
LEFT JOIN public.metro_complete_adjacency mca ON 
  mav.station_name = mca.station_name 
  AND mav.next_station = mca.next_station
  AND mav.line = mca.line_info
WHERE mav.line = '1号线'
  AND mca.station_name IS NULL
ORDER BY mav.station_name, mav.next_station;

-- 4. 检查徐家汇到人民广场的1号线路径
SELECT 
  '1号线路径检查' as check_type,
  '徐家汇到人民广场的完整路径' as focus;

WITH line1_path AS (
  SELECT unnest(ARRAY['徐家汇', '衡山路', '常熟路', '陕西南路', '一大会址·黄陂南路', '人民广场']) as station_name
)
SELECT 
  lp.station_name,
  mca.next_station,
  mca.travel_time,
  mca.line_info,
  CASE 
    WHEN mca.next_station IS NOT NULL THEN '✅ 连接存在'
    ELSE '❌ 连接缺失'
  END as connection_status
FROM line1_path lp
LEFT JOIN public.metro_complete_adjacency mca ON lp.station_name = mca.station_name
ORDER BY array_position(ARRAY['徐家汇', '衡山路', '常熟路', '陕西南路', '一大会址·黄陂南路', '人民广场'], lp.station_name);

-- 5. 检查metro_complete_adjacency视图的定义
SELECT 
  '视图定义检查' as check_type,
  '检查metro_complete_adjacency是如何构建的' as focus;

SELECT 
  schemaname,
  viewname,
  definition
FROM pg_views 
WHERE schemaname = 'public' 
  AND viewname = 'metro_complete_adjacency';