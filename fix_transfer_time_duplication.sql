-- 修复换乘时间重复计算问题
-- 避免多线路换乘点多次计算换乘惩罚

-- 1. 删除现有函数
DROP FUNCTION IF EXISTS public.dijkstra_metro_shortest_path(text, text) CASCADE;

-- 2. 创建修复后的Dijkstra函数
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
  v_current_line text;
  v_visited text[] := ARRAY[]::text[];
  v_pq text[] := ARRAY[]::text[];
  v_stations text[] := ARRAY[]::text[];
  v_path_stations text[] := ARRAY[]::text[];
  v_current_path_station text;
  v_transfer_penalty integer := 10; -- 换乘惩罚时间（分钟）
  v_has_transfer boolean := false; -- 标记是否已经计算过换乘惩罚
BEGIN
  -- 创建临时表来存储距离和前驱节点信息
  CREATE TEMP TABLE temp_dijkstra_data (
    station_name text PRIMARY KEY,
    distance integer DEFAULT 999999,
    previous_station text,
    line_info text,
    connection_type text,
    has_transfer_penalty boolean DEFAULT false -- 新增：标记是否已经计算过换乘惩罚
  );
  
  -- 获取所有唯一的站点名（避免重复站点名导致的主键冲突）
  SELECT array_agg(DISTINCT name) INTO v_stations
  FROM public.metrostations
  WHERE name IS NOT NULL;
  
  -- 初始化临时表（使用DISTINCT避免重复站点名）
  INSERT INTO temp_dijkstra_data (station_name, distance, previous_station, line_info, connection_type, has_transfer_penalty)
  SELECT DISTINCT name, 999999, NULL, NULL, NULL, false
  FROM public.metrostations
  WHERE name IS NOT NULL;
  
  -- 设置起始站距离为0
  UPDATE temp_dijkstra_data 
  SET distance = 0 
  WHERE temp_dijkstra_data.station_name = p_start_station;
  
  v_pq := ARRAY[p_start_station];
  v_current_line := NULL; -- 初始化当前线路
  
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
    
    -- 获取当前站点的线路信息
    SELECT temp_dijkstra_data.line_info INTO v_current_line
    FROM temp_dijkstra_data
    WHERE temp_dijkstra_data.station_name = v_current_station;
    
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
      
      -- 关键修复：避免重复计算换乘惩罚
      v_has_transfer := false;
      
      -- 检查是否涉及换乘
      IF v_current_line IS NOT NULL AND v_current_line != v_line_info THEN
        -- 检查是否已经计算过换乘惩罚（避免重复计算）
        SELECT has_transfer_penalty INTO v_has_transfer
        FROM temp_dijkstra_data
        WHERE temp_dijkstra_data.station_name = v_neighbor;
        
        -- 只有在没有计算过换乘惩罚时才添加
        IF NOT v_has_transfer THEN
          v_new_distance := v_new_distance + v_transfer_penalty;
        END IF;
      END IF;
      
      -- 如果找到更短的路径，更新
      IF v_new_distance < (SELECT temp_dijkstra_data.distance FROM temp_dijkstra_data WHERE temp_dijkstra_data.station_name = v_neighbor) THEN
        UPDATE temp_dijkstra_data 
        SET 
          distance = v_new_distance,
          previous_station = v_current_station,
          line_info = v_line_info,
          connection_type = v_connection_type,
          has_transfer_penalty = (v_current_line IS NOT NULL AND v_current_line != v_line_info) -- 标记是否计算过换乘惩罚
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

-- 3. 授予权限
GRANT EXECUTE ON FUNCTION public.dijkstra_metro_shortest_path(text, text) TO authenticated;

-- 4. 验证修复结果
SELECT 
  '换乘时间重复计算修复完成' as status,
  NOW() as fix_time,
  '已避免重复计算换乘惩罚，时间计算应该更准确' as message;

-- 5. 测试修复后的算法
SELECT 
  '测试修复后的算法' as check_type,
  '银都路到陕西南路' as route;

-- 调用修复后的Dijkstra函数测试
SELECT 
  station_name,
  distance,
  previous_station,
  line_info,
  connection_type
FROM public.dijkstra_metro_shortest_path('银都路', '陕西南路')
ORDER BY distance;

-- 6. 验证时间计算
SELECT 
  '时间计算验证' as check_type,
  '检查终点站陕西南路的距离值' as focus;

SELECT 
  station_name,
  distance,
  previous_station,
  line_info
FROM public.dijkstra_metro_shortest_path('银都路', '陕西南路')
WHERE station_name = '陕西南路';

-- 7. 预期结果说明
SELECT 
  '预期结果' as check_type,
  '修复前：陕西南路距离46分钟（换乘惩罚被重复计算）' as before_fix,
  '修复后：陕西南路距离应该接近44分钟' as after_fix,
  '减少的时间：换乘惩罚不再重复计算' as improvement;