-- 真正简化的修复版本：绕过复杂的换乘检测逻辑
-- 核心思路：优先检查同线路直达，避免复杂的路径分析
-- 修复版本：解决了函数依赖和循环调用问题

-- 1. 删除现有函数
DROP FUNCTION IF EXISTS public.calculate_metro_commute_time(text, text) CASCADE;
DROP FUNCTION IF EXISTS public.generate_metro_route_summary(text, text, text[], jsonb) CASCADE;
DROP FUNCTION IF EXISTS public.generate_transfer_summary(text, text, jsonb) CASCADE;
DROP FUNCTION IF EXISTS public.analyze_actual_transfers(text[]) CASCADE;

-- 2. 首先创建辅助函数：生成换乘摘要
CREATE OR REPLACE FUNCTION public.generate_transfer_summary(
  p_start_station text,
  p_end_station text,
  p_transfers jsonb
) RETURNS text AS $$
DECLARE
  v_summary text;
  v_start_line text;
  v_i integer;
BEGIN
  -- 获取起始站线路
  SELECT line INTO v_start_line
  FROM public.metrostations
  WHERE name = p_start_station
  LIMIT 1;
  
  v_summary := '从 ' || p_start_station || ' 乘坐' || (v_start_line || '');
  
  -- 添加换乘信息
  FOR v_i IN 0..(jsonb_array_length(p_transfers) - 1) LOOP
    v_summary := v_summary || '，在' || (p_transfers->v_i->>'station') || '换乘' || (p_transfers->v_i->>'to_line');
  END LOOP;
  
  v_summary := v_summary || '，到达' || p_end_station;
  RETURN v_summary;
END;
$$ LANGUAGE plpgsql;

-- 3. 创建辅助函数：分析实际换乘
CREATE OR REPLACE FUNCTION public.analyze_actual_transfers(p_path text[]) RETURNS jsonb AS $$
DECLARE
  v_transfers jsonb := '[]'::jsonb;
  v_prev_line text;
  v_current_line text;
  v_i integer;
BEGIN
  FOR v_i IN 1..array_length(p_path, 1) LOOP
    -- 获取当前站点的线路信息
    SELECT line INTO v_current_line
    FROM public.metrostations
    WHERE name = p_path[v_i]
    LIMIT 1;
    
    -- 检查是否发生换乘
    IF v_i > 1 AND v_prev_line IS NOT NULL AND v_current_line != v_prev_line THEN
      v_transfers := v_transfers || jsonb_build_object(
        'station', p_path[v_i-1],
        'from_line', v_prev_line,
        'to_line', v_current_line
      );
    END IF;
    
    v_prev_line := v_current_line;
  END LOOP;
  
  RETURN v_transfers;
END;
$$ LANGUAGE plpgsql;

-- 4. 创建简化的路线摘要生成函数
CREATE OR REPLACE FUNCTION public.generate_metro_route_summary(
  p_start_station text,
  p_end_station text,
  p_path text[],
  p_transfers jsonb
) RETURNS text AS $$
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
$$ LANGUAGE plpgsql;

-- 5. 创建简化的通勤时间计算函数
CREATE OR REPLACE FUNCTION public.calculate_metro_commute_time(
  p_start_station text,
  p_end_station text
) RETURNS jsonb AS $$
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
  
  -- 检查是否有共同线路（关键修复点）
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
  
  -- 计算结果
  v_transfer_count := jsonb_array_length(v_transfers);
  v_stations_count := array_length(v_path, 1) - 1;
  v_total_time := v_dijkstra_result.distance + (v_transfer_count * 5);
  
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
$$ LANGUAGE plpgsql;

-- 6. 验证修复结果
SELECT 
  '简化修复完成' as status,
  NOW() as fix_time,
  '已实现简化的同线路直达检测，避免复杂的换乘分析' as message;

-- 7. 测试修复后的函数
SELECT 
  '测试修复结果' as check_type,
  '莘庄 → 人民广场' as route,
  '期望结果: 1号线直达，0次换乘' as expected,
  '请运行: SELECT public.calculate_metro_commute_time(''莘庄'', ''人民广场'')' as test_command;

-- 8. 关键修复点说明
SELECT 
  '关键修复点' as check_type,
  '1. 优先检查同线路直达，避免复杂分析' as fix1,
  '2. 简化换乘检测逻辑' as fix2,
  '3. 基于实际路径分析，而不是假设' as fix3,
  '4. 避免过度复杂的算法' as fix4;

-- 9. 函数依赖关系检查
SELECT 
  '函数依赖关系检查' as check_type,
  'generate_transfer_summary' as function1,
  EXISTS(SELECT 1 FROM pg_proc WHERE proname = 'generate_transfer_summary') as exists1,
  'analyze_actual_transfers' as function2,
  EXISTS(SELECT 1 FROM pg_proc WHERE proname = 'analyze_actual_transfers') as exists2,
  'generate_metro_route_summary' as function3,
  EXISTS(SELECT 1 FROM pg_proc WHERE proname = 'generate_metro_route_summary') as exists3,
  'calculate_metro_commute_time' as function4,
  EXISTS(SELECT 1 FROM pg_proc WHERE proname = 'calculate_metro_commute_time') as exists4;
