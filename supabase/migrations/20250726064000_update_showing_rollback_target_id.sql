-- 更新带看回退的target_id逻辑
-- 将target_id从线索编号改为带看单编号，线索编号放在config中

-- 1. 更新process_showing_rollback函数，确保能正确处理新的参数结构
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
    v_leadid text;
    v_direct_card_issued boolean := false;
BEGIN
    -- 1. 获取带看记录的社区信息和线索编号
    SELECT community, leadid INTO v_community, v_leadid
    FROM public.showings
    WHERE id = p_showing_id;
    
    -- 如果带看记录不存在，返回错误
    IF v_community IS NULL THEN
        RETURN jsonb_build_object(
            'success', false,
            'message', '带看记录不存在或缺少社区信息',
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
        consumed_at,
        remark
    ) VALUES (
        p_applicant_id,
        v_community,
        'direct',
        now(),
        false,
        null,
        '带看回退补偿：' || COALESCE(p_reason, '未知原因')
    );
    v_direct_card_issued := true;
    
    -- 4. 通知联动将由统一的通知系统处理
    -- 注释掉原有的通知插入逻辑
    
    result := jsonb_build_object(
        'success', true,
        'message', '带看回退处理成功',
        'showing_id', p_showing_id,
        'leadid', COALESCE(p_leadid, v_leadid),
        'direct_card_issued', v_direct_card_issued,
        'community', v_community
    );
    
    RETURN result;
END;
$$;

-- 2. 添加注释说明新的参数结构
COMMENT ON FUNCTION public.process_showing_rollback IS '带看回退处理函数：标记带看记录无效，发放直通卡（可多张），通知由统一系统处理。参数：p_showing_id(带看记录ID), p_applicant_id(申请人ID), p_community(社区), p_reason(回退理由), p_leadid(线索编号，可选)';

-- 3. 确保索引存在
CREATE INDEX IF NOT EXISTS idx_showings_invalid ON public.showings(invalid);
CREATE INDEX IF NOT EXISTS idx_showings_rollback_instances ON public.approval_instances(type, target_id) WHERE type = 'showing_rollback'; 