-- 上海地铁Dijkstra算法实现（基于metrostations表）
-- 创建时间: 2024-12-02
-- 描述: 直接基于metrostations表实现Dijkstra最短路径算法，计算地铁通勤时间

-- 1. 创建地铁站点邻接关系视图（直接从metrostations表推导）
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

-- 2. 创建换乘站点视图（同一站点在不同线路上的连接）
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

-- 3. 创建完整的邻接关系视图（包含同线相邻站点和换乘站点）
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

-- 4. 创建Dijkstra算法的核心函数
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
  
  -- 返回结果
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


-- 5. 创建路线摘要生成函数（提前定义，避免依赖问题）
CREATE OR REPLACE FUNCTION public.generate_metro_route_summary(
  p_start_station text,
  p_end_station text,
  p_path text[],
  p_transfers jsonb
) RETURNS text AS $$
DECLARE
  v_summary text;
  v_start_line text;
  v_end_line text;
  v_transfer_info jsonb;
  v_i integer;
BEGIN
  -- 如果没有换乘
  IF jsonb_array_length(p_transfers) = 0 THEN
    -- 找到起始站和终点站所在的线路
    SELECT line INTO v_start_line
    FROM public.metrostations
    WHERE name = p_start_station
    LIMIT 1;
    
    SELECT line INTO v_end_line
    FROM public.metrostations
    WHERE name = p_end_station
    LIMIT 1;
    
    IF v_start_line = v_end_line THEN
      v_summary := '从 ' || p_start_station || ' 乘坐' || v_start_line || '到 ' || p_end_station || '，无需换乘';
    ELSE
      v_summary := '从 ' || p_start_station || ' 到 ' || p_end_station || '，无需换乘';
    END IF;
  ELSE
    -- 有换乘的情况
    SELECT line INTO v_start_line
    FROM public.metrostations
    WHERE name = p_start_station
    LIMIT 1;
    
    v_summary := '从 ' || p_start_station || ' 乘坐' || v_start_line;
    
    -- 添加换乘信息
    FOR v_i IN 0..(jsonb_array_length(p_transfers) - 1) LOOP
      v_transfer_info := p_transfers->v_i;
      v_summary := v_summary || '，在' || (v_transfer_info->>'station') || '换乘' || (v_transfer_info->>'to_line');
    END LOOP;
    
    v_summary := v_summary || '，到达' || p_end_station;
  END IF;
  
  RETURN v_summary;
END;
$$ LANGUAGE plpgsql;

-- 6. 创建通勤时间计算函数
CREATE OR REPLACE FUNCTION public.calculate_metro_commute_time(
  p_start_station text,
  p_end_station text
) RETURNS jsonb AS $$
DECLARE
  v_result jsonb;
  v_path text[] := ARRAY[]::text[];
  v_transfers jsonb := '[]'::jsonb;
  v_current_station text;
  v_total_time integer;
  v_stations_count integer;
  v_transfer_count integer;
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
  
  -- 使用Dijkstra算法计算最短路径
  SELECT 
    dms.station_name,
    dms.distance,
    dms.previous_station,
    dms.line_info,
    dms.connection_type
  INTO v_path_records
  FROM public.dijkstra_metro_shortest_path(p_start_station, p_end_station) dms
  WHERE dms.station_name = p_end_station;
  
  -- 如果无法找到路径
  IF v_path_records.station_name IS NULL OR v_path_records.distance >= 999999 THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', '无法找到从 ' || p_start_station || ' 到 ' || p_end_station || ' 的路线'
    );
  END IF;
  
  -- 获取基础路径距离（不包含换乘时间）
  v_total_time := v_path_records.distance;
  
  -- 重建完整路径
  v_current_station := p_end_station;
  WHILE v_current_station IS NOT NULL LOOP
    v_path := array_prepend(v_current_station, v_path);
    
    -- 获取前驱站点信息
    SELECT 
      dms.previous_station,
      dms.line_info,
      dms.connection_type
    INTO v_path_records
    FROM public.dijkstra_metro_shortest_path(p_start_station, p_end_station) dms
    WHERE dms.station_name = v_current_station;
    
    v_current_station := v_path_records.previous_station;
    
    -- 检查换乘（与Python版本逻辑一致）
    IF v_path_records.connection_type = 'transfer' THEN
      v_transfers := v_transfers || jsonb_build_object(
        'station', v_current_station,
        'from_line', split_part(v_path_records.line_info, '->', 1),
        'to_line', split_part(v_path_records.line_info, '->', 2)
      );
    END IF;
  END LOOP;
  
  -- 计算站点数和换乘次数
  v_stations_count := array_length(v_path, 1) - 1;
  v_transfer_count := jsonb_array_length(v_transfers);
  
  -- 计算总时间：站点间时间 + 换乘时间（与Python版本完全一致）
  v_total_time := v_total_time + (v_transfer_count * 5);
  
  -- 生成路线摘要
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
$$ LANGUAGE plpgsql;



-- 6. 创建批量计算通勤时间函数（集成community_keywords表）
CREATE OR REPLACE FUNCTION public.batch_calculate_community_commute_times(
  p_worklocation text,
  p_followup_id uuid
) RETURNS void AS $$
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
$$ LANGUAGE plpgsql;

-- 7. 创建通勤时间评分函数
CREATE OR REPLACE FUNCTION public.get_commute_score(commute_time integer) RETURNS integer AS $$
BEGIN
  IF commute_time <= 30 THEN
    RETURN 100;
  ELSIF commute_time <= 45 THEN
    RETURN 85;
  ELSIF commute_time <= 60 THEN
    RETURN 70;
  ELSIF commute_time <= 90 THEN
    RETURN 50;
  ELSE
    RETURN 30;
  END IF;
END;
$$ LANGUAGE plpgsql;

-- 8. 创建工作地点变更触发器函数
CREATE OR REPLACE FUNCTION public.trigger_worklocation_change() RETURNS TRIGGER AS $$
BEGIN
  -- 当工作地点发生变化时，自动计算通勤时间
  IF OLD.worklocation IS DISTINCT FROM NEW.worklocation AND NEW.worklocation IS NOT NULL THEN
    -- 异步调用批量计算通勤时间函数
    PERFORM public.batch_calculate_community_commute_times(NEW.worklocation, NEW.id);
    
    RAISE NOTICE 'Worklocation changed from % to %, triggering commute time calculation for followup %', 
                  OLD.worklocation, NEW.worklocation, NEW.id;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 9. 创建触发器
DROP TRIGGER IF EXISTS trigger_worklocation_change ON public.followups;
CREATE TRIGGER trigger_worklocation_change
    AFTER UPDATE ON public.followups
    FOR EACH ROW EXECUTE FUNCTION public.trigger_worklocation_change();

-- 10. 授予权限
GRANT EXECUTE ON FUNCTION public.dijkstra_metro_shortest_path(text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.calculate_metro_commute_time(text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.generate_metro_route_summary(text, text[], jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.batch_calculate_community_commute_times(text, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_commute_score(integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.trigger_worklocation_change() TO authenticated;

-- 11. 添加函数注释
COMMENT ON FUNCTION public.dijkstra_metro_shortest_path(text, text) IS 'Dijkstra算法实现，基于metrostations表计算两个地铁站之间的最短路径';
COMMENT ON FUNCTION public.calculate_metro_commute_time(text, text) IS '计算两个地铁站之间的通勤时间，使用Dijkstra算法找到最优路线';
COMMENT ON FUNCTION public.generate_metro_route_summary(text, text[], jsonb) IS '生成地铁路线摘要，包含换乘信息';
COMMENT ON FUNCTION public.batch_calculate_community_commute_times(text, uuid) IS '批量计算所有社区的通勤时间并保存到followups表的extended_data字段，集成community_keywords表';
COMMENT ON FUNCTION public.get_commute_score(integer) IS '根据通勤时间计算评分（0-100分），通勤时间越短评分越高';
COMMENT ON FUNCTION public.trigger_worklocation_change() IS '触发器函数：当工作地点变更时，自动计算并保存所有社区的通勤时间到extended_data字段';
COMMENT ON TRIGGER trigger_worklocation_change ON public.followups IS '触发器：监听工作地点变更，自动触发通勤时间计算';

-- 12. 添加视图注释
COMMENT ON VIEW public.metro_adjacency_view IS '地铁站点邻接关系视图，基于metrostations表构建同线相邻站点关系';
COMMENT ON VIEW public.metro_transfer_view IS '地铁换乘站点视图，识别同一站点在不同线路上的换乘关系';
COMMENT ON VIEW public.metro_complete_adjacency IS '完整的地铁邻接关系视图，包含同线相邻站点和换乘站点';
