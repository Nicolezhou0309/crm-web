-- 检查默认分配规则的配置
SELECT 
    id,
    name,
    description,
    is_active,
    priority,
    conditions,
    user_groups,
    allocation_method,
    enable_permission_check,
    created_at,
    updated_at
FROM simple_allocation_rules 
WHERE name = '默认分配规则' OR priority = 0
ORDER BY priority DESC, created_at ASC;

-- 检查默认分配规则关联的用户组
SELECT 
    ul.id,
    ul.groupname,
    ul.list,
    ul.allocation,
    ul.enable_quality_control,
    ul.enable_community_matching,
    ul.daily_lead_limit,
    ul.conversion_rate_requirement,
    ul.max_pending_leads
FROM users_list ul
WHERE ul.id = ANY(
    SELECT unnest(user_groups) 
    FROM simple_allocation_rules 
    WHERE name = '默认分配规则'
);

-- 检查所有规则的优先级分布
SELECT 
    name,
    priority,
    is_active,
    user_groups,
    conditions
FROM simple_allocation_rules
ORDER BY priority DESC, created_at ASC; 