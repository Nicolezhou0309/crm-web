-- =====================================
-- 积分分配功能快速部署脚本
-- 目标：一键部署积分分配功能
-- 执行顺序：4 (在所有基础脚本之后)
-- =====================================

-- =====================================
-- 1. 执行积分分配模式集成脚本
-- =====================================

-- 执行主要的积分分配脚本
\i sql-scripts/allocation/03_points_as_allocation_method.sql

-- =====================================
-- 2. 配置示例用户组
-- =====================================

-- 为现有用户组配置积分分配模式
UPDATE users_list 
SET allocation = 'points'::allocation_method,
    description = '高级销售组，使用积分分配模式'
WHERE groupname = '高级销售组';

-- 为其他用户组保持传统分配模式
UPDATE users_list 
SET allocation = 'round_robin'::allocation_method,
    description = '新手销售组，使用轮流分配模式'
WHERE groupname = '新手销售组';

UPDATE users_list 
SET allocation = 'workload'::allocation_method,
    description = '默认销售组，使用工作量分配模式'
WHERE groupname = '默认销售组';

-- =====================================
-- 3. 创建基础积分成本规则
-- =====================================

-- 创建默认积分成本规则
SELECT create_lead_points_cost_rule(
    '默认线索成本',
    '所有线索的默认积分成本',
    30,
    '{}',
    '{}',
    100
);

-- 创建高价值线索成本规则
SELECT create_lead_points_cost_rule(
    '高价值线索成本',
    '高价值线索的积分成本',
    50,
    '{"lead_types": ["意向客户", "准客户"]}',
    '{"source_adjustments": {"抖音": 10, "微信": 5}}',
    200
);

-- 创建特定社区成本规则
SELECT create_lead_points_cost_rule(
    '浦江公园社区成本',
    '浦江公园社区线索的积分成本',
    45,
    '{"keywords": ["浦江公园"]}',
    '{"keyword_adjustments": {"浦江公园": 15}}',
    150
);

-- 创建VIP客户成本规则
SELECT create_lead_points_cost_rule(
    'VIP客户成本',
    'VIP客户的积分成本',
    80,
    '{"lead_types": ["VIP客户"]}',
    '{"source_adjustments": {"抖音": 20, "微信": 15}}',
    300
);

-- =====================================
-- 4. 为用户分配初始积分
-- =====================================

-- 为活跃用户分配初始积分
SELECT batch_update_user_points(
    ARRAY(SELECT id FROM users_profile WHERE status = 'active'),
    1000, '初始积分分配'
);

-- =====================================
-- 5. 创建积分分配统计视图
-- =====================================

-- 创建积分分配统计视图
CREATE OR REPLACE VIEW public.points_allocation_stats AS
SELECT 
    up.name as user_name,
    upw.total_points as current_balance,
    COUNT(sal.id) as total_allocations,
    COUNT(sal.id) FILTER (WHERE sal.points_cost IS NOT NULL) as points_allocations,
    SUM(COALESCE(sal.points_cost, 0)) as total_points_cost,
    AVG(COALESCE(sal.points_cost, 0)) FILTER (WHERE sal.points_cost IS NOT NULL) as avg_points_cost,
    MAX(sal.created_at) as last_allocation
FROM users_profile up
LEFT JOIN user_points_wallet upw ON up.id = upw.user_id
LEFT JOIN simple_allocation_logs sal ON up.id = sal.assigned_user_id
WHERE up.status = 'active'
GROUP BY up.id, up.name, upw.total_points
ORDER BY total_allocations DESC;

-- 创建积分成本规则统计视图
CREATE OR REPLACE VIEW public.points_cost_rule_stats AS
SELECT 
    lpc.name as rule_name,
    lpc.base_points_cost,
    COUNT(sal.id) as usage_count,
    AVG(sal.points_cost) as avg_points_cost,
    SUM(sal.points_cost) as total_points_cost,
    MIN(sal.created_at) as first_usage,
    MAX(sal.created_at) as last_usage
FROM lead_points_cost lpc
LEFT JOIN simple_allocation_logs sal ON lpc.id = sal.cost_rule_id
WHERE lpc.is_active = true
GROUP BY lpc.id, lpc.name, lpc.base_points_cost
ORDER BY usage_count DESC;

-- =====================================
-- 6. 创建测试函数
-- =====================================

-- 创建测试积分分配的函数
CREATE OR REPLACE FUNCTION public.test_points_allocation(
    p_leadid text DEFAULT NULL,
    p_source source DEFAULT '抖音',
    p_leadtype text DEFAULT '意向客户'
) RETURNS jsonb
LANGUAGE plpgsql
AS $$
DECLARE
    test_leadid text;
    allocation_result jsonb;
BEGIN
    -- 生成测试线索ID
    IF p_leadid IS NULL THEN
        test_leadid := 'TEST_' || EXTRACT(EPOCH FROM NOW())::bigint;
    ELSE
        test_leadid := p_leadid;
    END IF;
    
    -- 执行测试分配
    allocation_result := allocate_lead_simple(
        test_leadid,
        p_source,
        p_leadtype,
        p_community,
        NULL
    );
    
    RETURN jsonb_build_object(
        'test_leadid', test_leadid,
        'test_parameters', jsonb_build_object(
            'source', p_source,
            'leadtype', p_leadtype,
            'community', p_community
        ),
        'allocation_result', allocation_result,
        'test_time', NOW()
    );
END;
$$;

-- =====================================
-- 7. 系统验证
-- =====================================

-- 验证积分分配系统
SELECT '积分分配系统验证结果：' as message;
SELECT public.validate_points_allocation_system() AS validation_result;

-- 显示积分分配统计
SELECT '积分分配统计：' as message;
SELECT * FROM points_allocation_stats LIMIT 10;

-- 显示积分成本规则统计
SELECT '积分成本规则统计：' as message;
SELECT * FROM points_cost_rule_stats;

-- =====================================
-- 8. 部署完成提示
-- =====================================

SELECT '积分分配功能部署完成！' as deployment_status;

-- 显示使用说明
SELECT 
    '使用说明：' as instruction_type,
    '1. 配置用户组分配模式：UPDATE users_list SET allocation = ''points'' WHERE groupname = ''用户组名'';' as instruction_1,
    '2. 创建积分成本规则：SELECT create_lead_points_cost_rule(''规则名'', ''描述'', 基础成本, 条件, 动态调整, 优先级);' as instruction_2,
    '3. 测试积分分配：SELECT test_points_allocation();' as instruction_3,
    '4. 查看统计：SELECT * FROM points_allocation_stats;' as instruction_4;

-- =====================================
-- 9. 清理临时数据（可选）
-- =====================================

-- 如果需要清理测试数据，取消注释以下行
-- DELETE FROM simple_allocation_logs WHERE leadid LIKE 'TEST_%';
-- DELETE FROM leads WHERE leadid LIKE 'TEST_%'; 