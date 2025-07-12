-- 测试动态积分规则
-- 1. 创建基于来源的动态积分规则
INSERT INTO lead_points_cost (
    name, 
    description, 
    is_active, 
    base_points_cost, 
    dynamic_cost_config, 
    conditions, 
    priority
) VALUES (
    '抖音来源动态规则',
    '抖音来源线索的动态积分成本规则',
    true,
    20,
    '{"source_adjustments": {"抖音": 15, "微信": 5}, "time_adjustments": {"peak_hours": {"start": "09:00", "end": "18:00", "multiplier": 1.2}}}',
    '{"lead_types": ["普通"], "sources": ["抖音"]}',
    5
);

-- 2. 创建基于关键词的动态积分规则
INSERT INTO lead_points_cost (
    name, 
    description, 
    is_active, 
    base_points_cost, 
    dynamic_cost_config, 
    conditions, 
    priority
) VALUES (
    '关键词动态规则',
    '基于关键词匹配的动态积分成本规则',
    true,
    15,
    '{"keyword_adjustments": {"别墅": 20, "豪宅": 25, "学区房": 10}, "community_adjustments": {"浦江中心社区": 5, "高端社区": 15}}',
    '{"lead_types": ["普通"]}',
    3
);

-- 3. 创建基于时间的动态积分规则
INSERT INTO lead_points_cost (
    name, 
    description, 
    is_active, 
    base_points_cost, 
    dynamic_cost_config, 
    conditions, 
    priority
) VALUES (
    '时间动态规则',
    '基于时间段的动态积分成本规则',
    true,
    25,
    '{"time_adjustments": {"weekend_multiplier": 1.5, "holiday_multiplier": 2.0, "off_peak_discount": 0.8}}',
    '{"lead_types": ["普通"]}',
    2
);

-- 4. 检查创建的规则
SELECT '动态积分规则列表:' as info;
SELECT name, base_points_cost, priority, 
       dynamic_cost_config->'source_adjustments' as source_adjustments,
       dynamic_cost_config->'keyword_adjustments' as keyword_adjustments,
       dynamic_cost_config->'time_adjustments' as time_adjustments
FROM lead_points_cost 
WHERE name IN ('抖音来源动态规则', '关键词动态规则', '时间动态规则')
ORDER BY priority DESC; 