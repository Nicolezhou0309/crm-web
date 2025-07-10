-- 修改 apply_allocation_filters 函数
CREATE OR REPLACE FUNCTION public.apply_allocation_filters(
    filtered_users bigint[],
    group_id bigint,
    enable_permission_check boolean DEFAULT false,
    enable_quality_control boolean DEFAULT true,
    enable_community_matching boolean DEFAULT true,
    p_community community DEFAULT NULL
) RETURNS bigint[]
LANGUAGE plpgsql
AS $$
DECLARE
    group_enable_quality boolean;
    group_enable_comm_match boolean;
    community_json jsonb;
    community_matched_users bigint[];
BEGIN
    -- 空数组直接返回
    IF filtered_users IS NULL OR array_length(filtered_users,1) IS NULL THEN
        RETURN NULL;
    END IF;

    -- 读取用户组配置
    SELECT 
        COALESCE(ul.enable_quality_control, false),
        COALESCE(ul.enable_community_matching, false)
    INTO
        group_enable_quality,
        group_enable_comm_match
    FROM users_list ul
    WHERE ul.id = group_id;
    
    -- 质量控制过滤
    IF group_enable_quality AND enable_quality_control THEN
        filtered_users := filter_users_by_quality_control(filtered_users, group_id);
        IF filtered_users IS NULL OR array_length(filtered_users,1) IS NULL THEN
            RETURN NULL;
        END IF;
    END IF;
    
    -- 权限检查过滤
    IF enable_permission_check THEN
        filtered_users := filter_users_by_permission(filtered_users);
        IF filtered_users IS NULL OR array_length(filtered_users,1) IS NULL THEN
            RETURN NULL;
        END IF;
    END IF;
    
    -- 社区优先推荐
    IF group_enable_comm_match AND enable_community_matching
       AND p_community IS NOT NULL THEN
        community_json := match_community_to_organization(p_community, filtered_users);
        community_matched_users := jsonb_to_bigint_array(community_json -> 'matched_users');
        
        IF community_matched_users IS NOT NULL
           AND array_length(community_matched_users,1) > 0 THEN
            filtered_users := community_matched_users;
        END IF;
    END IF;

    RETURN filtered_users;
END;
$$;

-- 修改 get_group_users 函数
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
        SELECT array_agg(element::bigint) INTO user_list
        FROM unnest(raw_list) element;
    END IF;
    
    RETURN user_list;
END;
$$;

-- 修改 simple_lead_allocation_trigger 函数
CREATE OR REPLACE FUNCTION public.simple_lead_allocation_trigger()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    allocation_result jsonb;
    target_user_id bigint;
    duplicate_count integer;
    lead_community community;
BEGIN
    -- 检查过去7天内是否有重复的phone或wechat
    SELECT COUNT(*) INTO duplicate_count
    FROM public.leads l
    WHERE (
            (NEW.phone IS NOT NULL AND l.phone = NEW.phone) OR
            (NEW.wechat IS NOT NULL AND l.wechat = NEW.wechat)
    )
    AND l.created_at >= NOW() - INTERVAL '7 days';
    
    -- 如果发现重复，标记为重复状态，不进行分配
    IF duplicate_count > 0 THEN
        RETURN NEW;
    END IF;
    
    -- 优先从remark中提取community信息
    IF NEW.remark IS NOT NULL AND NEW.remark ~ '\[COMMUNITY:([^\]]+)\]' THEN
        SELECT (regexp_match(NEW.remark, '\[COMMUNITY:([^\]]+)\]'))[1]::community INTO lead_community;
    END IF;
    
    -- 如果remark中没有community信息，则从广告信息动态推导
    IF lead_community IS NULL THEN
        SELECT community INTO lead_community
        FROM community_keywords
        WHERE EXISTS (
          SELECT 1 FROM unnest(keyword) AS k
          WHERE
            (NEW.campaignname ILIKE '%' || k || '%'
             OR NEW.unitname ILIKE '%' || k || '%'
             OR NEW.remark ILIKE '%' || k || '%')
        )
        ORDER BY priority DESC
        LIMIT 1;
    END IF;
    
    -- 如果仍然没有匹配到，使用默认值
    IF lead_community IS NULL THEN
        SELECT enumlabel INTO lead_community
        FROM pg_enum 
        WHERE enumtypid = 'community'::regtype 
        ORDER BY enumsortorder 
        LIMIT 1;
    END IF;
    
    -- 执行分配
    allocation_result := allocate_lead_simple(
        NEW.leadid,
        NEW.source,
        NEW.leadtype,
        lead_community,
        NULL  -- 手动分配用户
    );
    
    -- 获取分配结果
    target_user_id := (allocation_result->>'assigned_user_id')::bigint;
    
    -- 创建followups记录
    IF target_user_id IS NOT NULL THEN
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
    END IF;
    
    RETURN NEW;
END;
$$;
