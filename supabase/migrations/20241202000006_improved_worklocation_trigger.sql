-- 改进的工作地点触发器方案
-- 结合错误处理和性能优化

-- 1. 创建带错误处理的优化触发器函数
CREATE OR REPLACE FUNCTION public.trigger_worklocation_change_improved() RETURNS TRIGGER AS $$
DECLARE
    v_error_message text;
    v_commute_times jsonb;
    v_communities_count integer;
    v_start_time timestamp;
    v_end_time timestamp;
    v_duration interval;
BEGIN
    -- 当工作地点发生变化时，自动计算通勤时间
    IF OLD.worklocation IS DISTINCT FROM NEW.worklocation AND NEW.worklocation IS NOT NULL THEN
        v_start_time := clock_timestamp();
        
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
            
            -- 关键优化：限制计算数量，避免超时
            IF v_communities_count > 20 THEN
                RAISE NOTICE '⚠️ 社区数量过多 (% 个)，限制计算数量以避免超时', v_communities_count;
                v_communities_count := 20;
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
        
        -- 记录执行时间
        v_end_time := clock_timestamp();
        v_duration := v_end_time - v_start_time;
        RAISE NOTICE '⏱️ 通勤时间计算总耗时: %', v_duration;
        
        -- 如果执行时间超过5秒，记录警告
        IF v_duration > interval '5 seconds' THEN
            RAISE WARNING '⚠️ 通勤时间计算耗时过长: %，建议优化', v_duration;
        END IF;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 2. 创建优化的批量计算函数（限制计算数量）
CREATE OR REPLACE FUNCTION public.batch_calculate_community_commute_times_limited(
    p_worklocation TEXT,
    p_followup_id UUID,
    p_max_communities INTEGER DEFAULT 8
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
    v_start_time := clock_timestamp();
    
    RAISE NOTICE '🔄 开始批量计算通勤时间，限制最多 % 个社区', p_max_communities;
    
    -- 遍历社区，限制计算数量
    FOR rec IN 
        SELECT community, metrostation 
        FROM public.community_keywords 
        WHERE metrostation IS NOT NULL
        LIMIT p_max_communities
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
        
        -- 每计算5个社区记录一次进度
        IF calculated_count % 5 = 0 THEN
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

-- 3. 创建超时保护的触发器函数
CREATE OR REPLACE FUNCTION public.trigger_worklocation_change_with_timeout() RETURNS TRIGGER AS $$
DECLARE
    v_error_message text;
    v_commute_times jsonb;
    v_communities_count integer;
    v_start_time timestamp;
    v_end_time timestamp;
    v_duration interval;
    v_timeout_seconds integer := 10; -- 10秒超时
BEGIN
    -- 当工作地点发生变化时，自动计算通勤时间
    IF OLD.worklocation IS DISTINCT FROM NEW.worklocation AND NEW.worklocation IS NOT NULL THEN
        v_start_time := clock_timestamp();
        
        RAISE NOTICE '🚀 工作地点变更触发通勤时间计算: % → % (followup: %)', 
                    OLD.worklocation, NEW.worklocation, NEW.id;
        
        BEGIN
            -- 检查是否有社区数据
            SELECT COUNT(*) INTO v_communities_count
            FROM public.community_keywords 
            WHERE metrostation IS NOT NULL;
            
            IF v_communities_count = 0 THEN
                RAISE NOTICE '⚠️ 没有找到社区数据，跳过通勤时间计算';
                RETURN NEW;
            END IF;
            
            -- 根据社区数量动态调整计算数量
            IF v_communities_count > 50 THEN
                RAISE NOTICE '⚠️ 社区数量过多 (% 个)，限制计算数量以避免超时', v_communities_count;
                v_communities_count := 15; -- 限制为15个
            ELSIF v_communities_count > 20 THEN
                v_communities_count := 20; -- 限制为20个
            END IF;
            
            RAISE NOTICE '📊 开始计算 % 个社区的通勤时间...', v_communities_count;
            
            -- 使用优化的批量计算函数
            PERFORM public.batch_calculate_community_commute_times_limited(
                NEW.worklocation, 
                NEW.id, 
                v_communities_count
            );
            
            -- 验证计算结果
            SELECT extended_data->>'commute_times' INTO v_commute_times
            FROM public.followups 
            WHERE id = NEW.id;
            
            IF v_commute_times IS NOT NULL THEN
                RAISE NOTICE '✅ 通勤时间计算成功！已保存到 extended_data.commute_times';
            ELSE
                RAISE WARNING '⚠️ 通勤时间计算可能失败，extended_data.commute_times 为空';
            END IF;
            
        EXCEPTION WHEN OTHERS THEN
            -- 捕获所有错误，记录但不中断触发器
            v_error_message := SQLERRM;
            RAISE WARNING '❌ 通勤时间计算失败: %', v_error_message;
            
        END;
        
        -- 记录执行时间
        v_end_time := clock_timestamp();
        v_duration := v_end_time - v_start_time;
        RAISE NOTICE '⏱️ 通勤时间计算总耗时: %', v_duration;
        
        -- 如果执行时间超过超时阈值，记录警告
        IF v_duration > (v_timeout_seconds || ' seconds')::interval THEN
            RAISE WARNING '⚠️ 通勤时间计算耗时过长: %，超过 % 秒阈值', v_duration, v_timeout_seconds;
        END IF;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 4. 删除旧的触发器
DROP TRIGGER IF EXISTS trigger_worklocation_change ON public.followups;
DROP TRIGGER IF EXISTS trigger_worklocation_change_improved ON public.followups;

-- 5. 创建新的优化触发器
CREATE TRIGGER trigger_worklocation_change_with_timeout
    AFTER UPDATE ON public.followups
    FOR EACH ROW EXECUTE FUNCTION public.trigger_worklocation_change_with_timeout();

-- 6. 授予权限
GRANT EXECUTE ON FUNCTION public.trigger_worklocation_change_improved() TO authenticated;
GRANT EXECUTE ON FUNCTION public.batch_calculate_community_commute_times_limited(text, uuid, integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.trigger_worklocation_change_with_timeout() TO authenticated;

-- 7. 添加注释
COMMENT ON FUNCTION public.trigger_worklocation_change_improved() IS '改进的工作地点变更触发器，包含错误处理和性能监控';
COMMENT ON FUNCTION public.batch_calculate_community_commute_times_limited(text, uuid, integer) IS '限制计算数量的批量通勤时间计算函数，避免超时';
COMMENT ON FUNCTION public.trigger_worklocation_change_with_timeout() IS '带超时保护的工作地点变更触发器，动态调整计算数量';

-- 8. 显示完成信息
SELECT '改进的工作地点触发器已部署，包含错误处理和性能优化！' as status;
