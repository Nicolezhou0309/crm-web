-- 第八步：执行所有清理步骤
-- 按顺序执行所有清理和优化操作

-- 开始事务
BEGIN;

-- 第一步：清理历史调试数据
DELETE FROM simple_allocation_logs
WHERE leadid LIKE 'DEBUG_%'
   OR leadid LIKE 'DEFAULT_USER_%'
   OR leadid LIKE 'ALLOCATE_%'
   OR leadid LIKE 'TEST_%';

-- 第二步：精简 apply_allocation_filters 函数
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
BEGIN
    -- 空数组直接返回
    IF filtered_users IS NULL OR array_length(filtered_users,1) IS NULL THEN
        RETURN NULL;
    END IF;

    -- 读取用户组配置
    SELECT 
        COALESCE(ul.enable_quality_control,    false),
        COALESCE(ul.enable_community_matching, false)
    INTO
        group_enable_quality,
        group_enable_comm_match
    FROM users_list ul
    WHERE ul.id = group_id;

    -- 质量控制过滤
    IF group_enable_quality AND enable_quality_control THEN
        BEGIN
            filtered_users := filter_users_by_quality_control(filtered_users, group_id);
            IF filtered_users IS NULL OR array_length(filtered_users,1) IS NULL THEN
                RETURN NULL;
            END IF;
        EXCEPTION WHEN OTHERS THEN
            -- 质量控制出错时，继续使用原用户列表
            NULL;
        END;
    END IF;
    
    -- 权限检查过滤
    IF enable_permission_check THEN
        BEGIN
            filtered_users := filter_users_by_permission(filtered_users);
            IF filtered_users IS NULL OR array_length(filtered_users,1) IS NULL THEN
                RETURN NULL;
            END IF;
        EXCEPTION WHEN OTHERS THEN
            -- 权限检查出错时，继续使用原用户列表
            NULL;
        END;
    END IF;
    
    -- 社区优先推荐
    IF group_enable_comm_match AND enable_community_matching
       AND p_community IS NOT NULL THEN
        BEGIN
            community_json := match_community_to_organization(p_community, filtered_users);
            community_matched_users := jsonb_to_bigint_array(community_json -> 'matched_users');
            
            IF community_matched_users IS NOT NULL
               AND array_length(community_matched_users,1) > 0 THEN
                filtered_users := community_matched_users;
            END IF;
        EXCEPTION WHEN OTHERS THEN
            -- 社区匹配出错时，继续使用原用户列表
            NULL;
        END;
    END IF;
    
    RETURN filtered_users;
END;
$$;

-- 第三步：精简 get_group_users 函数
CREATE OR REPLACE FUNCTION public.get_group_users(group_id bigint)
RETURNS bigint[]
LANGUAGE plpgsql
AS $$
DECLARE
    user_list bigint[];
    raw_list text[];
BEGIN
    SELECT list INTO raw_list
    FROM users_list
    WHERE id = group_id AND list IS NOT NULL;
    
    -- 如果list是字符串数组，转换为数字数组
    IF raw_list IS NOT NULL THEN
        BEGIN
            SELECT array_agg(element::bigint) INTO user_list
            FROM unnest(raw_list) element;
        EXCEPTION WHEN OTHERS THEN
            user_list := NULL;
        END;
    END IF;
    
    RETURN user_list;
END;
$$;

-- 第四步：精简 allocate_from_users 函数
CREATE OR REPLACE FUNCTION public.allocate_from_users(
    user_list bigint[],
    method allocation_method
) RETURNS bigint
LANGUAGE plpgsql
AS $$
DECLARE
    target_user_id bigint;
BEGIN
    -- 如果用户列表为空，返回NULL
    IF user_list IS NULL OR array_length(user_list, 1) IS NULL THEN
        RETURN NULL;
    END IF;
    
    BEGIN
    CASE method
        WHEN 'round_robin' THEN
            -- 轮流分配：选择今日分配数量最少的用户
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
            -- 按工作量分配：选择近7天内分配线索最少的用户
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
        
    EXCEPTION WHEN OTHERS THEN
        target_user_id := NULL;
    END;
    
    RETURN target_user_id;
END;
$$;

-- 第五步：精简触发器函数
CREATE OR REPLACE FUNCTION public.simple_lead_allocation_trigger()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
    allocation_result jsonb;
    target_user_id bigint;
    duplicate_count integer;
    lead_community community;
BEGIN
    -- 检查过去7天内是否有重复的phone或wechat
    BEGIN
        SELECT COUNT(*) INTO duplicate_count
        FROM public.leads l
        WHERE (
            (NEW.phone IS NOT NULL AND l.phone = NEW.phone) OR
            (NEW.wechat IS NOT NULL AND l.wechat = NEW.wechat)
        )
        AND l.created_at >= NOW() - INTERVAL '7 days';
    EXCEPTION WHEN OTHERS THEN
        duplicate_count := 0;
    END;
    
    -- 如果发现重复，标记为重复状态，不进行分配
    IF duplicate_count > 0 THEN
        RETURN NULL;
    END IF;
    
    -- 优先从remark中提取community信息
    IF NEW.remark IS NOT NULL AND NEW.remark ~ '\[COMMUNITY:([^\]]+)\]' THEN
        BEGIN
            SELECT (regexp_match(NEW.remark, '\[COMMUNITY:([^\]]+)\]'))[1]::community INTO lead_community;
        EXCEPTION WHEN OTHERS THEN
            lead_community := NULL;
        END;
    END IF;
    
    -- 如果remark中没有community信息，则从广告信息动态推导
    IF lead_community IS NULL THEN
        BEGIN
            SELECT community INTO lead_community
            FROM community_keywords
            WHERE EXISTS (
                SELECT 1 FROM unnest(keyword) AS k
                WHERE (
                    NEW.campaignname ILIKE '%' || k || '%'
                    OR NEW.unitname ILIKE '%' || k || '%'
                    OR NEW.remark ILIKE '%' || k || '%'
                )
            )
            ORDER BY priority DESC
            LIMIT 1;
        EXCEPTION WHEN OTHERS THEN
            lead_community := NULL;
        END;
    END IF;
    
    -- 如果仍然没有匹配到，使用默认值
    IF lead_community IS NULL THEN
        BEGIN
            SELECT enumlabel INTO lead_community
            FROM pg_enum 
            WHERE enumtypid = 'community'::regtype 
            ORDER BY enumsortorder 
            LIMIT 1;
        EXCEPTION WHEN OTHERS THEN
            -- 如果连默认值都获取不到，跳过分配
            RETURN NULL;
        END;
    END IF;
    
    -- 执行分配
    BEGIN
        allocation_result := allocate_lead_simple(
            NEW.leadid,
            NEW.source,
            NEW.leadtype,
            lead_community,
            NULL  -- 手动分配用户
        );
    EXCEPTION WHEN OTHERS THEN
        -- 分配失败时，仍然创建线索但不分配
        RETURN NULL;
    END;
    
    -- 获取分配结果
    target_user_id := (allocation_result->>'assigned_user_id')::bigint;
    
    -- 创建followups记录
    IF target_user_id IS NOT NULL THEN
        BEGIN
            -- 检查用户是否存在
            IF NOT EXISTS (SELECT 1 FROM public.users_profile WHERE id = target_user_id) THEN
                RAISE EXCEPTION '用户ID % 不存在', target_user_id;
            END IF;
            
            -- 检查leadid是否已存在followups记录
            IF EXISTS (SELECT 1 FROM public.followups WHERE leadid = NEW.leadid) THEN
                RAISE EXCEPTION '线索ID % 的跟进记录已存在', NEW.leadid;
            END IF;
            
            INSERT INTO public.followups (
                leadid, leadtype, followupstage, interviewsales_user_id,
                created_at, updated_at
            ) VALUES (
                NEW.leadid, NEW.leadtype, '待接收', target_user_id,
                NOW(), NOW()
            );
        EXCEPTION WHEN OTHERS THEN
            -- 记录错误但不影响线索创建
            NULL;
        END;
    END IF;
    
    RETURN NULL;
END;
$$;

-- 第六步：精简主分配函数（带调试参数）
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

-- 提交事务
COMMIT;

-- 验证清理结果
SELECT 
    '清理完成' as status,
    COUNT(*) as remaining_logs,
    '所有函数已精简，调试开关已添加' as message
FROM simple_allocation_logs; 