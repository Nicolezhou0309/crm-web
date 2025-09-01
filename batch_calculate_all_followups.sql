-- 批量计算所有followup记录的通勤时间
-- 使用我们的Dijkstra算法为每个有工作地点的followup计算到所有社区的通勤时间

-- 方法1：使用现有的批量计算函数（推荐）
-- 这会为每个followup调用batch_calculate_community_commute_times函数
DO $$
DECLARE
    rec RECORD;
    total_count INTEGER := 0;
    processed_count INTEGER := 0;
    success_count INTEGER := 0;
    error_count INTEGER := 0;
    start_time TIMESTAMP := NOW();
BEGIN
    RAISE NOTICE '🚀 开始批量计算所有followup记录的通勤时间...';
    RAISE NOTICE '开始时间: %', start_time;
    
    -- 获取需要处理的记录总数
    SELECT COUNT(*) INTO total_count
    FROM public.followups 
    WHERE worklocation IS NOT NULL 
      AND worklocation != ''
      AND (extended_data->>'commute_times') IS NULL;
    
    RAISE NOTICE '📊 找到 % 条需要计算通勤时间的记录', total_count;
    
    -- 遍历所有有工作地点但还没有通勤时间的followup记录
    FOR rec IN 
        SELECT id, leadid, worklocation, created_at
        FROM public.followups 
        WHERE worklocation IS NOT NULL 
          AND worklocation != ''
          AND (extended_data->>'commute_times') IS NULL
        ORDER BY created_at DESC
    LOOP
        processed_count := processed_count + 1;
        
        BEGIN
            RAISE NOTICE '🔄 处理第 %/% 条记录: % (工作地点: %)', 
                        processed_count, total_count, rec.leadid, rec.worklocation;
            
            -- 调用批量计算通勤时间函数
            PERFORM public.batch_calculate_community_commute_times(rec.worklocation, rec.id);
            
            success_count := success_count + 1;
            RAISE NOTICE '  ✅ 成功计算并保存通勤时间';
            
        EXCEPTION WHEN OTHERS THEN
            error_count := error_count + 1;
            RAISE NOTICE '  ❌ 计算失败: %', SQLERRM;
            
            -- 继续处理下一条记录，不中断整个流程
            CONTINUE;
        END;
        
        -- 每处理100条记录输出一次进度
        IF processed_count % 100 = 0 THEN
            RAISE NOTICE '📈 进度: %/% (%.1f%%)', processed_count, total_count, 
                        (processed_count::float / total_count * 100);
        END IF;
    END LOOP;
    
    -- 输出最终统计结果
    RAISE NOTICE '';
    RAISE NOTICE '🎯 批量计算完成！';
    RAISE NOTICE '📊 总记录数: %', total_count;
    RAISE NOTICE '✅ 成功处理: %', success_count;
    RAISE NOTICE '❌ 处理失败: %', error_count;
    RAISE NOTICE '⏱️ 总耗时: %', NOW() - start_time;
    
    IF success_count > 0 THEN
        RAISE NOTICE '🎉 通勤时间计算成功！现在可以在社区推荐中看到准确的通勤时间了。';
    END IF;
END $$;

-- 方法2：直接使用SQL查询验证结果
-- 查看计算完成的记录
SELECT 
    f.leadid,
    f.worklocation,
    f.created_at,
    f.extended_data->>'commute_times' as commute_times,
    f.extended_data->>'commute_calculated_at' as calculated_at,
    CASE 
        WHEN f.extended_data->>'commute_times' IS NOT NULL THEN '✅ 已计算'
        ELSE '❌ 未计算'
    END as status
FROM public.followups f
WHERE f.worklocation IS NOT NULL 
  AND f.worklocation != ''
ORDER BY 
    CASE WHEN f.extended_data->>'commute_times' IS NULL THEN 0 ELSE 1 END,
    f.created_at DESC
LIMIT 20;

-- 方法3：统计各状态的记录数量
SELECT 
    CASE 
        WHEN f.extended_data->>'commute_times' IS NOT NULL THEN '✅ 已计算通勤时间'
        ELSE '❌ 未计算通勤时间'
    END as status,
    COUNT(*) as record_count,
    ROUND(COUNT(*) * 100.0 / SUM(COUNT(*)) OVER (), 1) as percentage
FROM public.followups f
WHERE f.worklocation IS NOT NULL 
  AND f.worklocation != ''
GROUP BY 
    CASE 
        WHEN f.extended_data->>'commute_times' IS NOT NULL THEN '✅ 已计算通勤时间'
        ELSE '❌ 未计算通勤时间'
    END
ORDER BY record_count DESC;
