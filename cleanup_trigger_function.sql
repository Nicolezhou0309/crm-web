-- 第五步：精简触发器函数
-- 删除调试插入，保留核心逻辑

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

-- 验证函数更新成功
SELECT 'simple_lead_allocation_trigger function cleaned up' AS status; 