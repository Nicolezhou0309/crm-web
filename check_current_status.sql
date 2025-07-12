-- =====================================
-- 快速检查：当前数据库状态
-- 目标：验证积分分配系统配置和状态
-- =====================================

-- =====================================
-- 1. 检查系统组件
-- =====================================

-- 检查积分分配枚举
SELECT 
    '积分分配枚举' as component,
    CASE 
        WHEN EXISTS (
            SELECT 1 FROM pg_enum 
            WHERE enumtypid = 'allocation_method'::regtype 
            AND enumlabel = 'points'
        ) THEN '✅ 存在'
        ELSE '❌ 不存在'
    END as status;

-- 检查积分成本表
SELECT 
    '积分成本表' as component,
    CASE 
        WHEN EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'lead_points_cost') 
        THEN '✅ 存在'
        ELSE '❌ 不存在'
    END as status;

-- 检查分配日志积分字段
SELECT 
    '分配日志积分字段' as component,
    CASE 
        WHEN EXISTS (
            SELECT 1 FROM information_schema.columns 
            WHERE table_name = 'simple_allocation_logs' 
            AND column_name = 'points_cost'
        ) THEN '✅ 存在'
        ELSE '❌ 不存在'
    END as status;

-- =====================================
-- 2. 检查函数
-- =====================================

-- 检查积分相关函数
SELECT 
    '积分成本计算函数' as function_name,
    CASE 
        WHEN EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'calculate_lead_points_cost') 
        THEN '✅ 存在'
        ELSE '❌ 不存在'
    END as status

UNION ALL

SELECT 
    '积分分配函数' as function_name,
    CASE 
        WHEN EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'allocate_from_users') 
        THEN '✅ 存在'
        ELSE '❌ 不存在'
    END as status

UNION ALL

SELECT 
    '积分扣除函数' as function_name,
    CASE 
        WHEN EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'process_points_deduction') 
        THEN '✅ 存在'
        ELSE '❌ 不存在'
    END as status;

-- =====================================
-- 3. 检查触发器
-- =====================================

-- 检查分配触发器
SELECT 
    '分配触发器' as trigger_name,
    CASE 
        WHEN EXISTS (
            SELECT 1 FROM information_schema.triggers 
            WHERE trigger_name = 'trg_simple_lead_allocation'
        ) THEN '✅ 存在'
        ELSE '❌ 不存在'
    END as status;

-- =====================================
-- 4. 检查数据
-- =====================================

-- 检查用户数据
SELECT 
    '用户数据' as data_type,
    COUNT(*) as total_users,
    COUNT(*) FILTER (WHERE status = 'active') as active_users
FROM users_profile;

-- 检查积分钱包数据
SELECT 
    '积分钱包数据' as data_type,
    COUNT(*) as total_wallets,
    SUM(total_points) as total_points,
    AVG(total_points) as avg_points
FROM user_points_wallet;

-- 检查用户组数据
SELECT 
    '用户组数据' as data_type,
    COUNT(*) as total_groups,
    COUNT(*) FILTER (WHERE allocation = 'points') as points_groups
FROM users_list;

-- 检查分配规则数据
SELECT 
    '分配规则数据' as data_type,
    COUNT(*) as total_rules,
    COUNT(*) FILTER (WHERE allocation_method = 'points') as points_rules
FROM simple_allocation_rules;

-- 检查积分成本规则数据
SELECT 
    '积分成本规则数据' as data_type,
    COUNT(*) as total_rules,
    COUNT(*) FILTER (WHERE is_active = true) as active_rules
FROM lead_points_cost;

-- =====================================
-- 5. 检查测试用户
-- =====================================

-- 检查测试用户是否存在
SELECT 
    '测试用户A' as user_name,
    CASE 
        WHEN EXISTS (SELECT 1 FROM users_profile WHERE id = 1001) THEN '✅ 存在'
        ELSE '❌ 不存在'
    END as status

UNION ALL

SELECT 
    '测试用户B' as user_name,
    CASE 
        WHEN EXISTS (SELECT 1 FROM users_profile WHERE id = 1002) THEN '✅ 存在'
        ELSE '❌ 不存在'
    END as status

UNION ALL

SELECT 
    '测试用户C' as user_name,
    CASE 
        WHEN EXISTS (SELECT 1 FROM users_profile WHERE id = 1003) THEN '✅ 存在'
        ELSE '❌ 不存在'
    END as status;

-- 检查测试用户积分
SELECT 
    up.name as user_name,
    upw.total_points as points,
    CASE 
        WHEN upw.total_points >= 50 THEN '✅ 足够'
        ELSE '❌ 不足'
    END as status
FROM users_profile up
LEFT JOIN user_points_wallet upw ON up.id = upw.user_id
WHERE up.id IN (1001, 1002, 1003)
ORDER BY up.id;

-- =====================================
-- 6. 检查最近的分配记录
-- =====================================

-- 查看最近的分配日志
SELECT 
    '最近分配记录' as record_type,
    COUNT(*) as total_records,
    COUNT(*) FILTER (WHERE points_cost IS NOT NULL) as points_records,
    COUNT(*) FILTER (WHERE allocation_method = 'points') as points_allocations
FROM simple_allocation_logs 
WHERE created_at >= NOW() - INTERVAL '1 hour';

-- 查看最近的积分交易
SELECT 
    '最近积分交易' as record_type,
    COUNT(*) as total_transactions,
    COUNT(*) FILTER (WHERE transaction_type = 'DEDUCT') as deductions,
    COUNT(*) FILTER (WHERE transaction_type = 'ADD') as additions
FROM user_points_transactions 
WHERE created_at >= NOW() - INTERVAL '1 hour';

-- =====================================
-- 7. 系统验证
-- =====================================

-- 验证积分分配系统
SELECT 
    '积分分配系统验证' as validation_type,
    CASE 
        WHEN EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'validate_points_allocation_system') 
        THEN public.validate_points_allocation_system()
        ELSE '{"error": "验证函数不存在"}'::jsonb
    END as result;

-- 验证分配系统
SELECT 
    '分配系统验证' as validation_type,
    CASE 
        WHEN EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'validate_allocation_system') 
        THEN public.validate_allocation_system()
        ELSE '{"error": "验证函数不存在"}'::jsonb
    END as result;

-- =====================================
-- 8. 快速测试
-- =====================================

-- 测试积分成本计算
SELECT 
    '积分成本计算测试' as test_type,
    CASE 
        WHEN EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'calculate_lead_points_cost') 
        THEN calculate_lead_points_cost('抖音'::source, '意向客户', NULL, NULL, NULL)
        ELSE '{"error": "函数不存在"}'::jsonb
    END as result;

-- 测试积分分配
SELECT 
    '积分分配测试' as test_type,
    CASE 
        WHEN EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'allocate_from_users') 
        THEN allocate_from_users(ARRAY[1001, 1002, 1003], 'points'::allocation_method, 50)::text
        ELSE '函数不存在'
    END as selected_user_id;

-- =====================================
-- 9. 状态总结
-- =====================================

SELECT 
    '系统状态总结' as summary_type,
    CASE 
        WHEN EXISTS (SELECT 1 FROM pg_enum WHERE enumtypid = 'allocation_method'::regtype AND enumlabel = 'points')
        AND EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'lead_points_cost')
        AND EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'calculate_lead_points_cost')
        AND EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'allocate_from_users')
        THEN '✅ 积分分配系统已就绪'
        ELSE '❌ 积分分配系统未完全配置'
    END as system_status,
    NOW() as check_time; 