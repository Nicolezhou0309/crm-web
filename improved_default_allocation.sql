-- 改进的默认分配逻辑
-- 支持工作量平衡和质量控制

CREATE OR REPLACE FUNCTION public.get_default_user_improved()
RETURNS bigint
LANGUAGE plpgsql
AS $$
DECLARE
    default_user_id bigint;
    debug_info jsonb := '{}';
BEGIN
    -- 尝试1: 选择今日分配最少的活跃用户
    SELECT up.id INTO default_user_id
    FROM users_profile up
    WHERE up.status = 'active'
    ORDER BY (
        SELECT COUNT(*) 
        FROM simple_allocation_logs sal 
        WHERE sal.assigned_user_id = up.id 
        AND sal.created_at >= CURRENT_DATE
    ) ASC, up.updated_at ASC  -- 二级排序：更新时间
    LIMIT 1;
    
    debug_info := jsonb_build_object(
        'method', 'workload_balanced',
        'selected_user_id', default_user_id
    );
    
    -- 如果没有找到用户，降级到原来的逻辑
    IF default_user_id IS NULL THEN
        SELECT id INTO default_user_id
        FROM users_profile
        WHERE status = 'active'
        ORDER BY updated_at ASC
        LIMIT 1;
        
        debug_info := debug_info || jsonb_build_object(
            'fallback_method', 'simple_active_user',
            'fallback_user_id', default_user_id
        );
    END IF;
    
    -- 记录默认分配的调试信息
    INSERT INTO simple_allocation_logs (
        leadid, processing_details
    ) VALUES (
        'DEFAULT_USER_' || EXTRACT(EPOCH FROM NOW())::bigint,
        jsonb_build_object('get_default_user_debug', debug_info)
    );
    
    RETURN default_user_id;
END;
$$;

-- 创建专门的默认分配规则（优先级为0，无条件匹配）
CREATE OR REPLACE FUNCTION public.create_fallback_rule()
RETURNS uuid
LANGUAGE plpgsql
AS $$
DECLARE
    rule_id uuid;
    default_group_id bigint;
BEGIN
    -- 确保有一个默认用户组
    INSERT INTO users_list (
        groupname, 
        list, 
        description, 
        allocation,
        enable_quality_control,
        enable_community_matching
    ) VALUES (
        '系统默认组',
        ARRAY[]::bigint[], -- 空数组，将使用 get_default_user 
        '系统级默认分配组，当所有规则失败时使用',
        'workload'::allocation_method,
        false, -- 不启用质量控制
        false  -- 不启用社区匹配
    ) 
    ON CONFLICT (groupname) DO UPDATE SET
        description = EXCLUDED.description
    RETURNING id INTO default_group_id;
    
    -- 创建优先级为0的默认规则
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
        '系统默认分配规则',
        '当所有其他规则都失败时的兜底规则，优先级为0',
        true,
        0, -- 最低优先级
        '{}', -- 空条件，匹配所有
        ARRAY[default_group_id],
        'workload'::allocation_method,
        false
    )
    ON CONFLICT (name) DO UPDATE SET
        description = EXCLUDED.description,
        priority = EXCLUDED.priority
    RETURNING id INTO rule_id;
    
    RETURN rule_id;
END;
$$;

-- 执行创建默认规则
SELECT create_fallback_rule() AS fallback_rule_id; 