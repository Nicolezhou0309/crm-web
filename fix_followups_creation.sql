-- 修复分配成功后followups记录未创建的问题
-- 问题分析：触发器函数中的followups创建逻辑可能因为异常而被跳过

-- 1. 首先检查当前的触发器函数
SELECT 
    proname as function_name,
    prosrc as function_source
FROM pg_proc 
WHERE proname = 'simple_lead_allocation_trigger';

-- 2. 检查最近的分配日志，看看是否有成功分配但未创建followups的情况
SELECT 
    l.leadid,
    l.assigned_user_id,
    l.created_at,
    l.processing_details,
    CASE WHEN f.leadid IS NULL THEN '未创建followups' ELSE '已创建followups' END as followups_status
FROM simple_allocation_logs l
LEFT JOIN followups f ON l.leadid = f.leadid
WHERE l.created_at >= NOW() - INTERVAL '1 hour'
ORDER BY l.created_at DESC
LIMIT 10;

-- 3. 修复触发器函数，添加更详细的错误处理和日志记录
CREATE OR REPLACE FUNCTION public.simple_lead_allocation_trigger()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
    allocation_result jsonb;
    target_user_id bigint;
    lead_community community;
    debug_info jsonb := '{}';
    followup_created boolean := false;
BEGIN
    -- 跳过重复线索检查（如果需要的话）
    -- 这里可以添加重复检查逻辑
    
    -- 从remark中提取community信息
    IF NEW.remark IS NOT NULL AND NEW.remark ~ '\[COMMUNITY:([^\]]+)\]' THEN
        SELECT (regexp_match(NEW.remark, '\[COMMUNITY:([^\]]+)\]'))[1]::community INTO lead_community;
        debug_info := debug_info || jsonb_build_object('community_from_remark', lead_community);
    END IF;
    
    -- 如果remark中没有community信息，从广告信息推导
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
        debug_info := debug_info || jsonb_build_object('community_from_keywords', lead_community);
    END IF;
    
    -- 如果仍然没有匹配到，使用默认值
    IF lead_community IS NULL THEN
        SELECT enumlabel::community INTO lead_community
        FROM pg_enum 
        WHERE enumtypid = 'community'::regtype 
        ORDER BY enumsortorder 
        LIMIT 1;
        debug_info := debug_info || jsonb_build_object('community_default', lead_community);
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
        
        debug_info := debug_info || jsonb_build_object('allocation_result', allocation_result);
        
        -- 获取分配结果
        IF allocation_result IS NOT NULL AND (allocation_result->>'success')::boolean THEN
            target_user_id := (allocation_result->>'assigned_user_id')::bigint;
            debug_info := debug_info || jsonb_build_object('target_user_id', target_user_id);
            
            -- 创建followups记录
            IF target_user_id IS NOT NULL THEN
                -- 检查用户是否存在
                IF NOT EXISTS (SELECT 1 FROM public.users_profile WHERE id = target_user_id) THEN
                    RAISE EXCEPTION '用户ID % 不存在', target_user_id;
                END IF;
                
                -- 检查leadid是否已存在followups记录
                IF NOT EXISTS (SELECT 1 FROM public.followups WHERE leadid = NEW.leadid) THEN
                    BEGIN
                        INSERT INTO public.followups (
                            leadid, 
                            leadtype, 
                            followupstage, 
                            interviewsales_user_id,
                            created_at, 
                            updated_at
                        ) VALUES (
                            NEW.leadid, 
                            NEW.leadtype, 
                            '待接收', 
                            target_user_id,
                            NOW(), 
                            NOW()
                        );
                        followup_created := true;
                        debug_info := debug_info || jsonb_build_object('followup_created', true);
                    EXCEPTION WHEN OTHERS THEN
                        debug_info := debug_info || jsonb_build_object(
                            'followup_creation_error', SQLERRM,
                            'followup_creation_error_detail', SQLSTATE
                        );
                        -- 不抛出异常，继续执行
                    END;
                ELSE
                    debug_info := debug_info || jsonb_build_object('followup_already_exists', true);
                END IF;
            ELSE
                debug_info := debug_info || jsonb_build_object('target_user_id_null', true);
            END IF;
        ELSE
            -- 记录分配失败的情况
            debug_info := debug_info || jsonb_build_object('allocation_failed', true);
        END IF;
        
        -- 记录详细的处理日志
        INSERT INTO simple_allocation_logs (
            leadid,
            assigned_user_id,
            processing_details
        ) VALUES (
            NEW.leadid,
            target_user_id,
            jsonb_build_object(
                'allocation_success', allocation_result IS NOT NULL AND (allocation_result->>'success')::boolean,
                'followup_created', followup_created,
                'debug_info', debug_info
            )
        );
        
    EXCEPTION WHEN OTHERS THEN
        -- 记录异常情况
        INSERT INTO simple_allocation_logs (
            leadid,
            processing_details
        ) VALUES (
            NEW.leadid,
            jsonb_build_object(
                'error', SQLERRM,
                'error_detail', SQLSTATE,
                'debug_info', debug_info
            )
        );
    END;
    
    RETURN NEW;
END;
$$;

-- 4. 为已分配但未创建followups的记录创建followups
-- 查找分配成功但未创建followups的记录
INSERT INTO followups (
    leadid, 
    leadtype, 
    followupstage, 
    interviewsales_user_id,
    created_at, 
    updated_at
)
SELECT 
    l.leadid,
    leads.leadtype,
    '待接收',
    l.assigned_user_id,
    l.created_at,
    l.created_at
FROM simple_allocation_logs l
JOIN leads ON l.leadid = leads.leadid
LEFT JOIN followups f ON l.leadid = f.leadid
WHERE l.assigned_user_id IS NOT NULL
  AND f.leadid IS NULL
  AND l.created_at >= NOW() - INTERVAL '24 hours'
  AND (l.processing_details->>'allocation_success')::boolean = true
ON CONFLICT (leadid) DO NOTHING;

-- 5. 验证修复结果
SELECT 
    '修复统计' as info,
    COUNT(*) as total_allocated,
    COUNT(CASE WHEN f.leadid IS NOT NULL THEN 1 END) as with_followups,
    COUNT(CASE WHEN f.leadid IS NULL THEN 1 END) as without_followups
FROM simple_allocation_logs l
LEFT JOIN followups f ON l.leadid = f.leadid
WHERE l.created_at >= NOW() - INTERVAL '24 hours'
  AND l.assigned_user_id IS NOT NULL; 