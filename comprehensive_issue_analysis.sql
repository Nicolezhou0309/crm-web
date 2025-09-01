-- 全面问题诊断脚本
-- 分析时间计算错误、站点数量错误和路径选择异常

-- 1. 问题1：时间计算错误 - 换乘惩罚被重复计算
SELECT 
  '问题1：时间计算错误分析' as issue_type,
  '检查换乘惩罚是否被重复计算' as focus;

-- 检查银都路到人民广场的详细路径和距离
SELECT 
  '银都路到人民广场路径分析' as check_type,
  station_name,
  distance,
  previous_station,
  line_info,
  CASE 
    WHEN previous_station IS NOT NULL THEN 
      distance - (SELECT distance FROM public.dijkstra_metro_shortest_path('银都路', '人民广场') WHERE station_name = previous_station)
    ELSE 0
  END as segment_time,
  CASE 
    WHEN previous_station IS NOT NULL AND 
         (SELECT line_info FROM public.dijkstra_metro_shortest_path('银都路', '人民广场') WHERE station_name = previous_station) != line_info THEN
      '换乘'
    ELSE '同线'
  END as transfer_check
FROM public.dijkstra_metro_shortest_path('银都路', '人民广场')
ORDER BY distance;

-- 2. 问题2：站点数量错误 - 统计逻辑有问题
SELECT 
  '问题2：站点数量错误分析' as issue_type,
  '检查站点数量统计逻辑' as focus;

-- 手动计算站点数量
WITH path_stations AS (
  SELECT unnest(ARRAY['银都路', '春申路', '莘庄', '外环路', '莲花路', '锦江乐园', '上海南站', '漕宝路', '上海体育馆', '徐家汇', '衡山路', '常熟路', '陕西南路', '一大会址·黄陂南路', '人民广场']) as station_name
)
SELECT 
  '手动站点统计' as check_type,
  COUNT(*) as total_stations,
  array_agg(station_name ORDER BY array_position(ARRAY['银都路', '春申路', '莘庄', '外环路', '莲花路', '锦江乐园', '上海南站', '漕宝路', '上海体育馆', '徐家汇', '衡山路', '常熟路', '陕西南路', '一大会址·黄陂南路', '人民广场'], station_name)) as path_stations
FROM path_stations;

-- 对比算法返回的站点数量
SELECT 
  '算法返回站点统计' as check_type,
  COUNT(*) as algorithm_stations,
  array_agg(station_name ORDER BY distance) as algorithm_path
FROM public.dijkstra_metro_shortest_path('银都路', '人民广场');

-- 3. 问题3：路径选择异常 - 可能选择了次优路径
SELECT 
  '问题3：路径选择异常分析' as issue_type,
  '检查是否有更优的路径被忽略' as focus;

-- 检查是否存在1号线直达路径
SELECT 
  '1号线直达路径检查' as check_type,
  '检查银都路到人民广场是否有1号线直达路径' as focus;

-- 检查银都路和人民广场是否都在1号线上
SELECT 
  '站点线路检查' as check_type,
  name as station_name,
  line,
  CASE 
    WHEN line = '1号线' THEN '✅ 在1号线上'
    ELSE '❌ 不在1号线上'
  END as line_check
FROM public.metrostations
WHERE name IN ('银都路', '人民广场')
ORDER BY name;

-- 检查1号线从银都路到人民广场的路径
SELECT 
  '1号线路径检查' as check_type,
  '检查1号线是否有银都路到人民广场的路径' as focus;

-- 检查1号线站点顺序
SELECT 
  '1号线站点顺序检查' as check_type,
  line,
  name as station_name,
  id,
  ROW_NUMBER() OVER (PARTITION BY line ORDER BY id) as station_order
FROM public.metrostations
WHERE line = '1号线'
  AND name IN ('银都路', '莘庄', '外环路', '莲花路', '锦江乐园', '上海南站', '漕宝路', '上海体育馆', '徐家汇', '衡山路', '常熟路', '陕西南路', '一大会址·黄陂南路', '人民广场')
ORDER BY id;

-- 4. 邻接关系完整性检查
SELECT 
  '邻接关系完整性检查' as issue_type,
  '检查关键站点的邻接关系' as focus;

-- 检查春申路的邻接关系
SELECT 
  '春申路邻接关系' as check_type,
  station_name,
  next_station,
  line_info,
  travel_time
FROM public.metro_complete_adjacency
WHERE station_name = '春申路' OR next_station = '春申路'
ORDER BY station_name, next_station;

-- 检查莘庄的邻接关系
SELECT 
  '莘庄邻接关系' as check_type,
  station_name,
  next_station,
  line_info,
  travel_time
FROM public.metro_complete_adjacency
WHERE station_name = '莘庄' OR next_station = '莘庄'
ORDER BY station_name, next_station;

-- 5. 问题总结和修复建议
SELECT 
  '问题总结和修复建议' as summary_type,
  '基于以上检查，主要问题：' as analysis,
  '1. 换乘惩罚重复计算导致时间错误' as problem1,
  '2. 站点数量统计逻辑有缺陷' as problem2,
  '3. 算法可能选择了次优路径' as problem3,
  '4. 邻接关系数据可能不完整' as problem4;

SELECT 
  '修复建议' as suggestion_type,
  '1. 修复换乘惩罚重复计算逻辑' as fix1,
  '2. 修复站点数量统计逻辑' as fix2,
  '3. 优化路径选择算法' as fix3,
  '4. 检查并修复邻接关系数据' as fix4;