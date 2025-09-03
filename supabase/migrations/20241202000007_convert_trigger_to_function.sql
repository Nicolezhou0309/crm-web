-- 将触发器函数转换为可调用的普通函数
-- 这样前端可以主动调用，避免触发器超时问题

-- 1. 删除现有的触发器
DROP TRIGGER IF EXISTS trigger_worklocation_change ON public.followups;
DROP TRIGGER IF EXISTS trigger_worklocation_change_with_timeout ON public.followups;
DROP TRIGGER IF EXISTS trigger_worklocation_change_improved ON public.followups;

-- 2. 创建可调用的通勤时间计算函数
CREATE OR REPLACE FUNCTION public.trigger_worklocation_change(
    p_followup_id UUID,
    p_old_worklocation TEXT,
    p_new_worklocation TEXT
) RETURNS JSONB AS $$
DECLARE
    v_error_message text;
    v_commute_times jsonb;
    v_communities_count integer;
    v_result jsonb;
BEGIN
    -- 验证参数
    IF p_followup_id IS NULL OR p_new_worklocation IS NULL OR p_new_worklocation = '' THEN
        RETURN jsonb_build_object(
            'success', false,
            'error', 'Invalid parameters: followup_id and new_worklocation are required'
        );
    END IF;
    
    -- 当工作地点发生变化时，自动计算通勤时间
    IF p_old_worklocation IS DISTINCT FROM p_new_worklocation AND p_new_worklocation IS NOT NULL THEN
        RAISE NOTICE '🚀 工作地点变更触发通勤时间计算: % → % (followup: %)', 
                    p_old_worklocation, p_new_worklocation, p_followup_id;
        
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
            PERFORM public.batch_calculate_community_commute_times(p_new_worklocation, p_followup_id);
            
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
    ELSE
        -- 工作地点没有变化
        RETURN jsonb_build_object(
            'success', true,
            'message', '工作地点没有变化，跳过通勤时间计算'
        );
    END IF;
END;
$$ LANGUAGE plpgsql;

-- 3. 创建简化的前端调用函数（不需要旧工作地点参数）
CREATE OR REPLACE FUNCTION public.calculate_commute_times_for_worklocation(
    p_followup_id UUID,
    p_worklocation TEXT
) RETURNS JSONB AS $$
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
$$ LANGUAGE plpgsql;

-- 4. 删除旧的触发器函数
DROP FUNCTION IF EXISTS public.trigger_worklocation_change_improved();
DROP FUNCTION IF EXISTS public.trigger_worklocation_change_with_timeout();
DROP FUNCTION IF EXISTS public.batch_calculate_community_commute_times_limited(text, uuid, integer);

-- 5. 授予权限
GRANT EXECUTE ON FUNCTION public.trigger_worklocation_change(uuid, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.calculate_commute_times_for_worklocation(uuid, text) TO authenticated;

-- 6. 添加注释
COMMENT ON FUNCTION public.trigger_worklocation_change(uuid, text, text) IS '可调用的通勤时间计算函数，包含完整的错误处理和日志记录';
COMMENT ON FUNCTION public.calculate_commute_times_for_worklocation(uuid, text) IS '简化的前端调用函数，用于计算指定工作地点的通勤时间';

-- 7. 显示完成信息
SELECT '触发器函数已转换为可调用的普通函数！' as status;
SELECT '现在前端可以主动调用这些函数，避免触发器超时问题' as note;
