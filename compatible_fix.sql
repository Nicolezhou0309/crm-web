-- 兼容老版本PostgreSQL的修复版本
-- 不使用jsonb_set函数，使用传统的jsonb操作

-- 1. 强制删除函数（包括所有依赖）
DROP FUNCTION IF EXISTS public.dijkstra_metro_shortest_path(text, text) CASCADE;

-- 2. 重新创建函数（兼容版本）
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
  v_temp_stations text[];
  v_result_station text;
BEGIN
  -- 获取所有站点（使用临时数组避免列引用歧义）
  v_temp_stations := ARRAY[]::text[];
  
  -- 分别获取起始站和终点站，避免UNION的列引用歧义
  FOR v_station IN 
    SELECT DISTINCT mav.station_name 
    FROM public.metro_adjacency_view mav
  LOOP
    v_temp_stations := array_append(v_temp_stations, v_station);
  END LOOP;
  
  FOR v_station IN 
    SELECT DISTINCT mav.next_station 
    FROM public.metro_adjacency_view mav
    WHERE mav.next_station IS NOT NULL
  LOOP
    IF v_station != ALL(v_temp_stations) THEN
      v_temp_stations := array_append(v_temp_stations, v_station);
    END IF;
  END LOOP;
  
  v_stations := v_temp_stations;
  
  -- 初始化距离和前驱节点（使用兼容的jsonb操作）
  FOREACH v_station IN ARRAY v_stations
  LOOP
    v_distances := v_distances || jsonb_build_object(v_station, 999999);
    v_previous := v_previous || jsonb_build_object(v_station, NULL);
    v_line_infos := v_line_infos || jsonb_build_object(v_station, NULL);
    v_connection_types := v_connection_types || jsonb_build_object(v_station, NULL);
  END LOOP;
  
  -- 设置起始站距离为0（使用兼容的jsonb操作）
  v_distances := v_distances || jsonb_build_object(p_start_station, 0);
  
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
      
      -- 如果找到更短的路径，更新（使用兼容的jsonb操作）
      IF v_new_distance < (v_distances->>v_neighbor)::integer THEN
        v_distances := v_distances || jsonb_build_object(v_neighbor, v_new_distance);
        v_previous := v_previous || jsonb_build_object(v_neighbor, v_current_station);
        v_line_infos := v_line_infos || jsonb_build_object(v_neighbor, v_line_info);
        v_connection_types := v_connection_types || jsonb_build_object(v_neighbor, v_connection_type);
        
        -- 将邻居站点加入优先队列（如果不在队列中）
        IF v_neighbor != ALL(v_pq) THEN
          v_pq := array_append(v_pq, v_neighbor);
        END IF;
      END IF;
    END LOOP;
  END LOOP;
  
  -- 返回结果（使用完全不同的方法避免歧义）
  FOREACH v_result_station IN ARRAY v_stations
  LOOP
    IF (v_distances->>v_result_station)::integer < 999999 THEN
      station_name := v_result_station;
      distance := (v_distances->>v_result_station)::integer;
      previous_station := (v_previous->>v_result_station)::text;
      line_info := (v_line_infos->>v_result_station)::text;
      connection_type := (v_connection_types->>v_result_station)::text;
      RETURN NEXT;
    END IF;
  END LOOP;
  
  RETURN;
END;
$$ LANGUAGE plpgsql;

-- 3. 重新授予权限
GRANT EXECUTE ON FUNCTION public.dijkstra_metro_shortest_path(text, text) TO authenticated;

-- 4. 验证修复
SELECT 'Dijkstra函数兼容版本完成' as status, NOW() as fix_time;
