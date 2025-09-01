-- 修复地铁视图中的列引用歧义问题
-- 修复时间: 2024-12-02

-- 1. 删除有问题的视图
DROP VIEW IF EXISTS public.metro_complete_adjacency;
DROP VIEW IF EXISTS public.metro_transfer_view;
DROP VIEW IF EXISTS public.metro_adjacency_view;

-- 2. 重新创建metro_adjacency_view视图（修复列引用歧义）
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
)
SELECT * FROM adjacent_stations;

-- 3. 重新创建metro_transfer_view视图（修复列引用歧义）
CREATE OR REPLACE VIEW public.metro_transfer_view AS
WITH transfer_stations AS (
  SELECT 
    name as station_name,
    array_agg(line) as lines
  FROM public.metrostations
  WHERE line IS NOT NULL AND name IS NOT NULL
  GROUP BY name
  HAVING COUNT(*) > 1
),
transfer_connections AS (
  SELECT 
    ts1.station_name,
    ts1.lines[1] as from_line,
    ts1.lines[2] as to_line,
    5 as transfer_time -- 换乘时间5分钟
  FROM transfer_stations ts1
  WHERE array_length(ts1.lines, 1) >= 2
  
  UNION ALL
  
  SELECT 
    ts2.station_name,
    ts2.lines[2] as from_line,
    ts2.lines[1] as to_line,
    5 as transfer_time
  FROM transfer_stations ts2
  WHERE array_length(ts2.lines, 1) >= 2
)
SELECT * FROM transfer_connections;

-- 4. 重新创建metro_complete_adjacency视图（修复列引用歧义）
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

-- 5. 添加视图注释
COMMENT ON VIEW public.metro_adjacency_view IS '地铁站点邻接关系视图，基于metrostations表构建同线相邻站点关系（已修复列引用歧义）';
COMMENT ON VIEW public.metro_transfer_view IS '地铁换乘站点视图，识别同一站点在不同线路上的换乘关系（已修复列引用歧义）';
COMMENT ON VIEW public.metro_complete_adjacency IS '完整的地铁邻接关系视图，包含同线相邻站点和换乘站点（已修复列引用歧义）';

-- 6. 验证修复
SELECT '地铁视图修复完成' as status, NOW() as fix_time;
