-- 优化版本：批量计算所有followup记录的通勤时间
-- 解决超时问题，分批处理，增加超时设置

-- 设置更长的语句超时时间（5分钟）
SET statement_timeout = '300000'; -- 300秒 = 5分钟

-- 方法1：分批处理，避免超时（推荐）
-- 每次只处理一小批记录
DO $$
DECLARE
    rec RECORD;
    batch_size INTEGER := 10; -- 每批处理10条记录
    total_count INTEGER := 0;
    processed_count INTEGER := 0;
    success_count INTEGER := 0;
    error_count INTEGER := 0;
    start_time TIMESTAMP := NOW();
    batch_start_time TIMESTAMP;
    batch_count INTEGER := 0;
BEGIN
    RAISE NOTICE '🚀 开始分批计算所有followup记录的通勤时间...';
    RAISE NOTICE '开始时间: %', start_time;
    RAISE NOTICE '批次大小: % 条记录', batch_size;
    
    -- 获取需要处理的记录总数
    SELECT COUNT(*) INTO total_count
    FROM public.followups 
    WHERE worklocation IS NOT NULL 
      AND worklocation != ''
      AND (extended_data->>'commute_times') IS NULL;
    
    RAISE NOTICE '📊 找到 % 条需要计算通勤时间的记录', total_count;
    
    -- 分批处理，避免超时
    WHILE processed_count < total_count LOOP
        batch_count := batch_count + 1;
        batch_start_time := NOW();
        
        RAISE NOTICE '';
        RAISE NOTICE '🔄 开始处理第 % 批 (已处理: %/%)', batch_count, processed_count, total_count;
        
        -- 处理当前批次
        FOR rec IN 
            SELECT id, leadid, worklocation, created_at
            FROM public.followups 
            WHERE worklocation IS NOT NULL 
              AND worklocation != ''
              AND (extended_data->>'commute_times') IS NULL
            ORDER BY created_at DESC
            LIMIT batch_size
            OFFSET processed_count
        LOOP
            processed_count := processed_count + 1;
            
            BEGIN
                RAISE NOTICE '  📍 处理记录: % (工作地点: %)', rec.leadid, rec.worklocation;
                
                -- 调用批量计算通勤时间函数
                PERFORM public.batch_calculate_community_commute_times(rec.worklocation, rec.id);
                
                success_count := success_count + 1;
                RAISE NOTICE '    ✅ 成功计算并保存通勤时间';
                
            EXCEPTION WHEN OTHERS THEN
                error_count := error_count + 1;
                RAISE NOTICE '    ❌ 计算失败: %', SQLERRM;
                
                -- 继续处理下一条记录，不中断整个流程
                CONTINUE;
            END;
        END LOOP;
        
        -- 输出批次完成信息
        RAISE NOTICE '  📈 第 % 批完成，耗时: %', batch_count, NOW() - batch_start_time;
        RAISE NOTICE '  📊 当前进度: %/% (%.1f%%)', processed_count, total_count, 
                    (processed_count::float / total_count * 100);
        
        -- 如果还有记录需要处理，等待一下避免API限制
        IF processed_count < total_count THEN
            RAISE NOTICE '  ⏳ 等待2秒后继续下一批...';
            PERFORM pg_sleep(2);
        END IF;
    END LOOP;
    
    -- 输出最终统计结果
    RAISE NOTICE '';
    RAISE NOTICE '🎯 分批计算完成！';
    RAISE NOTICE '📊 总记录数: %', total_count;
    RAISE NOTICE '✅ 成功处理: %', success_count;
    RAISE NOTICE '❌ 处理失败: %', error_count;
    RAISE NOTICE '🔄 总批次数: %', batch_count;
    RAISE NOTICE '⏱️ 总耗时: %', NOW() - start_time;
    
    IF success_count > 0 THEN
        RAISE NOTICE '🎉 通勤时间计算成功！现在可以在社区推荐中看到准确的通勤时间了。';
    END IF;
END $$;

-- 方法2：手动分批处理（如果上面的方法还是超时）
-- 你可以手动执行这些语句，每次处理一小批

-- 第1批：处理前10条记录
/*
DO $$
DECLARE
    rec RECORD;
BEGIN
    RAISE NOTICE '处理第1批（前10条记录）...';
    
    FOR rec IN 
        SELECT id, leadid, worklocation
        FROM public.followups 
        WHERE worklocation IS NOT NULL 
          AND worklocation != ''
          AND (extended_data->>'commute_times') IS NULL
        ORDER BY created_at DESC
        LIMIT 10
    LOOP
        BEGIN
            RAISE NOTICE '处理: % (工作地点: %)', rec.leadid, rec.worklocation;
            PERFORM public.batch_calculate_community_commute_times(rec.worklocation, rec.id);
            RAISE NOTICE '  ✅ 成功';
        EXCEPTION WHEN OTHERS THEN
            RAISE NOTICE '  ❌ 失败: %', SQLERRM;
        END;
    END LOOP;
    
    RAISE NOTICE '第1批完成';
END $$;
*/

-- 方法3：检查处理结果
-- 查看计算完成的记录
SELECT 
    f.leadid,
    f.worklocation,
    f.created_at,
    CASE 
        WHEN f.extended_data->>'commute_times' IS NOT NULL THEN '✅ 已计算'
        ELSE '❌ 未计算'
    END as status,
    f.extended_data->>'commute_calculated_at' as calculated_at
FROM public.followups f
WHERE f.worklocation IS NOT NULL 
  AND f.worklocation != ''
ORDER BY 
    CASE WHEN f.extended_data->>'commute_times' IS NULL THEN 0 ELSE 1 END,
    f.created_at DESC
LIMIT 20;

-- 方法4：统计各状态的记录数量
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

-- 重置超时设置
SET statement_timeout = DEFAULT;
