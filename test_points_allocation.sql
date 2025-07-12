-- =====================================
-- 积分分配系统全面测试脚本
-- 目标：验证积分分配功能的所有组件
-- =====================================

-- =====================================
-- 1. 数据准备：创建测试用户和积分钱包
-- =====================================

-- 创建测试用户（如果不存在）
INSERT INTO users_profile (id, name, email, phone, status, organization_id, created_at, updated_at)
SELECT 
    1001, '测试用户A', 'test_a@example.com', '13800138001', 'active', 1, NOW(), NOW()
WHERE NOT EXISTS (SELECT 1 FROM users_profile WHERE id = 1001)

UNION ALL

SELECT 
    1002, '测试用户B', 'test_b@example.com', '13800138002', 'active', 1, NOW(), NOW()
WHERE NOT EXISTS (SELECT 1 FROM users_profile WHERE id = 1002)

UNION ALL

SELECT 
    1003, '测试用户C', 'test_c@example.com', '13800138003', 'active', 1, NOW(), NOW()
WHERE NOT EXISTS (SELECT 1 FROM users_profile WHERE id = 1003);

-- 创建积分钱包（如果不存在）
INSERT INTO user_points_wallet (user_id, total_points, created_at, updated_at)
SELECT 
    1001, 100, NOW(), NOW()
WHERE NOT EXISTS (SELECT 1 FROM user_points_wallet WHERE user_id = 1001)

UNION ALL

SELECT 
    1002, 50, NOW(), NOW()
WHERE NOT EXISTS (SELECT 1 FROM user_points_wallet WHERE user_id = 1002)

UNION ALL

SELECT 
    1003, 200, NOW(), NOW()
WHERE NOT EXISTS (SELECT 1 FROM user_points_wallet WHERE user_id = 1003);

-- =====================================
-- 2. 创建测试用户组
-- =====================================

-- 创建积分分配测试组
INSERT INTO users_list (id, groupname, list, description, allocation, enable_quality_control, enable_community_matching)
SELECT 
    100, '积分分配测试组', ARRAY[1001, 1002, 1003], '用于测试积分分配功能的用户组', 'points'::allocation_method, false, false
WHERE NOT EXISTS (SELECT 1 FROM users_list WHERE id = 100);

-- =====================================
-- 3. 创建测试分配规则
-- =====================================

-- 创建积分分配测试规则
SELECT create_simple_allocation_rule(
    '积分分配测试规则',
    '用于测试积分分配功能的规则',
    ARRAY[100], -- 用户组ID
    '{"sources": ["抖音", "微信", "百度"]}',
    'points'::allocation_method,
    false,
    1000 -- 高优先级
);

-- =====================================
-- 4. 创建测试积分成本规则
-- =====================================

-- 删除可能存在的测试规则
DELETE FROM lead_points_cost WHERE name LIKE '测试%';

-- 创建基础测试成本规则
SELECT create_lead_points_cost_rule(
    '测试基础成本',
    '测试用的基础积分成本规则',
    30,
    '{}',
    '{}',
    100
);

-- 创建动态调整测试规则
SELECT create_lead_points_cost_rule(
    '测试动态成本',
    '测试动态成本调整的规则',
    25,
    '{"lead_types": ["意向客户", "准客户"]}',
    '{
        "source_adjustments": {
            "抖音": 10,
            "微信": 5,
            "百度": -5
        },
        "leadtype_adjustments": {
            "意向客户": 15,
            "准客户": 10
        },
        "keyword_adjustments": {
            "高端": 20,
            "别墅": 30,
            "学区房": 15
        }
    }',
    200
);

-- =====================================
-- 5. 功能测试
-- =====================================

-- 5.1 测试积分成本计算
DO $$
DECLARE
    cost_result jsonb;
    test_result text := '';
BEGIN
    RAISE NOTICE '=== 测试积分成本计算 ===';
    
    -- 测试基础成本
    SELECT calculate_lead_points_cost('抖音'::source, '意向客户', '高端别墅广告', '别墅单元', '高端别墅[COMMUNITY:浦江公园社区]') INTO cost_result;
    test_result := test_result || '基础成本测试: ' || cost_result::text || E'\n';
    
    -- 测试动态调整
    SELECT calculate_lead_points_cost('微信'::source, '准客户', '学区房广告', '学区单元', '学区房[COMMUNITY:浦江公园社区]') INTO cost_result;
    test_result := test_result || '动态调整测试: ' || cost_result::text || E'\n';
    
    RAISE NOTICE '%', test_result;
END $$;

-- 5.2 测试积分分配逻辑
DO $$
DECLARE
    allocation_result jsonb;
    test_result text := '';
BEGIN
    RAISE NOTICE '=== 测试积分分配逻辑 ===';
    
    -- 测试积分分配（用户C积分最多，应该被选中）
    SELECT allocate_from_users(ARRAY[1001, 1002, 1003], 'points'::allocation_method, 50) INTO allocation_result;
    test_result := test_result || '积分分配测试: ' || allocation_result::text || E'\n';
    
    RAISE NOTICE '%', test_result;
END $$;

-- 5.3 测试完整分配流程
DO $$
DECLARE
    allocation_result jsonb;
    test_result text := '';
BEGIN
    RAISE NOTICE '=== 测试完整分配流程 ===';
    
    -- 测试完整分配
    SELECT allocate_lead_simple(
        'TEST_LEAD_' || EXTRACT(EPOCH FROM NOW())::bigint,
        '抖音'::source,
        '意向客户',
        '浦江公园社区'::community,
        NULL
    ) INTO allocation_result;
    
    test_result := test_result || '完整分配测试: ' || allocation_result::text || E'\n';
    
    RAISE NOTICE '%', test_result;
END $$;

-- =====================================
-- 6. 创建测试线索进行实际分配测试
-- =====================================

-- 6.1 创建测试线索1：高价值线索
INSERT INTO leads (
    leadid, source, leadtype, campaignname, unitname, remark, 
    phone, wechat, created_at, updated_at
) VALUES (
    'TEST_HIGH_VALUE_' || EXTRACT(EPOCH FROM NOW())::bigint,
    '抖音'::source,
    '意向客户',
    '高端别墅广告',
    '别墅单元',
    '高端别墅[COMMUNITY:浦江公园社区]',
    '13900139001',
    'test_high_001',
    NOW(),
    NOW()
);

-- 6.2 创建测试线索2：普通线索
INSERT INTO leads (
    leadid, source, leadtype, campaignname, unitname, remark, 
    phone, wechat, created_at, updated_at
) VALUES (
    'TEST_NORMAL_' || EXTRACT(EPOCH FROM NOW())::bigint,
    '微信'::source,
    '准客户',
    '普通广告',
    '普通单元',
    '普通线索[COMMUNITY:浦江公园社区]',
    '13900139002',
    'test_normal_002',
    NOW(),
    NOW()
);

-- 6.3 创建测试线索3：低价值线索
INSERT INTO leads (
    leadid, source, leadtype, campaignname, unitname, remark, 
    phone, wechat, created_at, updated_at
) VALUES (
    'TEST_LOW_VALUE_' || EXTRACT(EPOCH FROM NOW())::bigint,
    '百度'::source,
    '潜在客户',
    '基础广告',
    '基础单元',
    '基础线索[COMMUNITY:浦江公园社区]',
    '13900139003',
    'test_low_003',
    NOW(),
    NOW()
);

-- =====================================
-- 7. 验证测试结果
-- =====================================

-- 7.1 查看分配日志
SELECT 
    '分配日志' as test_type,
    leadid,
    assigned_user_id,
    allocation_method,
    points_cost,
    user_balance_before,
    user_balance_after,
    created_at
FROM simple_allocation_logs 
WHERE leadid LIKE 'TEST_%'
ORDER BY created_at DESC;

-- 7.2 查看积分交易记录
SELECT 
    '积分交易' as test_type,
    user_id,
    points_change,
    balance_after,
    transaction_type,
    description,
    created_at
FROM user_points_transactions 
WHERE description LIKE '%TEST_%'
ORDER BY created_at DESC;

-- 7.3 查看用户积分余额变化
SELECT 
    '用户积分余额' as test_type,
    upw.user_id,
    up.name as user_name,
    upw.total_points as current_balance,
    upw.updated_at
FROM user_points_wallet upw
JOIN users_profile up ON up.id = upw.user_id
WHERE upw.user_id IN (1001, 1002, 1003)
ORDER BY upw.user_id;

-- 7.4 查看followups记录
SELECT 
    'Followups记录' as test_type,
    leadid,
    leadtype,
    followupstage,
    interviewsales_user_id,
    created_at
FROM followups 
WHERE leadid LIKE 'TEST_%'
ORDER BY created_at DESC;

-- =====================================
-- 8. 测试积分不足的情况
-- =====================================

-- 8.1 清空用户A的积分
UPDATE user_points_wallet SET total_points = 0 WHERE user_id = 1001;

-- 8.2 创建测试线索4：测试积分不足
INSERT INTO leads (
    leadid, source, leadtype, campaignname, unitname, remark, 
    phone, wechat, created_at, updated_at
) VALUES (
    'TEST_INSUFFICIENT_' || EXTRACT(EPOCH FROM NOW())::bigint,
    '抖音'::source,
    '意向客户',
    '测试积分不足',
    '测试单元',
    '测试积分不足[COMMUNITY:浦江公园社区]',
    '13900139004',
    'test_insufficient_004',
    NOW(),
    NOW()
);

-- 8.3 查看积分不足的分配结果
SELECT 
    '积分不足测试' as test_type,
    leadid,
    processing_details
FROM simple_allocation_logs 
WHERE leadid LIKE 'TEST_INSUFFICIENT_%'
ORDER BY created_at DESC;

-- =====================================
-- 9. 系统验证
-- =====================================

-- 9.1 验证积分分配系统
SELECT public.validate_points_allocation_system() AS system_validation;

-- 9.2 验证分配系统
SELECT public.validate_allocation_system() AS allocation_validation;

-- =====================================
-- 10. 清理测试数据（可选）
-- =====================================

-- 注意：以下清理语句默认注释，如需清理请取消注释

/*
-- 清理测试线索
DELETE FROM leads WHERE leadid LIKE 'TEST_%';

-- 清理测试分配日志
DELETE FROM simple_allocation_logs WHERE leadid LIKE 'TEST_%';

-- 清理测试积分交易
DELETE FROM user_points_transactions WHERE description LIKE '%TEST_%';

-- 清理测试用户（谨慎操作）
-- DELETE FROM users_profile WHERE id IN (1001, 1002, 1003);
-- DELETE FROM user_points_wallet WHERE user_id IN (1001, 1002, 1003);

-- 清理测试用户组
-- DELETE FROM users_list WHERE id = 100;

-- 清理测试规则
-- DELETE FROM simple_allocation_rules WHERE name LIKE '%测试%';
-- DELETE FROM lead_points_cost WHERE name LIKE '%测试%';
*/

-- =====================================
-- 11. 测试结果总结
-- =====================================

SELECT 
    '测试总结' as summary_type,
    '积分分配系统测试完成' as status,
    '请查看上述测试结果验证功能是否正常' as note,
    NOW() as test_time; 