-- 1. 轮空/直通记录表
CREATE TABLE IF NOT EXISTS public.showings_queue_record (
  id serial PRIMARY KEY,
  user_id bigint NOT NULL,         -- 用户ID（users_profile.id）
  community community NOT NULL,    -- 社区，统一为 community 枚举类型
  queue_type text NOT NULL,        -- 'direct'（直通）或 'skip'（轮空）
  created_at timestamp with time zone DEFAULT now(),
  consumed boolean DEFAULT false,  -- 是否已被消耗
  consumed_at timestamp with time zone
);

COMMENT ON TABLE public.showings_queue_record IS '带看分配队列消耗记录表，直通/轮空每次消耗一条记录';

-- 2. 带看质量控制函数（占位，可后续完善）
CREATE OR REPLACE FUNCTION public.check_showing_quality(user_id bigint, community community)
RETURNS boolean
LANGUAGE plpgsql
AS $$
BEGIN
    -- TODO: 这里写具体的质量控制逻辑
    -- 例如：近30天满意度>=4，或无投诉等
    -- 目前先全部返回true，后续再完善
    RETURN true;
END;
$$;

COMMENT ON FUNCTION public.check_showing_quality IS '检查带看人员在指定社区是否满足质量要求';

-- 3. 建议索引
CREATE INDEX IF NOT EXISTS idx_showings_queue_record_main ON public.showings_queue_record(user_id, community, queue_type, consumed);
CREATE INDEX IF NOT EXISTS idx_showings_community ON public.showings(community);
CREATE INDEX IF NOT EXISTS idx_users_list_list_gin ON public.users_list USING gin(list);

-- 带看分配主函数（v3，直通随机，基础循环，轮空消耗，上一位找不到从头开始）
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
                -- 消耗轮空记录
                UPDATE public.showings_queue_record
                SET consumed = true, consumed_at = now()
                WHERE id = v_skip.id;
                CONTINUE; -- 跳过本次直通车人
            END IF;

            -- 质量控制
            IF check_showing_quality(v_user_id, p_community) THEN
                -- 消耗一条直通卡记录
                UPDATE public.showings_queue_record
                SET consumed = true, consumed_at = now()
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
                    -- 消耗轮空记录
                    UPDATE public.showings_queue_record
                    SET consumed = true, consumed_at = now()
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

    -- 3. 返回分配结果
    RETURN v_next_user_id;
END;
$$;

COMMENT ON FUNCTION public.assign_showings_user IS '带看分配主函数，直通队列随机分配，基础队列循环遍历，轮空消耗后继续循环，所有人都被轮空消耗则继续循环，上一位找不到自动从头开始，消耗记录实时更新';

-- 1. showings_queue_record 主表索引
CREATE INDEX IF NOT EXISTS idx_showings_queue_record_main
  ON public.showings_queue_record(user_id, community, queue_type, consumed);

-- 2. showings_queue_record 按社区和队列类型的索引
CREATE INDEX IF NOT EXISTS idx_showings_queue_record_community_type
  ON public.showings_queue_record(community, queue_type, consumed);

-- 3. showings 表的社区字段索引
CREATE INDEX IF NOT EXISTS idx_showings_community
  ON public.showings(community);

-- 4. users_list.list GIN索引（加速基础队列分配）
CREATE INDEX IF NOT EXISTS idx_users_list_list_gin
  ON public.users_list USING gin(list);

-- 5. users_profile.id 唯一索引（如未有）
CREATE UNIQUE INDEX IF NOT EXISTS idx_users_profile_id
  ON public.users_profile(id);

-- 6. showings.showingsales 外键约束（如未有）
ALTER TABLE public.showings
  ADD CONSTRAINT fk_showings_showingsales
  FOREIGN KEY (showingsales) REFERENCES public.users_profile(id);

-- 7. showings_queue_record.user_id 外键约束（如未有）
ALTER TABLE public.showings_queue_record
  ADD CONSTRAINT fk_queue_record_user
  FOREIGN KEY (user_id) REFERENCES public.users_profile(id);

-- 8. users_list.community 字段索引（如未有）
CREATE INDEX IF NOT EXISTS idx_users_list_community
  ON public.users_list(community);

-- 9. 注释
COMMENT ON COLUMN public.showings_queue_record.queue_type IS '队列类型，direct=直通，skip=轮空';
COMMENT ON COLUMN public.showings_queue_record.consumed IS '是否已被消耗，true=已消耗，false=未消耗';
COMMENT ON COLUMN public.showings_queue_record.consumed_at IS '消耗时间';
COMMENT ON COLUMN public.users_list.list IS '基础队列用户ID数组';
COMMENT ON COLUMN public.users_list.community IS '队列所属社区';
COMMENT ON COLUMN public.showings.showingsales IS '本次带看分配到的用户ID';