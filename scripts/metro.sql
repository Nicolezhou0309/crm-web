CREATE OR REPLACE FUNCTION public.calculate_metro_commute_time(p_start_station text, p_end_station text)
 RETURNS jsonb
 LANGUAGE plpgsql
AS $function$
DECLARE
  v_result jsonb;
  v_path text[] := ARRAY[]::text[];
  v_transfers jsonb := '[]'::jsonb;
  v_total_time integer;
  v_stations_count integer;
  v_transfer_count integer;
  v_common_line text;
  v_dijkstra_result record;
  v_current_station text;
  v_path_records record;
BEGIN
  -- 检查站点是否存在
  IF NOT EXISTS (SELECT 1 FROM public.metrostations WHERE name = p_start_station) THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', '起始站不存在: ' || p_start_station
    );
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM public.metrostations WHERE name = p_end_station) THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', '终点站不存在: ' || p_end_station
    );
  END IF;
  
  -- 如果起始站和终点站相同
  IF p_start_station = p_end_station THEN
    RETURN jsonb_build_object(
      'success', true,
      'start_station', p_start_station,
      'end_station', p_end_station,
      'total_time_minutes', 0,
      'total_time_formatted', '0分钟',
      'stations_count', 0,
      'path', '[]'::jsonb,
      'transfers', '[]'::jsonb,
      'transfer_count', 0,
      'route_summary', '无需移动'
    );
  END IF;
  
  -- 检查是否有共同线路
  SELECT m1.line INTO v_common_line
  FROM public.metrostations m1
  JOIN public.metrostations m2 ON m1.line = m2.line
  WHERE m1.name = p_start_station 
    AND m2.name = p_end_station
  LIMIT 1;
  
  -- 获取dijkstra结果
  SELECT * INTO v_dijkstra_result
  FROM public.dijkstra_metro_shortest_path(p_start_station, p_end_station) dms
  WHERE dms.station_name = p_end_station;
  
  -- 重建路径
  v_current_station := p_end_station;
  WHILE v_current_station IS NOT NULL LOOP
    v_path := array_prepend(v_current_station, v_path);
    
    SELECT 
      dms.previous_station,
      dms.line_info,
      dms.connection_type
    INTO v_path_records
    FROM public.dijkstra_metro_shortest_path(p_start_station, p_end_station) dms
    WHERE dms.station_name = v_current_station;
    
    v_current_station := v_path_records.previous_station;
  END LOOP;
  
  -- 关键修复：如果有共同线路，检查是否真的可以直达
  IF v_common_line IS NOT NULL THEN
    -- 检查路径中是否所有站点都在共同线路上
    FOR i IN 1..array_length(v_path, 1) LOOP
      IF NOT EXISTS (
        SELECT 1 FROM public.metrostations 
        WHERE name = v_path[i] AND line = v_common_line
      ) THEN
        -- 发现不在共同线路上的站点，说明需要换乘
        -- 分析实际换乘
        v_transfers := public.analyze_actual_transfers(v_path);
        EXIT;
      END IF;
    END LOOP;
    
    -- 如果所有站点都在共同线路上，说明是直达
    IF jsonb_array_length(v_transfers) = 0 THEN
      v_transfers := '[]'::jsonb;
    END IF;
  ELSE
    -- 没有共同线路，分析换乘
    v_transfers := public.analyze_actual_transfers(v_path);
  END IF;
  
  -- 关键修复：避免重复计算换乘时间
  v_transfer_count := jsonb_array_length(v_transfers);
  v_stations_count := array_length(v_path, 1) - 1;
  
  -- 修复前的问题代码（注释掉）：
  -- v_total_time := v_dijkstra_result.distance + (v_transfer_count * 5);
  
  -- 修复后的时间计算逻辑：
  -- 只使用Dijkstra的距离，因为Dijkstra已经包含了换乘惩罚
  v_total_time := v_dijkstra_result.distance;
  
  -- 验证时间计算的合理性
  IF v_total_time <= 0 OR v_total_time > 999999 THEN
    -- 如果Dijkstra返回的时间异常，使用备选计算方式
    v_total_time := (v_stations_count * 3) + (v_transfer_count * 5);
  END IF;
  
  -- 生成结果
  v_result := jsonb_build_object(
    'success', true,
    'start_station', p_start_station,
    'end_station', p_end_station,
    'total_time_minutes', v_total_time,
    'total_time_formatted', v_total_time || '分钟',
    'stations_count', v_stations_count,
    'path', v_path,
    'transfers', v_transfers,
    'transfer_count', v_transfer_count,
    'route_summary', public.generate_metro_route_summary(p_start_station, p_end_station, v_path, v_transfers)
  );
  
  RETURN v_result;
END;
$function$

CREATE OR REPLACE FUNCTION public.dijkstra_metro_shortest_path(p_start_station text, p_end_station text)
 RETURNS TABLE(station_name text, distance integer, previous_station text, line_info text, connection_type text)
 LANGUAGE plpgsql
AS $function$
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
$function$

CREATE OR REPLACE FUNCTION public.generate_metro_route_summary(p_start_station text, p_end_station text, p_path text[], p_transfers jsonb)
 RETURNS text
 LANGUAGE plpgsql
AS $function$
DECLARE
  v_summary text;
  v_common_line text;
BEGIN
  -- 找到起始站和终点站的共同线路
  SELECT m1.line INTO v_common_line
  FROM public.metrostations m1
  JOIN public.metrostations m2 ON m1.line = m2.line
  WHERE m1.name = p_start_station 
    AND m2.name = p_end_station
  LIMIT 1;
  
  -- 如果有共同线路，检查是否真的可以直达
  IF v_common_line IS NOT NULL THEN
    -- 检查路径中是否所有站点都在共同线路上
    FOR i IN 1..array_length(p_path, 1) LOOP
      IF NOT EXISTS (
        SELECT 1 FROM public.metrostations 
        WHERE name = p_path[i] AND line = v_common_line
      ) THEN
        -- 发现不在共同线路上的站点，说明需要换乘
        -- 使用传入的换乘信息生成摘要
        RETURN public.generate_transfer_summary(p_start_station, p_end_station, p_transfers);
      END IF;
    END LOOP;
    
    -- 所有站点都在共同线路上，说明是直达
    RETURN '从 ' || p_start_station || ' 乘坐' || v_common_line || '到 ' || p_end_station || '，无需换乘';
  END IF;
  
  -- 没有共同线路，使用传入的换乘信息
  RETURN public.generate_transfer_summary(p_start_station, p_end_station, p_transfers);
END;
$function$

CREATE OR REPLACE FUNCTION public.get_metrostations()
 RETURNS TABLE(line text, name text)
 LANGUAGE plpgsql
AS $function$
BEGIN
  RETURN QUERY
  SELECT 
    ms.line,
    ms.name
  FROM public.metrostations ms
  ORDER BY 
    -- 按线路名称的自然排序，确保1号线、2号线、3号线等按顺序
    CASE 
      WHEN ms.line ~ '^[0-9]+号线$' THEN 
        -- 提取数字部分进行排序
        (regexp_replace(ms.line, '[^0-9]', '', 'g'))::integer
      ELSE 
        -- 非数字线路排在后面
        999999
    END,
    ms.line,
    -- 保持站点在数据库中的原有顺序（地理顺序），不按字母排序
    ms.id;
END;
$function$

CREATE OR REPLACE FUNCTION public.reconstruct_metro_path_with_transfers(p_start_station text, p_end_station text)
 RETURNS jsonb
 LANGUAGE plpgsql
AS $function$
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
$function$

CREATE OR REPLACE FUNCTION public.batch_calculate_community_commute_times(p_worklocation text, p_followup_id uuid)
 RETURNS void
 LANGUAGE plpgsql
AS $function$
DECLARE
  rec RECORD;
  commute_result jsonb;
  commute_times jsonb := '{}'::jsonb;
BEGIN
  -- 遍历所有社区，计算通勤时间
  FOR rec IN 
    SELECT community, metrostation 
    FROM public.community_keywords 
    WHERE metrostation IS NOT NULL
  LOOP
    -- 计算通勤时间
    commute_result := public.calculate_metro_commute_time(p_worklocation, rec.metrostation);
    
    -- 如果计算成功，提取通勤时间
    IF commute_result->>'success' = 'true' THEN
      commute_times := commute_times || jsonb_build_object(
        rec.community, 
        (commute_result->>'total_time_minutes')::integer
      );
    ELSE
      -- 计算失败，使用默认值
      commute_times := commute_times || jsonb_build_object(rec.community, 999);
    END IF;
  END LOOP;
  
  -- 保存到followups表的extended_data字段
  UPDATE public.followups 
  SET 
    extended_data = jsonb_set(
      COALESCE(extended_data, '{}'::jsonb),
      '{commute_times}',
      commute_times
    ),
    updated_at = NOW()
  WHERE id = p_followup_id;
  
  RAISE NOTICE 'Calculated commute times for followup %: %', p_followup_id, commute_times;
END;
$function$

CREATE OR REPLACE FUNCTION public.calculate_commute_times_for_worklocation(p_followup_id uuid, p_worklocation text)
 RETURNS jsonb
 LANGUAGE plpgsql
AS $function$
DECLARE
    v_error_message text;
    v_commute_times jsonb;
    v_communities_count integer;
    v_result jsonb;
BEGIN
    -- 验证参数
    IF p_followup_id IS NULL OR p_worklocation IS NULL OR p_worklocation = '' THEN
        RETURN jsonb_build_object(
            'success', false,
            'error', 'Invalid parameters: followup_id and worklocation are required'
        );
    END IF;
    
    RAISE NOTICE '🚀 开始计算通勤时间: % (followup: %)', p_worklocation, p_followup_id;
    
    BEGIN
        -- 检查批量计算函数是否存在
        IF NOT EXISTS (
            SELECT 1 FROM pg_proc 
            WHERE proname = 'batch_calculate_community_commute_times'
        ) THEN
            RETURN jsonb_build_object(
                'success', false,
                'error', '批量计算函数 batch_calculate_community_commute_times 不存在'
            );
        END IF;
        
        -- 检查是否有社区数据
        SELECT COUNT(*) INTO v_communities_count
        FROM public.community_keywords 
        WHERE metrostation IS NOT NULL;
        
        IF v_communities_count = 0 THEN
            RAISE NOTICE '⚠️ 没有找到社区数据，跳过通勤时间计算';
            RETURN jsonb_build_object(
                'success', true,
                'message', '没有找到社区数据，跳过通勤时间计算',
                'communities_count', 0
            );
        END IF;
        
        RAISE NOTICE '📊 找到 % 个社区，开始计算通勤时间...', v_communities_count;
        
        -- 调用批量计算通勤时间函数
        PERFORM public.batch_calculate_community_commute_times(p_worklocation, p_followup_id);
        
        -- 验证计算结果
        SELECT extended_data->>'commute_times' INTO v_commute_times
        FROM public.followups 
        WHERE id = p_followup_id;
        
        IF v_commute_times IS NOT NULL THEN
            RAISE NOTICE '✅ 通勤时间计算成功！已保存到 extended_data.commute_times';
            RAISE NOTICE '📊 通勤时间数据: %', v_commute_times;
            
            RETURN jsonb_build_object(
                'success', true,
                'message', '通勤时间计算成功',
                'commute_times', v_commute_times,
                'communities_count', v_communities_count
            );
        ELSE
            RAISE WARNING '⚠️ 通勤时间计算可能失败，extended_data.commute_times 为空';
            RETURN jsonb_build_object(
                'success', false,
                'error', '通勤时间计算可能失败，extended_data.commute_times 为空'
            );
        END IF;
        
    EXCEPTION WHEN OTHERS THEN
        -- 捕获所有错误，记录但不中断函数执行
        v_error_message := SQLERRM;
        RAISE WARNING '❌ 通勤时间计算失败: %', v_error_message;
        
        RETURN jsonb_build_object(
            'success', false,
            'error', v_error_message
        );
    END;
END;
$function$

