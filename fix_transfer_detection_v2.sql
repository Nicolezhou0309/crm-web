-- 修复换乘检测逻辑 V2
-- 解决线路推断错误和换乘检测bug，确保准确识别换乘

-- 1. 删除现有函数
DROP FUNCTION IF EXISTS public.calculate_metro_commute_time(text, text) CASCADE;

-- 2. 重新创建通勤时间计算函数（修复版本V2）
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
  v_previous_line text;
  v_current_line text;
  v_station_line_info record;
  v_dijkstra_path record;
  v_path_with_lines text[] := ARRAY[]::text[];
  v_lines_info text[] := ARRAY[]::text[];
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
  
  -- 重建完整路径并收集线路信息
  v_current_station := p_end_station;
  v_previous_line := NULL;
  
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
    
    -- 检查换乘（修复版本V2：使用Dijkstra算法返回的准确线路信息）
    IF v_current_station IS NOT NULL THEN
      -- 方法1：优先使用Dijkstra算法返回的线路信息
      IF v_path_records.line_info IS NOT NULL AND v_path_records.line_info != 'N/A' THEN
        -- 如果Dijkstra算法返回了线路信息，直接使用
        v_current_line := v_path_records.line_info;
        
        -- 检查线路变化
        IF v_previous_line IS NOT NULL AND v_previous_line != v_current_line THEN
          v_transfers := v_transfers || jsonb_build_object(
            'station', v_current_station,
            'from_line', v_previous_line,
            'to_line', v_current_line
          );
        END IF;
        
        v_previous_line := v_current_line;
      ELSE
        -- 方法2：通过站点推断线路（备用方案）
        SELECT line INTO v_current_line
        FROM public.metrostations
        WHERE name = v_current_station
        LIMIT 1;
        
        -- 检查线路变化
        IF v_previous_line IS NOT NULL AND v_current_line IS NOT NULL AND v_previous_line != v_current_line THEN
          v_transfers := v_transfers || jsonb_build_object(
            'station', v_current_station,
            'from_line', v_previous_line,
            'to_line', v_current_line
          );
        END IF;
        
        v_previous_line := v_current_line;
      END IF;
    END IF;
  END LOOP;
  
  -- 计算站点数和换乘次数
  v_stations_count := array_length(v_path, 1) - 1;
  v_transfer_count := jsonb_array_length(v_transfers);
  
  -- 计算总时间：站点间时间 + 换乘时间
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

-- 3. 重新授予权限
GRANT EXECUTE ON FUNCTION public.calculate_metro_commute_time(text, text) TO authenticated;

-- 4. 验证修复
SELECT '换乘检测逻辑修复V2完成' as status, NOW() as fix_time;

-- 5. 测试说明
SELECT '修复说明' as info;
SELECT '1. 优先使用Dijkstra算法返回的准确线路信息' as fix_detail;
SELECT '2. 避免通过站点名推断线路时的错误' as fix_detail;
SELECT '3. 确保换乘检测的准确性' as fix_detail;
SELECT '4. 沈杜公路到徐家汇应该只显示1次换乘' as expected_result;
