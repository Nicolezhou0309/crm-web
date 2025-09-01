-- 创建缺失的metro_complete_adjacency视图
-- 这个视图是calculate_metro_commute_time函数所必需的

-- 1. 删除现有视图（如果存在）
DROP VIEW IF EXISTS public.metro_complete_adjacency CASCADE;

-- 2. 创建完整的邻接关系视图
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
    5 as travel_time, -- 换乘时间5分钟
    'transfer' as connection_type,
    line || '->' || transfer_line as line_info
  FROM public.metro_transfer_view
  
  UNION ALL
  
  -- 反向换乘
  SELECT 
    station_name,
    station_name as next_station,
    5 as travel_time,
    'transfer' as connection_type,
    transfer_line || '->' || line as line_info
  FROM public.metro_transfer_view
)
SELECT * FROM same_line_connections
UNION ALL
SELECT * FROM transfer_connections
ORDER BY station_name, next_station, connection_type;

-- 3. 授予权限
GRANT SELECT ON public.metro_complete_adjacency TO authenticated;
GRANT SELECT ON public.metro_complete_adjacency TO anon;

-- 4. 添加注释
COMMENT ON VIEW public.metro_complete_adjacency IS '地铁完整邻接关系视图：包含同线路连接和换乘连接';

-- 5. 验证视图创建
SELECT 
  '完整邻接视图状态检查' as check_type,
  COUNT(*) as total_connections,
  COUNT(DISTINCT station_name) as unique_stations,
  COUNT(DISTINCT CASE WHEN connection_type = 'same_line' THEN station_name END) as stations_with_same_line,
  COUNT(DISTINCT CASE WHEN connection_type = 'transfer' THEN station_name END) as stations_with_transfers
FROM public.metro_complete_adjacency;

-- 6. 显示一些示例数据
SELECT 
  '示例数据' as check_type,
  station_name,
  next_station,
  travel_time,
  connection_type,
  line_info
FROM public.metro_complete_adjacency 
WHERE station_name IN ('静安寺', '人民广场', '顾村公园')
ORDER BY station_name, connection_type, next_station
LIMIT 20;

-- 7. 检查换乘连接
SELECT 
  '换乘连接检查' as check_type,
  station_name,
  COUNT(*) as transfer_connections_count
FROM public.metro_complete_adjacency 
WHERE connection_type = 'transfer'
GROUP BY station_name
ORDER BY COUNT(*) DESC
LIMIT 10;

-- 8. 检查同线路连接
SELECT 
  '同线路连接检查' as check_type,
  COUNT(*) as same_line_connections_count
FROM public.metro_complete_adjacency 
WHERE connection_type = 'same_line';

-- 9. 总结
SELECT 
  '视图创建完成' as status,
  NOW() as create_time,
  'metro_complete_adjacency视图已创建，calculate_metro_commute_time函数应该可以正常工作了' as message;
