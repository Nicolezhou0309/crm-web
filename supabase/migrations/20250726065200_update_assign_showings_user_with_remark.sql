-- 更新assign_showings_user函数，在消耗直通卡和轮空卡时添加remark

-- 1. 更新带看分配主函数，在消耗记录时添加remark
CREATE OR REPLACE FUNCTION public.assign_showings_user(
    p_community community
) RETURNS bigint  -- 返回分配到的用户ID（users_profile.id）
LANGUAGE plpgsql
AS $$
DECLARE
    v_user_id bigint;
    v_list_id bigint;
    v_list bigint[];
    v_idx int;
    v_last_user_id bigint;
    v_found boolean := false;
    v_skip RECORD;
    v_next_user_id bigint := NULL;
    v_checked_count int;
    v_total_count int;
    v_start_idx int;
    v_express_candidates bigint[];
    v_express_count int;
BEGIN
    -- 1. 直通队列：随机分配
    SELECT array_agg(user_id) INTO v_express_candidates
    FROM (
        SELECT DISTINCT user_id
        FROM public.showings_queue_record
        WHERE community = p_community AND queue_type = 'direct'
    ) t;

    IF v_express_candidates IS NOT NULL AND array_length(v_express_candidates, 1) > 0 THEN
        v_express_count := array_length(v_express_candidates, 1);
        FOR v_idx IN 1..v_express_count LOOP
            SELECT v_express_candidates[(random() * (v_express_count-1) + 1)::int] INTO v_user_id;
            -- 检查是否有未消耗的轮空记录
            SELECT id INTO v_skip
            FROM public.showings_queue_record
            WHERE community = p_community
              AND queue_type = 'skip'
              AND user_id = v_user_id
              AND consumed = false
            LIMIT 1;

            IF v_skip IS NOT NULL THEN
                -- 消耗轮空记录，添加消耗理由
                UPDATE public.showings_queue_record
                SET consumed = true, consumed_at = now(), remark = COALESCE(remark, '') || ' | 消耗时间：' || now()::text
                WHERE id = v_skip.id;
                CONTINUE; -- 跳过本次直通车人
            END IF;

            -- 质量控制
            IF check_showing_quality(v_user_id, p_community) THEN
                -- 消耗一条直通卡记录，添加消耗理由
                UPDATE public.showings_queue_record
                SET consumed = true, consumed_at = now(), remark = COALESCE(remark, '') || ' | 消耗时间：' || now()::text
                WHERE id = (
                    SELECT id FROM public.showings_queue_record
                    WHERE community = p_community
                      AND queue_type = 'direct'
                      AND user_id = v_user_id
                      AND consumed = false
                    LIMIT 1
                );
                v_next_user_id := v_user_id;
                EXIT;
            END IF;
        END LOOP;
    END IF;

    -- 2. 基础队列循环分配
    IF v_next_user_id IS NULL THEN
        SELECT id, list INTO v_list_id, v_list
        FROM public.users_list
        WHERE community = p_community
        LIMIT 1;

        IF v_list_id IS NOT NULL AND v_list IS NOT NULL THEN
            -- 查找最近一次带看人
            SELECT showingsales INTO v_last_user_id
            FROM public.showings
            WHERE community = p_community AND showingsales IS NOT NULL
            ORDER BY created_at DESC
            LIMIT 1;

            -- 找到上一位在队列中的索引
            v_start_idx := 1;
            IF v_last_user_id IS NOT NULL THEN
                FOR v_idx IN 1..array_length(v_list, 1) LOOP
                    IF v_list[v_idx] = v_last_user_id THEN
                        v_start_idx := v_idx + 1;
                        IF v_start_idx > array_length(v_list, 1) THEN
                            v_start_idx := 1;
                        END IF;
                        EXIT;
                    END IF;
                END LOOP;
            END IF;

            v_total_count := array_length(v_list, 1);
            v_idx := v_start_idx;
            v_checked_count := 0;

            -- 无限循环，直到找到可分配人（最多10轮）
            WHILE v_checked_count < v_total_count * 10 LOOP
                v_user_id := v_list[v_idx];

                -- 检查是否有未消耗的轮空记录
                SELECT id INTO v_skip
                FROM public.showings_queue_record
                WHERE community = p_community
                  AND queue_type = 'skip'
                  AND user_id = v_user_id
                  AND consumed = false
                LIMIT 1;

                IF v_skip IS NOT NULL THEN
                    -- 消耗轮空记录，添加消耗理由
                    UPDATE public.showings_queue_record
                    SET consumed = true, consumed_at = now(), remark = COALESCE(remark, '') || ' | 消耗时间：' || now()::text
                    WHERE id = v_skip.id;
                    -- 跳过本人
                ELSE
                    -- 质量控制
                    IF check_showing_quality(v_user_id, p_community) THEN
                        v_next_user_id := v_user_id;
                        EXIT;
                    END IF;
                END IF;

                -- 循环下一个
                v_idx := v_idx + 1;
                IF v_idx > v_total_count THEN
                    v_idx := 1;
                END IF;
                v_checked_count := v_checked_count + 1;
            END LOOP;
        END IF;
    END IF;

    RETURN v_next_user_id;
END;
$$;

-- 2. 更新函数注释
COMMENT ON FUNCTION public.assign_showings_user IS '带看分配主函数：优先分配直通卡，其次轮空卡，最后基础队列循环分配。在消耗记录时会更新remark字段记录消耗时间。'; 