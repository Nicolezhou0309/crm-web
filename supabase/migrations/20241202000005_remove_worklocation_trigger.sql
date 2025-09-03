-- 移除工作地点触发器，改为前端主动计算
-- 这是最简单的解决方案

-- 1. 删除所有工作地点相关的触发器
DROP TRIGGER IF EXISTS trigger_worklocation_change ON public.followups;
DROP TRIGGER IF EXISTS trigger_worklocation_change_optimized ON public.followups;
DROP TRIGGER IF EXISTS trigger_worklocation_change_simple ON public.followups;
DROP TRIGGER IF EXISTS trigger_worklocation_change_ultra_simple ON public.followups;

-- 2. 删除触发器函数
DROP FUNCTION IF EXISTS public.trigger_worklocation_change();
DROP FUNCTION IF EXISTS public.trigger_worklocation_change_optimized();
DROP FUNCTION IF EXISTS public.trigger_worklocation_change_simple();
DROP FUNCTION IF EXISTS public.trigger_worklocation_change_ultra_simple();

-- 3. 保留通勤时间计算函数，供前端调用
-- 这些函数保持不变，只是不再通过触发器自动调用

-- 4. 创建简化的前端调用函数
CREATE OR REPLACE FUNCTION public.calculate_commute_times_for_followup(
    p_followup_id UUID,
    p_worklocation TEXT
) RETURNS JSONB AS $$
DECLARE
    commute_result JSONB;
    commute_times JSONB := '{}'::jsonb;
    rec RECORD;
    calculated_count INTEGER := 0;
    max_calculations INTEGER := 8; -- 限制计算数量，避免超时
BEGIN
    -- 验证参数
    IF p_followup_id IS NULL OR p_worklocation IS NULL OR p_worklocation = '' THEN
        RETURN jsonb_build_object('success', false, 'error', 'Invalid parameters');
    END IF;
    
    -- 遍历社区，限制计算数量
    FOR rec IN 
        SELECT community, metrostation 
        FROM public.community_keywords 
        WHERE metrostation IS NOT NULL
        LIMIT max_calculations
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
    
    RETURN jsonb_build_object(
        'success', true,
        'commute_times', commute_times,
        'calculated_count', calculated_count,
        'message', '通勤时间计算完成'
    );
END;
$$ LANGUAGE plpgsql;

-- 5. 授予权限
GRANT EXECUTE ON FUNCTION public.calculate_commute_times_for_followup(uuid, text) TO authenticated;

-- 6. 添加注释
COMMENT ON FUNCTION public.calculate_commute_times_for_followup(uuid, text) IS '前端调用的通勤时间计算函数，避免触发器超时问题';

-- 7. 显示完成信息
SELECT '工作地点触发器已移除，改为前端主动计算模式！' as status;
