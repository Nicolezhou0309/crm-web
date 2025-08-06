-- 修复直通队列消耗逻辑：当有轮空卡时，同时消耗轮空卡和直通卡
CREATE OR REPLACE FUNCTION public.assign_showings_user(
    p_community community,
    p_assigned_user_id bigint DEFAULT NULL  -- 新增：指定带看人ID参数
) RETURNS bigint
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
    v_record_id bigint;
    v_affected_rows int;
    v_quality_check boolean;
    v_skip_record_id bigint;
    v_direct_record_id bigint;
    v_skip_affected_rows int;
    v_direct_affected_rows int;
    v_log_id uuid;
    v_allocation_method text;
    v_queue_type text;
    v_processing_details jsonb;
    v_skip_card_consumed boolean := false;
    v_direct_card_consumed boolean := false;
    v_quality_check_passed boolean := false;
    v_remark text;
BEGIN
    -- 0. 指定人带看：最高优先级
    IF p_assigned_user_id IS NOT NULL THEN
        v_allocation_method := 'assigned';
        v_queue_type := 'direct';
        v_processing_details := jsonb_build_object(
            'assigned_user_id', p_assigned_user_id,
            'step', 'assigned_user_allocation'
        );
        
        -- 检查指定人是否有直通卡
        SELECT id INTO v_direct_record_id
        FROM public.showings_queue_record
        WHERE community = p_community
          AND queue_type = 'direct'
          AND user_id = p_assigned_user_id
          AND consumed = false
        ORDER BY created_at ASC
        LIMIT 1;
        
        IF v_direct_record_id IS NOT NULL THEN
            -- 有直通卡，消耗一张
            UPDATE public.showings_queue_record
            SET consumed = true, consumed_at = now(), remark = COALESCE(remark, '') || ' | 指定人直通卡消耗'
            WHERE id = v_direct_record_id;
            
            GET DIAGNOSTICS v_affected_rows = ROW_COUNT;
            
            IF v_affected_rows > 0 THEN
                v_next_user_id := p_assigned_user_id;
                v_direct_card_consumed := true;
                v_quality_check_passed := true;
                v_remark := '指定人直通卡分配成功';
                
                -- 记录日志
                INSERT INTO public.showings_allocation_logs (
                    community, assigned_user_id, allocation_method, queue_type, 
                    processing_details, skip_card_consumed, direct_card_consumed, 
                    quality_check_passed, remark
                ) VALUES (
                    p_community, v_next_user_id, v_allocation_method, v_queue_type,
                    v_processing_details, v_skip_card_consumed, v_direct_card_consumed,
                    v_quality_check_passed, v_remark
                );
                
                RETURN v_next_user_id;
            ELSE
                v_remark := '指定人直通卡消耗失败';
            END IF;
        ELSE
            -- 没有直通卡，为指定人添加一张轮空卡作为补偿
            INSERT INTO public.showings_queue_record (user_id, community, queue_type, created_at, consumed, remark)
            VALUES (p_assigned_user_id, p_community, 'skip', now(), false, '指定人无直通卡自动添加轮空卡补偿');
            
            GET DIAGNOSTICS v_affected_rows = ROW_COUNT;
            
            IF v_affected_rows > 0 THEN
                v_next_user_id := p_assigned_user_id;
                v_skip_card_consumed := false; -- 轮空卡未消耗，用于下一轮跳过
                v_quality_check_passed := true;
                v_remark := '指定人轮空卡补偿发放成功';
                
                -- 记录日志
                INSERT INTO public.showings_allocation_logs (
                    community, assigned_user_id, allocation_method, queue_type, 
                    processing_details, skip_card_consumed, direct_card_consumed, 
                    quality_check_passed, remark
                ) VALUES (
                    p_community, v_next_user_id, v_allocation_method, 'skip',
                    v_processing_details, v_skip_card_consumed, v_direct_card_consumed,
                    v_quality_check_passed, v_remark
                );
                
                RETURN v_next_user_id;
            ELSE
                v_remark := '指定人轮空卡发放失败';
            END IF;
        END IF;
        
        -- 记录失败日志
        IF v_next_user_id IS NULL THEN
            INSERT INTO public.showings_allocation_logs (
                community, assigned_user_id, allocation_method, queue_type, 
                processing_details, skip_card_consumed, direct_card_consumed, 
                quality_check_passed, remark
            ) VALUES (
                p_community, p_assigned_user_id, v_allocation_method, v_queue_type,
                v_processing_details, v_skip_card_consumed, v_direct_card_consumed,
                v_quality_check_passed, v_remark
            );
        END IF;
    END IF;

    -- 1. 直通队列：随机分配
    v_allocation_method := 'direct';
    v_queue_type := 'direct';
    v_processing_details := jsonb_build_object('step', 'direct_queue_allocation');
    
    -- 先通过质量检查函数过滤直通卡用户
    SELECT array_agg(user_id) INTO v_express_candidates
    FROM (
        SELECT DISTINCT sqr.user_id
        FROM public.showings_queue_record sqr
        WHERE sqr.community = p_community 
          AND sqr.queue_type = 'direct' 
          AND sqr.consumed = false
          AND check_showing_quality(sqr.user_id, p_community) = true
    ) t;

    IF v_express_candidates IS NOT NULL AND array_length(v_express_candidates, 1) > 0 THEN
        v_express_count := array_length(v_express_candidates, 1);
            
            FOR v_idx IN 1..v_express_count LOOP
                -- 随机选择一位直通卡用户
                SELECT v_express_candidates[(random() * (v_express_count-1) + 1)::int] INTO v_user_id;
                
                -- 初始化调试信息
                v_processing_details := jsonb_build_object(
                    'step', 'direct_queue_allocation',
                    'selected_user_id', v_user_id,
                    'direct_card_query', jsonb_build_object(),
                    'skip_card_query', jsonb_build_object()
                );
                
                -- 1. 先查询直通卡
                SELECT id INTO v_direct_record_id
                FROM public.showings_queue_record
                WHERE community = p_community
                  AND queue_type = 'direct'
                  AND user_id = v_user_id
                  AND consumed = false
                ORDER BY created_at ASC, id ASC
                LIMIT 1
                FOR UPDATE SKIP LOCKED;
                
                -- 更新调试信息：直通卡查询结果
                v_processing_details := jsonb_set(v_processing_details, '{direct_card_query}', 
                    jsonb_build_object(
                        'step', 'direct_card_query_first',
                        'user_id', v_user_id,
                        'direct_record_id', v_direct_record_id,
                        'query_time', now(),
                        'found', v_direct_record_id IS NOT NULL,
                        'message', CASE 
                            WHEN v_direct_record_id IS NULL THEN '记录不存在或已被锁定'
                            ELSE '找到记录ID=' || v_direct_record_id
                        END
                    )
                );
                
                -- 2. 如果找到直通卡，查询对应人员是否有轮空卡
                IF v_direct_record_id IS NOT NULL THEN
                    SELECT id INTO v_skip_record_id
                    FROM public.showings_queue_record
                    WHERE community = p_community
                      AND queue_type = 'skip'
                      AND user_id = v_user_id
                      AND consumed = false
                    ORDER BY created_at ASC, id ASC
                    LIMIT 1
                    FOR UPDATE SKIP LOCKED;
                    
                    -- 更新调试信息：轮空卡查询结果
                    v_processing_details := jsonb_set(v_processing_details, '{skip_card_query}', 
                        jsonb_build_object(
                            'step', 'skip_card_query_after_direct',
                            'user_id', v_user_id,
                            'direct_record_id', v_direct_record_id,
                            'skip_record_id', v_skip_record_id,
                            'query_time', now(),
                            'found', v_skip_record_id IS NOT NULL,
                            'message', CASE 
                                WHEN v_skip_record_id IS NULL THEN '记录不存在或已被锁定'
                                ELSE '找到记录ID=' || v_skip_record_id
                            END
                        )
                    );
                    
                    -- 3. 如果有轮空卡：同时消耗轮空卡和直通卡
                    IF v_skip_record_id IS NOT NULL THEN
                    
                        -- 同时消耗轮空卡和直通卡
                        -- 第三步：消耗轮空卡
                        UPDATE public.showings_queue_record
                        SET consumed = true, consumed_at = now(), remark = COALESCE(remark, '') || ' | 直通队列轮空消耗'
                        WHERE id = v_skip_record_id;
                        
                        GET DIAGNOSTICS v_skip_affected_rows = ROW_COUNT;
                        
                        -- 第四步：消耗直通卡
                        UPDATE public.showings_queue_record
                        SET consumed = true, consumed_at = now(), remark = COALESCE(remark, '') || ' | 直通队列直通消耗'
                        WHERE id = v_direct_record_id;
                        
                        GET DIAGNOSTICS v_direct_affected_rows = ROW_COUNT;
                        
                        -- 检查两次更新是否都成功
                        IF v_skip_affected_rows > 0 AND v_direct_affected_rows > 0 THEN
                            v_skip_card_consumed := true;
                            v_direct_card_consumed := true;
                            v_quality_check_passed := true;
                            v_remark := '直通队列轮空卡和直通卡同时消耗成功';
                            
                            -- 更新调试信息：消耗结果
                            v_processing_details := jsonb_set(v_processing_details, '{consumption_result}', 
                                jsonb_build_object(
                                    'step', 'card_consumption_result',
                                    'user_id', v_user_id,
                                    'skip_record_id', v_skip_record_id,
                                    'direct_record_id', v_direct_record_id,
                                    'skip_affected_rows', v_skip_affected_rows,
                                    'direct_affected_rows', v_direct_affected_rows,
                                    'consumption_time', now(),
                                    'success', true,
                                    'message', '轮空卡=' || v_skip_affected_rows || '行，直通卡=' || v_direct_affected_rows || '行'
                                )
                            );
                            
                            -- 记录成功日志
                            INSERT INTO public.showings_allocation_logs (
                                community, assigned_user_id, allocation_method, queue_type, 
                                processing_details, skip_card_consumed, direct_card_consumed, 
                                quality_check_passed, remark
                            ) VALUES (
                                p_community, v_user_id, v_allocation_method, v_queue_type,
                                v_processing_details, v_skip_card_consumed, v_direct_card_consumed,
                                v_quality_check_passed, v_remark
                            );
                            
                            CONTINUE; -- 同时消耗轮空卡和直通卡，继续下一个直通卡用户
                        ELSE
                            v_remark := '直通队列轮空卡和直通卡消耗失败';
                            
                            -- 更新调试信息：消耗失败
                            v_processing_details := jsonb_set(v_processing_details, '{consumption_result}', 
                                jsonb_build_object(
                                    'step', 'card_consumption_failed',
                                    'user_id', v_user_id,
                                    'skip_record_id', v_skip_record_id,
                                    'direct_record_id', v_direct_record_id,
                                    'skip_affected_rows', v_skip_affected_rows,
                                    'direct_affected_rows', v_direct_affected_rows,
                                    'consumption_time', now(),
                                    'success', false,
                                    'message', '消耗失败：轮空卡=' || v_skip_affected_rows || '行，直通卡=' || v_direct_affected_rows || '行'
                                )
                            );
                            
                            -- 记录消耗失败日志
                            INSERT INTO public.showings_allocation_logs (
                                community, assigned_user_id, allocation_method, queue_type, 
                                processing_details, skip_card_consumed, direct_card_consumed, 
                                quality_check_passed, remark
                            ) VALUES (
                                p_community, v_user_id, v_allocation_method, v_queue_type,
                                v_processing_details, v_skip_card_consumed, v_direct_card_consumed,
                                v_quality_check_passed, v_remark
                            );
                        END IF;
                        
                        -- 调试日志：记录消耗结果
                        INSERT INTO public.showings_allocation_logs (
                            community, assigned_user_id, allocation_method, queue_type, 
                            processing_details, skip_card_consumed, direct_card_consumed, 
                            quality_check_passed, remark
                        ) VALUES (
                            p_community, v_user_id, 'debug', 'consumption',
                            jsonb_build_object(
                                'step', 'card_consumption_result',
                                'user_id', v_user_id,
                                'skip_record_id', v_skip_record_id,
                                'direct_record_id', v_direct_record_id,
                                'skip_affected_rows', v_skip_affected_rows,
                                'direct_affected_rows', v_direct_affected_rows,
                                'consumption_time', now()
                            ), v_skip_card_consumed, v_direct_card_consumed, v_quality_check_passed, 
                            '消耗结果：轮空卡=' || v_skip_affected_rows || '行，直通卡=' || v_direct_affected_rows || '行'
                        );
                    ELSE
                        -- 如果没有轮空卡，只消耗直通卡，选中此人带看
                        -- 消耗直通卡
                        UPDATE public.showings_queue_record
                        SET consumed = true, consumed_at = now(), remark = COALESCE(remark, '') || ' | 直通队列直通消耗'
                        WHERE id = v_direct_record_id;
                        
                        GET DIAGNOSTICS v_direct_affected_rows = ROW_COUNT;
                        
                        IF v_direct_affected_rows > 0 THEN
                            v_next_user_id := v_user_id;
                            v_direct_card_consumed := true;
                            v_quality_check_passed := true;
                            v_remark := '直通队列直通卡消耗成功，选中此人带看';
                            
                            -- 更新调试信息：消耗结果
                            v_processing_details := jsonb_set(v_processing_details, '{consumption_result}', 
                                jsonb_build_object(
                                    'step', 'direct_card_consumption_success',
                                    'user_id', v_user_id,
                                    'direct_record_id', v_direct_record_id,
                                    'direct_affected_rows', v_direct_affected_rows,
                                    'consumption_time', now(),
                                    'success', true,
                                    'message', '直通卡消耗成功，选中此人带看'
                                )
                            );
                            
                            -- 记录成功日志
                            INSERT INTO public.showings_allocation_logs (
                                community, assigned_user_id, allocation_method, queue_type, 
                                processing_details, skip_card_consumed, direct_card_consumed, 
                                quality_check_passed, remark
                            ) VALUES (
                                p_community, v_next_user_id, v_allocation_method, v_queue_type,
                                v_processing_details, v_skip_card_consumed, v_direct_card_consumed,
                                v_quality_check_passed, v_remark
                            );
                            
                            EXIT; -- 选中此人，退出直通队列循环
                        ELSE
                            v_remark := '直通队列直通卡消耗失败';
                            
                            -- 更新调试信息：消耗失败
                            v_processing_details := jsonb_set(v_processing_details, '{consumption_result}', 
                                jsonb_build_object(
                                    'step', 'direct_card_consumption_failed',
                                    'user_id', v_user_id,
                                    'direct_record_id', v_direct_record_id,
                                    'direct_affected_rows', v_direct_affected_rows,
                                    'consumption_time', now(),
                                    'success', false,
                                    'message', '直通卡消耗失败'
                                )
                            );
                            
                            -- 记录消耗失败日志
                            INSERT INTO public.showings_allocation_logs (
                                community, assigned_user_id, allocation_method, queue_type, 
                                processing_details, skip_card_consumed, direct_card_consumed, 
                                quality_check_passed, remark
                            ) VALUES (
                                p_community, v_user_id, v_allocation_method, v_queue_type,
                                v_processing_details, v_skip_card_consumed, v_direct_card_consumed,
                                v_quality_check_passed, v_remark
                            );
                        END IF;
                    END IF;
                ELSE
                    -- 如果没有找到直通卡，进入基础队列
                    v_remark := '直通队列无可用直通卡，进入基础队列';
                    
                    -- 更新调试信息：无直通卡
                    v_processing_details := jsonb_set(v_processing_details, '{consumption_result}', 
                        jsonb_build_object(
                            'step', 'no_direct_card_available',
                            'user_id', v_user_id,
                            'consumption_time', now(),
                            'success', false,
                            'message', '无可用直通卡，进入基础队列'
                        )
                    );
                    
                    -- 记录无直通卡日志
                    INSERT INTO public.showings_allocation_logs (
                        community, assigned_user_id, allocation_method, queue_type, 
                        processing_details, skip_card_consumed, direct_card_consumed, 
                        quality_check_passed, remark
                    ) VALUES (
                        p_community, v_user_id, v_allocation_method, v_queue_type,
                        v_processing_details, v_skip_card_consumed, v_direct_card_consumed,
                        v_quality_check_passed, v_remark
                    );
                END IF;
            END LOOP;
    ELSE
        v_remark := '直通队列无可用候选人';
        
        -- 记录直通队列无候选人的日志
        INSERT INTO public.showings_allocation_logs (
            community, assigned_user_id, allocation_method, queue_type, 
            processing_details, skip_card_consumed, direct_card_consumed, 
            quality_check_passed, remark
        ) VALUES (
            p_community, NULL, v_allocation_method, v_queue_type,
            v_processing_details, v_skip_card_consumed, v_direct_card_consumed,
            v_quality_check_passed, v_remark
        );
    END IF;

    -- 2. 基础队列循环分配
    IF v_next_user_id IS NULL THEN
        v_allocation_method := 'basic';
        v_queue_type := 'basic';
        v_processing_details := jsonb_build_object('step', 'basic_queue_allocation');
        
        SELECT id, list INTO v_list_id, v_list
        FROM public.users_list
        WHERE community = p_community
        LIMIT 1;

        IF v_list_id IS NOT NULL AND v_list IS NOT NULL THEN
            
            -- 查找最近一次基础队列分配的带看人
            SELECT assigned_user_id INTO v_last_user_id
            FROM public.showings_allocation_logs
            WHERE community = p_community 
              AND allocation_method = 'basic'
              AND assigned_user_id IS NOT NULL
            ORDER BY created_at DESC
            LIMIT 1;

            -- 如果日志表中没有基础队列记录，则从基础队列第一个用户开始
            IF v_last_user_id IS NULL THEN
                v_start_idx := 1;
            ELSE
                -- 找到上一位在队列中的索引
                v_start_idx := 1;
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

                -- 检查是否有未消耗的轮空记录（使用与锁定查询相同的排序逻辑）
                SELECT id INTO v_skip
                FROM public.showings_queue_record
                WHERE community = p_community
                  AND queue_type = 'skip'
                  AND user_id = v_user_id
                  AND consumed = false
                ORDER BY created_at ASC, id ASC
                LIMIT 1;

                IF v_skip IS NOT NULL THEN
                    
                    -- 修复并发竞争：获取并锁定轮空记录（使用ID作为第二排序条件确保一致性）
                    SELECT id INTO v_record_id
                    FROM public.showings_queue_record
                    WHERE community = p_community
                      AND queue_type = 'skip'
                      AND user_id = v_user_id
                      AND consumed = false
                    ORDER BY created_at ASC, id ASC
                    LIMIT 1
                    FOR UPDATE SKIP LOCKED;
                    
                    IF v_record_id IS NOT NULL THEN
                        -- 消耗轮空记录
                        UPDATE public.showings_queue_record
                        SET consumed = true, consumed_at = now(), remark = COALESCE(remark, '') || ' | 基础队列轮空消耗'
                        WHERE id = v_record_id;
                        
                        GET DIAGNOSTICS v_affected_rows = ROW_COUNT;
                        
                        IF v_affected_rows > 0 THEN
                            v_skip_card_consumed := true;
                            v_quality_check_passed := true;
                            v_remark := '基础队列轮空卡消耗成功';
                            
                            -- 记录日志
                            INSERT INTO public.showings_allocation_logs (
                                community, assigned_user_id, allocation_method, queue_type, 
                                processing_details, skip_card_consumed, direct_card_consumed, 
                                quality_check_passed, remark
                            ) VALUES (
                                p_community, v_user_id, v_allocation_method, 'skip',
                                v_processing_details, v_skip_card_consumed, v_direct_card_consumed,
                                v_quality_check_passed, v_remark
                            );
                            
                            -- 跳过本人
                        ELSE
                            v_remark := '基础队列轮空卡消耗失败';
                            
                            -- 记录消耗失败日志
                            INSERT INTO public.showings_allocation_logs (
                                community, assigned_user_id, allocation_method, queue_type, 
                                processing_details, skip_card_consumed, direct_card_consumed, 
                                quality_check_passed, remark
                            ) VALUES (
                                p_community, v_user_id, v_allocation_method, 'skip',
                                v_processing_details, v_skip_card_consumed, v_direct_card_consumed,
                                v_quality_check_passed, v_remark
                            );
                        END IF;
                    ELSE
                        v_remark := '基础队列轮空卡记录不存在或已被锁定';
                        
                        -- 记录记录不存在日志
                        INSERT INTO public.showings_allocation_logs (
                            community, assigned_user_id, allocation_method, queue_type, 
                            processing_details, skip_card_consumed, direct_card_consumed, 
                            quality_check_passed, remark
                        ) VALUES (
                            p_community, v_user_id, v_allocation_method, 'skip',
                            v_processing_details, v_skip_card_consumed, v_direct_card_consumed,
                            v_quality_check_passed, v_remark
                        );
                    END IF;
                ELSE
                    
                    -- 质量控制
                    SELECT check_showing_quality(v_user_id, p_community) INTO v_quality_check;  
                    
                    IF v_quality_check THEN
                        v_next_user_id := v_user_id;
                        v_quality_check_passed := true;
                        v_remark := '基础队列正常分配成功';
                        
                        -- 记录日志
                        INSERT INTO public.showings_allocation_logs (
                            community, assigned_user_id, allocation_method, queue_type, 
                            processing_details, skip_card_consumed, direct_card_consumed, 
                            quality_check_passed, remark
                        ) VALUES (
                            p_community, v_next_user_id, v_allocation_method, v_queue_type,
                            v_processing_details, v_skip_card_consumed, v_direct_card_consumed,
                            v_quality_check_passed, v_remark
                        );
                        
                        EXIT;
                    ELSE
                        v_quality_check_passed := false;
                        v_remark := '基础队列质量控制未通过';
                        
                        -- 记录质量控制失败日志
                        INSERT INTO public.showings_allocation_logs (
                            community, assigned_user_id, allocation_method, queue_type, 
                            processing_details, skip_card_consumed, direct_card_consumed, 
                            quality_check_passed, remark
                        ) VALUES (
                            p_community, v_user_id, v_allocation_method, v_queue_type,
                            v_processing_details, v_skip_card_consumed, v_direct_card_consumed,
                            v_quality_check_passed, v_remark
                        );
                    END IF;
                END IF;

                -- 循环下一个
                v_idx := v_idx + 1;
                IF v_idx > v_total_count THEN
                    v_idx := 1;
                END IF;
                v_checked_count := v_checked_count + 1;
            END LOOP;
        ELSE
            v_remark := '基础队列列表不存在';
            
            -- 记录基础队列列表不存在日志
            INSERT INTO public.showings_allocation_logs (
                community, assigned_user_id, allocation_method, queue_type, 
                processing_details, skip_card_consumed, direct_card_consumed, 
                quality_check_passed, remark
            ) VALUES (
                p_community, NULL, v_allocation_method, v_queue_type,
                v_processing_details, v_skip_card_consumed, v_direct_card_consumed,
                v_quality_check_passed, v_remark
            );
        END IF;
    END IF;

    -- 3. 如果没有分配到任何人，记录失败日志
    IF v_next_user_id IS NULL THEN
        INSERT INTO public.showings_allocation_logs (
            community, assigned_user_id, allocation_method, queue_type, 
            processing_details, skip_card_consumed, direct_card_consumed, 
            quality_check_passed, remark
        ) VALUES (
            p_community, NULL, COALESCE(v_allocation_method, 'unknown'), COALESCE(v_queue_type, 'unknown'),
            COALESCE(v_processing_details, '{}'::jsonb), v_skip_card_consumed, v_direct_card_consumed,
            v_quality_check_passed, COALESCE(v_remark, '分配失败')
        );
    END IF;

    -- 4. 返回分配结果
    RETURN v_next_user_id;
END;
$$;

COMMENT ON FUNCTION public.assign_showings_user IS '修复版带看分配主函数，支持指定人带看（最高优先级，无直通卡时自动添加轮空卡补偿），直通队列先通过质量检查过滤用户，随机选择用户，如有轮空卡则同时消耗并继续下一个，否则选中此人带看，基础队列从最近一次基础队列分配的用户下一位开始，使用FOR UPDATE SKIP LOCKED避免并发竞争，使用ORDER BY created_at ASC, id ASC确保排序一致性，并记录详细日志'; 