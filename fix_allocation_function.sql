-- 修复分配函数中的字段名冲突问题
CREATE OR REPLACE FUNCTION public.allocate_from_users(user_list bigint[], method allocation_method, p_required_points integer DEFAULT NULL::integer)
  RETURNS bigint
  LANGUAGE plpgsql
 AS $function$
DECLARE
    target_user_id bigint;
    available_users bigint[];
    current_user_id bigint;
BEGIN
    -- 如果用户列表为空，返回NULL
    IF user_list IS NULL OR array_length(user_list, 1) IS NULL THEN
        RETURN NULL;
    END IF;

    -- 如果是积分分配模式且指定了所需积分，先过滤积分足够的用户
    IF method = 'points' AND p_required_points IS NOT NULL AND p_required_points > 0 THEN
        available_users := ARRAY[]::bigint[];

        -- 检查每个用户的积分余额
        FOREACH current_user_id IN ARRAY user_list LOOP
            IF EXISTS (
                SELECT 1 FROM user_points_wallet upw
                WHERE upw.user_id = current_user_id::bigint
                AND COALESCE(upw.total_points, 0) >= p_required_points
            ) THEN
                available_users := available_users || current_user_id;
            END IF;
        END LOOP;

        -- 如果没有积分足够的用户，返回NULL
        IF array_length(available_users, 1) IS NULL THEN
            RETURN NULL;
        END IF;

        -- 使用过滤后的用户列表
        user_list := available_users;
    END IF;

    CASE method
        WHEN 'round_robin' THEN
            -- 轮流分配：选择今日分配数量最少的用户
            SELECT uid INTO target_user_id
            FROM unnest(user_list) AS uid
            ORDER BY (
                SELECT COUNT(*) FROM simple_allocation_logs sal
                WHERE sal.assigned_user_id = uid::bigint
                AND sal.created_at >= CURRENT_DATE
            ) ASC, RANDOM()
            LIMIT 1;

        WHEN 'random' THEN
            -- 随机分配
            SELECT uid INTO target_user_id
            FROM unnest(user_list) AS uid
            ORDER BY RANDOM()
            LIMIT 1;

        WHEN 'workload' THEN
            -- 按工作量分配
            SELECT uid INTO target_user_id
            FROM unnest(user_list) AS uid
            ORDER BY (
                SELECT COUNT(*) FROM simple_allocation_logs sal
                WHERE sal.assigned_user_id = uid::bigint
                AND sal.created_at >= CURRENT_DATE - INTERVAL '7 days'
            ) ASC, RANDOM()
            LIMIT 1;

        WHEN 'points' THEN
            -- 积分分配：选择积分余额最高的用户
            SELECT uid INTO target_user_id
            FROM unnest(user_list) AS uid
            ORDER BY (
                SELECT COALESCE(upw.total_points, 0) FROM user_points_wallet upw
                WHERE upw.user_id = uid::bigint
            ) DESC, RANDOM()
            LIMIT 1;

        ELSE
            -- 默认取第一个用户
            SELECT uid INTO target_user_id
            FROM unnest(user_list) AS uid
            LIMIT 1;
    END CASE;

    RETURN target_user_id;
END;
$function$; 

-- 修复分配函数，添加rule_id到返回结果中
CREATE OR REPLACE FUNCTION public.allocate_lead_simple(p_leadid text, p_source source DEFAULT NULL::source, p_leadtype text DEFAULT NULL::text, p_community community DEFAULT NULL::community, p_manual_user_id bigint DEFAULT NULL::bigint)
  RETURNS jsonb
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO 'public', 'pg_temp'
 AS $function$
DECLARE
    rule_record RECORD;
    target_user_id bigint;
    processing_result jsonb;
    group_index integer;
    user_group_id bigint;
    candidate_users bigint[];
    final_users bigint[];
    allocation_details jsonb := '{}';
    group_allocation_method allocation_method;
    debug_info jsonb := '{}';
    rules_attempted integer := 0;
    rule_success boolean := false;
    points_cost integer := NULL;
    points_cost_result jsonb;
BEGIN
    -- 添加调试日志
    debug_info := jsonb_build_object(
        'input_leadid', p_leadid,
        'input_source', p_source,
        'input_leadtype', p_leadtype,
        'input_community', p_community,
        'input_manual_user_id', p_manual_user_id
    );

    -- 1. 手动分配优先
    IF p_manual_user_id IS NOT NULL THEN
        debug_info := debug_info || jsonb_build_object('manual_assignment', true);
        RETURN jsonb_build_object(
            'success', true,
            'assigned_user_id', p_manual_user_id,
            'allocation_method', 'manual',
            'processing_details', jsonb_build_object('manual_assignment', true),
            'debug_info', debug_info
        );
    END IF;

    -- 2. 按优先级顺序尝试所有匹配的规则
    FOR rule_record IN
        SELECT * FROM simple_allocation_rules
        WHERE is_active = true
          AND check_rule_conditions(conditions, p_source, p_leadtype, p_community)
        ORDER BY priority DESC, created_at ASC
    LOOP
        rules_attempted := rules_attempted + 1;

        -- 遍历规则中的用户组
        group_index := 1;
        FOREACH user_group_id IN ARRAY rule_record.user_groups
        LOOP
            -- 获取用户组中的用户列表
            candidate_users := get_group_users(user_group_id);

            -- 应用分配过滤器
            final_users := apply_allocation_filters(
                candidate_users,
                user_group_id,
                p_community,
                true, -- 质量控制
                true, -- 社区匹配
                rule_record.enable_permission_check
            );

            -- 如果有可用用户，尝试分配
            IF final_users IS NOT NULL AND array_length(final_users, 1) > 0 THEN
                -- 从users_list表获取分配方法，优先使用用户组配置
                SELECT allocation INTO group_allocation_method
                FROM users_list
                WHERE id = user_group_id;

                -- 如果是积分分配模式，先计算积分成本
                IF group_allocation_method = 'points' THEN
                    points_cost_result := calculate_lead_points_cost(
                        p_source, p_leadtype, NULL, NULL, NULL
                    );
                    IF (points_cost_result->>'success')::boolean THEN
                        points_cost := (points_cost_result->>'points_cost')::integer;
                    END IF;
                END IF;

                BEGIN
                    -- 调用分配函数，传入积分成本参数
                    SELECT allocate_from_users(final_users, COALESCE(group_allocation_method, rule_record.allocation_method), points_cost) INTO target_user_id;

                    IF target_user_id IS NOT NULL THEN
                        rule_success := true;

                        -- 移除日志记录，由触发器统一处理
                        RETURN jsonb_build_object(
                            'success', true,
                            'assigned_user_id', target_user_id,
                            'allocation_method', rule_record.allocation_method,
                            'rule_id', rule_record.id,  -- 添加rule_id
                            'rule_name', rule_record.name,
                            'rule_priority', rule_record.priority,
                            'selected_group_index', group_index,
                            'rules_attempted', rules_attempted,
                            'points_cost', points_cost,
                            'processing_details', jsonb_build_object(
                                'rule_name', rule_record.name,
                                'rule_priority', rule_record.priority,
                                'group_id', user_group_id,
                                'candidate_count', array_length(candidate_users, 1),
                                'final_count', array_length(final_users, 1),
                                'allocation_method', COALESCE(group_allocation_method, rule_record.allocation_method),
                                'rules_attempted', rules_attempted,
                                'points_cost', points_cost,
                                'filters_applied', jsonb_build_object(
                                    'permission_check', rule_record.enable_permission_check
                                ),
                                'debug_info', debug_info
                            ),
                            'debug_info', debug_info
                        );
                    END IF;
                END;
            END IF;

            group_index := group_index + 1;
        END LOOP;

        EXIT WHEN rule_success;
    END LOOP;

    -- 如果没有成功分配，返回失败结果（不记录日志）
    RETURN jsonb_build_object(
        'success', false,
        'error', '无法找到合适的分配目标',
        'rules_attempted', rules_attempted,
        'debug_info', debug_info
    );
END;
$function$; 