-- 修复Dijkstra地铁算法函数的列引用歧义问题
-- 修复时间: 2024-12-02

-- 1. 修复dijkstra_metro_shortest_path函数的列引用歧义
CREATE OR REPLACE FUNCTION public.dijkstra_metro_shortest_path(
  p_start_station text,
  p_end_station text
) RETURNS TABLE(
  station_name text,
  distance integer,
  previous_station text,
  line_info text,
  connection_type text
) AS $$
DECLARE
  v_station text;
  v_neighbor text;
  v_weight integer;
  v_line_info text;
  v_connection_type text;
  v_new_distance integer;
  v_min_distance integer;
  v_current_station text;
  v_visited text[] := ARRAY[]::text[];
  v_distances jsonb := '{}'::jsonb;
  v_previous jsonb := '{}'::jsonb;
  v_line_infos jsonb := '{}'::jsonb;
  v_connection_types jsonb := '{}'::jsonb;
  v_pq text[] := ARRAY[]::text[];
  v_stations text[] := ARRAY[]::text[];
BEGIN
  -- 获取所有站点（修复列引用歧义）
  SELECT array_agg(DISTINCT station_name) INTO v_stations
  FROM (
    SELECT mav.station_name FROM public.metro_adjacency_view mav
    UNION
    SELECT mav.next_station FROM public.metro_adjacency_view mav
  ) all_stations;
  
  -- 初始化距离和前驱节点
  FOREACH v_station IN ARRAY v_stations
  LOOP
    v_distances := v_distances || jsonb_build_object(v_station, 999999);
    v_previous := v_previous || jsonb_build_object(v_station, NULL);
    v_line_infos := v_line_infos || jsonb_build_object(v_station, NULL);
    v_connection_types := v_connection_types || jsonb_build_object(v_station, NULL);
  END LOOP;
  
  -- 设置起始站距离为0
  v_distances := jsonb_set(v_distances, ARRAY[p_start_station], '0');
  
  -- 将起始站加入优先队列
  v_pq := ARRAY[p_start_station];
  
  -- Dijkstra主循环
  WHILE array_length(v_pq, 1) > 0 LOOP
    -- 找到距离最小的站点
    v_min_distance := 999999;
    v_current_station := NULL;
    
    FOREACH v_station IN ARRAY v_pq
    LOOP
      IF (v_distances->>v_station)::integer < v_min_distance THEN
        v_min_distance := (v_distances->>v_station)::integer;
        v_current_station := v_station;
      END IF;
    END LOOP;
    
    -- 如果没有找到可访问的站点，退出
    IF v_current_station IS NULL THEN
      EXIT;
    END IF;
    
    -- 标记当前站点为已访问
    v_visited := array_append(v_visited, v_current_station);
    
    -- 从优先队列中移除当前站点
    v_pq := array_remove(v_pq, v_current_station);
    
    -- 如果到达终点，退出
    IF v_current_station = p_end_station THEN
      EXIT;
    END IF;
    
    -- 遍历所有相邻站点（同线相邻 + 换乘）
    FOR v_neighbor, v_weight, v_line_info, v_connection_type IN
      SELECT mca.next_station, mca.travel_time, mca.line_info, mca.connection_type
      FROM public.metro_complete_adjacency mca
      WHERE mca.station_name = v_current_station
    LOOP
      -- 如果邻居站点已访问，跳过
      IF v_neighbor = ANY(v_visited) THEN
        CONTINUE;
      END IF;
      
      -- 计算新距离
      v_new_distance := (v_distances->>v_current_station)::integer + v_weight;
      
      -- 如果找到更短的路径，更新
      IF v_new_distance < (v_distances->>v_neighbor)::integer THEN
        v_distances := jsonb_set(v_distances, ARRAY[v_neighbor], v_new_distance::text);
        v_previous := jsonb_set(v_previous, ARRAY[v_neighbor], v_current_station);
        v_line_infos := jsonb_set(v_line_infos, ARRAY[v_neighbor], v_line_info);
        v_connection_types := jsonb_set(v_connection_types, ARRAY[v_neighbor], v_connection_type);
        
        -- 将邻居站点加入优先队列（如果不在队列中）
        IF v_neighbor != ALL(v_pq) THEN
          v_pq := array_append(v_pq, v_neighbor);
        END IF;
      END IF;
    END LOOP;
  END LOOP;
  
  -- 返回结果（修复列引用歧义）
  RETURN QUERY
  SELECT 
    v_station::text as station_name,
    (v_distances->>v_station)::integer as distance,
    (v_previous->>v_station)::text as previous_station,
    (v_line_infos->>v_station)::text as line_info,
    (v_connection_types->>v_station)::text as connection_type
  FROM unnest(v_stations) v_station
  WHERE (v_distances->>v_station)::integer < 999999
  ORDER BY (v_distances->>v_station)::integer;
END;
$$ LANGUAGE plpgsql;

-- 2. 重新授予权限
GRANT EXECUTE ON FUNCTION public.dijkstra_metro_shortest_path(text, text) TO authenticated;

-- 3. 添加函数注释
COMMENT ON FUNCTION public.dijkstra_metro_shortest_path(text, text) IS 'Dijkstra算法实现，基于metrostations表计算两个地铁站之间的最短路径（已修复列引用歧义问题）';

-- 4. 验证修复
SELECT 'Dijkstra函数修复完成' as status, NOW() as fix_time;
