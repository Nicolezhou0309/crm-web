-- 重建分配统计视图
DROP VIEW IF EXISTS public.simple_allocation_stats;

CREATE OR REPLACE VIEW public.simple_allocation_stats AS
SELECT 
    r.name as rule_name,
    COUNT(*) as total_allocations,
    COUNT(DISTINCT l.assigned_user_id) as unique_users,
    AVG(l.selected_group_index) as avg_group_index,
    COUNT(*) FILTER (WHERE l.selected_group_index = 1) as first_group_success,
    ROUND(
        COUNT(*) FILTER (WHERE l.selected_group_index = 1)::numeric / 
        NULLIF(COUNT(*)::numeric, 0) * 100, 2
    ) as first_group_success_rate,
    MIN(l.created_at) as first_allocation,
    MAX(l.created_at) as last_allocation
FROM simple_allocation_logs l
LEFT JOIN simple_allocation_rules r ON l.rule_id = r.id
WHERE l.rule_id IS NOT NULL
GROUP BY r.id, r.name
ORDER BY total_allocations DESC; 