-- 修复积分分配系统
-- 1. 修改默认销售组的分配方法为积分分配
UPDATE users_list 
SET allocation = 'points' 
WHERE groupname = '默认销售组';

-- 2. 创建积分分配规则（如果不存在）
INSERT INTO simple_allocation_rules (
    name, 
    description, 
    is_active, 
    priority, 
    conditions, 
    user_groups, 
    allocation_method, 
    enable_permission_check
) VALUES (
    '积分分配规则',
    '使用积分进行线索分配的规则',
    true,
    10, -- 高优先级
    '{"time_ranges": {"end": "18:00", "start": "09:00", "weekdays": [1, 2, 3, 4, 5, 6, 7]}}',
    ARRAY[6], -- 默认销售组ID
    'points',
    false
) ON CONFLICT (name) DO UPDATE SET
    is_active = true,
    allocation_method = 'points';

-- 3. 确保积分成本规则存在
INSERT INTO lead_points_cost (
    name, 
    description, 
    is_active, 
    base_points_cost, 
    dynamic_cost_config, 
    conditions, 
    priority
) VALUES (
    '普通线索积分成本',
    '普通类型线索的积分成本规则',
    true,
    10,
    '{}',
    '{"lead_types": ["普通"]}',
    1
) ON CONFLICT (name) DO UPDATE SET
    is_active = true,
    base_points_cost = 10;

-- 4. 检查修复结果
SELECT '用户组分配方法:' as info, groupname, allocation FROM users_list WHERE groupname = '默认销售组';
SELECT '积分分配规则:' as info, name, allocation_method FROM simple_allocation_rules WHERE name = '积分分配规则';
SELECT '积分成本规则:' as info, name, base_points_cost FROM lead_points_cost WHERE name = '普通线索积分成本'; 