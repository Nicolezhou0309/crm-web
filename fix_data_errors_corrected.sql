-- 修复地铁数据中的错误连接关系
-- 解决算法生成不存在路径的问题
-- 注意：视图不能直接删除数据，需要重新创建

-- 1. 重新创建正确的metro_transfer_view，过滤掉错误的换乘关系
DROP VIEW IF EXISTS public.metro_transfer_view CASCADE;

CREATE OR REPLACE VIEW public.metro_transfer_view AS
WITH transfer_stations AS (
  -- 找出所有换乘站（同一站点名对应多条线路）
  SELECT 
    name as station_name,
    array_agg(line ORDER BY line) as lines
  FROM public.metrostations 
  WHERE name IS NOT NULL 
    AND line IS NOT NULL
    AND line != '未知'
    AND line != '非地铁'
  GROUP BY name
  HAVING COUNT(*) > 1
),
transfer_combinations AS (
  -- 生成所有可能的换乘组合
  SELECT 
    station_name,
    unnest(lines) as line1,
    unnest(lines) as line2
  FROM transfer_stations
  WHERE array_length(lines, 1) > 1
),
final_transfers AS (
  -- 过滤出有效的换乘组合（line1 != line2）
  SELECT DISTINCT
    station_name,
    LEAST(line1, line2) as line,
    GREATEST(line1, line2) as transfer_line
  FROM transfer_combinations
  WHERE line1 != line2
    -- 过滤掉已知错误的换乘关系
    AND NOT (station_name = '宜山路' AND (line1 = '1号线' OR line2 = '1号线'))
    AND NOT (station_name = '桂林路' AND (line1 = '4号线' OR line2 = '4号线'))
    AND NOT (station_name = '桂林公园' AND (line1 = '9号线' OR line2 = '9号线'))
)
SELECT 
  station_name,
  line,
  transfer_line
FROM final_transfers
ORDER BY station_name, line, transfer_line;

-- 2. 重新创建正确的metro_adjacency_view，确保连接关系正确
DROP VIEW IF EXISTS public.metro_adjacency_view CASCADE;

CREATE OR REPLACE VIEW public.metro_adjacency_view AS
WITH line_stations AS (
  -- 获取每条线路的站点，按ID排序确保正确的站点顺序
  SELECT 
    line,
    name as station_name,
    id,
    ROW_NUMBER() OVER (PARTITION BY line ORDER BY id) as station_order
  FROM public.metrostations
  WHERE line IS NOT NULL 
    AND name IS NOT NULL
    AND line != '未知'
    AND line != '非地铁'
),
adjacent_stations AS (
  -- 生成相邻站点的连接关系
  SELECT 
    ls1.line,
    ls1.station_name,
    ls2.station_name as next_station,
    3 as travel_time -- 默认3分钟一站
  FROM line_stations ls1
  JOIN line_stations ls2 ON ls1.line = ls2.line 
    AND ls2.station_order = ls1.station_order + 1
  
  UNION ALL
  
  -- 添加反向连接
  SELECT 
    ls2.line,
    ls2.station_name,
    ls1.station_name as next_station,
    3 as travel_time
  FROM line_stations ls1
  JOIN line_stations ls2 ON ls1.line = ls2.line 
    AND ls2.station_order = ls1.station_order + 1
)
SELECT * FROM adjacent_stations
ORDER BY line, station_name, next_station;

-- 3. 重新创建metro_complete_adjacency视图
DROP VIEW IF EXISTS public.metro_complete_adjacency CASCADE;

CREATE OR REPLACE VIEW public.metro_complete_adjacency AS
WITH same_line_connections AS (
  -- 同线路连接（从metro_adjacency_view）
  SELECT 
    station_name,
    next_station,
    travel_time,
    'same_line' as connection_type,
    line as line_info
  FROM public.metro_adjacency_view
),
transfer_connections AS (
  -- 换乘连接（从metro_transfer_view）
  SELECT 
    station_name,
    station_name as next_station, -- 换乘时站点相同
    2 as travel_time, -- 换乘时间降低到2分钟
    'transfer' as connection_type,
    line || '->' || transfer_line as line_info
  FROM public.metro_transfer_view
  
  UNION ALL
  
  -- 反向换乘
  SELECT 
    station_name,
    station_name as next_station,
    2 as travel_time,
    'transfer' as connection_type,
    transfer_line || '->' || line as line_info
  FROM public.metro_transfer_view
)
SELECT * FROM same_line_connections
UNION ALL
SELECT * FROM transfer_connections
ORDER BY station_name, next_station, connection_type;

-- 4. 授予权限
GRANT SELECT ON public.metro_transfer_view TO authenticated;
GRANT SELECT ON public.metro_transfer_view TO anon;
GRANT SELECT ON public.metro_adjacency_view TO authenticated;
GRANT SELECT ON public.metro_adjacency_view TO anon;
GRANT SELECT ON public.metro_complete_adjacency TO authenticated;
GRANT SELECT ON public.metro_complete_adjacency TO anon;

-- 5. 添加注释
COMMENT ON VIEW public.metro_transfer_view IS '地铁换乘关系视图（修复版）：显示所有换乘站的线路换乘关系，已过滤错误数据';
COMMENT ON VIEW public.metro_adjacency_view IS '地铁站点邻接关系视图（修复版）：显示每条线路上相邻站点的连接关系';
COMMENT ON VIEW public.metro_complete_adjacency IS '地铁完整邻接关系视图（修复版）：结合同线路连接和换乘连接，已过滤错误数据';

-- 6. 验证修复结果
SELECT 
  '数据错误修复完成' as status,
  NOW() as fix_time,
  '已重新创建所有视图，过滤掉错误的换乘关系，现在算法应该能找到正确的路径了' as message;

-- 7. 检查3号线从上海南站到中山公园的路径是否存在
WITH RECURSIVE path_search AS (
  -- 起始点：上海南站
  SELECT 
    station_name,
    next_station,
    line,
    ARRAY[station_name, next_station] as path,
    1 as depth
  FROM public.metro_adjacency_view
  WHERE line = '3号线' AND station_name = '上海南站'
  
  UNION ALL
  
  -- 递归查找路径
  SELECT 
    mav.station_name,
    mav.next_station,
    mav.line,
    ps.path || mav.next_station,
    ps.depth + 1
  FROM public.metro_adjacency_view mav
  JOIN path_search ps ON mav.station_name = ps.next_station
  WHERE mav.line = '3号线' 
    AND mav.next_station != ALL(ps.path) -- 避免循环
    AND ps.depth < 20 -- 限制深度
)
SELECT 
  '3号线路径验证' as check_type,
  path,
  depth,
  CASE 
    WHEN path[array_length(path, 1)] = '中山公园' THEN '✅ 找到到中山公园的路径'
    ELSE '⏳ 继续搜索'
  END as status
FROM path_search
WHERE path[array_length(path, 1)] = '中山公园'
ORDER BY depth
LIMIT 10;

-- 8. 验证换乘视图是否已过滤错误数据
SELECT 
  '换乘视图验证' as check_type,
  COUNT(*) as total_transfers,
  COUNT(DISTINCT station_name) as transfer_stations
FROM public.metro_transfer_view;

-- 9. 检查是否还有错误的换乘关系
SELECT 
  '错误换乘关系检查' as check_type,
  station_name,
  line,
  transfer_line
FROM public.metro_transfer_view 
WHERE (station_name = '宜山路' AND (line = '1号线' OR transfer_line = '1号线'))
   OR (station_name = '桂林路' AND (line = '4号线' OR transfer_line = '4号线'))
   OR (station_name = '桂林公园' AND (line = '9号线' OR transfer_line = '9号线'));
