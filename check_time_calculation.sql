-- 检查时间计算错误的原因
-- 分析银都路到陕西南路的路径时间计算

-- 1. 检查银都路到陕西南路的实际路径
SELECT 
  '路径检查' as check_type,
  '银都路到陕西南路' as route;

-- 调用Dijkstra函数获取路径
SELECT 
  station_name,
  distance,
  previous_station,
  line_info,
  connection_type
FROM public.dijkstra_metro_shortest_path('银都路', '陕西南路')
ORDER BY distance;

-- 2. 手动验证路径和时间计算
SELECT 
  '手动时间计算验证' as check_type,
  '验证每个站点的距离计算' as focus;

WITH path_analysis AS (
  SELECT unnest(ARRAY['银都路', '春申路', '莘庄', '外环路', '莲花路', '锦江乐园', '上海南站', '漕宝路', '上海体育馆', '徐家汇', '衡山路', '常熟路', '陕西南路']) as station_name
)
SELECT 
  pa.station_name,
  array_position(ARRAY['银都路', '春申路', '莘庄', '外环路', '莲花路', '锦江乐园', '上海南站', '漕宝路', '上海体育馆', '徐家汇', '衡山路', '常熟路', '陕西南路'], pa.station_name) as station_order,
  (array_position(ARRAY['银都路', '春申路', '莘庄', '外环路', '莲花路', '锦江乐园', '上海南站', '漕宝路', '上海体育馆', '徐家汇', '衡山路', '常熟路', '陕西南路'], pa.station_name) - 1) * 3 as expected_time
FROM path_analysis pa
ORDER BY pa.station_name;

-- 3. 检查换乘检测逻辑
SELECT 
  '换乘检测检查' as check_type,
  '检查春申路换乘是否正确识别' as focus;

-- 检查春申路的线路信息
SELECT 
  '春申路线路信息' as check_type,
  name as station_name,
  line,
  id
FROM public.metrostations
WHERE name = '春申路'
ORDER BY line;

-- 4. 检查时间计算逻辑
SELECT 
  '时间计算逻辑分析' as check_type,
  '分析为什么显示51分钟而不是44分钟' as focus;

-- 计算理论时间
SELECT 
  '理论时间计算' as calculation_type,
  '站点数量' as factor,
  13 as value,
  '站' as unit
UNION ALL
SELECT 
  '站点时间' as calculation_type,
  '13站 × 3分钟' as factor,
  39 as value,
  '分钟' as unit
UNION ALL
SELECT 
  '换乘时间' as calculation_type,
  '1次 × 5分钟' as factor,
  5 as value,
  '分钟' as unit
UNION ALL
SELECT 
  '总时间' as calculation_type,
  '39 + 5' as factor,
  44 as value,
  '分钟' as unit;

-- 5. 检查Dijkstra函数返回的距离值
SELECT 
  'Dijkstra距离值检查' as check_type,
  '检查终点站陕西南路的距离值' as focus;

SELECT 
  station_name,
  distance,
  previous_station,
  line_info
FROM public.dijkstra_metro_shortest_path('银都路', '陕西南路')
WHERE station_name = '陕西南路';

-- 6. 问题诊断
SELECT 
  '问题诊断' as check_type,
  '基于以上检查，可能的问题：' as diagnosis,
  '1. Dijkstra函数返回的距离值不正确' as issue1,
  '2. 换乘时间被重复计算' as issue2,
  '3. 站点数量统计错误' as issue3,
  '4. 时间计算逻辑有bug' as issue4;

-- 7. 建议的检查方向
SELECT 
  '检查方向' as check_type,
  '1. 检查Dijkstra函数的距离计算逻辑' as direction1,
  '2. 检查换乘时间的计算次数' as direction2,
  '3. 检查站点数量的统计逻辑' as direction3,
  '4. 检查最终时间汇总的计算' as direction4;