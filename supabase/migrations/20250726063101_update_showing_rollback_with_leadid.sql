-- 更新带看回退函数，支持线索编号作为操作编号
DROP FUNCTION IF EXISTS public.process_showing_rollback(uuid, bigint, community, text);
CREATE OR REPLACE FUNCTION public.process_showing_rollback(
    p_showing_id uuid,
    p_applicant_id bigint,
    p_community community,
    p_reason text,
    p_leadid text DEFAULT NULL
) RETURNS jsonb
LANGUAGE plpgsql
AS $$
DECLARE
    result jsonb;
    v_community community;
    v_direct_card_issued boolean := false;
BEGIN
    -- 1. 获取带看记录的社区信息
    SELECT community INTO v_community
    FROM public.showings
    WHERE id = p_showing_id;
    
    -- 如果带看记录没有社区信息，使用默认社区或返回错误
    IF v_community IS NULL THEN
        -- 可以根据业务需求设置默认社区，这里暂时返回错误
        RETURN jsonb_build_object(
            'success', false,
            'message', '带看记录缺少社区信息，无法发放直通卡',
            'showing_id', p_showing_id
        );
    END IF;
    
    -- 2. 标记带看记录为无效
    UPDATE public.showings 
    SET invalid = true, updated_at = now()
    WHERE id = p_showing_id;
    
    -- 3. 为申请人发放直通卡（可以有多张）
    INSERT INTO public.showings_queue_record (
        user_id,
        community,
        queue_type,
        created_at,
        consumed,
        consumed_at
    ) VALUES (
        p_applicant_id,
        v_community,
        'direct',
        now(),
        false,
        null
    );
    v_direct_card_issued := true;
    
    -- 4. 通知联动将由统一的通知系统处理
    -- 注释掉原有的通知插入逻辑
    
    result := jsonb_build_object(
        'success', true,
        'message', '带看回退处理成功',
        'showing_id', p_showing_id,
        'leadid', COALESCE(p_leadid, ''),
        'direct_card_issued', v_direct_card_issued,
        'community', v_community
    );
    
    RETURN result;
END;
$$;

COMMENT ON FUNCTION public.process_showing_rollback IS '处理带看回退业务逻辑：标记记录无效、发放直通卡（可多张），使用线索编号作为操作编号，通知由统一系统处理';
