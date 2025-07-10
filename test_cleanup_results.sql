-- 第九步：测试清理结果
-- 验证所有函数是否正常工作

-- 1. 测试调试模式关闭时的分配（正常模式）
SELECT 
    '测试1：正常分配模式' as test_name,
    allocate_lead_simple(
        'TEST_NORMAL_' || EXTRACT(EPOCH FROM NOW())::bigint,
        '抖音'::source,
        '意向客户',
        '万科城市花园'::community,
        NULL,
        false  -- 调试模式关闭
    ) as result;

-- 2. 测试调试模式开启时的分配（调试模式）
SELECT 
    '测试2：调试分配模式' as test_name,
    allocate_lead_simple(
        'TEST_DEBUG_' || EXTRACT(EPOCH FROM NOW())::bigint,
        '小红书'::source,
        '意向客户',
        '绿地香颂'::community,
        NULL,
        true  -- 调试模式开启
    ) as result;

-- 3. 测试手动分配
SELECT 
    '测试3：手动分配模式' as test_name,
    allocate_lead_simple(
        'TEST_MANUAL_' || EXTRACT(EPOCH FROM NOW())::bigint,
        '微信'::source,
        '意向客户',
        '保利天悦'::community,
        1,  -- 手动指定用户ID
        true  -- 调试模式开启
    ) as result;

-- 4. 检查日志记录
SELECT 
    '日志统计' as info,
    COUNT(*) as total_logs,
    COUNT(*) FILTER (WHERE leadid LIKE 'TEST_%') as test_logs,
    COUNT(*) FILTER (WHERE leadid NOT LIKE 'TEST_%' AND leadid NOT LIKE 'DEBUG_%') as real_logs
FROM simple_allocation_logs;

-- 5. 验证函数是否存在
SELECT 
    '函数验证' as info,
    routine_name,
    routine_type
FROM information_schema.routines 
WHERE routine_schema = 'public' 
  AND routine_name IN (
    'allocate_lead_simple',
    'apply_allocation_filters',
    'get_group_users',
    'allocate_from_users',
    'simple_lead_allocation_trigger'
  )
ORDER BY routine_name;

-- 6. 检查触发器是否存在
SELECT 
    '触发器验证' as info,
    trigger_name,
    event_manipulation,
    action_timing
FROM information_schema.triggers 
WHERE trigger_schema = 'public' 
  AND trigger_name = 'trg_simple_lead_allocation';

-- 7. 清理测试数据
DELETE FROM simple_allocation_logs WHERE leadid LIKE 'TEST_%';

-- 8. 最终验证
SELECT 
    '最终验证' as status,
    COUNT(*) as remaining_logs,
    '清理和优化完成' as message
FROM simple_allocation_logs; 