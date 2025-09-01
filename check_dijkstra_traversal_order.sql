-- 检查Dijkstra算法的遍历顺序
-- 找出为什么11号线路径被优先选择

-- 1. 检查当前Dijkstra函数的实现
SELECT 
  'Dijkstra函数检查' as check_type,
  '检查当前函数的实现逻辑' as focus;

SELECT 
  proname,
  prosrc
FROM pg_proc 
WHERE proname = 'dijkstra_metro_shortest_path';

-- 2. 检查徐家汇的所有邻接关系
SELECT 
  '徐家汇邻接关系检查' as check_type,
  '检查徐家汇可以到达的所有站点' as focus;

SELECT 
  station_name,
  next_station,
  travel_time,
  line_info,
  connection_type
FROM public.metro_complete_adjacency
WHERE station_name = '徐家汇'
ORDER BY line_info, next_station;

-- 3. 检查Dijkstra算法在徐家汇的选择过程
SELECT 
  '算法选择过程分析' as check_type,
  '分析为什么选择11号线而不是1号线' as focus;

-- 模拟算法在徐家汇的选择过程
WITH dijkstra_simulation AS (
  -- 从莘庄到徐家汇的路径
  SELECT 
    '莘庄' as start_station,
    '徐家汇' as current_station,
    21 as current_distance
)
SELECT 
  '模拟结果' as simulation_type,
  ds.start_station,
  ds.current_station,
  ds.current_distance,
  mca.next_station,
  mca.line_info,
  ds.current_distance + mca.travel_time as new_distance,
  CASE 
    WHEN mca.line_info = '1号线' THEN '✅ 1号线路径'
    WHEN mca.line_info = '11号线' THEN '❌ 11号线路径'
    ELSE '⚠️ 其他线路'
  END as path_analysis
FROM dijkstra_simulation ds
JOIN public.metro_complete_adjacency mca ON ds.current_station = mca.station_name
ORDER BY mca.line_info, mca.next_station;

-- 4. 检查1号线和11号线路径的权重对比
SELECT 
  '路径权重对比' as check_type,
  '对比1号线和11号线路径的总权重' as focus;

-- 1号线路径：徐家汇 → 衡山路 → 常熟路 → 陕西南路 → 一大会址·黄陂南路 → 人民广场
WITH line1_path AS (
  SELECT 
    '1号线路径' as path_type,
    '徐家汇→衡山路→常熟路→陕西南路→一大会址·黄陂南路→人民广场' as path_description,
    5 as station_count,
    5 * 3 as total_time
),
-- 11号线路径：徐家汇 → 交通大学 → 上海图书馆 → 陕西南路 → 一大会址·黄陂南路 → 人民广场
line11_path AS (
  SELECT 
    '11号线路径' as path_type,
    '徐家汇→交通大学→上海图书馆→陕西南路→一大会址·黄陂南路→人民广场' as path_description,
    5 as station_count,
    5 * 3 as total_time
)
SELECT * FROM line1_path
UNION ALL
SELECT * FROM line11_path;

-- 5. 检查算法遍历邻接关系的顺序
SELECT 
  '遍历顺序分析' as check_type,
  '分析Dijkstra算法如何遍历邻接关系' as focus;

-- 检查metro_complete_adjacency中徐家汇邻接关系的存储顺序
SELECT 
  station_name,
  next_station,
  line_info,
  connection_type,
  ROW_NUMBER() OVER (ORDER BY line_info, next_station) as traversal_order
FROM public.metro_complete_adjacency
WHERE station_name = '徐家汇'
ORDER BY line_info, next_station;

-- 6. 问题诊断
SELECT 
  '问题诊断' as check_type,
  '基于以上检查，可能的问题：' as diagnosis,
  '1. 算法遍历邻接关系的顺序问题' as issue1,
  '2. 11号线路径在邻接关系中的位置' as issue2,
  '3. Dijkstra算法的选择逻辑' as issue3,
  '4. 邻接关系的存储顺序影响' as issue4;

-- 7. 建议的修复方向
SELECT 
  '修复建议' as check_type,
  '1. 检查Dijkstra函数的遍历逻辑' as suggestion1,
  '2. 确保1号线路径有优先级' as suggestion2,
  '3. 修复邻接关系的遍历顺序' as suggestion3,
  '4. 或者强制优先选择1号线路径' as suggestion4;