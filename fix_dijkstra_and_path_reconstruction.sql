-- 修复后的两个主要算法
-- 1. 修复Dijkstra算法只返回最短路径上的站点
-- 2. 修复路径重建算法在重建时检测换乘信息

-- 1. 首先修复metro_complete_adjacency视图，移除换乘连接
DROP VIEW IF EXISTS public.metro_complete_adjacency CASCADE;

CREATE OR REPLACE VIEW public.metro_complete_adjacency AS
-- 只包含同线路连接，不包含换乘连接（像Python版本一样）
SELECT 
  station_name,
  next_station,
  travel_time,
  'same_line' as connection_type,
  line as line_info
FROM public.metro_adjacency_view
ORDER BY station_name, next_station;

-- 2. 修复Dijkstra算法，确保只返回最短路径上的站点
DROP FUNCTION IF EXISTS public.dijkstra_metro_shortest_path(text, text) CASCADE;

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
  v_pq text[] := ARRAY[]::text[];
  v_stations text[] := ARRAY[]::text[];
  v_path_stations text[] := ARRAY[]::text[];
  v_current_path_station text;
BEGIN
  -- 创建临时表来存储距离和前驱节点信息
  CREATE TEMP TABLE temp_dijkstra_data (
    station_name text PRIMARY KEY,
    distance integer DEFAULT 999999,
    previous_station text,
    line_info text,
    connection_type text
  );
  
  -- 获取所有唯一的站点名（避免重复站点名导致的主键冲突）
  SELECT array_agg(DISTINCT name) INTO v_stations
  FROM public.metrostations
  WHERE name IS NOT NULL;
  
  -- 初始化临时表（使用DISTINCT避免重复站点名）
  INSERT INTO temp_dijkstra_data (station_name, distance, previous_station, line_info, connection_type)
  SELECT DISTINCT name, 999999, NULL, NULL, NULL
  FROM public.metrostations
  WHERE name IS NOT NULL;
  
  -- 设置起始站距离为0
  UPDATE temp_dijkstra_data 
  SET distance = 0 
  WHERE temp_dijkstra_data.station_name = p_start_station;
  
  v_pq := ARRAY[p_start_station];
  
  -- Dijkstra主循环
  WHILE array_length(v_pq, 1) > 0 LOOP
    -- 找到距离最小的站点
    SELECT temp_dijkstra_data.station_name, temp_dijkstra_data.distance 
    INTO v_current_station, v_min_distance
    FROM temp_dijkstra_data 
    WHERE temp_dijkstra_data.station_name = ANY(v_pq) 
      AND temp_dijkstra_data.distance < 999999
    ORDER BY temp_dijkstra_data.distance 
    LIMIT 1;
    
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
    
    -- 遍历所有相邻站点（只考虑同线路连接）
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
      SELECT temp_dijkstra_data.distance INTO v_new_distance
      FROM temp_dijkstra_data
      WHERE temp_dijkstra_data.station_name = v_current_station;
      
      v_new_distance := v_new_distance + v_weight;
      
      -- 如果找到更短的路径，更新
      IF v_new_distance < (SELECT temp_dijkstra_data.distance FROM temp_dijkstra_data WHERE temp_dijkstra_data.station_name = v_neighbor) THEN
        UPDATE temp_dijkstra_data 
        SET 
          distance = v_new_distance,
          previous_station = v_current_station,
          line_info = v_line_info,
          connection_type = v_connection_type
        WHERE temp_dijkstra_data.station_name = v_neighbor;
        
        -- 将邻居站点加入优先队列（如果不在队列中）
        IF v_neighbor != ALL(v_pq) THEN
          v_pq := array_append(v_pq, v_neighbor);
        END IF;
      END IF;
    END LOOP;
  END LOOP;
  
  -- 重建最短路径上的站点（关键修复：只返回路径上的站点）
  v_current_path_station := p_end_station;
  WHILE v_current_path_station IS NOT NULL LOOP
    v_path_stations := array_prepend(v_current_path_station, v_path_stations);
    SELECT temp_dijkstra_data.previous_station INTO v_current_path_station
    FROM temp_dijkstra_data
    WHERE temp_dijkstra_data.station_name = v_current_path_station;
  END LOOP;
  
  -- 返回结果（只返回最短路径上的站点）
  RETURN QUERY
  SELECT 
    tdd.station_name,
    tdd.distance,
    tdd.previous_station,
    tdd.line_info,
    tdd.connection_type
  FROM temp_dijkstra_data tdd
  WHERE tdd.station_name = ANY(v_path_stations)
    AND tdd.distance < 999999
  ORDER BY array_position(v_path_stations, tdd.station_name);
  
  -- 清理临时表
  DROP TABLE temp_dijkstra_data;
END;
$$ LANGUAGE plpgsql;

-- 3. 修复路径重建算法，在重建时检测换乘信息（像Python版本一样）
CREATE OR REPLACE FUNCTION public.reconstruct_metro_path_with_transfers(
  p_start_station text,
  p_end_station text
) RETURNS jsonb AS $$
DECLARE
  v_result jsonb;
  v_path text[] := ARRAY[]::text[];
  v_transfers jsonb := '[]'::jsonb;
  v_current_station text;
  v_current_line text;
  v_found_line text;
  v_station_line_info record;
  v_i integer;
BEGIN
  -- 获取Dijkstra算法计算的最短路径
  FOR v_station_line_info IN
    SELECT 
      station_name,
      distance,
      previous_station,
      line_info
    FROM public.dijkstra_metro_shortest_path(p_start_station, p_end_station)
    ORDER BY distance
  LOOP
    v_path := array_append(v_path, v_station_line_info.station_name);
  END LOOP;
  
  -- 分析换乘信息（像Python版本一样）
  v_current_line := NULL;
  FOR v_i IN 1..array_length(v_path, 1) - 1 LOOP
    v_current_station := v_path[v_i];
    v_found_line := NULL;
    
    -- 尝试从站点推断线路（检查相邻站点是否在同一条线路上）
    SELECT m.line INTO v_found_line
    FROM public.metrostations m
    WHERE m.name = v_current_station
      AND m.line IN (
        SELECT m2.line 
        FROM public.metrostations m2
        WHERE m2.name = v_path[v_i + 1]
      )
    LIMIT 1;
    
    IF v_found_line IS NOT NULL THEN
      IF v_current_line IS NOT NULL AND v_current_line != v_found_line THEN
        -- 发现换乘
        v_transfers := v_transfers || jsonb_build_object(
          'station', v_current_station,
          'from_line', v_current_line,
          'to_line', v_found_line
        );
      END IF;
      v_current_line := v_found_line;
    END IF;
  END LOOP;
  
  -- 构建结果（修复array_length函数使用）
  v_result := jsonb_build_object(
    'success', true,
    'path', v_path,
    'transfers', v_transfers,
    'transfer_count', jsonb_array_length(v_transfers), -- 修复：使用jsonb_array_length
    'total_stations', array_length(v_path, 1), -- 修复：使用array_length用于数组
    'total_time_minutes', (SELECT distance FROM public.dijkstra_metro_shortest_path(p_start_station, p_end_station) WHERE station_name = p_end_station)
  );
  
  RETURN v_result;
END;
$$ LANGUAGE plpgsql;

-- 4. 授予权限
GRANT SELECT ON public.metro_complete_adjacency TO authenticated;
GRANT SELECT ON public.metro_complete_adjacency TO anon;
GRANT EXECUTE ON FUNCTION public.dijkstra_metro_shortest_path(text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.reconstruct_metro_path_with_transfers(text, text) TO authenticated;

-- 5. 验证修复结果
SELECT 
  '算法修复完成' as status,
  NOW() as fix_time,
  '已修复Dijkstra算法和路径重建算法' as message;

-- 6. 测试修复后的算法
SELECT 
  '测试修复后的算法' as check_type,
  '莘庄到人民广场' as route;

-- 测试Dijkstra算法
SELECT 
  'Dijkstra算法结果' as test_type,
  station_name,
  distance,
  previous_station,
  line_info
FROM public.dijkstra_metro_shortest_path('莘庄', '人民广场')
ORDER BY distance;

-- 测试路径重建算法
SELECT 
  '路径重建算法结果' as test_type,
  jsonb_pretty(reconstruct_metro_path_with_transfers('莘庄', '人民广场')) as result;

-- 7. 预期结果说明
SELECT 
  '预期结果' as check_type,
  '1号线直达路径: 13站，36分钟' as expected_path,
  'Dijkstra只返回路径上的站点' as dijkstra_behavior,
  '路径重建时检测换乘信息' as path_reconstruction_behavior;