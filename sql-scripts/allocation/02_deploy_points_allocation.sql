-- =====================================
-- 积分分配功能完整部署脚本
-- 目标：部署完整的积分分配系统
-- 执行顺序：2 (在简化分配系统之后)
-- =====================================

-- 开始事务
BEGIN;

-- =====================================
-- 1. 执行积分分配集成脚本
-- =====================================

-- 执行积分分配集成脚本
\i sql-scripts/allocation/01_points_allocation_integration.sql

-- =====================================
-- 2. 更新现有触发器
-- =====================================

-- 删除旧的触发器
DROP TRIGGER IF EXISTS trg_simple_lead_allocation ON public.leads;

-- 创建新的带积分功能的触发器
CREATE TRIGGER trg_simple_lead_allocation
AFTER INSERT ON public.leads
FOR EACH ROW
EXECUTE FUNCTION simple_lead_allocation_trigger_with_points();

-- =====================================
-- 3. 创建示例数据
-- =====================================

-- 3.1 创建更多示例积分成本规则
SELECT create_lead_points_cost_rule(
    '电话线索成本',
    '电话来源线索的积分成本',
    25,
    '{"sources": ["电话"]}',
    '{"source_adjustments": {"电话": -5}}',
    120
);

SELECT create_lead_points_cost_rule(
    '微信线索成本',
    '微信来源线索的积分成本',
    35,
    '{"sources": ["微信"]}',
    '{"source_adjustments": {"微信": 5}}',
    130
);

SELECT create_lead_points_cost_rule(
    '抖音高价值线索',
    '抖音来源的高价值线索',
    60,
    '{"sources": ["抖音"], "lead_types": ["意向客户", "准客户"]}',
    '{"source_adjustments": {"抖音": 10}, "leadtype_adjustments": {"意向客户": 10, "准客户": 15}}',
    300
);

-- =====================================
-- 4. 创建管理视图
-- =====================================

-- 4.1 用户积分分配概览视图
CREATE OR REPLACE VIEW public.user_points_allocation_overview AS
SELECT 
    up.id as user_id,
    up.name as user_name,
    upw.total_points as current_points,
    COUNT(par.id) as total_allocations,
    COUNT(par.id) FILTER (WHERE par.allocation_status = 'success') as successful_allocations,
    COUNT(par.id) FILTER (WHERE par.allocation_status = 'insufficient_points') as insufficient_allocations,
    COALESCE(SUM(par.points_cost), 0) as total_points_cost,
    COALESCE(SUM(par.points_cost) FILTER (WHERE par.allocation_status = 'success'), 0) as successful_points_cost,
    COALESCE(AVG(par.points_cost), 0) as avg_points_cost
FROM users_profile up
LEFT JOIN user_points_wallet upw ON up.id = upw.user_id
LEFT JOIN points_allocation_records par ON up.id = par.assigned_user_id
WHERE up.status = 'active'
GROUP BY up.id, up.name, upw.total_points
ORDER BY total_allocations DESC;

-- 4.2 积分成本规则效果统计视图
CREATE OR REPLACE VIEW public.points_cost_rule_stats AS
SELECT 
    lpc.id as rule_id,
    lpc.name as rule_name,
    lpc.base_points_cost,
    lpc.priority,
    COUNT(par.id) as times_used,
    COALESCE(SUM(par.points_cost), 0) as total_points_cost,
    COALESCE(AVG(par.points_cost), 0) as avg_points_cost,
    COUNT(par.id) FILTER (WHERE par.allocation_status = 'success') as successful_uses,
    COUNT(par.id) FILTER (WHERE par.allocation_status = 'insufficient_points') as insufficient_uses
FROM lead_points_cost lpc
LEFT JOIN points_allocation_records par ON lpc.id = par.cost_rule_id
WHERE lpc.is_active = true
GROUP BY lpc.id, lpc.name, lpc.base_points_cost, lpc.priority
ORDER BY lpc.priority DESC, times_used DESC;

-- =====================================
-- 5. 创建管理函数
-- =====================================

-- 5.1 批量更新用户积分
CREATE OR REPLACE FUNCTION public.batch_update_user_points(
    p_user_ids bigint[],
    p_points_change integer,
    p_reason text DEFAULT '批量调整'
)
RETURNS jsonb
LANGUAGE plpgsql
AS $$
DECLARE
    user_id bigint;
    result jsonb := '{}';
    success_count integer := 0;
    fail_count integer := 0;
    errors text[] := ARRAY[]::text[];
BEGIN
    -- 遍历用户ID数组
    FOREACH user_id IN ARRAY p_user_ids LOOP
        BEGIN
            -- 插入积分交易记录
            INSERT INTO user_points_transactions (
                user_id, points_change, balance_after,
                transaction_type, source_type, description
            ) VALUES (
                user_id, p_points_change, 
                COALESCE((SELECT total_points FROM user_points_wallet WHERE user_id = user_id), 0) + p_points_change,
                CASE WHEN p_points_change > 0 THEN 'EARN' ELSE 'DEDUCT' END,
                'BATCH_ADJUSTMENT',
                p_reason
            );
            
            success_count := success_count + 1;
        EXCEPTION WHEN OTHERS THEN
            fail_count := fail_count + 1;
            errors := errors || (user_id::text || ': ' || SQLERRM);
        END;
    END LOOP;
    
    result := jsonb_build_object(
        'success', true,
        'total_users', array_length(p_user_ids, 1),
        'success_count', success_count,
        'fail_count', fail_count,
        'errors', errors
    );
    
    RETURN result;
END;
$$;

-- 5.2 重置用户积分分配记录
CREATE OR REPLACE FUNCTION public.reset_user_allocation_points(
    p_user_id bigint
)
RETURNS jsonb
LANGUAGE plpgsql
AS $$
DECLARE
    total_deducted integer;
    record_count integer;
BEGIN
    -- 计算需要退还的积分
    SELECT COALESCE(SUM(points_cost), 0), COUNT(*)
    INTO total_deducted, record_count
    FROM points_allocation_records
    WHERE assigned_user_id = p_user_id
      AND allocation_status = 'success';
    
    -- 退还积分
    IF total_deducted > 0 THEN
        INSERT INTO user_points_transactions (
            user_id, points_change, balance_after,
            transaction_type, source_type, description
        ) VALUES (
            p_user_id, total_deducted,
            COALESCE((SELECT total_points FROM user_points_wallet WHERE user_id = p_user_id), 0) + total_deducted,
            'EARN', 'ALLOCATION_REFUND',
            '重置分配积分：退还 ' || total_deducted || ' 积分'
        );
    END IF;
    
    -- 删除分配记录
    DELETE FROM points_allocation_records
    WHERE assigned_user_id = p_user_id;
    
    RETURN jsonb_build_object(
        'success', true,
        'records_deleted', record_count,
        'points_refunded', total_deducted
    );
END;
$$;

-- =====================================
-- 6. 创建测试数据
-- =====================================

-- 6.1 为测试用户添加积分
DO $$
DECLARE
    test_user_id bigint;
BEGIN
    -- 获取第一个活跃用户作为测试用户
    SELECT id INTO test_user_id
    FROM users_profile
    WHERE status = 'active'
    LIMIT 1;
    
    -- 如果找到用户，为其添加积分
    IF test_user_id IS NOT NULL THEN
        -- 确保用户有积分钱包记录
        INSERT INTO user_points_wallet (user_id, total_points, total_earned_points)
        VALUES (test_user_id, 1000, 1000)
        ON CONFLICT (user_id) DO UPDATE SET
            total_points = user_points_wallet.total_points + 1000,
            total_earned_points = user_points_wallet.total_earned_points + 1000,
            updated_at = NOW();
        
        RAISE NOTICE '已为测试用户 % 添加 1000 积分', test_user_id;
    ELSE
        RAISE NOTICE '未找到活跃用户，无法添加测试积分';
    END IF;
END $$;

-- =====================================
-- 7. 系统验证
-- =====================================

-- 7.1 验证积分分配系统
SELECT public.validate_points_allocation_system() AS system_validation;

-- 7.2 测试积分分配功能
SELECT public.test_points_allocation_system() AS test_result;

-- =====================================
-- 8. 创建权限
-- =====================================

-- 8.1 添加积分分配相关权限
INSERT INTO permissions (name, resource, action, description) VALUES
('points_allocation_view', 'points_allocation', 'view', '查看积分分配记录'),
('points_allocation_manage', 'points_allocation', 'manage', '管理积分分配规则'),
('points_cost_rules_view', 'points_cost_rules', 'view', '查看积分成本规则'),
('points_cost_rules_manage', 'points_cost_rules', 'manage', '管理积分成本规则')
ON CONFLICT (resource, action) DO NOTHING;

-- =====================================
-- 9. 部署完成提示
-- =====================================

DO $$
BEGIN
    RAISE NOTICE '========================================';
    RAISE NOTICE '积分分配功能部署完成！';
    RAISE NOTICE '========================================';
    RAISE NOTICE '功能包括：';
    RAISE NOTICE '- 动态积分成本配置';
    RAISE NOTICE '- 线索分配时自动扣除积分';
    RAISE NOTICE '- 积分不足处理机制';
    RAISE NOTICE '- 分配记录和统计';
    RAISE NOTICE '- 管理界面和API';
    RAISE NOTICE '========================================';
    RAISE NOTICE '下一步：';
    RAISE NOTICE '1. 配置积分成本规则';
    RAISE NOTICE '2. 为用户分配初始积分';
    RAISE NOTICE '3. 测试分配功能';
    RAISE NOTICE '4. 监控分配效果';
    RAISE NOTICE '========================================';
END $$;

-- 提交事务
COMMIT; 