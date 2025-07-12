-- 修复 allocate_lead_simple 函数中的参数顺序问题
CREATE OR REPLACE FUNCTION public.allocate_lead_simple(
    p_leadid text,
    p_source source DEFAULT NULL,
    p_leadtype text DEFAULT NULL,
    p_community community DEFAULT NULL,
    p_manual_user_id bigint DEFAULT NULL
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
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
            
            -- 应用分配过滤器（修复参数顺序）
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
                
                BEGIN
                    SELECT allocate_from_users(final_users, COALESCE(group_allocation_method, rule_record.allocation_method)) INTO target_user_id;
                    
                    IF target_user_id IS NOT NULL THEN
                        rule_success := true;
                        
                        -- 只在成功分配时记录一次日志
                        INSERT INTO simple_allocation_logs (
                            leadid, rule_id, assigned_user_id, allocation_method,
                            selected_group_index, processing_details
                        ) VALUES (
                            p_leadid, rule_record.id, target_user_id, rule_record.allocation_method,
                            group_index, jsonb_build_object(
                                'rule_name', rule_record.name,
                                'rule_priority', rule_record.priority,
                                'group_id', user_group_id,
                                'candidate_count', array_length(candidate_users, 1),
                                'final_count', array_length(final_users, 1),
                                'allocation_method', COALESCE(group_allocation_method, rule_record.allocation_method),
                                'rules_attempted', rules_attempted,
                                'filters_applied', jsonb_build_object(
                                    'permission_check', rule_record.enable_permission_check
                                ),
                                'debug_info', debug_info
                            )
                        );
                        
                        RETURN jsonb_build_object(
                            'success', true,
                            'assigned_user_id', target_user_id,
                            'allocation_method', rule_record.allocation_method,
                            'rule_name', rule_record.name,
                            'rule_priority', rule_record.priority,
                            'selected_group_index', group_index,
                            'rules_attempted', rules_attempted,
                            'processing_details', allocation_details,
                            'debug_info', debug_info
                        );
                    END IF;
                END;
            END IF;
            
            group_index := group_index + 1;
        END LOOP;
        
        EXIT WHEN rule_success;
    END LOOP;
    
    -- 如果没有成功分配，记录一次失败日志
    IF NOT rule_success THEN
        INSERT INTO simple_allocation_logs (
            leadid, processing_details
        ) VALUES (
            p_leadid,
            jsonb_build_object(
                'allocation_failed', true,
                'rules_attempted', rules_attempted,
                'debug_info', debug_info
            )
        );
    END IF;
    
    -- 返回分配失败结果
    RETURN jsonb_build_object(
        'success', false,
        'error', '无法找到合适的分配目标',
        'rules_attempted', rules_attempted,
        'debug_info', debug_info
    );
END;
$$; 