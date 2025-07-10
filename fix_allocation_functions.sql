-- 修复分配函数的关键问题
-- 执行日期：2025-01-10
-- 重点：修复LOOP语句缺失和语法错误

-- =====================================
-- 1. 修复主分配函数 - 添加缺失的LOOP语句
-- =====================================

CREATE OR REPLACE FUNCTION public.allocate_lead_simple(
    p_leadid text,
    p_source source DEFAULT NULL,
    p_leadtype text DEFAULT NULL,
    p_community community DEFAULT NULL,
    p_manual_user_id bigint DEFAULT NULL
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
        
        -- 添加规则调试信息
        debug_info := debug_info || jsonb_build_object(
            'rules_attempted', rules_attempted,
            'current_rule_id', rule_record.id,
            'current_rule_name', rule_record.name,
            'current_rule_priority', rule_record.priority,
            'user_groups', rule_record.user_groups,
            'user_groups_type', pg_typeof(rule_record.user_groups),
            'user_groups_length', array_length(rule_record.user_groups, 1)
        );
        
        -- 3. 按用户组顺序尝试分配
        FOR group_index IN 1..array_length(rule_record.user_groups, 1) LOOP
            -- 添加用户组调试信息
            debug_info := debug_info || jsonb_build_object(
                'current_group_index', group_index,
                'current_group_value', rule_record.user_groups[group_index],
                'current_group_type', pg_typeof(rule_record.user_groups[group_index])
            );
            
            -- 处理字符串格式的数组元素，确保转换为bigint
            BEGIN
                user_group_id := (rule_record.user_groups[group_index])::bigint;
                debug_info := debug_info || jsonb_build_object('user_group_id_converted', user_group_id);
            EXCEPTION WHEN OTHERS THEN
                debug_info := debug_info || jsonb_build_object(
                    'conversion_error', SQLERRM,
                    'original_value', rule_record.user_groups[group_index]
                );
                CONTINUE;
            END;
            
            -- 3.1 获取用户组的用户
            SELECT get_group_users(user_group_id) INTO candidate_users;
            debug_info := debug_info || jsonb_build_object(
                'candidate_users', candidate_users,
                'candidate_users_type', pg_typeof(candidate_users),
                'candidate_users_length', CASE WHEN candidate_users IS NULL THEN NULL ELSE array_length(candidate_users, 1) END
            );
            
            IF candidate_users IS NULL OR array_length(candidate_users, 1) IS NULL THEN
                debug_info := debug_info || jsonb_build_object('no_candidate_users', true);
                CONTINUE;
            END IF;
            
            -- 3.2 应用所有过滤器（统一处理）
            BEGIN
                -- 权限检查统一取消，默认所有组内成员均可分配
                SELECT apply_allocation_filters(
                    candidate_users,
                    user_group_id,
                    p_community,
                    true,  -- 质量控制由 users_list 表控制
                    true,  -- 社区匹配由 users_list 表控制
                    false  -- 取消权限检查
                ) INTO final_users;
                
                debug_info := debug_info || jsonb_build_object(
                    'final_users', final_users,
                    'final_users_type', pg_typeof(final_users),
                    'final_users_length', CASE WHEN final_users IS NULL THEN NULL ELSE array_length(final_users, 1) END
                );
            EXCEPTION WHEN OTHERS THEN
                debug_info := debug_info || jsonb_build_object(
                    'filter_error', SQLERRM,
                    'filter_error_detail', SQLSTATE
                );
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
                    
                    debug_info := debug_info || jsonb_build_object(
                        'target_user_id', target_user_id,
                        'allocation_method_used', COALESCE(group_allocation_method, rule_record.allocation_method)
                    );
                    
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
                            'processing_details', jsonb_build_object('rule_success', true),
                            'debug_info', debug_info
                        );
                    END IF;
                EXCEPTION WHEN OTHERS THEN
                    debug_info := debug_info || jsonb_build_object(
                        'allocation_error', SQLERRM,
                        'allocation_error_detail', SQLSTATE
                    );
                    CONTINUE;
                END;
            END IF;
        END LOOP;
        
        -- 记录当前规则尝试失败
        debug_info := debug_info || jsonb_build_object(
            'rule_' || rule_record.name || '_failed', true,
            'rule_' || rule_record.name || '_priority', rule_record.priority
        );
        
    END LOOP;
    
    -- 4. 所有规则都失败，使用系统兜底分配
    SELECT get_default_user() INTO target_user_id;
    debug_info := debug_info || jsonb_build_object(
        'all_rules_failed', true, 
        'fallback_user_id', target_user_id,
        'total_rules_attempted', rules_attempted
    );
    
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

-- =====================================
-- 2. 修复 apply_allocation_filters 函数
-- =====================================

CREATE OR REPLACE FUNCTION public.apply_allocation_filters (
    candidate_users           bigint[],
    group_id                  bigint,
    p_community               community,
    enable_quality_control    boolean,
    enable_community_matching boolean,
    enable_permission_check   boolean
) RETURNS bigint[]
LANGUAGE plpgsql
AS $$
DECLARE
    filtered_users          bigint[] := candidate_users;
    community_json          jsonb;
    community_matched_users bigint[];
    group_enable_quality    boolean;
    group_enable_comm_match boolean;
    dbg jsonb := jsonb_build_object(
        'input_users',                candidate_users,
        'group_id',                   group_id,
        'community',                  p_community,
        'enable_quality_control_arg', enable_quality_control,
        'enable_community_matching_arg', enable_community_matching,
        'enable_permission_check',    enable_permission_check
    );
BEGIN
    ------------------------------------------------------------------
    -- 0. 空数组直接返回
    ------------------------------------------------------------------
    IF filtered_users IS NULL OR array_length(filtered_users,1) IS NULL THEN
        dbg := dbg || '{"input_empty":true}';
        INSERT INTO simple_allocation_logs (leadid, processing_details)
        VALUES ('DEBUG_'||extract(epoch from now())::bigint,
                jsonb_build_object('apply_allocation_filters', dbg));
        RETURN NULL;
    END IF;

    ------------------------------------------------------------------
    -- 1. 读取用户组配置（加表别名避免歧义）
    ------------------------------------------------------------------
    SELECT 
        COALESCE(ul.enable_quality_control,    false),
        COALESCE(ul.enable_community_matching, false)
    INTO
        group_enable_quality,
        group_enable_comm_match
    FROM users_list ul
    WHERE ul.id = group_id;
    
    dbg := dbg || jsonb_build_object(
        'group_enable_quality',    group_enable_quality,
        'group_enable_comm_match', group_enable_comm_match
    );

    ------------------------------------------------------------------
    -- 2. 质量控制过滤
    ------------------------------------------------------------------
    IF group_enable_quality AND enable_quality_control THEN
        BEGIN
        filtered_users := filter_users_by_quality_control(filtered_users, group_id);
            dbg := dbg || jsonb_build_object('after_quality', filtered_users);

            IF filtered_users IS NULL OR array_length(filtered_users,1) IS NULL THEN
                dbg := dbg || '{"quality_filtered_all":true}';
                INSERT INTO simple_allocation_logs (leadid, processing_details)
                VALUES ('DEBUG_'||extract(epoch from now())::bigint,
                        jsonb_build_object('apply_allocation_filters', dbg));
            RETURN NULL;
        END IF;
        EXCEPTION WHEN OTHERS THEN
            dbg := dbg || jsonb_build_object('quality_error', SQLERRM);
        END;
    END IF;
    
    ------------------------------------------------------------------
    -- 3. 权限检查过滤
    ------------------------------------------------------------------
    IF enable_permission_check THEN
        BEGIN
        filtered_users := filter_users_by_permission(filtered_users);
            dbg := dbg || jsonb_build_object('after_permission', filtered_users);

            IF filtered_users IS NULL OR array_length(filtered_users,1) IS NULL THEN
                dbg := dbg || '{"permission_filtered_all":true}';
                INSERT INTO simple_allocation_logs (leadid, processing_details)
                VALUES ('DEBUG_'||extract(epoch from now())::bigint,
                        jsonb_build_object('apply_allocation_filters', dbg));
            RETURN NULL;
        END IF;
        EXCEPTION WHEN OTHERS THEN
            dbg := dbg || jsonb_build_object('permission_error', SQLERRM);
        END;
    END IF;
    
    ------------------------------------------------------------------
    -- 4. 社区优先推荐
    ------------------------------------------------------------------
    IF group_enable_comm_match AND enable_community_matching
       AND p_community IS NOT NULL THEN
        BEGIN
            community_json := match_community_to_organization(p_community,
                                                              filtered_users);
            community_matched_users :=
                jsonb_to_bigint_array(community_json -> 'matched_users');

            dbg := dbg || jsonb_build_object(
                'community_json',      community_json,
                'community_matched',   community_matched_users
            );
        
            IF community_matched_users IS NOT NULL
               AND array_length(community_matched_users,1) > 0 THEN
            filtered_users := community_matched_users;
        END IF;
        EXCEPTION WHEN OTHERS THEN
            dbg := dbg || jsonb_build_object('community_match_error', SQLERRM);
        END;
    END IF;
    
    ------------------------------------------------------------------
    -- 5. 写入最终日志并返回
    ------------------------------------------------------------------
    dbg := dbg || jsonb_build_object(
        'final_users', filtered_users,
        'final_cnt',   COALESCE(array_length(filtered_users,1),0)
    );

    INSERT INTO simple_allocation_logs (leadid, processing_details)
    VALUES ('DEBUG_'||extract(epoch from now())::bigint,
            jsonb_build_object('apply_allocation_filters', dbg));

    RETURN filtered_users;
END;
$$;

-- =====================================
-- 3. 修复 get_group_users 函数
-- =====================================

CREATE OR REPLACE FUNCTION public.get_group_users(group_id bigint)
RETURNS bigint[]
LANGUAGE plpgsql
AS $$
DECLARE
    user_list bigint[];
    raw_list text[];
    debug_info jsonb := '{}';
BEGIN
    debug_info := jsonb_build_object('input_group_id', group_id);
    
    SELECT list INTO raw_list
    FROM users_list
    WHERE id = group_id AND list IS NOT NULL;
    
    debug_info := debug_info || jsonb_build_object(
        'raw_list', raw_list,
        'raw_list_type', pg_typeof(raw_list),
        'raw_list_length', CASE WHEN raw_list IS NULL THEN NULL ELSE array_length(raw_list, 1) END
    );
    
    -- 如果list是字符串数组，转换为数字数组
    IF raw_list IS NOT NULL THEN
        BEGIN
            SELECT array_agg(element::bigint) INTO user_list
            FROM unnest(raw_list) element;
            
            debug_info := debug_info || jsonb_build_object(
                'conversion_success', true,
                'user_list', user_list,
                'user_list_type', pg_typeof(user_list),
                'user_list_length', CASE WHEN user_list IS NULL THEN NULL ELSE array_length(user_list, 1) END
            );
        EXCEPTION WHEN OTHERS THEN
            debug_info := debug_info || jsonb_build_object(
                'conversion_error', SQLERRM,
                'conversion_error_detail', SQLSTATE
            );
            user_list := NULL;
        END;
    ELSE
        debug_info := debug_info || jsonb_build_object('raw_list_null', true);
    END IF;
    
    -- 记录调试信息到日志表（可选）
    INSERT INTO simple_allocation_logs (
        leadid, processing_details
    ) VALUES (
        'DEBUG_' || EXTRACT(EPOCH FROM NOW())::bigint,
        jsonb_build_object('get_group_users_debug', debug_info)
    );
    
    RETURN user_list;
END;
$$;

-- =====================================
-- 4. 修复 allocate_from_users 函数
-- =====================================

CREATE OR REPLACE FUNCTION public.allocate_from_users(
    user_list bigint[],
    method allocation_method
) RETURNS bigint
LANGUAGE plpgsql
AS $$
DECLARE
    target_user_id bigint;
    debug_info jsonb := '{}';
BEGIN
    -- 添加调试信息
    debug_info := jsonb_build_object(
        'user_list', user_list,
        'method', method,
        'user_list_type', pg_typeof(user_list),
        'user_list_length', CASE WHEN user_list IS NULL THEN NULL ELSE array_length(user_list, 1) END
    );
    
    -- 如果用户列表为空，返回NULL
    IF user_list IS NULL OR array_length(user_list, 1) IS NULL THEN
        debug_info := debug_info || jsonb_build_object('empty_user_list', true);
        INSERT INTO simple_allocation_logs (
            leadid, processing_details
        ) VALUES (
            'DEBUG_ALLOCATE_' || EXTRACT(EPOCH FROM NOW())::bigint,
            jsonb_build_object('allocate_from_users_debug', debug_info)
        );
        RETURN NULL;
    END IF;
    
    BEGIN
    CASE method
        WHEN 'round_robin' THEN
            -- 轮流分配：选择今日分配数量最少的用户
                -- 确保类型匹配，显式转换为bigint
                SELECT user_id INTO target_user_id
                FROM unnest(user_list) AS user_id
            ORDER BY (
                    SELECT COUNT(*) FROM simple_allocation_logs sal
                    WHERE sal.assigned_user_id = user_id::bigint
                    AND sal.created_at >= CURRENT_DATE
            ) ASC, RANDOM()  -- 加入随机因子避免总是选择同一个
            LIMIT 1;
            
        WHEN 'random' THEN
            -- 随机分配
                SELECT user_id INTO target_user_id
                FROM unnest(user_list) AS user_id
            ORDER BY RANDOM()
            LIMIT 1;
            
        WHEN 'workload' THEN
            -- 按工作量分配：选择近7天内分配线索最少的用户（基于分配日志）
                -- 确保类型匹配，显式转换为bigint
                SELECT user_id INTO target_user_id
                FROM unnest(user_list) AS user_id
            ORDER BY (
                    SELECT COUNT(*) FROM simple_allocation_logs sal
                    WHERE sal.assigned_user_id = user_id::bigint
                    AND sal.created_at >= CURRENT_DATE - INTERVAL '7 days'
            ) ASC, RANDOM()  -- 加入随机因子避免总是选择同一个
            LIMIT 1;
            
        ELSE
            -- 默认取第一个用户
                SELECT user_id INTO target_user_id
                FROM unnest(user_list) AS user_id
            LIMIT 1;
    END CASE;
        
        debug_info := debug_info || jsonb_build_object(
            'allocation_success', true,
            'target_user_id', target_user_id,
            'target_user_id_type', pg_typeof(target_user_id)
        );
        
    EXCEPTION WHEN OTHERS THEN
        debug_info := debug_info || jsonb_build_object(
            'allocation_error', SQLERRM,
            'allocation_error_detail', SQLSTATE,
            'allocation_error_context', 'allocate_from_users function'
        );
        target_user_id := NULL;
    END;
    
    -- 记录调试信息
    INSERT INTO simple_allocation_logs (
        leadid, processing_details
    ) VALUES (
        'DEBUG_ALLOCATE_' || EXTRACT(EPOCH FROM NOW())::bigint,
        jsonb_build_object('allocate_from_users_debug', debug_info)
    );
    
    RETURN target_user_id;
END;
$$;

-- =====================================
-- 5. 验证修复结果
-- =====================================

-- 验证函数是否存在
SELECT 
    '函数修复验证' as info,
    routine_name,
    routine_type
FROM information_schema.routines 
WHERE routine_schema = 'public' 
  AND routine_name IN (
    'allocate_lead_simple',
    'apply_allocation_filters',
    'get_group_users',
    'allocate_from_users'
  )
ORDER BY routine_name;

-- 测试分配功能
SELECT 
    '测试分配功能' as test_name,
    allocate_lead_simple(
        'TEST_FIX_' || EXTRACT(EPOCH FROM NOW())::bigint,
        '抖音'::source,
        '意向客户',
        '万科城市花园'::community,
        NULL
    ) as result;

-- 清理测试数据
DELETE FROM simple_allocation_logs WHERE leadid LIKE 'TEST_FIX_%';

SELECT '分配函数已修复' as status; 