// 强制重建Dijkstra函数的脚本
// 用于解决函数更新失败的问题

import { createClient } from '@supabase/supabase-js';

// Supabase配置
const supabaseUrl = 'http://47.123.26.25:8000';
const supabaseKey = 'eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJvbGUiOiJhbm9uIiwiaWF0IjoxNzU1Nzg1ODY3LCJleHAiOjEzMjY2NDI1ODY3fQ.h_DW3s03LaUCtf_7LepkEwmFVxdqPZ6zfHhuSMc5Ewg';

const supabase = createClient(supabaseUrl, supabaseKey);

async function forceRebuild() {
  console.log('🔨 强制重建Dijkstra函数...\n');

  try {
    // 1. 首先尝试调用函数，确认问题
    console.log('1️⃣ 确认当前问题...');
    const { data: testData, error: testError } = await supabase
      .rpc('dijkstra_metro_shortest_path', {
        p_start_station: '人民广场',
        p_end_station: '人民广场'
      });
    
    if (testError) {
      console.log('❌ 确认问题存在:', testError.message);
      console.log('   错误代码:', testError.code);
    } else {
      console.log('✅ 问题已解决，函数工作正常');
      return;
    }

    // 2. 检查函数是否真的存在
    console.log('\n2️⃣ 检查函数状态...');
    console.log('💡 建议在Supabase Studio中执行以下SQL来检查函数:');
    console.log('   SELECT proname, prosrc FROM pg_proc WHERE proname = \'dijkstra_metro_shortest_path\';');

    // 3. 提供强制重建的SQL
    console.log('\n3️⃣ 强制重建SQL...');
    console.log('💡 请在Supabase Studio中执行以下SQL来强制重建函数:');
    
    const rebuildSQL = `
-- 强制重建Dijkstra函数
-- 1. 强制删除函数（包括所有重载版本）
DROP FUNCTION IF EXISTS public.dijkstra_metro_shortest_path(text, text) CASCADE;

-- 2. 重新创建函数
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
  -- 获取所有站点（完全修复列引用歧义）
  SELECT array_agg(DISTINCT station_name) INTO v_stations
  FROM (
    SELECT mav.station_name as station_name FROM public.metro_adjacency_view mav
    UNION
    SELECT mav.next_station as station_name FROM public.metro_adjacency_view mav
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
  
  -- 返回结果（完全修复列引用歧义）
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

-- 3. 重新授予权限
GRANT EXECUTE ON FUNCTION public.dijkstra_metro_shortest_path(text, text) TO authenticated;

-- 4. 验证重建
SELECT 'Dijkstra函数强制重建完成' as status, NOW() as rebuild_time;
`;

    console.log(rebuildSQL);

    // 4. 总结
    console.log('\n📊 强制重建总结:');
    console.log('🔍 问题分析:');
    console.log('   函数更新失败，可能是由于:');
    console.log('   1. 函数依赖其他对象，无法直接替换');
    console.log('   2. 有多个同名函数，需要强制删除');
    console.log('   3. PostgreSQL缓存了旧的函数定义');
    
    console.log('\n💡 解决步骤:');
    console.log('   1. 在Supabase Studio中执行上面的SQL');
    console.log('   2. 使用CASCADE强制删除所有相关对象');
    console.log('   3. 重新创建函数');
    console.log('   4. 重新测试功能');

  } catch (error) {
    console.error('❌ 强制重建过程中发生错误:', error);
  }
}

// 运行强制重建
forceRebuild();
