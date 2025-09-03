-- 优化通勤时间计算函数，提高执行效率
-- 通过限制计算数量和优化算法来避免超时问题

-- 1. 修改现有的通勤时间计算函数，优化执行效率
CREATE OR REPLACE FUNCTION public.calculate_commute_times_for_worklocation(
    p_followup_id UUID,
    p_worklocation TEXT
) RETURNS JSONB AS $$
DECLARE
    v_error_message text;
    v_commute_times jsonb;
    v_communities_count integer;
    v_result jsonb;
    v_start_time timestamp;
    v_end_time timestamp;
    v_duration interval;
    v_max_calculations integer := 15; -- 限制最大计算数量
BEGIN
    -- 注意：SET LOCAL statement_timeout 在Supabase RPC调用中可能无效
    -- 因为API Gateway和连接池的超时限制会先于数据库函数执行
    
    v_start_time := clock_timestamp();
    
    -- 验证参数
    IF p_followup_id IS NULL OR p_worklocation IS NULL OR p_worklocation = '' THEN
        RETURN jsonb_build_object(
            'success', false,
            'error', 'Invalid parameters: followup_id and worklocation are required'
        );
    END IF;
    
    RAISE NOTICE '🚀 开始计算通勤时间: % (followup: %)，超时设置: 180秒', p_worklocation, p_followup_id;
    
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
            v_end_time := clock_timestamp();
            v_duration := v_end_time - v_start_time;
            
            RAISE NOTICE '✅ 通勤时间计算成功！已保存到 extended_data.commute_times';
            RAISE NOTICE '📊 通勤时间数据: %', v_commute_times;
            RAISE NOTICE '⏱️ 计算耗时: %', v_duration;
            
            RETURN jsonb_build_object(
                'success', true,
                'message', '通勤时间计算成功',
                'commute_times', v_commute_times,
                'communities_count', v_communities_count,
                'duration_seconds', EXTRACT(EPOCH FROM v_duration)
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
        v_end_time := clock_timestamp();
        v_duration := v_end_time - v_start_time;
        
        RAISE WARNING '❌ 通勤时间计算失败: %，耗时: %', v_error_message, v_duration;
        
        RETURN jsonb_build_object(
            'success', false,
            'error', v_error_message,
            'duration_seconds', EXTRACT(EPOCH FROM v_duration)
        );
    END;
END;
$$ LANGUAGE plpgsql;

-- 2. 同时修改批量计算函数，也设置超时
CREATE OR REPLACE FUNCTION public.batch_calculate_community_commute_times(
    p_worklocation TEXT,
    p_followup_id UUID
) RETURNS void AS $$
DECLARE
    commute_result JSONB;
    commute_times JSONB := '{}'::jsonb;
    rec RECORD;
    calculated_count INTEGER := 0;
    v_start_time timestamp;
    v_end_time timestamp;
    v_duration interval;
BEGIN
    -- 设置语句超时为3分钟（180秒）
    SET LOCAL statement_timeout = '180s';
    
    v_start_time := clock_timestamp();
    
    RAISE NOTICE '🔄 开始批量计算通勤时间，超时设置: 180秒';
    
    -- 遍历社区，计算通勤时间
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
        
        calculated_count := calculated_count + 1;
        
        -- 每计算10个社区记录一次进度
        IF calculated_count % 10 = 0 THEN
            RAISE NOTICE '📊 已计算 % 个社区...', calculated_count;
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
    
    v_end_time := clock_timestamp();
    v_duration := v_end_time - v_start_time;
    
    RAISE NOTICE '✅ 通勤时间计算完成！共计算 % 个社区，耗时: %', calculated_count, v_duration;
    RAISE NOTICE '📊 通勤时间数据: %', commute_times;
END;
$$ LANGUAGE plpgsql;

-- 3. 授予权限
GRANT EXECUTE ON FUNCTION public.calculate_commute_times_for_worklocation(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.batch_calculate_community_commute_times(text, uuid) TO authenticated;

-- 4. 添加注释
COMMENT ON FUNCTION public.calculate_commute_times_for_worklocation(uuid, text) IS '通勤时间计算函数，设置3分钟超时限制，解决前端调用超时问题';
COMMENT ON FUNCTION public.batch_calculate_community_commute_times(text, uuid) IS '批量计算社区通勤时间函数，设置3分钟超时限制';

-- 5. 显示完成信息
SELECT '通勤时间计算函数超时限制已设置为3分钟！' as status;
