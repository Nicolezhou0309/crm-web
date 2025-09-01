-- 修复触发器函数
-- 解决函数调用和错误处理问题

-- 1. 删除现有触发器
DROP TRIGGER IF EXISTS trigger_worklocation_change ON public.followups;

-- 2. 删除现有触发器函数
DROP FUNCTION IF EXISTS public.trigger_worklocation_change() CASCADE;

-- 3. 重新创建触发器函数（修复版本）
CREATE OR REPLACE FUNCTION public.trigger_worklocation_change() 
RETURNS TRIGGER 
LANGUAGE plpgsql
AS $function$
DECLARE
    v_error_message text;
    v_commute_times jsonb;
    v_communities_count integer;
BEGIN
    -- 当工作地点发生变化时，自动计算通勤时间
    IF OLD.worklocation IS DISTINCT FROM NEW.worklocation AND NEW.worklocation IS NOT NULL THEN
        RAISE NOTICE '🚀 工作地点变更触发通勤时间计算: % → % (followup: %)', 
                    OLD.worklocation, NEW.worklocation, NEW.id;
        
        BEGIN
            -- 检查批量计算函数是否存在
            IF NOT EXISTS (
                SELECT 1 FROM pg_proc 
                WHERE proname = 'batch_calculate_community_commute_times'
            ) THEN
                RAISE EXCEPTION '批量计算函数 batch_calculate_community_commute_times 不存在';
            END IF;
            
            -- 检查是否有社区数据
            SELECT COUNT(*) INTO v_communities_count
            FROM public.community_keywords 
            WHERE metrostation IS NOT NULL;
            
            IF v_communities_count = 0 THEN
                RAISE NOTICE '⚠️ 没有找到社区数据，跳过通勤时间计算';
                RETURN NEW;
            END IF;
            
            RAISE NOTICE '📊 找到 % 个社区，开始计算通勤时间...', v_communities_count;
            
            -- 调用批量计算通勤时间函数
            PERFORM public.batch_calculate_community_commute_times(NEW.worklocation, NEW.id);
            
            -- 验证计算结果
            SELECT extended_data->>'commute_times' INTO v_commute_times
            FROM public.followups 
            WHERE id = NEW.id;
            
            IF v_commute_times IS NOT NULL THEN
                RAISE NOTICE '✅ 通勤时间计算成功！已保存到 extended_data.commute_times';
                RAISE NOTICE '📊 通勤时间数据: %', v_commute_times;
            ELSE
                RAISE WARNING '⚠️ 通勤时间计算可能失败，extended_data.commute_times 为空';
            END IF;
            
        EXCEPTION WHEN OTHERS THEN
            -- 捕获所有错误，记录但不中断触发器
            v_error_message := SQLERRM;
            RAISE WARNING '❌ 通勤时间计算失败: %', v_error_message;
            
            -- 可以选择记录错误到日志表，或者发送通知
            -- 这里我们只是记录警告，不中断正常的数据库操作
            
        END;
    END IF;
    
    RETURN NEW;
END;
$function$;

-- 4. 重新创建触发器
CREATE TRIGGER trigger_worklocation_change
    AFTER UPDATE ON public.followups
    FOR EACH ROW EXECUTE FUNCTION public.trigger_worklocation_change();

-- 5. 授予权限
GRANT EXECUTE ON FUNCTION public.trigger_worklocation_change() TO authenticated;

-- 6. 添加注释
COMMENT ON FUNCTION public.trigger_worklocation_change() IS '触发器函数：当工作地点变更时，自动计算并保存所有社区的通勤时间到extended_data字段（修复版本）';
COMMENT ON TRIGGER trigger_worklocation_change ON public.followups IS '触发器：监听工作地点变更，自动触发通勤时间计算（修复版本）';

-- 7. 验证触发器创建
SELECT 
    '触发器状态检查' as check_type,
    trigger_name,
    event_manipulation,
    action_timing,
    action_statement
FROM information_schema.triggers 
WHERE trigger_name = 'trigger_worklocation_change'
  AND event_object_table = 'followups';

-- 8. 验证函数创建
SELECT 
    '函数状态检查' as check_type,
    proname,
    prosrc IS NOT NULL as has_source
FROM pg_proc 
WHERE proname = 'trigger_worklocation_change';

-- 9. 测试触发器函数（不实际执行）
SELECT 
    '触发器函数测试' as test_type,
    '函数已创建，等待实际UPDATE操作测试' as status;

-- 优化后的地铁通勤时间计算函数
-- 主要性能改进：
-- 1. 避免重复调用Dijkstra函数
-- 2. 优化数组操作，使用更高效的方法
-- 3. 减少JSONB操作开销
-- 4. 优化内存使用

CREATE OR REPLACE FUNCTION public.calculate_metro_commute_time(p_start_station text, p_end_station text)
 RETURNS jsonb
 LANGUAGE plpgsql
AS $function$
DECLARE
  v_result jsonb;
  v_path text[] := ARRAY[]::text[];
  v_transfers jsonb := '[]'::jsonb;
  v_current_station text;
  v_total_time integer;
  v_stations_count integer;
  v_transfer_count integer;
  -- 修复：使用临时变量而不是record类型
  v_temp_distance integer;
  v_temp_previous_station text;
  v_temp_line_info text;
  v_temp_connection_type text;
  v_previous_line text;
  v_current_line text;
  v_station_line_info record;
  v_dijkstra_path record;
  v_path_with_lines text[] := ARRAY[]::text[];
  v_lines_info text[] := ARRAY[]::text[];
  -- 新增：缓存Dijkstra结果，避免重复调用
  v_dijkstra_cache jsonb := '{}'::jsonb;
  v_path_cache jsonb := '{}'::jsonb;
  v_line_cache jsonb := '{}'::jsonb;
  v_connection_cache jsonb := '{}'::jsonb;
  v_temp_path text[];
  v_temp_transfers jsonb := '[]'::jsonb;
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
  
  -- 性能优化：一次性获取所有Dijkstra结果并缓存
  FOR v_dijkstra_path IN
    SELECT 
      dms.station_name,
      dms.distance,
      dms.previous_station,
      dms.line_info,
      dms.connection_type
    FROM public.dijkstra_metro_shortest_path(p_start_station, p_end_station) dms
  LOOP
    -- 缓存结果到JSONB对象中，避免重复查询
    v_dijkstra_cache := jsonb_set(v_dijkstra_cache, ARRAY[v_dijkstra_path.station_name], 
      jsonb_build_object(
        'distance', v_dijkstra_path.distance,
        'previous_station', v_dijkstra_path.previous_station,
        'line_info', v_dijkstra_path.line_info,
        'connection_type', v_dijkstra_path.connection_type
      )
    );
  END LOOP;
  
  -- 检查是否找到路径
  IF NOT (v_dijkstra_cache ? p_end_station) OR 
         (v_dijkstra_cache->p_end_station->>'distance')::integer >= 999999 THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', '无法找到从 ' || p_start_station || ' 到 ' || p_end_station || ' 的路线'
    );
  END IF;
  
  -- 获取基础路径距离（不包含换乘时间）
  v_total_time := (v_dijkstra_cache->p_end_station->>'distance')::integer;
  
  -- 性能优化：使用临时数组和JSONB构建路径，避免重复查询
  v_current_station := p_end_station;
  v_previous_line := NULL;
  
  -- 预分配数组大小（性能优化）
  v_temp_path := ARRAY[v_current_station];
  v_temp_transfers := '[]'::jsonb;
  
  WHILE v_current_station IS NOT NULL LOOP
    -- 从缓存中获取前驱站点信息，避免重复调用函数
    IF NOT (v_dijkstra_cache ? v_current_station) THEN
      EXIT;
    END IF;
    
    -- 修复：使用临时变量而不是record类型
    v_temp_distance := (v_dijkstra_cache->v_current_station->>'distance')::integer;
    v_temp_previous_station := v_dijkstra_cache->v_current_station->>'previous_station';
    v_temp_line_info := v_dijkstra_cache->v_current_station->>'line_info';
    v_temp_connection_type := v_dijkstra_cache->v_current_station->>'connection_type';
    
    v_current_station := v_temp_previous_station;
    
    -- 检查换乘（使用缓存的线路信息）
    IF v_current_station IS NOT NULL THEN
      -- 方法1：优先使用Dijkstra算法返回的线路信息
      IF v_temp_line_info IS NOT NULL AND v_temp_line_info != 'N/A' THEN
        v_current_line := v_temp_line_info;
        
        -- 检查线路变化
        IF v_previous_line IS NOT NULL AND v_previous_line != v_current_line THEN
          v_temp_transfers := v_temp_transfers || jsonb_build_object(
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
          v_temp_transfers := v_temp_transfers || jsonb_build_object(
            'station', v_current_station,
            'from_line', v_previous_line,
            'to_line', v_current_line
          );
        END IF;
        
        v_previous_line := v_current_line;
      END IF;
      
      -- 性能优化：使用array_append而不是array_prepend，最后反转数组
      v_temp_path := array_append(v_temp_path, v_current_station);
    END IF;
  END LOOP;
  
  -- 性能优化：反转数组以获得正确的路径顺序
  -- 修复：PostgreSQL没有array_reverse函数，使用自定义逻辑
  v_path := ARRAY[]::text[];
  FOR i IN REVERSE array_length(v_temp_path, 1)..1 LOOP
    v_path := array_append(v_path, v_temp_path[i]);
  END LOOP;
  v_transfers := v_temp_transfers;
  
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
$function$;
