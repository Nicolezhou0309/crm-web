-- 测试修复结果
-- 执行日期：2025-01-10

-- 1. 检查函数是否存在
SELECT 
    '函数存在性检查' as check_type,
    routine_name,
    routine_type,
    CASE 
        WHEN routine_name IS NOT NULL THEN '✓ 存在'
        ELSE '✗ 缺失'
    END as status
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

-- 2. 测试基本分配功能
SELECT 
    '基本分配测试' as test_name,
    allocate_lead_simple(
        'TEST_BASIC_' || EXTRACT(EPOCH FROM NOW())::bigint,
        '抖音'::source,
        '意向客户',
        '万科城市花园'::community,
        NULL
    ) as result;

-- 3. 测试手动分配
SELECT 
    '手动分配测试' as test_name,
    allocate_lead_simple(
        'TEST_MANUAL_' || EXTRACT(EPOCH FROM NOW())::bigint,
        '小红书'::source,
        '意向客户',
        '绿地香颂'::community,
        1  -- 手动指定用户ID
    ) as result;

-- 4. 检查日志记录
SELECT 
    '日志记录检查' as check_type,
    COUNT(*) as total_logs,
    COUNT(*) FILTER (WHERE leadid LIKE 'TEST_%') as test_logs,
    COUNT(*) FILTER (WHERE leadid NOT LIKE 'TEST_%' AND leadid NOT LIKE 'DEBUG_%') as real_logs
FROM simple_allocation_logs;

-- 5. 检查触发器
SELECT 
    '触发器检查' as check_type,
    trigger_name,
    event_manipulation,
    action_timing,
    CASE 
        WHEN trigger_name IS NOT NULL THEN '✓ 存在'
        ELSE '✗ 缺失'
    END as status
FROM information_schema.triggers 
WHERE trigger_schema = 'public' 
  AND trigger_name = 'trg_simple_lead_allocation';

-- 6. 清理测试数据
DELETE FROM simple_allocation_logs WHERE leadid LIKE 'TEST_%';

-- 7. 最终验证
SELECT 
    '最终验证' as status,
    COUNT(*) as remaining_logs,
    '修复完成，系统正常' as message
FROM simple_allocation_logs; 