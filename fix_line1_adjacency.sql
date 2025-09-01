-- 检查和修复1号线邻接关系问题
-- 确保1号线在徐家汇之后的路径正确

-- 1. 检查当前1号线的邻接关系
SELECT 
  '1号线邻接关系检查' as check_type,
  '当前状态' as status;

SELECT 
  station_name,
  next_station,
  travel_time,
  line
FROM public.metro_adjacency_view
WHERE line = '1号线'
  AND station_name IN ('徐家汇', '衡山路', '常熟路', '陕西南路', '一大会址·黄陂南路', '人民广场')
ORDER BY station_name, next_station;

-- 2. 检查1号线站点顺序
SELECT 
  '1号线站点顺序检查' as check_type,
  '检查站点ID和顺序' as focus;

SELECT 
  line,
  name as station_name,
  id,
  ROW_NUMBER() OVER (PARTITION BY line ORDER BY id) as station_order
FROM public.metrostations
WHERE line = '1号线'
  AND name IN ('莘庄', '外环路', '莲花路', '锦江乐园', '上海南站', '漕宝路', '上海体育馆', '徐家汇', '衡山路', '常熟路', '陕西南路', '一大会址·黄陂南路', '人民广场')
ORDER BY id;

-- 3. 检查徐家汇到人民广场的正确1号线路径
SELECT 
  '正确1号线路径检查' as check_type,
  '徐家汇到人民广场的1号线路径' as focus;

WITH line1_correct_path AS (
  SELECT unnest(ARRAY['徐家汇', '衡山路', '常熟路', '陕西南路', '一大会址·黄陂南路', '人民广场']) as station_name
)
SELECT 
  lp.station_name,
  mca.next_station,
  mca.travel_time,
  mca.line_info
FROM line1_correct_path lp
LEFT JOIN public.metro_complete_adjacency mca ON lp.station_name = mca.station_name
ORDER BY array_position(ARRAY['徐家汇', '衡山路', '常熟路', '陕西南路', '一大会址·黄陂南路', '人民广场'], lp.station_name);

-- 4. 问题分析
SELECT 
  '问题分析' as check_type,
  '当前问题：' as issue,
  '1. 徐家汇之后缺少衡山路站点' as problem1,
  '2. 1号线邻接关系不完整' as problem2,
  '3. 算法选择了错误的换乘路径' as problem3;

-- 5. 建议修复方案
SELECT 
  '修复建议' as check_type,
  '1. 检查metrostations表中1号线站点顺序' as suggestion1,
  '2. 修复metro_adjacency_view中1号线邻接关系' as suggestion2,
  '3. 确保1号线路径完整：徐家汇→衡山路→常熟路→陕西南路' as suggestion3;
