-- 第七步：添加调试开关参数
-- 为分配函数添加可选的调试模式

-- 修改主分配函数，添加调试参数
CREATE OR REPLACE FUNCTION public.allocate_lead_simple(
    p_leadid text,
    p_source source DEFAULT NULL,
    p_leadtype text DEFAULT NULL,
    p_community community DEFAULT NULL,
    p_manual_user_id bigint DEFAULT NULL,
    p_debug_mode boolean DEFAULT false
) RETURNS jsonb
LANGUAGE plpgsql
AS $$
DECLARE
    rule_record RECORD;
    target_user_id bigint;
    group_index integer;
    user_group_id bigint;
    candidate_users bigint[];
    final_users bigint[];
    group_allocation_method allocation_method;
    rules_attempted integer := 0;
    rule_success boolean := false;
    debug_info jsonb := '{}';
BEGIN
    -- 初始化调试信息
    IF p_debug_mode THEN
        debug_info := jsonb_build_object(
            'input_leadid', p_leadid,
            'input_source', p_source,
            'input_leadtype', p_leadtype,
            'input_community', p_community,
            'input_manual_user_id', p_manual_user_id,
            'debug_mode', true
        );
    END IF;
    
    -- 1. 手动分配优先
    IF p_manual_user_id IS NOT NULL THEN
        IF p_debug_mode THEN
            debug_info := debug_info || jsonb_build_object('manual_assignment', true);
        END IF;
        
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
        
        IF p_debug_mode THEN
            debug_info := debug_info || jsonb_build_object(
                'rules_attempted', rules_attempted,
                'current_rule_id', rule_record.id,
                'current_rule_name', rule_record.name,
                'current_rule_priority', rule_record.priority
            );
        END IF;
        
        -- 3. 按用户组顺序尝试分配
        FOR group_index IN 1..array_length(rule_record.user_groups, 1) LOOP
            -- 处理字符串格式的数组元素，确保转换为bigint
            BEGIN
                user_group_id := (rule_record.user_groups[group_index])::bigint;
            EXCEPTION WHEN OTHERS THEN
                CONTINUE;
            END;
            
            -- 3.1 获取用户组的用户
            SELECT get_group_users(user_group_id) INTO candidate_users;
            
            IF p_debug_mode THEN
                debug_info := debug_info || jsonb_build_object(
                    'current_group_index', group_index,
                    'current_group_id', user_group_id,
                    'candidate_users', candidate_users,
                    'candidate_count', CASE WHEN candidate_users IS NULL THEN NULL ELSE array_length(candidate_users, 1) END
                );
            END IF;
            
            IF candidate_users IS NULL OR array_length(candidate_users, 1) IS NULL THEN
                CONTINUE;
            END IF;
            
            -- 3.2 应用所有过滤器
            BEGIN
                SELECT apply_allocation_filters(
                    candidate_users,
                    user_group_id,
                    p_community,
                    true,  -- 质量控制由 users_list 表控制
                    true,  -- 社区匹配由 users_list 表控制
                    false  -- 取消权限检查
                ) INTO final_users;
                
                IF p_debug_mode THEN
                    debug_info := debug_info || jsonb_build_object(
                        'final_users', final_users,
                        'final_count', CASE WHEN final_users IS NULL THEN NULL ELSE array_length(final_users, 1) END
                    );
                END IF;
            EXCEPTION WHEN OTHERS THEN
                CONTINUE;
            END;
            
            -- 3.3 如果有可用用户，执行分配
            IF final_users IS NOT NULL AND array_length(final_users, 1) > 0 THEN
                -- 从users_list表获取分配方法，优先使用用户组配置
                SELECT allocation INTO group_allocation_method
                FROM users_list
                WHERE id = user_group_id;
                
                BEGIN
                    SELECT allocate_from_users(final_users, COALESCE(group_allocation_method, rule_record.allocation_method)) INTO target_user_id;
                    
                    IF p_debug_mode THEN
                        debug_info := debug_info || jsonb_build_object(
                            'target_user_id', target_user_id,
                            'allocation_method_used', COALESCE(group_allocation_method, rule_record.allocation_method)
                        );
                    END IF;
                    
                    IF target_user_id IS NOT NULL THEN
                        rule_success := true;
                        
                        -- 记录分配日志
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
                            'debug_info', debug_info
                        );
                    END IF;
                EXCEPTION WHEN OTHERS THEN
                    CONTINUE;
                END;
            END IF;
        END LOOP;
    END LOOP;
    
    -- 4. 所有规则都失败，使用系统兜底分配
    SELECT get_default_user() INTO target_user_id;
    
    IF p_debug_mode THEN
        debug_info := debug_info || jsonb_build_object(
            'all_rules_failed', true,
            'fallback_user_id', target_user_id,
            'total_rules_attempted', rules_attempted
        );
    END IF;
    
    RETURN jsonb_build_object(
        'success', target_user_id IS NOT NULL,
        'assigned_user_id', target_user_id,
        'allocation_method', 'fallback',
        'rules_attempted', rules_attempted,
        'processing_details', jsonb_build_object(
            'all_rules_failed', true,
            'total_rules_attempted', rules_attempted
        ),
        'debug_info', debug_info
    );
END;
$$;

-- 验证函数更新成功
SELECT 'allocate_lead_simple function with debug parameter added' AS status; 