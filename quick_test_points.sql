-- =====================================
-- 积分分配系统快速测试脚本
-- 目标：快速验证核心功能是否正常
-- =====================================

-- =====================================
-- 1. 快速验证：检查系统组件
-- =====================================

-- 检查积分分配枚举是否存在
SELECT 
    '积分分配枚举检查' as test_name,
    CASE 
        WHEN EXISTS (
            SELECT 1 FROM pg_enum 
            WHERE enumtypid = 'allocation_method'::regtype 
            AND enumlabel = 'points'
        ) THEN '✅ 积分分配枚举存在'
        ELSE '❌ 积分分配枚举不存在'
    END as result;

-- 检查积分成本表是否存在
SELECT 
    '积分成本表检查' as test_name,
    CASE 
        WHEN EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'lead_points_cost') 
        THEN '✅ 积分成本表存在'
        ELSE '❌ 积分成本表不存在'
    END as result;

-- 检查分配日志表是否有积分字段
SELECT 
    '分配日志积分字段检查' as test_name,
    CASE 
        WHEN EXISTS (
            SELECT 1 FROM information_schema.columns 
            WHERE table_name = 'simple_allocation_logs' 
            AND column_name = 'points_cost'
        ) THEN '✅ 积分字段存在'
        ELSE '❌ 积分字段不存在'
    END as result;

-- =====================================
-- 2. 快速验证：测试积分成本计算
-- =====================================

-- 测试基础积分成本计算
SELECT 
    '基础积分成本测试' as test_name,
    CASE 
        WHEN (calculate_lead_points_cost('抖音'::source, '意向客户', NULL, NULL, NULL)->>'success')::boolean 
        THEN '✅ 基础积分成本计算正常'
        ELSE '❌ 基础积分成本计算失败'
    END as result,
    calculate_lead_points_cost('抖音'::source, '意向客户', NULL, NULL, NULL) as cost_details;

-- =====================================
-- 3. 快速验证：测试积分分配逻辑
-- =====================================

-- 检查是否有测试用户
DO $$
DECLARE
    user_count integer;
    test_user_id bigint;
BEGIN
    -- 检查测试用户是否存在
    SELECT COUNT(*) INTO user_count FROM users_profile WHERE id IN (1001, 1002, 1003);
    
    IF user_count = 0 THEN
        RAISE NOTICE '⚠️ 未找到测试用户，创建测试用户...';
        
        -- 创建测试用户
        INSERT INTO users_profile (id, name, email, phone, status, organization_id, created_at, updated_at)
        VALUES 
            (1001, '测试用户A', 'test_a@example.com', '13800138001', 'active', 1, NOW(), NOW()),
            (1002, '测试用户B', 'test_b@example.com', '13800138002', 'active', 1, NOW(), NOW()),
            (1003, '测试用户C', 'test_c@example.com', '13800138003', 'active', 1, NOW(), NOW());
            
        -- 创建积分钱包
        INSERT INTO user_points_wallet (user_id, total_points, created_at, updated_at)
        VALUES 
            (1001, 100, NOW(), NOW()),
            (1002, 50, NOW(), NOW()),
            (1003, 200, NOW(), NOW());
            
        RAISE NOTICE '✅ 测试用户创建完成';
    ELSE
        RAISE NOTICE '✅ 测试用户已存在';
    END IF;
    
    -- 测试积分分配
    SELECT allocate_from_users(ARRAY[1001, 1002, 1003], 'points'::allocation_method, 50) INTO test_user_id;
    
    IF test_user_id IS NOT NULL THEN
        RAISE NOTICE '✅ 积分分配逻辑正常，选中用户ID: %', test_user_id;
    ELSE
        RAISE NOTICE '❌ 积分分配逻辑失败，没有找到合适的用户';
    END IF;
END $$;

-- =====================================
-- 4. 快速验证：创建测试线索
-- =====================================

-- 创建测试线索
INSERT INTO leads (
    leadid, source, leadtype, campaignname, unitname, remark, 
    phone, wechat, created_at, updated_at
) VALUES (
    'QUICK_TEST_' || EXTRACT(EPOCH FROM NOW())::bigint,
    '抖音'::source,
    '意向客户',
    '快速测试广告',
    '测试单元',
    '快速测试[COMMUNITY:浦江公园社区]',
    '13900139099',
    'quick_test_099',
    NOW(),
    NOW()
);

-- =====================================
-- 5. 快速验证：查看测试结果
-- =====================================

-- 查看分配结果
SELECT 
    '分配结果' as test_type,
    leadid,
    assigned_user_id,
    allocation_method,
    points_cost,
    user_balance_before,
    user_balance_after,
    created_at
FROM simple_allocation_logs 
WHERE leadid LIKE 'QUICK_TEST_%'
ORDER BY created_at DESC;

-- 查看积分交易
SELECT 
    '积分交易' as test_type,
    user_id,
    points_change,
    balance_after,
    transaction_type,
    description,
    created_at
FROM user_points_transactions 
WHERE description LIKE '%QUICK_TEST_%'
ORDER BY created_at DESC;

-- 查看followups
SELECT 
    'Followups' as test_type,
    leadid,
    leadtype,
    followupstage,
    interviewsales_user_id,
    created_at
FROM followups 
WHERE leadid LIKE 'QUICK_TEST_%'
ORDER BY created_at DESC;

-- =====================================
-- 6. 快速验证：系统状态检查
-- =====================================

-- 检查系统验证函数
SELECT 
    '系统验证' as test_type,
    CASE 
        WHEN EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'validate_points_allocation_system') 
        THEN '✅ 积分分配系统验证函数存在'
        ELSE '❌ 积分分配系统验证函数不存在'
    END as validation_function,
    CASE 
        WHEN EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'validate_allocation_system') 
        THEN '✅ 分配系统验证函数存在'
        ELSE '❌ 分配系统验证函数不存在'
    END as allocation_function;

-- =====================================
-- 7. 测试结果总结
-- =====================================

SELECT 
    '快速测试完成' as summary,
    '请查看上述结果验证积分分配功能' as note,
    NOW() as test_time; 