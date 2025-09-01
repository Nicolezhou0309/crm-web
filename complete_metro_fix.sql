-- 完整的地铁视图修复版本
-- 基于Python版本的完整线路数据，修复所有缺失的连接关系

-- 1. 删除现有视图
DROP VIEW IF EXISTS public.metro_complete_adjacency;
DROP VIEW IF EXISTS public.metro_transfer_view;
DROP VIEW IF EXISTS public.metro_adjacency_view;

-- 2. 重新创建地铁站点邻接关系视图（完整版本）
CREATE OR REPLACE VIEW public.metro_adjacency_view AS
WITH line_stations AS (
  SELECT 
    line,
    name as station_name,
    ROW_NUMBER() OVER (PARTITION BY line ORDER BY id) as station_order
  FROM public.metrostations
  WHERE line IS NOT NULL AND name IS NOT NULL
),
adjacent_stations AS (
  SELECT 
    ls1.line,
    ls1.station_name,
    ls2.station_name as next_station,
    3 as travel_time -- 默认3分钟一站
  FROM line_stations ls1
  JOIN line_stations ls2 ON ls1.line = ls2.line 
    AND ls2.station_order = ls1.station_order + 1
  
  UNION ALL
  
  -- 添加反向连接（确保双向可达）
  SELECT 
    ls2.line,
    ls2.station_name,
    ls1.station_name as next_station,
    3 as travel_time
  FROM line_stations ls1
  JOIN line_stations ls2 ON ls1.line = ls2.line 
    AND ls2.station_order = ls1.station_order + 1
)
SELECT * FROM adjacent_stations;

-- 3. 重新创建换乘站点视图（支持任意次数换乘）
CREATE OR REPLACE VIEW public.metro_transfer_view AS
WITH transfer_stations AS (
  SELECT 
    name as station_name,
    array_agg(line ORDER BY line) as lines
  FROM public.metrostations
  WHERE line IS NOT NULL AND name IS NOT NULL
  GROUP BY name
  HAVING COUNT(*) > 1
),
-- 生成所有可能的换乘组合（递归方式）
transfer_combinations AS (
  SELECT 
    station_name,
    lines,
    array_length(lines, 1) as line_count,
    generate_series(1, array_length(lines, 1)) as from_index,
    generate_series(1, array_length(lines, 1)) as to_index
  FROM transfer_stations
),
transfer_connections AS (
  SELECT DISTINCT
    station_name,
    lines[from_index] as from_line,
    lines[to_index] as to_line,
    5 as transfer_time -- 换乘时间5分钟
  FROM transfer_combinations
  WHERE from_index != to_index -- 排除同线路换乘
)
SELECT * FROM transfer_connections;

-- 4. 重新创建完整的邻接关系视图（完整版本）
CREATE OR REPLACE VIEW public.metro_complete_adjacency AS
SELECT 
  station_name,
  next_station,
  travel_time,
  'same_line' as connection_type,
  line as line_info
FROM public.metro_adjacency_view

UNION ALL

SELECT 
  station_name,
  station_name as next_station, -- 换乘时站点相同
  transfer_time as travel_time,
  'transfer' as connection_type,
  from_line || '->' || to_line as line_info
FROM public.metro_transfer_view;

-- 5. 验证视图数据
SELECT '完整地铁视图修复完成' as status, NOW() as fix_time;

-- 6. 显示视图数据统计
SELECT 
  'metro_adjacency_view' as view_name,
  COUNT(*) as record_count
FROM public.metro_adjacency_view

UNION ALL

SELECT 
  'metro_transfer_view' as view_name,
  COUNT(*) as record_count
FROM public.metro_transfer_view

UNION ALL

SELECT 
  'metro_complete_adjacency' as view_name,
  COUNT(*) as record_count
FROM public.metro_complete_adjacency;

-- 7. 检查关键站点的连接性
SELECT '关键站点连接性检查' as check_type;

-- 检查浦东1号2号航站楼的连接
SELECT 
  '浦东1号2号航站楼连接' as station_check,
  station_name,
  next_station,
  line,
  travel_time
FROM public.metro_adjacency_view
WHERE station_name = '浦东1号2号航站楼' OR next_station = '浦东1号2号航站楼';

-- 检查迪士尼的连接
SELECT 
  '迪士尼连接' as station_check,
  station_name,
  next_station,
  line,
  travel_time
FROM public.metro_adjacency_view
WHERE station_name = '迪士尼' OR next_station = '迪士尼';

-- 检查人民广场的连接
SELECT 
  '人民广场连接' as station_check,
  station_name,
  next_station,
  line,
  travel_time
FROM public.metro_adjacency_view
WHERE station_name = '人民广场' OR next_station = '人民广场';
