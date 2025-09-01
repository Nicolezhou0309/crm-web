-- 检查数据库状态并创建测试数据
-- 用于测试触发器功能

-- 1. 检查followups表状态
SELECT 
    'followups表状态检查' as check_type,
    COUNT(*) as total_records,
    COUNT(*) FILTER (WHERE worklocation IS NOT NULL AND worklocation != '') as has_worklocation,
    COUNT(*) FILTER (WHERE worklocation IS NULL OR worklocation = '') as no_worklocation
FROM public.followups;

-- 2. 检查community_keywords表状态
SELECT 
    'community_keywords表状态检查' as check_type,
    COUNT(*) as total_communities,
    COUNT(*) FILTER (WHERE metrostation IS NOT NULL) as has_metrostation,
    COUNT(*) FILTER (WHERE metrostation IS NULL) as no_metrostation
FROM public.community_keywords;

-- 3. 检查触发器状态
SELECT 
    '触发器状态检查' as check_type,
    trigger_name,
    event_manipulation,
    action_timing,
    action_statement
FROM information_schema.triggers 
WHERE trigger_name = 'trigger_worklocation_change'
  AND event_object_table = 'followups';

-- 4. 检查触发器函数
SELECT 
    '触发器函数检查' as check_type,
    proname,
    prosrc IS NOT NULL as has_source
FROM pg_proc 
WHERE proname = 'trigger_worklocation_change';

-- 5. 如果没有数据，创建测试数据
DO $$
DECLARE
    test_followup_id uuid;
    test_leadid text := 'TEST001';
BEGIN
    -- 检查是否已有测试数据
    IF NOT EXISTS (SELECT 1 FROM public.followups WHERE leadid = test_leadid) THEN
        RAISE NOTICE '创建测试followup记录...';
        
        -- 创建测试followup记录
        INSERT INTO public.followups (
            leadid,
            worklocation,
            customerprofile,
            followupstage,
            created_at,
            updated_at
        ) VALUES (
            test_leadid,
            '人民广场',
            '首次购房',
            '初步接触',
            NOW(),
            NOW()
        ) RETURNING id INTO test_followup_id;
        
        RAISE NOTICE '测试followup记录已创建，ID: %', test_followup_id;
    ELSE
        RAISE NOTICE '测试数据已存在，跳过创建';
    END IF;
END $$;

-- 6. 检查测试数据
SELECT 
    '测试数据检查' as check_type,
    id,
    leadid,
    worklocation,
    extended_data,
    created_at
FROM public.followups 
WHERE leadid = 'TEST001';

-- 7. 手动测试触发器函数
SELECT 
    '手动测试触发器函数' as test_type,
    public.trigger_worklocation_change() as function_result;

-- 8. 检查是否有社区数据
SELECT 
    '社区数据检查' as check_type,
    community,
    metrostation,
    lowest_price,
    highest_price
FROM public.community_keywords 
WHERE metrostation IS NOT NULL
LIMIT 5;

-- 9. 测试批量计算函数
DO $$
DECLARE
    test_result jsonb;
BEGIN
    RAISE NOTICE '测试批量计算函数...';
    
    -- 调用批量计算函数
    PERFORM public.batch_calculate_community_commute_times('人民广场', 
        (SELECT id FROM public.followups WHERE leadid = 'TEST001' LIMIT 1));
    
    RAISE NOTICE '批量计算函数调用完成';
END $$;

-- 10. 检查计算结果
SELECT 
    '计算结果检查' as check_type,
    id,
    leadid,
    worklocation,
    extended_data->>'commute_times' as commute_times,
    extended_data->>'commute_calculated_at' as calculated_at
FROM public.followups 
WHERE leadid = 'TEST001';
