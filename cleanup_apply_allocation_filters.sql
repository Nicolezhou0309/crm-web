-- 第二步：精简 apply_allocation_filters 函数
-- 删除调试插入，保留核心逻辑

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

-- 验证函数更新成功
SELECT 'apply_allocation_filters function cleaned up' AS status; 