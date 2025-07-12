-- =====================================
-- 直接测试：插入数据并检查结果
-- 目标：快速验证积分分配系统功能
-- =====================================

-- =====================================
-- 1. 清理可能存在的测试数据
-- =====================================

-- 清理测试线索
DELETE FROM leads WHERE leadid LIKE 'DIRECT_TEST_%';
DELETE FROM simple_allocation_logs WHERE leadid LIKE 'DIRECT_TEST_%';
DELETE FROM user_points_transactions WHERE description LIKE '%DIRECT_TEST_%';
DELETE FROM followups WHERE leadid LIKE 'DIRECT_TEST_%';

-- =====================================
-- 2. 确保测试用户存在
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
-- 3. 确保测试用户组存在
-- =====================================

-- 创建积分分配测试组
INSERT INTO users_list (id, groupname, list, description, allocation, enable_quality_control, enable_community_matching)
SELECT 
    100, '积分分配测试组', ARRAY[1001, 1002, 1003], '用于测试积分分配功能的用户组', 'points'::allocation_method, false, false
WHERE NOT EXISTS (SELECT 1 FROM users_list WHERE id = 100);

-- =====================================
-- 4. 确保测试分配规则存在
-- =====================================

-- 创建积分分配测试规则
INSERT INTO simple_allocation_rules (id, name, description, is_active, priority, conditions, user_groups, allocation_method, enable_permission_check, created_at, updated_at)
SELECT 
    gen_random_uuid(), '积分分配测试规则', '用于测试积分分配功能的规则', true, 1000,
    '{"sources": ["抖音", "微信", "百度"]}'::jsonb,
    ARRAY[100], 'points'::allocation_method, false, NOW(), NOW()
WHERE NOT EXISTS (SELECT 1 FROM simple_allocation_rules WHERE name = '积分分配测试规则');

-- =====================================
-- 5. 确保测试积分成本规则存在
-- =====================================

-- 删除可能存在的测试规则
DELETE FROM lead_points_cost WHERE name LIKE '测试%';

-- 创建基础测试成本规则
INSERT INTO lead_points_cost (id, name, description, is_active, base_points_cost, conditions, dynamic_cost_config, priority, created_at, updated_at)
VALUES 
    (gen_random_uuid(), '测试基础成本', '测试用的基础积分成本规则', true, 30, '{}'::jsonb, '{}'::jsonb, 100, NOW(), NOW()),
    (gen_random_uuid(), '测试动态成本', '测试动态成本调整的规则', true, 25, 
     '{"lead_types": ["意向客户", "准客户"]}'::jsonb,
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
     }'::jsonb, 200, NOW(), NOW());

-- =====================================
-- 6. 检查当前状态
-- =====================================

-- 检查测试用户
SELECT '测试用户状态' as check_type, COUNT(*) as count FROM users_profile WHERE id IN (1001, 1002, 1003);

-- 检查积分钱包
SELECT '积分钱包状态' as check_type, user_id, total_points FROM user_points_wallet WHERE user_id IN (1001, 1002, 1003);

-- 检查用户组
SELECT '用户组状态' as check_type, id, groupname, list FROM users_list WHERE id = 100;

-- 检查分配规则
SELECT '分配规则状态' as check_type, name, is_active, allocation_method FROM simple_allocation_rules WHERE name = '积分分配测试规则';

-- 检查积分成本规则
SELECT '积分成本规则状态' as check_type, name, is_active, base_points_cost FROM lead_points_cost WHERE name LIKE '测试%';

-- =====================================
-- 7. 测试积分成本计算
-- =====================================

-- 测试基础成本计算
SELECT 
    '基础成本测试' as test_name,
    calculate_lead_points_cost('抖音'::source, '意向客户', NULL, NULL, NULL) as result;

-- 测试动态成本计算
SELECT 
    '动态成本测试' as test_name,
    calculate_lead_points_cost('抖音'::source, '意向客户', '高端别墅广告', '别墅单元', '高端别墅[COMMUNITY:浦江公园社区]') as result;

-- =====================================
-- 8. 测试积分分配逻辑
-- =====================================

-- 测试积分分配
SELECT 
    '积分分配测试' as test_name,
    allocate_from_users(ARRAY[1001, 1002, 1003], 'points'::allocation_method, 50) as selected_user_id;

-- =====================================
-- 9. 插入测试线索
-- =====================================

-- 插入高价值线索
INSERT INTO leads (
    leadid, source, leadtype, campaignname, unitname, remark, 
    phone, wechat, created_at, updated_at
) VALUES (
    'DIRECT_TEST_HIGH_VALUE_' || EXTRACT(EPOCH FROM NOW())::bigint,
    '抖音'::source,
    '意向客户',
    '高端别墅广告',
    '别墅单元',
    '高端别墅[COMMUNITY:浦江公园社区]',
    '13900139001',
    'direct_test_high_001',
    NOW(),
    NOW()
);

-- 插入普通线索
INSERT INTO leads (
    leadid, source, leadtype, campaignname, unitname, remark, 
    phone, wechat, created_at, updated_at
) VALUES (
    'DIRECT_TEST_NORMAL_' || EXTRACT(EPOCH FROM NOW())::bigint,
    '微信'::source,
    '准客户',
    '普通广告',
    '普通单元',
    '普通线索[COMMUNITY:浦江公园社区]',
    '13900139002',
    'direct_test_normal_002',
    NOW(),
    NOW()
);

-- 插入低价值线索
INSERT INTO leads (
    leadid, source, leadtype, campaignname, unitname, remark, 
    phone, wechat, created_at, updated_at
) VALUES (
    'DIRECT_TEST_LOW_VALUE_' || EXTRACT(EPOCH FROM NOW())::bigint,
    '百度'::source,
    '潜在客户',
    '基础广告',
    '基础单元',
    '基础线索[COMMUNITY:浦江公园社区]',
    '13900139003',
    'direct_test_low_003',
    NOW(),
    NOW()
);

-- =====================================
-- 10. 等待触发器处理（模拟延迟）
-- =====================================

-- 等待1秒让触发器处理
SELECT pg_sleep(1);

-- =====================================
-- 11. 检查分配结果
-- =====================================

-- 查看分配日志
SELECT 
    '分配日志' as result_type,
    leadid,
    assigned_user_id,
    allocation_method,
    points_cost,
    user_balance_before,
    user_balance_after,
    created_at
FROM simple_allocation_logs 
WHERE leadid LIKE 'DIRECT_TEST_%'
ORDER BY created_at DESC;

-- 查看积分交易
SELECT 
    '积分交易' as result_type,
    user_id,
    points_change,
    balance_after,
    transaction_type,
    description,
    created_at
FROM user_points_transactions 
WHERE description LIKE '%DIRECT_TEST_%'
ORDER BY created_at DESC;

-- 查看followups
SELECT 
    'Followups' as result_type,
    leadid,
    leadtype,
    followupstage,
    interviewsales_user_id,
    created_at
FROM followups 
WHERE leadid LIKE 'DIRECT_TEST_%'
ORDER BY created_at DESC;

-- =====================================
-- 12. 检查用户积分余额变化
-- =====================================

-- 查看用户积分余额
SELECT 
    '用户积分余额' as result_type,
    upw.user_id,
    up.name as user_name,
    upw.total_points as current_balance,
    upw.updated_at
FROM user_points_wallet upw
JOIN users_profile up ON up.id = upw.user_id
WHERE upw.user_id IN (1001, 1002, 1003)
ORDER BY upw.user_id;

-- =====================================
-- 13. 测试积分不足的情况
-- =====================================

-- 清空用户A的积分
UPDATE user_points_wallet SET total_points = 0 WHERE user_id = 1001;

-- 插入测试线索（积分不足）
INSERT INTO leads (
    leadid, source, leadtype, campaignname, unitname, remark, 
    phone, wechat, created_at, updated_at
) VALUES (
    'DIRECT_TEST_INSUFFICIENT_' || EXTRACT(EPOCH FROM NOW())::bigint,
    '抖音'::source,
    '意向客户',
    '测试积分不足',
    '测试单元',
    '测试积分不足[COMMUNITY:浦江公园社区]',
    '13900139004',
    'direct_test_insufficient_004',
    NOW(),
    NOW()
);

-- 等待触发器处理
SELECT pg_sleep(1);

-- 查看积分不足的分配结果
SELECT 
    '积分不足测试' as result_type,
    leadid,
    processing_details
FROM simple_allocation_logs 
WHERE leadid LIKE 'DIRECT_TEST_INSUFFICIENT_%'
ORDER BY created_at DESC;

-- =====================================
-- 14. 系统验证
-- =====================================

-- 验证积分分配系统
SELECT 
    '系统验证' as result_type,
    public.validate_points_allocation_system() AS system_validation;

-- 验证分配系统
SELECT 
    '分配系统验证' as result_type,
    public.validate_allocation_system() AS allocation_validation;

-- =====================================
-- 15. 测试结果总结
-- =====================================

-- 统计测试结果
SELECT 
    '测试总结' as summary_type,
    COUNT(*) as total_leads,
    COUNT(DISTINCT assigned_user_id) as unique_assigned_users,
    AVG(points_cost) as avg_points_cost,
    SUM(points_cost) as total_points_deducted
FROM simple_allocation_logs 
WHERE leadid LIKE 'DIRECT_TEST_%' AND assigned_user_id IS NOT NULL;

-- 检查是否有失败的分配
SELECT 
    '失败分配检查' as check_type,
    COUNT(*) as failed_allocations
FROM simple_allocation_logs 
WHERE leadid LIKE 'DIRECT_TEST_%' AND assigned_user_id IS NULL;

-- =====================================
-- 16. 清理测试数据（可选）
-- =====================================

-- 注意：以下清理语句默认注释，如需清理请取消注释

/*
-- 清理测试线索
DELETE FROM leads WHERE leadid LIKE 'DIRECT_TEST_%';

-- 清理测试分配日志
DELETE FROM simple_allocation_logs WHERE leadid LIKE 'DIRECT_TEST_%';

-- 清理测试积分交易
DELETE FROM user_points_transactions WHERE description LIKE '%DIRECT_TEST_%';

-- 清理测试followups
DELETE FROM followups WHERE leadid LIKE 'DIRECT_TEST_%';

-- 恢复用户A的积分
UPDATE user_points_wallet SET total_points = 100 WHERE user_id = 1001;
*/

-- =====================================
-- 17. 最终状态报告
-- =====================================

SELECT 
    '最终状态报告' as report_type,
    '积分分配系统测试完成' as status,
    '请查看上述结果验证功能是否正常' as note,
    NOW() as test_time; 