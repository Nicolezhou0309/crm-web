

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET transaction_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;


CREATE SCHEMA IF NOT EXISTS "public";


COMMENT ON SCHEMA "public" IS 'standard public schema';



CREATE TYPE "public"."allocation_method" AS ENUM (
    'round_robin',
    'random',
    'workload',
    'points'
);


ALTER TYPE "public"."allocation_method" OWNER TO "postgres";


CREATE TYPE "public"."community" AS ENUM (
    '浦江中心社区',
    '浦江公园社区',
    '北虹桥国际社区',
    '新静安中心社区',
    '中环沪太路社区',
    '微领地青年社区'
);


ALTER TYPE "public"."community" OWNER TO "postgres";


COMMENT ON TYPE "public"."community" IS '社区名称';



CREATE TYPE "public"."customerprofile" AS ENUM (
    '新来沪应届生',
    '新来沪非应届生',
    '本地应届生',
    '换房客',
    '未知'
);


ALTER TYPE "public"."customerprofile" OWNER TO "postgres";


COMMENT ON TYPE "public"."customerprofile" IS '用户画像';



CREATE TYPE "public"."followupstage" AS ENUM (
    '待接收',
    '确认需求',
    '邀约到店',
    '已到店',
    '赢单',
    '丢单'
);


ALTER TYPE "public"."followupstage" OWNER TO "postgres";


COMMENT ON TYPE "public"."followupstage" IS '跟进阶段';



CREATE TYPE "public"."source" AS ENUM (
    '抖音',
    '小红书',
    'B站',
    '视频号',
    'APP',
    '小程序',
    '大众点评',
    '其他'
);


ALTER TYPE "public"."source" OWNER TO "postgres";


COMMENT ON TYPE "public"."source" IS '线索渠道';



CREATE TYPE "public"."userrating" AS ENUM (
    'A',
    'B+',
    'B',
    'C'
);


ALTER TYPE "public"."userrating" OWNER TO "postgres";


COMMENT ON TYPE "public"."userrating" IS '用户评级';



CREATE OR REPLACE FUNCTION "public"."allocate_from_users"("user_list" bigint[], "method" "public"."allocation_method", "p_required_points" integer DEFAULT NULL::integer) RETURNS bigint
    LANGUAGE "plpgsql"
    AS $$
DECLARE
    target_user_id bigint;
    available_users bigint[];
    current_user_id bigint;
BEGIN
    -- 如果用户列表为空，返回NULL
    IF user_list IS NULL OR array_length(user_list, 1) IS NULL THEN
        RETURN NULL;
    END IF;

    -- 如果是积分分配模式且指定了所需积分，先过滤积分足够的用户
    IF method = 'points' AND p_required_points IS NOT NULL AND p_required_points > 0 THEN
        available_users := ARRAY[]::bigint[];

        -- 检查每个用户的积分余额
        FOREACH current_user_id IN ARRAY user_list LOOP
            IF EXISTS (
                SELECT 1 FROM user_points_wallet upw
                WHERE upw.user_id = current_user_id::bigint
                AND COALESCE(upw.total_points, 0) >= p_required_points
            ) THEN
                available_users := available_users || current_user_id;
            END IF;
        END LOOP;

        -- 如果没有积分足够的用户，返回NULL
        IF array_length(available_users, 1) IS NULL THEN
            RETURN NULL;
        END IF;

        -- 使用过滤后的用户列表
        user_list := available_users;
    END IF;

    CASE method
        WHEN 'round_robin' THEN
            -- 轮流分配：选择今日分配数量最少的用户
            SELECT uid INTO target_user_id
            FROM unnest(user_list) AS uid
            ORDER BY (
                SELECT COUNT(*) FROM simple_allocation_logs sal
                WHERE sal.assigned_user_id = uid::bigint
                AND sal.created_at >= CURRENT_DATE
            ) ASC, RANDOM()
            LIMIT 1;

        WHEN 'random' THEN
            -- 随机分配
            SELECT uid INTO target_user_id
            FROM unnest(user_list) AS uid
            ORDER BY RANDOM()
            LIMIT 1;

        WHEN 'workload' THEN
            -- 按工作量分配
            SELECT uid INTO target_user_id
            FROM unnest(user_list) AS uid
            ORDER BY (
                SELECT COUNT(*) FROM simple_allocation_logs sal
                WHERE sal.assigned_user_id = uid::bigint
                AND sal.created_at >= CURRENT_DATE - INTERVAL '7 days'
            ) ASC, RANDOM()
            LIMIT 1;

        WHEN 'points' THEN
            -- 积分分配：选择积分余额最高的用户
            SELECT uid INTO target_user_id
            FROM unnest(user_list) AS uid
            ORDER BY (
                SELECT COALESCE(upw.total_points, 0) FROM user_points_wallet upw
                WHERE upw.user_id = uid::bigint
            ) DESC, RANDOM()
            LIMIT 1;

        ELSE
            -- 默认取第一个用户
            SELECT uid INTO target_user_id
            FROM unnest(user_list) AS uid
            LIMIT 1;
    END CASE;

    RETURN target_user_id;
END;
$$;


ALTER FUNCTION "public"."allocate_from_users"("user_list" bigint[], "method" "public"."allocation_method", "p_required_points" integer) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."allocate_lead_simple"("p_leadid" "text", "p_source" "public"."source" DEFAULT NULL::"public"."source", "p_leadtype" "text" DEFAULT NULL::"text", "p_community" "public"."community" DEFAULT NULL::"public"."community", "p_manual_user_id" bigint DEFAULT NULL::bigint) RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
DECLARE
    rule_record RECORD;
    target_user_id bigint;
    processing_result jsonb;
    group_index integer;
    user_group_id bigint;
    candidate_users bigint[];
    final_users bigint[];
    allocation_details jsonb := '{}';
    group_allocation_method allocation_method;
    debug_info jsonb := '{}';
    rules_attempted integer := 0;
    rule_success boolean := false;
    points_cost integer := NULL;
    points_cost_result jsonb;
BEGIN
    -- 添加调试日志
    debug_info := jsonb_build_object(
        'input_leadid', p_leadid,
        'input_source', p_source,
        'input_leadtype', p_leadtype,
        'input_community', p_community,
        'input_manual_user_id', p_manual_user_id
    );

    -- 1. 手动分配优先
    IF p_manual_user_id IS NOT NULL THEN
        debug_info := debug_info || jsonb_build_object('manual_assignment', true);
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

        -- 遍历规则中的用户组
        group_index := 1;
        FOREACH user_group_id IN ARRAY rule_record.user_groups
        LOOP
            -- 获取用户组中的用户列表
            candidate_users := get_group_users(user_group_id);

            -- 应用分配过滤器
            final_users := apply_allocation_filters(
                candidate_users,
                user_group_id,
                p_community,
                true, -- 质量控制
                true, -- 社区匹配
                rule_record.enable_permission_check
            );

            -- 如果有可用用户，尝试分配
            IF final_users IS NOT NULL AND array_length(final_users, 1) > 0 THEN
                -- 从users_list表获取分配方法，优先使用用户组配置
                SELECT allocation INTO group_allocation_method
                FROM users_list
                WHERE id = user_group_id;

                -- 如果是积分分配模式，先计算积分成本
                IF group_allocation_method = 'points' THEN
                    points_cost_result := calculate_lead_points_cost(
                        p_source, p_leadtype, NULL, NULL, NULL
                    );
                    IF (points_cost_result->>'success')::boolean THEN
                        points_cost := (points_cost_result->>'points_cost')::integer;
                    END IF;
                END IF;

                BEGIN
                    -- 调用分配函数，传入积分成本参数
                    SELECT allocate_from_users(final_users, COALESCE(group_allocation_method, rule_record.allocation_method), points_cost) INTO target_user_id;

                    IF target_user_id IS NOT NULL THEN
                        rule_success := true;

                        -- 移除日志记录，由触发器统一处理
                        RETURN jsonb_build_object(
                            'success', true,
                            'assigned_user_id', target_user_id,
                            'allocation_method', rule_record.allocation_method,
                            'rule_id', rule_record.id,  -- 添加rule_id
                            'rule_name', rule_record.name,
                            'rule_priority', rule_record.priority,
                            'selected_group_index', group_index,
                            'rules_attempted', rules_attempted,
                            'points_cost', points_cost,
                            'processing_details', jsonb_build_object(
                                'rule_name', rule_record.name,
                                'rule_priority', rule_record.priority,
                                'group_id', user_group_id,
                                'candidate_count', array_length(candidate_users, 1),
                                'final_count', array_length(final_users, 1),
                                'allocation_method', COALESCE(group_allocation_method, rule_record.allocation_method),
                                'rules_attempted', rules_attempted,
                                'points_cost', points_cost,
                                'filters_applied', jsonb_build_object(
                                    'permission_check', rule_record.enable_permission_check
                                ),
                                'debug_info', debug_info
                            ),
                            'debug_info', debug_info
                        );
                    END IF;
                END;
            END IF;

            group_index := group_index + 1;
        END LOOP;

        EXIT WHEN rule_success;
    END LOOP;

    -- 如果没有成功分配，返回失败结果（不记录日志）
    RETURN jsonb_build_object(
        'success', false,
        'error', '无法找到合适的分配目标',
        'rules_attempted', rules_attempted,
        'debug_info', debug_info
    );
END;
$$;


ALTER FUNCTION "public"."allocate_lead_simple"("p_leadid" "text", "p_source" "public"."source", "p_leadtype" "text", "p_community" "public"."community", "p_manual_user_id" bigint) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."apply_allocation_filters"("candidate_users" bigint[], "group_id" bigint, "p_community" "public"."community", "enable_quality_control" boolean, "enable_community_matching" boolean, "enable_permission_check" boolean) RETURNS bigint[]
    LANGUAGE "plpgsql"
    AS $$
      DECLARE
          filtered_users          bigint[] := candidate_users;
          community_json          jsonb;
          community_matched_users bigint[];
          group_enable_quality    boolean;
          group_enable_comm_match boolean;
          dbg jsonb := jsonb_build_object(
              'input_users',                candidate_users,
              'group_id',                   group_id,
              'community',                  p_community,
              'enable_quality_control_arg', enable_quality_control,
              'enable_community_matching_arg', enable_community_matching,
              'enable_permission_check',    enable_permission_check
          );
      BEGIN
          ------------------------------------------------------------------
          -- 0. 空数组直接返回
          ------------------------------------------------------------------
          IF filtered_users IS NULL OR array_length(filtered_users,1) IS NULL THEN
              dbg := dbg || '{"input_empty":true}';
              RETURN NULL;
          END IF;

          ------------------------------------------------------------------
          -- 1. 读取用户组配置
          ------------------------------------------------------------------
          SELECT 
              COALESCE(ul.enable_quality_control,    false),
              COALESCE(ul.enable_community_matching, false)
          INTO
              group_enable_quality,
              group_enable_comm_match
          FROM users_list ul
          WHERE ul.id = group_id;
          
          dbg := dbg || jsonb_build_object(
              'group_enable_quality',    group_enable_quality,
              'group_enable_comm_match', group_enable_comm_match
          );

          ------------------------------------------------------------------
          -- 2. 质量控制过滤
          ------------------------------------------------------------------
          IF group_enable_quality AND enable_quality_control THEN
              BEGIN
                  filtered_users := filter_users_by_quality_control(filtered_users, group_id);
                  dbg := dbg || jsonb_build_object('after_quality', filtered_users);

                  IF filtered_users IS NULL OR array_length(filtered_users,1) IS NULL THEN
                      dbg := dbg || '{"quality_filtered_all":true}';
                      RETURN NULL;
                  END IF;
              EXCEPTION WHEN OTHERS THEN
                  dbg := dbg || jsonb_build_object('quality_error', SQLERRM);
              END;
          END IF;
          
          ------------------------------------------------------------------
          -- 3. 权限检查过滤
          ------------------------------------------------------------------
          IF enable_permission_check THEN
              BEGIN
                  filtered_users := filter_users_by_permission(filtered_users);
                  dbg := dbg || jsonb_build_object('after_permission', filtered_users);

                  IF filtered_users IS NULL OR array_length(filtered_users,1) IS NULL THEN
                      dbg := dbg || '{"permission_filtered_all":true}';
                      RETURN NULL;
                  END IF;
              EXCEPTION WHEN OTHERS THEN
                  dbg := dbg || jsonb_build_object('permission_error', SQLERRM);
              END;
          END IF;
          
          ------------------------------------------------------------------
          -- 4. 社区优先推荐 (修复：确保社区匹配被正确应用)
          ------------------------------------------------------------------
          IF group_enable_comm_match AND enable_community_matching
             AND p_community IS NOT NULL THEN
              BEGIN
                  -- 调用社区匹配函数
                  community_json := match_community_to_organization(p_community, filtered_users);
                  community_matched_users := jsonb_to_bigint_array(community_json -> 'matched_users');

                  dbg := dbg || jsonb_build_object(
                      'community_json',      community_json,
                      'community_matched',   community_matched_users
                  );
              
                  -- 修复：如果社区匹配成功，优先使用社区匹配的用户
                  IF community_matched_users IS NOT NULL
                     AND array_length(community_matched_users,1) > 0 THEN
                      filtered_users := community_matched_users;
                      dbg := dbg || jsonb_build_object('community_priority_applied', true);
                  END IF;
              EXCEPTION WHEN OTHERS THEN
                  dbg := dbg || jsonb_build_object('community_match_error', SQLERRM);
              END;
          END IF;
          
          ------------------------------------------------------------------
          -- 5. 写入最终日志并返回
          ------------------------------------------------------------------
          dbg := dbg || jsonb_build_object(
              'final_users', filtered_users,
              'final_cnt',   COALESCE(array_length(filtered_users,1),0)
          );

          RETURN filtered_users;
      END;
      $$;


ALTER FUNCTION "public"."apply_allocation_filters"("candidate_users" bigint[], "group_id" bigint, "p_community" "public"."community", "enable_quality_control" boolean, "enable_community_matching" boolean, "enable_permission_check" boolean) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."approval_instance_approved_hook"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  IF NEW.status = 'approved' AND OLD.status IS DISTINCT FROM 'approved' THEN
    -- 这里可调用业务逻辑，如发放积分、变更业务状态等
    RAISE NOTICE '审批流[%]已通过，业务表: %, 业务ID: %', NEW.id, NEW.target_table, NEW.target_id;
    -- 可扩展：PERFORM your_business_function(NEW.target_table, NEW.target_id);
  END IF;
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."approval_instance_approved_hook"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."assign_showings_user"("p_community" "public"."community", "p_assigned_user_id" bigint DEFAULT NULL::bigint) RETURNS bigint
    LANGUAGE "plpgsql"
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


ALTER FUNCTION "public"."assign_showings_user"("p_community" "public"."community", "p_assigned_user_id" bigint) OWNER TO "postgres";


COMMENT ON FUNCTION "public"."assign_showings_user"("p_community" "public"."community", "p_assigned_user_id" bigint) IS '修复版带看分配主函数，支持指定人带看（最高优先级，无直通卡时自动添加轮空卡补偿），直通队列先通过质量检查过滤用户，随机选择用户，如有轮空卡则同时消耗并继续下一个，否则选中此人带看，基础队列从最近一次基础队列分配的用户下一位开始，使用FOR UPDATE SKIP LOCKED避免并发竞争，使用ORDER BY created_at ASC, id ASC确保排序一致性，并记录详细日志';



CREATE OR REPLACE FUNCTION "public"."auto_cleanup_frequency_tables"("p_freq_table_max_rows" integer DEFAULT 100000, "p_freq_table_batch_delete" integer DEFAULT 10000, "p_log_table_max_rows" integer DEFAULT 500000, "p_log_table_batch_delete" integer DEFAULT 50000) RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
    v_freq_count INTEGER;
    v_log_count INTEGER;
    v_freq_deleted INTEGER := 0;
    v_log_deleted INTEGER := 0;
BEGIN
    -- 1. 清理 operation_frequency_control
    SELECT COUNT(*) INTO v_freq_count FROM public.operation_frequency_control;
    IF v_freq_count > p_freq_table_max_rows THEN
        WITH del AS (
            DELETE FROM public.operation_frequency_control
            WHERE id IN (
                SELECT id FROM public.operation_frequency_control
                ORDER BY window_end ASC, id ASC
                LIMIT p_freq_table_batch_delete
            )
            RETURNING 1
        )
        SELECT COUNT(*) INTO v_freq_deleted FROM del;
    END IF;

    -- 2. 清理 operation_logs
    SELECT COUNT(*) INTO v_log_count FROM public.operation_logs;
    IF v_log_count > p_log_table_max_rows THEN
        WITH del AS (
            DELETE FROM public.operation_logs
            WHERE id IN (
                SELECT id FROM public.operation_logs
                ORDER BY created_at ASC, id ASC
                LIMIT p_log_table_batch_delete
            )
            RETURNING 1
        )
        SELECT COUNT(*) INTO v_log_deleted FROM del;
    END IF;

    RETURN jsonb_build_object(
        'freq_table_total', v_freq_count,
        'freq_table_deleted', v_freq_deleted,
        'log_table_total', v_log_count,
        'log_table_deleted', v_log_deleted
    );
END;
$$;


ALTER FUNCTION "public"."auto_cleanup_frequency_tables"("p_freq_table_max_rows" integer, "p_freq_table_batch_delete" integer, "p_log_table_max_rows" integer, "p_log_table_batch_delete" integer) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."award_points"("p_user_id" bigint, "p_source_type" character varying, "p_source_id" bigint DEFAULT NULL::bigint, "p_description" "text" DEFAULT NULL::"text") RETURNS "jsonb"
    LANGUAGE "plpgsql"
    AS $$
DECLARE
  v_rule_id INTEGER;
  v_points_value INTEGER;
  v_current_balance INTEGER;
  v_new_balance INTEGER;
  v_result JSONB;
  v_today_count INTEGER;
  v_total_count INTEGER;
BEGIN
  -- 1. 查找适用的积分规则
  SELECT id, points_value
  INTO v_rule_id, v_points_value
  FROM points_rules 
  WHERE source_type = p_source_type 
    AND is_active = true
    AND (start_time IS NULL OR start_time <= NOW())
    AND (end_time IS NULL OR end_time >= NOW())
  LIMIT 1;
  
  -- 2. 检查规则是否存在
  IF v_rule_id IS NULL THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'No active rule found for source type: ' || p_source_type
    );
  END IF;
  
  -- 3. 检查每日限制
  IF EXISTS (SELECT 1 FROM points_rules WHERE id = v_rule_id AND max_times_per_day IS NOT NULL) THEN
    SELECT COUNT(*)
    INTO v_today_count
    FROM user_points_transactions
    WHERE user_id = p_user_id 
      AND source_type = p_source_type
      AND created_at >= CURRENT_DATE;
    
    IF v_today_count >= (SELECT max_times_per_day FROM points_rules WHERE id = v_rule_id) THEN
      RETURN jsonb_build_object(
        'success', false,
        'error', 'Daily limit reached for source type: ' || p_source_type
      );
    END IF;
  END IF;
  
  -- 4. 检查总限制
  IF EXISTS (SELECT 1 FROM points_rules WHERE id = v_rule_id AND max_times_total IS NOT NULL) THEN
    SELECT COUNT(*)
    INTO v_total_count
    FROM user_points_transactions
    WHERE user_id = p_user_id 
      AND source_type = p_source_type;
    
    IF v_total_count >= (SELECT max_times_total FROM points_rules WHERE id = v_rule_id) THEN
      RETURN jsonb_build_object(
        'success', false,
        'error', 'Total limit reached for source type: ' || p_source_type
      );
    END IF;
  END IF;
  
  -- 5. 获取当前积分余额
  SELECT total_points INTO v_current_balance
  FROM user_points_wallet
  WHERE user_id = p_user_id;
  v_current_balance := COALESCE(v_current_balance, 0);
  v_new_balance := v_current_balance + v_points_value;
  
  -- 6. 只插入积分流水记录，钱包余额由触发器维护
  INSERT INTO user_points_transactions (
    user_id, points_change, balance_after, 
    transaction_type, source_type, source_id, description
  ) VALUES (
    p_user_id, v_points_value, v_new_balance,
    'EARN', p_source_type, p_source_id::text,
    COALESCE(p_description, '自动发放积分')
  );
  
  -- 7. 返回结果
  v_result := jsonb_build_object(
    'success', true,
    'points_awarded', v_points_value,
    'new_balance', v_new_balance,
    'rule_id', v_rule_id,
    'description', COALESCE(p_description, '自动发放积分')
  );
  
  RETURN v_result;
  
EXCEPTION
  WHEN OTHERS THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Failed to award points: ' || SQLERRM
    );
END;
$$;


ALTER FUNCTION "public"."award_points"("p_user_id" bigint, "p_source_type" character varying, "p_source_id" bigint, "p_description" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."before_insert_lead"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
DECLARE
    duplicate_count INT;
BEGIN
    -- 生成新的 leadid
    NEW.leadid := gen_leadid();
    -- 检查在过去 7 天内是否有重复的 phone 或 wechat
    SELECT COUNT(*) INTO duplicate_count
    FROM public.leads
    WHERE (phone = NEW.phone OR wechat = NEW.wechat)
      AND created_at >= NOW() - INTERVAL '7 days';
    -- 如果发现重复，更新 leadstatus
    IF duplicate_count > 0 THEN
        NEW.leadstatus := '重复';
    ELSE
        NEW.leadstatus := '新建';
    END IF;
    RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."before_insert_lead"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."calculate_dynamic_cost_adjustments"("dynamic_config" "jsonb", "p_source" "public"."source", "p_leadtype" "text", "p_campaignname" "text" DEFAULT NULL::"text", "p_unitname" "text" DEFAULT NULL::"text", "p_remark" "text" DEFAULT NULL::"text") RETURNS "jsonb"
    LANGUAGE "plpgsql"
    AS $$
DECLARE
    adjustments jsonb := '{}';
    adjustment_value integer;
    extracted_community text;
BEGIN
    -- 来源调整
    IF dynamic_config ? 'source_adjustments' AND p_source IS NOT NULL THEN
        adjustment_value := COALESCE((dynamic_config->'source_adjustments'->>(p_source::text))::integer, 0);
        IF adjustment_value != 0 THEN
            adjustments := adjustments || jsonb_build_object('source_' || p_source, adjustment_value);
        END IF;
    END IF;
    
    -- 线索类型调整
    IF dynamic_config ? 'leadtype_adjustments' AND p_leadtype IS NOT NULL THEN
        adjustment_value := COALESCE((dynamic_config->'leadtype_adjustments'->>p_leadtype)::integer, 0);
        IF adjustment_value != 0 THEN
            adjustments := adjustments || jsonb_build_object('leadtype_' || p_leadtype, adjustment_value);
        END IF;
    END IF;
    
    -- 关键词调整（包含从remark中提取的社区信息）
    IF dynamic_config ? 'keyword_adjustments' THEN
        DECLARE
            keyword text;
            keyword_adjustment integer;
        BEGIN
            -- 优先从remark中提取community信息
            IF p_remark IS NOT NULL AND p_remark ~ '\[COMMUNITY:([^\]]+)\]' THEN
                extracted_community := (regexp_match(p_remark, '\[COMMUNITY:([^\]]+)\]'))[1];
            END IF;
            
            FOR keyword IN SELECT jsonb_object_keys(dynamic_config->'keyword_adjustments')
            LOOP
                keyword_adjustment := (dynamic_config->'keyword_adjustments'->>keyword)::integer;
                IF (p_campaignname ILIKE '%' || keyword || '%' OR
                    p_unitname ILIKE '%' || keyword || '%' OR
                    p_remark ILIKE '%' || keyword || '%' OR
                    (extracted_community IS NOT NULL AND extracted_community ILIKE '%' || keyword || '%')) THEN
                    adjustments := adjustments || jsonb_build_object('keyword_' || keyword, keyword_adjustment);
                END IF;
            END LOOP;
        END;
    END IF;
    
    RETURN adjustments;
END;
$$;


ALTER FUNCTION "public"."calculate_dynamic_cost_adjustments"("dynamic_config" "jsonb", "p_source" "public"."source", "p_leadtype" "text", "p_campaignname" "text", "p_unitname" "text", "p_remark" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."calculate_lead_points_cost"("p_source" "public"."source", "p_leadtype" "text", "p_campaignname" "text" DEFAULT NULL::"text", "p_unitname" "text" DEFAULT NULL::"text", "p_remark" "text" DEFAULT NULL::"text") RETURNS "jsonb"
    LANGUAGE "plpgsql"
    AS $$
DECLARE
    cost_record RECORD;
    final_cost integer;
    cost_details jsonb := '{}';
    dynamic_adjustments jsonb := '{}';
    total_adjustment integer := 0;
BEGIN
    -- 查找匹配的成本规则（按优先级排序）
    SELECT * INTO cost_record
    FROM lead_points_cost
    WHERE is_active = true
      AND check_cost_conditions(conditions, p_source, p_leadtype, p_campaignname, p_unitname, p_remark)
    ORDER BY priority DESC, created_at ASC
    LIMIT 1;
    
    -- 如果没有找到规则，使用默认成本
    IF cost_record IS NULL THEN
        final_cost := 30; -- 默认30积分
        cost_details := jsonb_build_object(
            'rule_name', 'default',
            'base_cost', final_cost,
            'dynamic_adjustments', '{}',
            'total_adjustment', 0,
            'final_cost', final_cost
        );
    ELSE
        -- 计算动态调整
        dynamic_adjustments := calculate_dynamic_cost_adjustments(
            cost_record.dynamic_cost_config,
            p_source, p_leadtype, p_campaignname, p_unitname, p_remark
        );
        
        -- 计算总调整
        SELECT COALESCE(SUM(value::integer), 0) INTO total_adjustment
        FROM jsonb_each(dynamic_adjustments);
        
        -- 计算最终成本
        final_cost := cost_record.base_points_cost + total_adjustment;
        
        -- 确保成本为正数
        IF final_cost < 1 THEN
            final_cost := 1;
        END IF;
        
        cost_details := jsonb_build_object(
            'rule_name', cost_record.name,
            'rule_id', cost_record.id,
            'base_cost', cost_record.base_points_cost,
            'dynamic_adjustments', dynamic_adjustments,
            'total_adjustment', total_adjustment,
            'final_cost', final_cost
        );
    END IF;
    
    RETURN jsonb_build_object(
        'success', true,
        'points_cost', final_cost,
        'cost_details', cost_details
    );
    
EXCEPTION WHEN OTHERS THEN
    RETURN jsonb_build_object(
        'success', false,
        'error', SQLERRM,
        'points_cost', 30
    );
END;
$$;


ALTER FUNCTION "public"."calculate_lead_points_cost"("p_source" "public"."source", "p_leadtype" "text", "p_campaignname" "text", "p_unitname" "text", "p_remark" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."calculate_weighted_score"("scoring_data" "jsonb") RETURNS numeric
    LANGUAGE "plpgsql"
    AS $$
DECLARE
  total_weighted_score DECIMAL(10,2) := 0;
  total_weight DECIMAL(10,2) := 0;
  dimension_score DECIMAL(3,1);
  dimension_weight DECIMAL(3,2);
  dimension_code TEXT;
  dimension_data JSONB;
BEGIN
  -- 遍历所有维度的评分
  FOR dimension_data IN SELECT key, value FROM jsonb_each(scoring_data->'dimensions')
  LOOP
    dimension_code := dimension_data.key;
    dimension_score := (dimension_data.value->>'score')::DECIMAL(3,1);
    
    IF dimension_score IS NOT NULL THEN
      -- 从维度表中获取权重
      SELECT weight INTO dimension_weight 
      FROM live_stream_scoring_dimensions 
      WHERE dimension_code = dimension_code AND is_active = true;
      
      -- 如果找不到权重，使用默认权重1.0
      IF dimension_weight IS NULL THEN
        dimension_weight := 1.0;
      END IF;
      
      total_weighted_score := total_weighted_score + (dimension_score * dimension_weight);
      total_weight := total_weight + dimension_weight;
    END IF;
  END LOOP;
  
  -- 计算加权平均分
  IF total_weight > 0 THEN
    RETURN ROUND(total_weighted_score / total_weight, 1);
  ELSE
    RETURN 0.0;
  END IF;
END;
$$;


ALTER FUNCTION "public"."calculate_weighted_score"("scoring_data" "jsonb") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."calculate_weighted_score"("scoring_data" "jsonb") IS '计算加权评分函数（支持维度权重）';



CREATE OR REPLACE FUNCTION "public"."check_bi_permission"() RETURNS boolean
    LANGUAGE "plpgsql"
    AS $$
DECLARE
  v_user_id text;
  v_has_permission boolean;
BEGIN
  -- 获取当前用户ID
  SELECT auth.uid()::text INTO v_user_id;
  
  -- 检查用户是否存在
  IF v_user_id IS NULL THEN
    RETURN false;
  END IF;
  
  -- 检查用户是否有BI权限（这里可以根据实际需求调整）
  SELECT EXISTS(
    SELECT 1 FROM users_profile 
    WHERE id::text = v_user_id 
    AND (role = 'admin' OR role = 'manager' OR role = 'analyst')
  ) INTO v_has_permission;
  
  RETURN COALESCE(v_has_permission, false);
END;
$$;


ALTER FUNCTION "public"."check_bi_permission"() OWNER TO "postgres";


COMMENT ON FUNCTION "public"."check_bi_permission"() IS '检查用户是否有BI功能权限';



CREATE OR REPLACE FUNCTION "public"."check_cost_conditions"("conditions" "jsonb", "p_source" "public"."source", "p_leadtype" "text", "p_campaignname" "text" DEFAULT NULL::"text", "p_unitname" "text" DEFAULT NULL::"text", "p_remark" "text" DEFAULT NULL::"text") RETURNS boolean
    LANGUAGE "plpgsql"
    AS $$
DECLARE
    extracted_community text;
BEGIN
    -- 检查来源条件
    IF conditions ? 'sources' AND p_source IS NOT NULL THEN
        IF NOT (p_source::text = ANY(ARRAY(SELECT jsonb_array_elements_text(conditions->'sources')))) THEN
            RETURN false;
        END IF;
    END IF;
    
    -- 显式避免 leadtype 为 null 或空字符串时命中
    IF conditions ? 'lead_types' AND (p_leadtype IS NULL OR p_leadtype = '') THEN
        RETURN false;
    END IF;
    -- 检查线索类型条件
    IF conditions ? 'lead_types' AND p_leadtype IS NOT NULL THEN
        IF NOT (p_leadtype = ANY(ARRAY(SELECT jsonb_array_elements_text(conditions->'lead_types')))) THEN
            RETURN false;
        END IF;
    END IF;
    
    -- 检查关键词条件（包含从remark中提取的社区信息）
    IF conditions ? 'keywords' THEN
        DECLARE
            keyword text;
            found_keyword boolean := false;
        BEGIN
            -- 优先从remark中提取community信息
            IF p_remark IS NOT NULL AND p_remark ~ '\[COMMUNITY:([^\]]+)\]' THEN
                extracted_community := (regexp_match(p_remark, '\[COMMUNITY:([^\]]+)\]'))[1];
            END IF;
            
            FOR keyword IN SELECT jsonb_array_elements_text(conditions->'keywords')
            LOOP
                IF (p_campaignname ILIKE '%' || keyword || '%' OR
                    p_unitname ILIKE '%' || keyword || '%' OR
                    p_remark ILIKE '%' || keyword || '%' OR
                    (extracted_community IS NOT NULL AND extracted_community ILIKE '%' || keyword || '%')) THEN
                    found_keyword := true;
                    EXIT;
                END IF;
            END LOOP;
            
            IF NOT found_keyword THEN
                RETURN false;
            END IF;
        END;
    END IF;
    
    RETURN true;
END;
$$;


ALTER FUNCTION "public"."check_cost_conditions"("conditions" "jsonb", "p_source" "public"."source", "p_leadtype" "text", "p_campaignname" "text", "p_unitname" "text", "p_remark" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."check_operation_frequency"("p_user_id" bigint, "p_operation_type" character varying) RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
    v_config RECORD;
    v_current_count INTEGER;
    v_cd_level int := 0;
    v_cd_minutes int;
    v_cd_array int[] := ARRAY[5, 10, 30, 60, 1440]; -- 单位：分钟
    v_cooldown frequency_cooldown%ROWTYPE;
    v_new_cooldown_until timestamp with time zone;
BEGIN
    -- 获取配置
    SELECT * INTO v_config 
    FROM public.frequency_control_config 
    WHERE operation_type = p_operation_type AND is_active = true;
    IF NOT FOUND THEN
        RETURN jsonb_build_object('allowed', true);
    END IF;

    -- 1. 检查是否在CD期内
    SELECT * INTO v_cooldown FROM frequency_cooldown
      WHERE user_id = p_user_id AND operation_type = p_operation_type;

    IF FOUND AND v_cooldown.cooldown_until IS NOT NULL AND v_cooldown.cooldown_until > now() THEN
        RETURN jsonb_build_object(
            'allowed', false,
            'cooldown_until', v_cooldown.cooldown_until,
            'message', '操作过于频繁，请在' || v_cooldown.cooldown_until || '后再试'
        );
    END IF;

    -- 2. 正常统计操作次数
    SELECT COALESCE(SUM(operation_count), 0) INTO v_current_count
    FROM public.operation_frequency_control
    WHERE user_id = p_user_id 
      AND operation_type = p_operation_type
      AND created_at >= NOW() - INTERVAL '2 minutes';

    IF v_current_count >= v_config.max_operations THEN
        -- 超限，CD等级+1（如果CD期外），累计+1
        v_cd_level := COALESCE(v_cooldown.cooldown_level, 0) + 1;
        IF v_cd_level > array_length(v_cd_array, 1) THEN
            v_cd_level := array_length(v_cd_array, 1);
        END IF;
        v_cd_minutes := v_cd_array[v_cd_level];
        v_new_cooldown_until := now() + interval '1 minute' * v_cd_minutes;
        -- 更新CD表，累计+1
        INSERT INTO frequency_cooldown (user_id, operation_type, cooldown_level, last_blocked_at, cooldown_until, total_blocked_count)
          VALUES (p_user_id, p_operation_type, v_cd_level, now(), v_new_cooldown_until, 1)
          ON CONFLICT (user_id, operation_type)
          DO UPDATE SET 
            cooldown_level = v_cd_level, 
            last_blocked_at = now(), 
            cooldown_until = v_new_cooldown_until,
            total_blocked_count = frequency_cooldown.total_blocked_count + 1;
        RETURN jsonb_build_object(
            'allowed', false,
            'cooldown_until', v_new_cooldown_until,
            'message', '操作过于频繁，请在' || v_new_cooldown_until || '后再试'
        );
    ELSE
        -- 未超限，CD等级归零，累计不清零
        IF FOUND THEN
            UPDATE frequency_cooldown SET cooldown_level = 0, last_blocked_at = NULL, cooldown_until = NULL
            WHERE user_id = p_user_id AND operation_type = p_operation_type;
        END IF;
        RETURN jsonb_build_object('allowed', true);
    END IF;
END;
$$;


ALTER FUNCTION "public"."check_operation_frequency"("p_user_id" bigint, "p_operation_type" character varying) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."check_profile_consistency"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
DECLARE
    auth_user auth.users%ROWTYPE;
    user_name TEXT;
    user_status TEXT;
BEGIN
    -- 获取auth.users表中对应用户的数据
    SELECT * INTO auth_user FROM auth.users WHERE id = NEW.user_id;
    -- 如果找不到对应的auth用户，允许操作继续（可能是测试数据）
    IF auth_user IS NULL THEN
        RETURN NEW;
    END IF;
    -- 从用户元数据中提取名称
    user_name := COALESCE(auth_user.raw_user_meta_data->>'name', auth_user.raw_user_meta_data->>'full_name');
    -- 确定用户状态
    IF auth_user.banned_until IS NOT NULL AND auth_user.banned_until > NOW() THEN
        user_status := 'banned';
    ELSIF auth_user.deleted_at IS NOT NULL THEN
        user_status := 'deleted';
    ELSIF auth_user.email_confirmed_at IS NOT NULL OR auth_user.phone_confirmed_at IS NOT NULL THEN
        user_status := 'active';
    ELSE
        user_status := 'pending';
    END IF;
    -- 确保email一致
    IF NEW.email IS DISTINCT FROM auth_user.email THEN
        NEW.email := auth_user.email;
    END IF;
    -- 如果没有提供nickname，使用auth用户的名称
    IF NEW.nickname IS NULL AND user_name IS NOT NULL THEN
        NEW.nickname := user_name;
    END IF;
    -- 如果没有提供status，使用计算的状态
    IF NEW.status IS NULL THEN
        NEW.status := user_status;
    END IF;
    RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."check_profile_consistency"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."check_profile_sync_status"("user_email" "text" DEFAULT NULL::"text") RETURNS TABLE("auth_user_id" "uuid", "auth_email" "text", "auth_confirmed" boolean, "profile_user_id" "uuid", "profile_email" "text", "profile_status" "text", "profile_organization_id" "uuid", "profile_nickname" "text", "sync_status" "text")
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
BEGIN
    RETURN QUERY
    SELECT
        au.id as auth_user_id,
        au.email as auth_email,
        (au.email_confirmed_at IS NOT NULL) as auth_confirmed,
        up.user_id as profile_user_id,
        up.email as profile_email,
        up.status as profile_status,
        up.organization_id as profile_organization_id,
        up.nickname as profile_nickname,
        CASE 
            WHEN au.id IS NULL THEN 'auth_user_not_found'
            WHEN up.user_id IS NULL THEN 'profile_not_linked'
            WHEN au.id = up.user_id THEN 'synced'
            ELSE 'mismatch'
        END as sync_status
    FROM auth.users au
    FULL OUTER JOIN public.users_profile up ON au.email = up.email
    WHERE (user_email IS NULL OR au.email = user_email OR up.email = user_email)
    ORDER BY au.email;
END;
$$;


ALTER FUNCTION "public"."check_profile_sync_status"("user_email" "text") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."check_profile_sync_status"("user_email" "text") IS '检查用户profile同步状态';



CREATE OR REPLACE FUNCTION "public"."check_rule_conditions"("conditions" "jsonb", "p_source" "public"."source", "p_leadtype" "text", "p_community" "public"."community") RETURNS boolean
    LANGUAGE "plpgsql"
    AS $$
BEGIN
    -- 检查来源条件
    IF conditions ? 'sources' AND p_source IS NOT NULL THEN
        IF NOT (p_source::text = ANY(ARRAY(SELECT jsonb_array_elements_text(conditions->'sources')))) THEN
            RETURN false;
        END IF;
    END IF;
    
    -- 检查线索类型条件
    IF conditions ? 'lead_types' AND p_leadtype IS NOT NULL THEN
        IF NOT (p_leadtype = ANY(ARRAY(SELECT jsonb_array_elements_text(conditions->'lead_types')))) THEN
            RETURN false;
        END IF;
    END IF;
    
    -- 检查社区条件
    IF conditions ? 'communities' AND p_community IS NOT NULL THEN
        IF NOT (p_community::text = ANY(ARRAY(SELECT jsonb_array_elements_text(conditions->'communities')))) THEN
            RETURN false;
        END IF;
    END IF;
    
    -- 检查时间条件
    IF conditions ? 'time_ranges' THEN
        IF NOT check_time_condition(conditions->'time_ranges') THEN
            RETURN false;
        END IF;
    END IF;
    
    RETURN true;
END;
$$;


ALTER FUNCTION "public"."check_rule_conditions"("conditions" "jsonb", "p_source" "public"."source", "p_leadtype" "text", "p_community" "public"."community") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."check_showing_quality"("user_id" bigint, "community" "public"."community") RETURNS boolean
    LANGUAGE "plpgsql"
    AS $$
BEGIN
    -- TODO: 这里写具体的质量控制逻辑
    -- 例如：近30天满意度>=4，或无投诉等
    -- 目前先全部返回true，后续再完善
    RETURN true;
END;
$$;


ALTER FUNCTION "public"."check_showing_quality"("user_id" bigint, "community" "public"."community") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."check_showing_quality"("user_id" bigint, "community" "public"."community") IS '检查带看人员在指定社区是否满足质量要求';



CREATE OR REPLACE FUNCTION "public"."check_time_condition"("time_config" "jsonb") RETURNS boolean
    LANGUAGE "plpgsql"
    AS $$
      DECLARE
          current_time_val time;
          current_weekday integer;
          start_time time;
          end_time time;
          weekdays integer[];
      BEGIN
          -- 获取东八区当前时间
          current_time_val := (NOW() AT TIME ZONE 'Asia/Shanghai')::time;
          current_weekday := EXTRACT(DOW FROM (NOW() AT TIME ZONE 'Asia/Shanghai')::date);
          
          -- 检查工作日
          IF time_config ? 'weekdays' THEN
              weekdays := ARRAY(SELECT jsonb_array_elements_text(time_config->'weekdays'))::integer[];
              IF NOT (current_weekday = ANY(weekdays)) THEN
                  RETURN false;
              END IF;
          END IF;
          
          -- 检查时间范围
          IF time_config ? 'start' AND time_config ? 'end' THEN
              start_time := (time_config->>'start')::time;
              end_time := (time_config->>'end')::time;
              RETURN current_time_val BETWEEN start_time AND end_time;
          END IF;
          
          RETURN true;
      END;
      $$;


ALTER FUNCTION "public"."check_time_condition"("time_config" "jsonb") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."check_user_group_status"("p_user_id" bigint, "p_group_id" bigint, "p_source" "text" DEFAULT NULL::"text", "p_leadtype" "text" DEFAULT NULL::"text", "p_community" "text" DEFAULT NULL::"text") RETURNS "jsonb"
    LANGUAGE "plpgsql"
    AS $$
declare
  group_rec record;
  can_allocate boolean := false;
  reasons text[] := array[]::text[];
  filtered_users bigint[];
  daily_assigned integer;
  pending_count integer;
  conversion_rate numeric;
  total_leads integer;
  converted_leads integer;
begin
  select * into group_rec from users_list where id = p_group_id;

  -- 日线索量限制
  if group_rec.daily_lead_limit is not null then
    select count(*) into daily_assigned
    from simple_allocation_logs
    where assigned_user_id = p_user_id
      and created_at >= current_date;
    if daily_assigned >= group_rec.daily_lead_limit then
      reasons := reasons || format('今日已分配线索达到上限（%s/%s）', daily_assigned, group_rec.daily_lead_limit);
    end if;
  end if;

  -- 未接受线索数量
  if group_rec.max_pending_leads is not null then
    select count(*) into pending_count
    from followups
    where interviewsales_user_id = p_user_id
      and followupstage = '待接收';
    if pending_count > group_rec.max_pending_leads then
      reasons := reasons || format('待接收线索数超限（%s/%s）', pending_count, group_rec.max_pending_leads);
    end if;
  end if;

  -- 转化率
  if group_rec.conversion_rate_requirement is not null then
    select
      count(*) as total_leads,
      count(*) filter (where followupstage in ('赢单')) as converted_leads
    into total_leads, converted_leads
    from followups
    where interviewsales_user_id = p_user_id
      and created_at >= current_date - interval '30 days';

    if total_leads >= 50 then
      conversion_rate := round((converted_leads::numeric / total_leads::numeric) * 100, 2);
    else
      conversion_rate := group_rec.conversion_rate_requirement;
    end if;

    if conversion_rate < group_rec.conversion_rate_requirement then
      reasons := reasons || format('转化率低于要求（当前%.2f%%，要求%.2f%%）', coalesce(conversion_rate,0), group_rec.conversion_rate_requirement);
    end if;
  end if;

  -- apply_allocation_filters
  filtered_users := apply_allocation_filters(
    group_rec.list,
    group_rec.id,
    p_community::community,
    true,
    false,
    false
  );

  if filtered_users is not null and array_position(filtered_users, p_user_id) is not null then
    can_allocate := true;
  else
    can_allocate := false;

    -- 进一步细分过滤原因
    -- 社区匹配
    -- 权限检查（如有权限相关逻辑，可补充）

    -- 兜底
    if array_length(reasons,1) is null then
      reasons := array['不满足销售组分配要求'];
    end if;
  end if;

  return jsonb_build_object(
    'groupname', group_rec.groupname,
    'can_allocate', can_allocate,
    'reason', reasons
  );
end;
$$;


ALTER FUNCTION "public"."check_user_group_status"("p_user_id" bigint, "p_group_id" bigint, "p_source" "text", "p_leadtype" "text", "p_community" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."check_user_registration_status"("user_email" "text") RETURNS TABLE("auth_user_id" "uuid", "profile_user_id" "uuid", "email_confirmed" boolean, "profile_status" "text", "organization_id" "uuid", "nickname" "text")
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
BEGIN
  RETURN QUERY
  SELECT
    au.id as auth_user_id,
    up.user_id as profile_user_id,
    (au.email_confirmed_at IS NOT NULL) as email_confirmed,
    up.status as profile_status,
    up.organization_id,
    up.nickname
  FROM auth.users au
  FULL OUTER JOIN public.users_profile up ON au.email = up.email
  WHERE au.email = user_email OR up.email = user_email;
END;
$$;


ALTER FUNCTION "public"."check_user_registration_status"("user_email" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."check_users_profile_ids"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
DECLARE
    invalid_ids bigint[];
    user_id bigint;
BEGIN
    -- 如果 list 字段为空或NULL，直接返回
    IF NEW.list IS NULL OR array_length(NEW.list, 1) IS NULL THEN
        RETURN NEW;
    END IF;
    
    -- 检查 list 数组中的每个 ID 是否存在于 users_profile 表中
    SELECT array_agg(id) INTO invalid_ids
    FROM unnest(NEW.list) AS id
    WHERE NOT EXISTS (
        SELECT 1 FROM public.users_profile 
        WHERE users_profile.id = id
    );
    
    -- 如果有无效的用户 ID，抛出异常
    IF invalid_ids IS NOT NULL AND array_length(invalid_ids, 1) > 0 THEN
        RAISE EXCEPTION '无效的用户ID: %', array_to_string(invalid_ids, ', ');
    END IF;
    
    -- 更新 updated_at 时间戳
    NEW.updated_at := NOW();
    
    RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."check_users_profile_ids"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."cleanup_expired_frequency_data"() RETURNS integer
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
    v_deleted_count INTEGER;
    v_max_window_minutes INTEGER;
BEGIN
    -- 获取最大时间窗口
    SELECT COALESCE(MAX(time_window_minutes), 60) INTO v_max_window_minutes
    FROM public.frequency_control_config
    WHERE is_active = true;
    
    -- 删除过期的频率控制记录
    DELETE FROM public.operation_frequency_control
    WHERE window_end < NOW() - INTERVAL '1 minute' * v_max_window_minutes;
    
    GET DIAGNOSTICS v_deleted_count = ROW_COUNT;
    
    -- 删除30天前的操作日志（可选）
    DELETE FROM public.operation_logs
    WHERE created_at < NOW() - INTERVAL '30 days';
    
    RETURN v_deleted_count;
END;
$$;


ALTER FUNCTION "public"."cleanup_expired_frequency_data"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."cleanup_old_approval_data"("p_days_old" integer DEFAULT 365) RETURNS integer
    LANGUAGE "plpgsql"
    AS $$
DECLARE
  v_deleted_count INTEGER;
BEGIN
  -- 删除超过指定天数的已完成审批实例
  DELETE FROM approval_instances 
  WHERE status IN ('approved', 'rejected') 
    AND created_at < NOW() - INTERVAL '1 day' * p_days_old;
  
  GET DIAGNOSTICS v_deleted_count = ROW_COUNT;
  
  RETURN v_deleted_count;
END;
$$;


ALTER FUNCTION "public"."cleanup_old_approval_data"("p_days_old" integer) OWNER TO "postgres";


COMMENT ON FUNCTION "public"."cleanup_old_approval_data"("p_days_old" integer) IS '清理旧的审批数据';



CREATE OR REPLACE FUNCTION "public"."cleanup_old_logs"("p_days_to_keep" integer DEFAULT 90) RETURNS integer
    LANGUAGE "plpgsql"
    AS $$
DECLARE
  v_deleted_count integer;
BEGIN
  DELETE FROM live_stream_schedule_logs
  WHERE operation_time < now() - interval '1 day' * p_days_to_keep;
  
  GET DIAGNOSTICS v_deleted_count = ROW_COUNT;
  
  RETURN v_deleted_count;
END;
$$;


ALTER FUNCTION "public"."cleanup_old_logs"("p_days_to_keep" integer) OWNER TO "postgres";


COMMENT ON FUNCTION "public"."cleanup_old_logs"("p_days_to_keep" integer) IS '清理旧日志记录';



CREATE OR REPLACE FUNCTION "public"."create_announcement"("p_title" "text", "p_content" "text", "p_type" "text" DEFAULT 'info'::"text", "p_priority" integer DEFAULT 0, "p_target_roles" "text"[] DEFAULT NULL::"text"[], "p_target_organizations" "uuid"[] DEFAULT NULL::"uuid"[], "p_start_time" timestamp with time zone DEFAULT "now"(), "p_end_time" timestamp with time zone DEFAULT NULL::timestamp with time zone, "p_created_by" bigint DEFAULT NULL::bigint) RETURNS "uuid"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
  v_announcement_id uuid;
BEGIN
  INSERT INTO announcements (
    title, content, type, priority, target_roles, target_organizations,
    start_time, end_time, created_by
  ) VALUES (
    p_title, p_content, p_type, p_priority, p_target_roles, p_target_organizations,
    p_start_time, p_end_time, p_created_by
  ) RETURNING id INTO v_announcement_id;
  
  RETURN v_announcement_id;
END;
$$;


ALTER FUNCTION "public"."create_announcement"("p_title" "text", "p_content" "text", "p_type" "text", "p_priority" integer, "p_target_roles" "text"[], "p_target_organizations" "uuid"[], "p_start_time" timestamp with time zone, "p_end_time" timestamp with time zone, "p_created_by" bigint) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."create_lead_points_cost_rule"("p_name" "text", "p_description" "text" DEFAULT NULL::"text", "p_base_points_cost" integer DEFAULT 30, "p_conditions" "jsonb" DEFAULT '{}'::"jsonb", "p_dynamic_cost_config" "jsonb" DEFAULT '{}'::"jsonb", "p_priority" integer DEFAULT 0) RETURNS "uuid"
    LANGUAGE "plpgsql"
    AS $$
DECLARE
    rule_id uuid;
BEGIN
    INSERT INTO lead_points_cost (
        name, description, base_points_cost, conditions, 
        dynamic_cost_config, priority
    ) VALUES (
        p_name, p_description, p_base_points_cost, p_conditions,
        p_dynamic_cost_config, p_priority
    ) RETURNING id INTO rule_id;
    
    RETURN rule_id;
END;
$$;


ALTER FUNCTION "public"."create_lead_points_cost_rule"("p_name" "text", "p_description" "text", "p_base_points_cost" integer, "p_conditions" "jsonb", "p_dynamic_cost_config" "jsonb", "p_priority" integer) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."create_notification"("p_user_id" bigint, "p_type" "text", "p_title" "text", "p_content" "text", "p_metadata" "jsonb" DEFAULT NULL::"jsonb", "p_priority" integer DEFAULT 0) RETURNS "uuid"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
  v_notification_id uuid;
BEGIN
  INSERT INTO notifications (
    user_id, type, title, content, metadata, priority
  ) VALUES (
    p_user_id, p_type, p_title, p_content, p_metadata, p_priority
  ) RETURNING id INTO v_notification_id;
  
  RETURN v_notification_id;
END;
$$;


ALTER FUNCTION "public"."create_notification"("p_user_id" bigint, "p_type" "text", "p_title" "text", "p_content" "text", "p_metadata" "jsonb", "p_priority" integer) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."create_simple_allocation_rule"("p_name" "text", "p_description" "text" DEFAULT NULL::"text", "p_user_groups" bigint[] DEFAULT NULL::bigint[], "p_conditions" "jsonb" DEFAULT '{}'::"jsonb", "p_allocation_method" "public"."allocation_method" DEFAULT 'round_robin'::"public"."allocation_method", "p_enable_permission_check" boolean DEFAULT false, "p_priority" integer DEFAULT 0) RETURNS "uuid"
    LANGUAGE "plpgsql"
    AS $$
DECLARE
    rule_id uuid;
BEGIN
    INSERT INTO simple_allocation_rules (
        name, description, user_groups, conditions, allocation_method,
        enable_permission_check, priority
    ) VALUES (
        p_name, p_description, p_user_groups, p_conditions, p_allocation_method,
        p_enable_permission_check, p_priority
    ) RETURNING id INTO rule_id;
    
    RETURN rule_id;
END;
$$;


ALTER FUNCTION "public"."create_simple_allocation_rule"("p_name" "text", "p_description" "text", "p_user_groups" bigint[], "p_conditions" "jsonb", "p_allocation_method" "public"."allocation_method", "p_enable_permission_check" boolean, "p_priority" integer) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."create_user_profile"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
BEGIN
    -- 检查是否已存在该用户的profile
    IF NOT EXISTS (
        SELECT 1 FROM public.users_profile WHERE user_id = NEW.id
    ) THEN
        -- 创建新的profile记录，并同步email、名称和状态
        INSERT INTO public.users_profile (
            user_id, 
            email, 
            nickname,
            status
        )
        VALUES (
            NEW.id, 
            NEW.email,
            COALESCE(NEW.raw_user_meta_data->>'name', NEW.raw_user_meta_data->>'full_name'),
            CASE
                WHEN NEW.banned_until IS NOT NULL AND NEW.banned_until > NOW() THEN 'banned'
                WHEN NEW.deleted_at IS NOT NULL THEN 'deleted'
                WHEN NEW.email_confirmed_at IS NOT NULL OR NEW.phone_confirmed_at IS NOT NULL THEN 'active'
                ELSE 'pending'
            END
        );
    END IF;
    RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."create_user_profile"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."delete_pivot_config"("p_config_id" "uuid") RETURNS boolean
    LANGUAGE "plpgsql"
    AS $$
DECLARE
  v_user_id text;
  v_affected_rows integer;
BEGIN
  -- 获取当前用户ID
  SELECT auth.uid()::text INTO v_user_id;
  
  -- 删除配置（只能删除自己的配置）
  DELETE FROM bi_pivot_configs 
  WHERE id = p_config_id AND created_by = v_user_id;
  
  GET DIAGNOSTICS v_affected_rows = ROW_COUNT;
  
  RETURN v_affected_rows > 0;
END;
$$;


ALTER FUNCTION "public"."delete_pivot_config"("p_config_id" "uuid") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."delete_pivot_config"("p_config_id" "uuid") IS '删除透视表配置';



CREATE OR REPLACE FUNCTION "public"."exchange_goods_item"("p_user_id" bigint, "p_goods_id" "uuid", "p_description" "text" DEFAULT NULL::"text") RETURNS "jsonb"
    LANGUAGE "plpgsql"
    AS $$DECLARE
  goods_record RECORD;
  user_balance integer;
  daily_count integer;
  exchange_record_id bigint;
  result jsonb;
  reward_result jsonb;
  target_id_bigint bigint;
BEGIN
  -- 获取商品信息
  SELECT * INTO goods_record
  FROM exchange_goods
  WHERE id = p_goods_id AND is_active = true;
  
  IF goods_record IS NULL THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', '商品不存在或已下架'
    );
  END IF;
  
  -- 获取用户积分余额
  SELECT COALESCE(total_points, 0) INTO user_balance
  FROM user_points_wallet
  WHERE user_id = p_user_id;
  
  -- 检查积分是否足够
  IF user_balance < goods_record.points_cost THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', '积分不足',
      'required_points', goods_record.points_cost,
      'available_points', user_balance
    );
  END IF;
  
  -- 检查每日兑换限制
  IF goods_record.daily_limit IS NOT NULL THEN
    SELECT COALESCE(exchange_count, 0) INTO daily_count
    FROM user_exchange_limits
    WHERE user_id = p_user_id 
      AND goods_id = p_goods_id 
      AND exchange_date = CURRENT_DATE;
    
    IF daily_count >= goods_record.daily_limit THEN
      RETURN jsonb_build_object(
        'success', false,
        'error', '已达到每日兑换限制',
        'daily_limit', goods_record.daily_limit,
        'current_count', daily_count
      );
    END IF;
  END IF;
  
  -- 将uuid转换为bigint（使用hash值）
  target_id_bigint := ('x' || substr(p_goods_id::text, 1, 8))::bit(32)::bigint;
  
  -- 开始事务处理
  BEGIN
    
    -- 插入积分交易记录（如果表存在）
    BEGIN
      INSERT INTO user_points_transactions (
        user_id, points_change, balance_after,
        transaction_type, source_type, source_id, description
      ) VALUES (
        p_user_id, -goods_record.points_cost, user_balance - goods_record.points_cost,
        'DEDUCT', 'EXCHANGE_GOODS', p_goods_id::text,
        COALESCE(p_description, '兑换商品：' || goods_record.name)
      );
    EXCEPTION WHEN undefined_table THEN
      -- 如果user_points_transactions表不存在，跳过
      NULL;
    END;
    
    -- 插入兑换记录（使用转换后的bigint值）
    INSERT INTO points_exchange_records (
      user_id, exchange_type, target_id, points_used, description
    ) VALUES (
      p_user_id, goods_record.category, target_id_bigint, goods_record.points_cost,
      COALESCE(p_description, '兑换商品：' || goods_record.name)
    ) RETURNING id INTO exchange_record_id;
    
    -- 更新或插入每日兑换限制记录
    INSERT INTO user_exchange_limits (user_id, goods_id, exchange_date, exchange_count)
    VALUES (p_user_id, p_goods_id, CURRENT_DATE, 1)
    ON CONFLICT (user_id, goods_id, exchange_date)
    DO UPDATE SET 
      exchange_count = user_exchange_limits.exchange_count + 1,
      updated_at = now();
    
    -- 构建成功结果
    result := jsonb_build_object(
      'success', true,
      'exchange_record_id', exchange_record_id,
      'goods_name', goods_record.name,
      'points_used', goods_record.points_cost,
      'new_balance', user_balance - goods_record.points_cost,
      'description', COALESCE(p_description, '兑换商品：' || goods_record.name)
    );
    
    RETURN result;
    
  EXCEPTION WHEN OTHERS THEN
    -- 回滚事务
    RAISE EXCEPTION '兑换失败：%', SQLERRM;
  END;
END;$$;


ALTER FUNCTION "public"."exchange_goods_item"("p_user_id" bigint, "p_goods_id" "uuid", "p_description" "text") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."exchange_goods_item"("p_user_id" bigint, "p_goods_id" "uuid", "p_description" "text") IS '兑换商品函数，支持自动发放奖励（如带看直通卡等）';



CREATE OR REPLACE FUNCTION "public"."exchange_points"("p_user_id" bigint, "p_exchange_type" character varying, "p_target_id" bigint, "p_points_required" integer, "p_description" "text" DEFAULT NULL::"text") RETURNS "jsonb"
    LANGUAGE "plpgsql"
    AS $$
DECLARE
  v_current_balance INTEGER;
  v_new_balance INTEGER;
  v_result JSONB;
BEGIN
  -- 1. 检查用户积分余额
  SELECT total_points INTO v_current_balance
  FROM user_points_wallet
  WHERE user_id = p_user_id;
  
  IF v_current_balance IS NULL OR v_current_balance < p_points_required THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Insufficient points. Required: ' || p_points_required || ', Available: ' || COALESCE(v_current_balance, 0)
    );
  END IF;
  
  v_new_balance := v_current_balance - p_points_required;
  
  -- 2. 插入兑换记录
  INSERT INTO points_exchange_records (
    user_id, exchange_type, target_id, points_used
  ) VALUES (
    p_user_id, p_exchange_type, p_target_id, p_points_required
  );
  
  -- 3. 只插入积分流水记录，钱包余额由触发器维护
  INSERT INTO user_points_transactions (
    user_id, points_change, balance_after,
    transaction_type, source_type, source_id, description
  ) VALUES (
    p_user_id, -p_points_required, v_new_balance,
    'EXCHANGE', p_exchange_type, p_target_id::text,
    COALESCE(p_description, '积分兑换')
  );
  
  -- 4. 返回结果
  v_result := jsonb_build_object(
    'success', true,
    'points_used', p_points_required,
    'new_balance', v_new_balance,
    'exchange_id', currval('points_exchange_records_id_seq'),
    'description', COALESCE(p_description, '积分兑换')
  );
  
  RETURN v_result;
  
EXCEPTION
  WHEN OTHERS THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Failed to exchange points: ' || SQLERRM
    );
END;
$$;


ALTER FUNCTION "public"."exchange_points"("p_user_id" bigint, "p_exchange_type" character varying, "p_target_id" bigint, "p_points_required" integer, "p_description" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."execute_enhanced_pivot_analysis"("p_data_source" "text" DEFAULT 'joined_data'::"text", "p_row_fields" "text"[] DEFAULT NULL::"text"[], "p_column_fields" "text"[] DEFAULT NULL::"text"[], "p_value_fields" "jsonb" DEFAULT NULL::"jsonb", "p_filters" "jsonb" DEFAULT NULL::"jsonb", "p_show_totals" boolean DEFAULT true, "p_show_subtotals" boolean DEFAULT true) RETURNS "jsonb"
    LANGUAGE "plpgsql"
    AS $_$
DECLARE
  v_base_sql text;
  v_result_sql text;
  v_row_fields_sql text;
  v_column_fields_sql text;
  v_value_fields_sql text;
  v_filter_sql text;
  v_result jsonb;
  v_count integer;
  v_field text;
  v_aggregation text;
  v_alias text;
BEGIN
  -- 设置基础SQL
  CASE p_data_source
    WHEN 'joined_data' THEN
      v_base_sql := 'SELECT * FROM filter_all_analysis_multi()';
    ELSE
      v_base_sql := 'SELECT * FROM filter_all_analysis_multi()';
  END CASE;

  -- 构建行字段SQL（支持父子关系）
  v_row_fields_sql := '';
  IF p_row_fields IS NOT NULL AND array_length(p_row_fields, 1) > 0 THEN
    FOR i IN 1..array_length(p_row_fields, 1) LOOP
      v_field := p_row_fields[i];
      IF i > 1 THEN
        v_row_fields_sql := v_row_fields_sql || ', ';
      END IF;
      v_row_fields_sql := v_row_fields_sql || quote_ident(v_field);
    END LOOP;
  END IF;

  -- 构建列字段SQL（支持父子关系）
  v_column_fields_sql := '';
  IF p_column_fields IS NOT NULL AND array_length(p_column_fields, 1) > 0 THEN
    FOR i IN 1..array_length(p_column_fields, 1) LOOP
      v_field := p_column_fields[i];
      IF i > 1 THEN
        v_column_fields_sql := v_column_fields_sql || ', ';
      END IF;
      v_column_fields_sql := v_column_fields_sql || quote_ident(v_field);
    END LOOP;
  END IF;

  -- 构建值字段SQL
  v_value_fields_sql := '';
  IF p_value_fields IS NOT NULL THEN
    FOR i IN 0..jsonb_array_length(p_value_fields) - 1 LOOP
      v_field := p_value_fields->i->>'field';
      v_aggregation := p_value_fields->i->>'aggregation';
      v_alias := p_value_fields->i->>'alias';
      
      IF v_alias IS NULL THEN
        v_alias := v_field || '_' || v_aggregation;
      END IF;
      
      IF i > 0 THEN
        v_value_fields_sql := v_value_fields_sql || ', ';
      END IF;
      
      CASE v_aggregation
        WHEN 'count' THEN
          v_value_fields_sql := v_value_fields_sql || 'COUNT(' || quote_ident(v_field) || ') as ' || quote_ident(v_alias);
        WHEN 'sum' THEN
          v_value_fields_sql := v_value_fields_sql || 'SUM(' || quote_ident(v_field) || ') as ' || quote_ident(v_alias);
        WHEN 'avg' THEN
          v_value_fields_sql := v_value_fields_sql || 'AVG(' || quote_ident(v_field) || ') as ' || quote_ident(v_alias);
        WHEN 'min' THEN
          v_value_fields_sql := v_value_fields_sql || 'MIN(' || quote_ident(v_field) || ') as ' || quote_ident(v_alias);
        WHEN 'max' THEN
          v_value_fields_sql := v_value_fields_sql || 'MAX(' || quote_ident(v_field) || ') as ' || quote_ident(v_alias);
        ELSE
          v_value_fields_sql := v_value_fields_sql || 'COUNT(' || quote_ident(v_field) || ') as ' || quote_ident(v_alias);
      END CASE;
    END LOOP;
  END IF;

  -- 构建筛选条件SQL（支持多值处理）
  v_filter_sql := '';
  IF p_filters IS NOT NULL THEN
    FOR i IN 0..jsonb_array_length(p_filters) - 1 LOOP
      v_field := p_filters->i->>'field';
      v_aggregation := p_filters->i->>'operator';
      
      IF i > 0 THEN
        v_filter_sql := v_filter_sql || ' AND ';
      END IF;
      
      CASE v_aggregation
        WHEN 'equals' THEN
          v_filter_sql := v_filter_sql || quote_ident(v_field) || ' = ' || quote_literal(p_filters->i->>'value');
        WHEN 'in' THEN
          -- 多值处理：每个值单独显示
          v_filter_sql := v_filter_sql || quote_ident(v_field) || ' = ANY(' || quote_literal(p_filters->i->'value') || '::text[])';
        WHEN 'between' THEN
          v_filter_sql := v_filter_sql || quote_ident(v_field) || ' BETWEEN ' || 
                         quote_literal(p_filters->i->'value'->0) || ' AND ' || 
                         quote_literal(p_filters->i->'value'->1);
        WHEN 'like' THEN
          v_filter_sql := v_filter_sql || quote_ident(v_field) || ' LIKE ' || quote_literal('%' || p_filters->i->>'value' || '%');
        ELSE
          v_filter_sql := v_filter_sql || quote_ident(v_field) || ' = ' || quote_literal(p_filters->i->>'value');
      END CASE;
    END LOOP;
  END IF;

  -- 构建完整的SQL查询
  v_result_sql := 'SELECT ';
  
  -- 添加行字段
  IF v_row_fields_sql != '' THEN
    v_result_sql := v_result_sql || v_row_fields_sql;
  END IF;
  
  -- 添加列字段
  IF v_column_fields_sql != '' THEN
    IF v_row_fields_sql != '' THEN
      v_result_sql := v_result_sql || ', ';
    END IF;
    v_result_sql := v_result_sql || v_column_fields_sql;
  END IF;
  
  -- 添加值字段
  IF v_value_fields_sql != '' THEN
    IF v_row_fields_sql != '' OR v_column_fields_sql != '' THEN
      v_result_sql := v_result_sql || ', ';
    END IF;
    v_result_sql := v_result_sql || v_value_fields_sql;
  END IF;
  
  v_result_sql := v_result_sql || ' FROM (' || v_base_sql || ') t';
  
  -- 添加筛选条件
  IF v_filter_sql != '' THEN
    v_result_sql := v_result_sql || ' WHERE ' || v_filter_sql;
  END IF;
  
  -- 添加分组（支持父子关系）
  IF v_row_fields_sql != '' OR v_column_fields_sql != '' THEN
    v_result_sql := v_result_sql || ' GROUP BY ';
    
    IF v_row_fields_sql != '' AND v_column_fields_sql != '' THEN
      v_result_sql := v_result_sql || v_row_fields_sql || ', ' || v_column_fields_sql;
    ELSIF v_row_fields_sql != '' THEN
      v_result_sql := v_result_sql || v_row_fields_sql;
    ELSE
      v_result_sql := v_result_sql || v_column_fields_sql;
    END IF;
    
    -- 添加小计和总计（类似Excel透视表）
    IF p_show_subtotals THEN
      v_result_sql := v_result_sql || ' WITH ROLLUP';
    END IF;
  END IF;
  
  -- 添加排序
  IF v_row_fields_sql != '' OR v_column_fields_sql != '' THEN
    v_result_sql := v_result_sql || ' ORDER BY ';
    
    IF v_row_fields_sql != '' AND v_column_fields_sql != '' THEN
      v_result_sql := v_result_sql || v_row_fields_sql || ', ' || v_column_fields_sql;
    ELSIF v_row_fields_sql != '' THEN
      v_result_sql := v_result_sql || v_row_fields_sql;
    ELSE
      v_result_sql := v_result_sql || v_column_fields_sql;
    END IF;
  END IF;

  -- 执行查询
  BEGIN
    EXECUTE 'SELECT COUNT(*) FROM (' || v_result_sql || ') t' INTO v_count;
    
    IF v_count > 0 THEN
      EXECUTE 'SELECT jsonb_build_object(
        ''sql'', $1,
        ''result'', to_jsonb(array_agg(row_to_json(t))),
        ''total_rows'', $2,
        ''show_totals'', $3,
        ''show_subtotals'', $4
      ) FROM (' || v_result_sql || ') t' INTO v_result USING v_result_sql, v_count, p_show_totals, p_show_subtotals;
    ELSE
      v_result := jsonb_build_object(
        'sql', v_result_sql,
        'result', '[]'::jsonb,
        'total_rows', 0,
        'show_totals', p_show_totals,
        'show_subtotals', p_show_subtotals
      );
    END IF;
  EXCEPTION
    WHEN OTHERS THEN
      v_result := jsonb_build_object(
        'error', SQLERRM,
        'sql', v_result_sql,
        'result', '[]'::jsonb
      );
  END;

  RETURN v_result;
END;
$_$;


ALTER FUNCTION "public"."execute_enhanced_pivot_analysis"("p_data_source" "text", "p_row_fields" "text"[], "p_column_fields" "text"[], "p_value_fields" "jsonb", "p_filters" "jsonb", "p_show_totals" boolean, "p_show_subtotals" boolean) OWNER TO "postgres";


COMMENT ON FUNCTION "public"."execute_enhanced_pivot_analysis"("p_data_source" "text", "p_row_fields" "text"[], "p_column_fields" "text"[], "p_value_fields" "jsonb", "p_filters" "jsonb", "p_show_totals" boolean, "p_show_subtotals" boolean) IS '增强版透视表分析函数，支持多值处理和父子关系，类似Excel数据透视表';



CREATE OR REPLACE FUNCTION "public"."execute_multi_level_pivot_analysis"("p_data_source" "text" DEFAULT 'joined_data'::"text", "p_row_fields" "text"[] DEFAULT NULL::"text"[], "p_column_fields" "text"[] DEFAULT NULL::"text"[], "p_value_fields" "jsonb" DEFAULT NULL::"jsonb", "p_filters" "jsonb" DEFAULT NULL::"jsonb", "p_show_totals" boolean DEFAULT true) RETURNS "jsonb"
    LANGUAGE "plpgsql"
    AS $_$
DECLARE
  v_base_sql text;
  v_result_sql text;
  v_row_fields_sql text;
  v_column_fields_sql text;
  v_value_fields_sql text;
  v_filter_sql text;
  v_result jsonb;
  v_count integer;
  v_field text;
  v_aggregation text;
  v_alias text;
  v_header_structure jsonb;
  v_filter_value text;
  v_filter_values text[];
  v_dynamic_columns text := '';
  v_has_multi_value_filter boolean := false;
  v_filter_field text;
  v_filter_operator text;
BEGIN
  -- 设置基础SQL
  CASE p_data_source
    WHEN 'joined_data' THEN
      v_base_sql := 'SELECT * FROM filter_all_analysis_multi()';
    ELSE
      v_base_sql := 'SELECT * FROM filter_all_analysis_multi()';
  END CASE;

  -- 构建行字段SQL
  v_row_fields_sql := '';
  IF p_row_fields IS NOT NULL AND array_length(p_row_fields, 1) > 0 THEN
    FOR i IN 1..array_length(p_row_fields, 1) LOOP
      v_field := p_row_fields[i];
      IF i > 1 THEN
        v_row_fields_sql := v_row_fields_sql || ', ';
      END IF;
      v_row_fields_sql := v_row_fields_sql || quote_ident(v_field);
    END LOOP;
  END IF;

  -- 构建列字段SQL（支持多层级）
  v_column_fields_sql := '';
  IF p_column_fields IS NOT NULL AND array_length(p_column_fields, 1) > 0 THEN
    FOR i IN 1..array_length(p_column_fields, 1) LOOP
      v_field := p_column_fields[i];
      IF i > 1 THEN
        v_column_fields_sql := v_column_fields_sql || ', ';
      END IF;
      v_column_fields_sql := v_column_fields_sql || quote_ident(v_field);
    END LOOP;
  END IF;

  -- 构建值字段SQL（支持动态列生成）
  v_value_fields_sql := '';
  IF p_value_fields IS NOT NULL THEN
    FOR i IN 0..jsonb_array_length(p_value_fields) - 1 LOOP
      v_field := p_value_fields->i->>'field';
      v_aggregation := p_value_fields->i->>'aggregation';
      
      IF i > 0 THEN
        v_value_fields_sql := v_value_fields_sql || ', ';
      END IF;
      
      -- 检查值字段是否包含多值（逗号分隔）
      IF v_field LIKE '%,%' THEN
        -- 分割多个值，为每个值生成单独的聚合列
        v_filter_values := string_to_array(v_field, ',');
        FOR j IN 1..array_length(v_filter_values, 1) LOOP
          IF j > 1 THEN
            v_value_fields_sql := v_value_fields_sql || ', ';
          END IF;
          
          CASE v_aggregation
            WHEN 'sum' THEN
              v_alias := trim(v_filter_values[j]) || '_sum';
              v_value_fields_sql := v_value_fields_sql || 'SUM(CASE WHEN ' || quote_ident(v_field) || ' ILIKE ' || 
                                   quote_literal('%' || trim(v_filter_values[j]) || '%') || ' THEN 1 ELSE 0 END) as ' || quote_ident(v_alias);
            WHEN 'count' THEN
              v_alias := trim(v_filter_values[j]) || '_count';
              v_value_fields_sql := v_value_fields_sql || 'COUNT(CASE WHEN ' || quote_ident(v_field) || ' ILIKE ' || 
                                   quote_literal('%' || trim(v_filter_values[j]) || '%') || ' THEN 1 END) as ' || quote_ident(v_alias);
            WHEN 'count_distinct' THEN
              v_alias := trim(v_filter_values[j]) || '_count_distinct';
              v_value_fields_sql := v_value_fields_sql || 'COUNT(DISTINCT CASE WHEN ' || quote_ident(v_field) || ' ILIKE ' || 
                                   quote_literal('%' || trim(v_filter_values[j]) || '%') || ' THEN ' || quote_ident(v_field) || ' END) as ' || quote_ident(v_alias);
            WHEN 'avg' THEN
              v_alias := trim(v_filter_values[j]) || '_avg';
              v_value_fields_sql := v_value_fields_sql || 'AVG(CASE WHEN ' || quote_ident(v_field) || ' ILIKE ' || 
                                   quote_literal('%' || trim(v_filter_values[j]) || '%') || ' THEN 1 ELSE 0 END) as ' || quote_ident(v_alias);
            WHEN 'max' THEN
              v_alias := trim(v_filter_values[j]) || '_max';
              v_value_fields_sql := v_value_fields_sql || 'MAX(CASE WHEN ' || quote_ident(v_field) || ' ILIKE ' || 
                                   quote_literal('%' || trim(v_filter_values[j]) || '%') || ' THEN 1 ELSE 0 END) as ' || quote_ident(v_alias);
            WHEN 'min' THEN
              v_alias := trim(v_filter_values[j]) || '_min';
              v_value_fields_sql := v_value_fields_sql || 'MIN(CASE WHEN ' || quote_ident(v_field) || ' ILIKE ' || 
                                   quote_literal('%' || trim(v_filter_values[j]) || '%') || ' THEN 1 ELSE 0 END) as ' || quote_ident(v_alias);
            ELSE
              v_alias := trim(v_filter_values[j]) || '_count';
              v_value_fields_sql := v_value_fields_sql || 'COUNT(CASE WHEN ' || quote_ident(v_field) || ' ILIKE ' || 
                                   quote_literal('%' || trim(v_filter_values[j]) || '%') || ' THEN 1 END) as ' || quote_ident(v_alias);
          END CASE;
        END LOOP;
      ELSE
        -- 单个值字段，使用标准聚合
        CASE v_aggregation
          WHEN 'sum' THEN
            v_alias := v_field || '_sum';
            v_value_fields_sql := v_value_fields_sql || 'SUM(' || quote_ident(v_field) || ') as ' || quote_ident(v_alias);
          WHEN 'count' THEN
            v_alias := v_field || '_count';
            v_value_fields_sql := v_value_fields_sql || 'COUNT(' || quote_ident(v_field) || ') as ' || quote_ident(v_alias);
          WHEN 'count_distinct' THEN
            v_alias := v_field || '_count_distinct';
            v_value_fields_sql := v_value_fields_sql || 'COUNT(DISTINCT ' || quote_ident(v_field) || ') as ' || quote_ident(v_alias);
          WHEN 'avg' THEN
            v_alias := v_field || '_avg';
            v_value_fields_sql := v_value_fields_sql || 'AVG(' || quote_ident(v_field) || ') as ' || quote_ident(v_alias);
          WHEN 'max' THEN
            v_alias := v_field || '_max';
            v_value_fields_sql := v_value_fields_sql || 'MAX(' || quote_ident(v_field) || ') as ' || quote_ident(v_alias);
          WHEN 'min' THEN
            v_alias := v_field || '_min';
            v_value_fields_sql := v_value_fields_sql || 'MIN(' || quote_ident(v_field) || ') as ' || quote_ident(v_alias);
          ELSE
            v_alias := v_field || '_count';
            v_value_fields_sql := v_value_fields_sql || 'COUNT(' || quote_ident(v_field) || ') as ' || quote_ident(v_alias);
        END CASE;
      END IF;
    END LOOP;
  END IF;

  -- 构建筛选条件SQL（不生成动态列）
  v_filter_sql := '';
  IF p_filters IS NOT NULL THEN
    FOR i IN 0..jsonb_array_length(p_filters) - 1 LOOP
      v_field := p_filters->i->>'field';
      v_aggregation := p_filters->i->>'operator';
      v_filter_value := p_filters->i->>'value';
      
      IF i > 0 THEN
        v_filter_sql := v_filter_sql || ' AND ';
      END IF;
      
      CASE v_aggregation
        WHEN 'equals' THEN
          v_filter_sql := v_filter_sql || quote_ident(v_field) || ' = ' || quote_literal(v_filter_value);
        WHEN 'not_equals' THEN
          v_filter_sql := v_filter_sql || quote_ident(v_field) || ' != ' || quote_literal(v_filter_value);
        WHEN 'contains' THEN
          -- 支持多值筛选：检查是否包含逗号分隔的多个值
          IF v_filter_value LIKE '%,%' THEN
            -- 分割多个值
            v_filter_values := string_to_array(v_filter_value, ',');
            v_filter_sql := v_filter_sql || '(';
            FOR j IN 1..array_length(v_filter_values, 1) LOOP
              IF j > 1 THEN
                v_filter_sql := v_filter_sql || ' OR ';
              END IF;
              v_filter_sql := v_filter_sql || quote_ident(v_field) || ' ILIKE ' || 
                             quote_literal('%' || trim(v_filter_values[j]) || '%');
            END LOOP;
            v_filter_sql := v_filter_sql || ')';
          ELSE
            -- 单个值
            v_filter_sql := v_filter_sql || quote_ident(v_field) || ' ILIKE ' || 
                           quote_literal('%' || v_filter_value || '%');
          END IF;
        WHEN 'not_contains' THEN
          v_filter_sql := v_filter_sql || quote_ident(v_field) || ' NOT ILIKE ' || 
                         quote_literal('%' || v_filter_value || '%');
        WHEN 'greater_than' THEN
          v_filter_sql := v_filter_sql || quote_ident(v_field) || ' > ' || quote_literal(v_filter_value);
        WHEN 'less_than' THEN
          v_filter_sql := v_filter_sql || quote_ident(v_field) || ' < ' || quote_literal(v_filter_value);
        WHEN 'between' THEN
          v_filter_sql := v_filter_sql || quote_ident(v_field) || ' BETWEEN ' || 
                         quote_literal(p_filters->i->>'value') || ' AND ' || 
                         quote_literal(p_filters->i->>'value2');
        WHEN 'date_between' THEN
          v_filter_sql := v_filter_sql || quote_ident(v_field) || ' BETWEEN ' || 
                         quote_literal(p_filters->i->>'value') || ' AND ' || 
                         quote_literal(p_filters->i->>'value2');
        WHEN 'is_null' THEN
          v_filter_sql := v_filter_sql || quote_ident(v_field) || ' IS NULL';
        WHEN 'is_not_null' THEN
          v_filter_sql := v_filter_sql || quote_ident(v_field) || ' IS NOT NULL';
        ELSE
          v_filter_sql := v_filter_sql || quote_ident(v_field) || ' = ' || quote_literal(v_filter_value);
      END CASE;
    END LOOP;
  END IF;

  -- 构建完整的SQL查询
  v_result_sql := 'SELECT ';
  
  -- 添加行字段
  IF v_row_fields_sql != '' THEN
    v_result_sql := v_result_sql || v_row_fields_sql;
  END IF;
  
  -- 添加列字段
  IF v_column_fields_sql != '' THEN
    IF v_row_fields_sql != '' THEN
      v_result_sql := v_result_sql || ', ';
    END IF;
    v_result_sql := v_result_sql || v_column_fields_sql;
  END IF;
  
  -- 添加值字段
  IF v_value_fields_sql != '' THEN
    IF v_row_fields_sql != '' OR v_column_fields_sql != '' THEN
      v_result_sql := v_result_sql || ', ';
    END IF;
    v_result_sql := v_result_sql || v_value_fields_sql;
  END IF;
  
  v_result_sql := v_result_sql || ' FROM (' || v_base_sql || ') t';
  
  -- 添加筛选条件
  IF v_filter_sql != '' THEN
    v_result_sql := v_result_sql || ' WHERE ' || v_filter_sql;
  END IF;
  
  -- 添加分组
  IF v_row_fields_sql != '' OR v_column_fields_sql != '' THEN
    v_result_sql := v_result_sql || ' GROUP BY ';
    
    IF v_row_fields_sql != '' AND v_column_fields_sql != '' THEN
      v_result_sql := v_result_sql || v_row_fields_sql || ', ' || v_column_fields_sql;
    ELSIF v_row_fields_sql != '' THEN
      v_result_sql := v_result_sql || v_row_fields_sql;
    ELSE
      v_result_sql := v_result_sql || v_column_fields_sql;
    END IF;
  END IF;
  
  -- 添加排序
  IF v_row_fields_sql != '' OR v_column_fields_sql != '' THEN
    v_result_sql := v_result_sql || ' ORDER BY ';
    
    IF v_row_fields_sql != '' AND v_column_fields_sql != '' THEN
      v_result_sql := v_result_sql || v_row_fields_sql || ', ' || v_column_fields_sql;
    ELSIF v_row_fields_sql != '' THEN
      v_result_sql := v_result_sql || v_row_fields_sql;
    ELSE
      v_result_sql := v_result_sql || v_column_fields_sql;
    END IF;
  END IF;

  -- 构建表头结构信息
  v_header_structure := jsonb_build_object(
    'row_fields', p_row_fields,
    'column_fields', p_column_fields,
    'value_fields', p_value_fields,
    'has_multi_level_headers', CASE 
      WHEN p_column_fields IS NOT NULL AND array_length(p_column_fields, 1) > 1 THEN true
      ELSE false
    END
  );

  -- 执行查询
  BEGIN
    EXECUTE 'SELECT COUNT(*) FROM (' || v_result_sql || ') t' INTO v_count;
    
    IF v_count > 0 THEN
      EXECUTE 'SELECT jsonb_build_object(
        ''sql'', $1,
        ''result'', to_jsonb(array_agg(row_to_json(t))),
        ''total_rows'', $2,
        ''header_structure'', $3,
        ''show_totals'', $4
      ) FROM (' || v_result_sql || ') t' INTO v_result USING v_result_sql, v_count, v_header_structure, p_show_totals;
    ELSE
      v_result := jsonb_build_object(
        'sql', v_result_sql,
        'result', '[]'::jsonb,
        'total_rows', 0,
        'header_structure', v_header_structure,
        'show_totals', p_show_totals
      );
    END IF;
  EXCEPTION
    WHEN OTHERS THEN
      v_result := jsonb_build_object(
        'error', SQLERRM,
        'sql', v_result_sql,
        'result', '[]'::jsonb
      );
  END;

  RETURN v_result;
END;
$_$;


ALTER FUNCTION "public"."execute_multi_level_pivot_analysis"("p_data_source" "text", "p_row_fields" "text"[], "p_column_fields" "text"[], "p_value_fields" "jsonb", "p_filters" "jsonb", "p_show_totals" boolean) OWNER TO "postgres";


COMMENT ON FUNCTION "public"."execute_multi_level_pivot_analysis"("p_data_source" "text", "p_row_fields" "text"[], "p_column_fields" "text"[], "p_value_fields" "jsonb", "p_filters" "jsonb", "p_show_totals" boolean) IS '多行表头透视表分析函数，支持类似Excel的多行表头效果 - 修复动态列逻辑版本';



CREATE OR REPLACE FUNCTION "public"."filter_all_analysis"("p_leadid" "text" DEFAULT NULL::"text", "p_phone" "text" DEFAULT NULL::"text", "p_community" "text" DEFAULT NULL::"text", "p_contractdate_start" "date" DEFAULT NULL::"date", "p_contractdate_end" "date" DEFAULT NULL::"date", "p_limit" integer DEFAULT 1000, "p_offset" integer DEFAULT 0) RETURNS TABLE("followup_id" "uuid", "leadid" "text", "followupstage" "text", "customerprofile" "text", "worklocation" "text", "userbudget" "text", "moveintime" timestamp with time zone, "userrating" "text", "majorcategory" "text", "followupresult" "text", "scheduledcommunity" "text", "interviewsales_user_id" bigint, "interviewsales_user_name" "text", "followup_created_at" timestamp with time zone, "phone" "text", "wechat" "text", "qq" "text", "location" "text", "budget" "text", "remark" "text", "source" "text", "staffname" "text", "area" "text", "leadtype" "text", "leadstatus" "text", "lead_created_at" timestamp with time zone, "showing_id" "uuid", "showing_community" "text", "viewresult" "text", "arrivaltime" timestamp with time zone, "showingsales_user_name" "text", "trueshowingsales_nickname" "text", "showing_budget" "text", "showing_moveintime" timestamp with time zone, "showing_remark" "text", "renttime" "text", "showing_scheduletime" timestamp with time zone, "showing_created_at" timestamp with time zone, "deal_id" "uuid", "contractdate" "date", "deal_community" "text", "contractnumber" "text", "roomnumber" "text", "deal_created_at" timestamp with time zone)
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  RETURN QUERY
  SELECT
    -- Followups（主表）
    f.id as followup_id,
    f.leadid,
    f.followupstage::text,
    f.customerprofile::text,
    f.worklocation,
    f.userbudget,
    f.moveintime,
    f.userrating::text,
    f.majorcategory,
    f.followupresult,
    f.scheduledcommunity::text,
    f.interviewsales_user_id,
    up_interview.nickname as interviewsales_user_name,
    f.created_at as followup_created_at,
    -- Leads（通过 followups.leadid 关联）
    l.phone,
    l.wechat,
    l.qq,
    l.location,
    l.budget,
    l.remark,
    l.source::text,
    l.staffname,
    l.area,
    l.leadtype,
    l.leadstatus,
    l.created_at as lead_created_at,
    -- Showings（通过 followups.leadid 关联，只取最新一条）
    s.id as showing_id,
    s.community::text as showing_community,
    s.viewresult,
    s.arrivaltime,
    up_showing.nickname as showingsales_user_name,
    up_trueshowing.nickname as trueshowingsales_nickname,
    s.budget as showing_budget,
    s.moveintime as showing_moveintime,
    s.remark as showing_remark,
    s.renttime,
    s.scheduletime as showing_scheduletime,
    s.created_at as showing_created_at,
    -- Deals（通过 followups.leadid 关联，只取最新一条）
    d.id as deal_id,
    d.contractdate,
    d.community::text as deal_community,
    d.contractnumber,
    d.roomnumber,
    d.created_at as deal_created_at
  FROM followups f
  -- 关联 leads 表（通过 followups.leadid）
  LEFT JOIN leads l ON f.leadid = l.leadid
  -- 关联约访销售信息
  LEFT JOIN users_profile up_interview ON f.interviewsales_user_id = up_interview.id
  -- 关联 showings 表（只取最新一条）
  LEFT JOIN LATERAL (
    SELECT s.*
    FROM showings s
    WHERE s.leadid = f.leadid
    ORDER BY s.created_at DESC
    LIMIT 1
  ) s ON TRUE
  LEFT JOIN users_profile up_showing ON s.showingsales = up_showing.id
  LEFT JOIN users_profile up_trueshowing ON s.trueshowingsales = up_trueshowing.id
  -- 关联 deals 表（只取最新一条）
  LEFT JOIN LATERAL (
    SELECT d.*
    FROM deals d
    WHERE d.leadid = f.leadid
    ORDER BY d.created_at DESC
    LIMIT 1
  ) d ON TRUE
  WHERE
    (p_leadid IS NULL OR f.leadid = p_leadid)
    AND (p_phone IS NULL OR l.phone = p_phone)
    AND (p_community IS NULL OR s.community::text = p_community OR d.community::text = p_community)
    AND (p_contractdate_start IS NULL OR d.contractdate >= p_contractdate_start)
    AND (p_contractdate_end IS NULL OR d.contractdate <= p_contractdate_end)
  ORDER BY f.created_at DESC
  LIMIT p_limit OFFSET p_offset;
END;
$$;


ALTER FUNCTION "public"."filter_all_analysis"("p_leadid" "text", "p_phone" "text", "p_community" "text", "p_contractdate_start" "date", "p_contractdate_end" "date", "p_limit" integer, "p_offset" integer) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."filter_all_analysis_multi"("p_leadid" "text"[] DEFAULT NULL::"text"[], "p_phone" "text"[] DEFAULT NULL::"text"[], "p_wechat" "text"[] DEFAULT NULL::"text"[], "p_source" "text"[] DEFAULT NULL::"text"[], "p_leadtype" "text"[] DEFAULT NULL::"text"[], "p_leadstatus" "text"[] DEFAULT NULL::"text"[], "p_community" "text"[] DEFAULT NULL::"text"[], "p_viewresult" "text"[] DEFAULT NULL::"text"[], "p_showingsales" bigint[] DEFAULT NULL::bigint[], "p_trueshowingsales" bigint[] DEFAULT NULL::bigint[], "p_budget_min" integer DEFAULT NULL::integer, "p_budget_max" integer DEFAULT NULL::integer, "p_scheduletime_start" timestamp with time zone DEFAULT NULL::timestamp with time zone, "p_scheduletime_end" timestamp with time zone DEFAULT NULL::timestamp with time zone, "p_arrivaltime_start" timestamp with time zone DEFAULT NULL::timestamp with time zone, "p_arrivaltime_end" timestamp with time zone DEFAULT NULL::timestamp with time zone, "p_contractdate_start" "date" DEFAULT NULL::"date", "p_contractdate_end" "date" DEFAULT NULL::"date", "p_contractnumber" "text"[] DEFAULT NULL::"text"[], "p_roomnumber" "text"[] DEFAULT NULL::"text"[], "p_deal_community" "text"[] DEFAULT NULL::"text"[], "p_limit" integer DEFAULT 1000, "p_offset" integer DEFAULT 0) RETURNS TABLE("followup_id" "uuid", "leadid" "text", "followupstage" "text", "customerprofile" "text", "worklocation" "text", "userbudget" "text", "moveintime" "date", "userrating" "text", "majorcategory" "text", "followupresult" "text", "scheduledcommunity" "text", "interviewsales_user_id" bigint, "interviewsales_user_name" "text", "followup_created_at" "date", "phone" "text", "wechat" "text", "qq" "text", "location" "text", "budget" "text", "remark" "text", "source" "text", "staffname" "text", "area" "text", "leadtype" "text", "leadstatus" "text", "lead_created_at" "date", "showing_id" "uuid", "showing_community" "text", "viewresult" "text", "arrivaltime" "date", "showingsales_user_name" "text", "trueshowingsales_nickname" "text", "showing_budget" integer, "showing_moveintime" "date", "showing_remark" "text", "renttime" integer, "showing_scheduletime" "date", "showing_created_at" "date", "deal_id" "uuid", "contractdate" "date", "deal_community" "text", "contractnumber" "text", "roomnumber" "text", "deal_created_at" "date")
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  RETURN QUERY
  SELECT
    -- Followups（主表）
    f.id as followup_id,
    f.leadid,
    f.followupstage::text,
    f.customerprofile::text,
    f.worklocation,
    f.userbudget,
    (f.moveintime AT TIME ZONE 'Asia/Shanghai')::date as moveintime,
    f.userrating::text,
    f.majorcategory,
    f.followupresult,
    f.scheduledcommunity::text,
    f.interviewsales_user_id,
    up_interview.nickname as interviewsales_user_name,
    (f.created_at AT TIME ZONE 'Asia/Shanghai')::date as followup_created_at,
    -- Leads（通过 followups.leadid 关联）
    l.phone,
    l.wechat,
    l.qq,
    l.location,
    l.budget,
    l.remark,
    l.source::text,
    l.staffname,
    l.area,
    l.leadtype,
    l.leadstatus,
    (l.created_at AT TIME ZONE 'Asia/Shanghai')::date as lead_created_at,
    -- Showings（通过 followups.leadid 关联，只取最新一条）
    s.id as showing_id,
    s.community::text as showing_community,
    s.viewresult,
    (s.arrivaltime AT TIME ZONE 'Asia/Shanghai')::date as arrivaltime,
    up_showing.nickname as showingsales_user_name,
    up_trueshowing.nickname as trueshowingsales_nickname,
    s.budget as showing_budget,
    (s.moveintime AT TIME ZONE 'Asia/Shanghai')::date as showing_moveintime,
    s.remark as showing_remark,
    s.renttime,
    (s.scheduletime AT TIME ZONE 'Asia/Shanghai')::date as showing_scheduletime,
    (s.created_at AT TIME ZONE 'Asia/Shanghai')::date as showing_created_at,
    -- Deals（通过 followups.leadid 关联，只取最新一条）
    d.id as deal_id,
    d.contractdate,
    d.community::text as deal_community,
    d.contractnumber,
    d.roomnumber,
    (d.created_at AT TIME ZONE 'Asia/Shanghai')::date as deal_created_at
  FROM followups f
  -- 关联 leads 表（通过 followups.leadid）
  LEFT JOIN leads l ON f.leadid = l.leadid
  -- 关联约访销售信息
  LEFT JOIN users_profile up_interview ON f.interviewsales_user_id = up_interview.id
  -- 关联 showings 表（只取最新一条）
  LEFT JOIN LATERAL (
    SELECT s.*
    FROM showings s
    WHERE s.leadid = f.leadid
    ORDER BY s.created_at DESC
    LIMIT 1
  ) s ON TRUE
  LEFT JOIN users_profile up_showing ON s.showingsales = up_showing.id
  LEFT JOIN users_profile up_trueshowing ON s.trueshowingsales = up_trueshowing.id
  -- 关联 deals 表（只取最新一条）
  LEFT JOIN LATERAL (
    SELECT d.*
    FROM deals d
    WHERE d.leadid = f.leadid
    ORDER BY d.created_at DESC
    LIMIT 1
  ) d ON TRUE
  WHERE
    -- 多选支持：leadid数组匹配
    (p_leadid IS NULL OR f.leadid = ANY(p_leadid))
    -- 多选支持：phone数组匹配
    AND (p_phone IS NULL OR l.phone = ANY(p_phone))
    -- 多选支持：wechat数组匹配
    AND (p_wechat IS NULL OR l.wechat = ANY(p_wechat))
    -- 多选支持：source数组匹配
    AND (p_source IS NULL OR l.source::text = ANY(p_source))
    -- 多选支持：leadtype数组匹配
    AND (p_leadtype IS NULL OR l.leadtype = ANY(p_leadtype))
    -- 多选支持：leadstatus数组匹配
    AND (p_leadstatus IS NULL OR l.leadstatus = ANY(p_leadstatus))
    -- 多选支持：community数组匹配（同时匹配showings和deals的community）
    AND (p_community IS NULL OR 
         s.community::text = ANY(p_community) OR 
         d.community::text = ANY(p_community))
    -- 多选支持：viewresult数组匹配
    AND (p_viewresult IS NULL OR s.viewresult = ANY(p_viewresult))
    -- 多选支持：showingsales数组匹配
    AND (p_showingsales IS NULL OR s.showingsales = ANY(p_showingsales))
    -- 多选支持：trueshowingsales数组匹配
    AND (p_trueshowingsales IS NULL OR s.trueshowingsales = ANY(p_trueshowingsales))
    -- 预算范围筛选
    AND (p_budget_min IS NULL OR s.budget >= p_budget_min)
    AND (p_budget_max IS NULL OR s.budget <= p_budget_max)
    -- 预约时间范围筛选
    AND (p_scheduletime_start IS NULL OR s.scheduletime >= p_scheduletime_start)
    AND (p_scheduletime_end IS NULL OR s.scheduletime <= p_scheduletime_end)
    -- 到达时间范围筛选
    AND (p_arrivaltime_start IS NULL OR s.arrivaltime >= p_arrivaltime_start)
    AND (p_arrivaltime_end IS NULL OR s.arrivaltime <= p_arrivaltime_end)
    -- 成交日期范围保持不变
    AND (p_contractdate_start IS NULL OR d.contractdate >= p_contractdate_start)
    AND (p_contractdate_end IS NULL OR d.contractdate <= p_contractdate_end)
    -- 多选支持：contractnumber数组匹配
    AND (p_contractnumber IS NULL OR d.contractnumber = ANY(p_contractnumber))
    -- 多选支持：roomnumber数组匹配
    AND (p_roomnumber IS NULL OR d.roomnumber = ANY(p_roomnumber))
    -- 多选支持：deal_community数组匹配（专门针对deals的社区筛选）
    AND (p_deal_community IS NULL OR d.community::text = ANY(p_deal_community))
    -- 过滤无效记录：只返回有效记录（invalid IS NULL OR invalid = false）
    AND (f.invalid IS NULL OR f.invalid = false)
    AND (s.invalid IS NULL OR s.invalid = false)
    AND (d.invalid IS NULL OR d.invalid = false)
  ORDER BY f.created_at DESC
  LIMIT p_limit OFFSET p_offset;
END;
$$;


ALTER FUNCTION "public"."filter_all_analysis_multi"("p_leadid" "text"[], "p_phone" "text"[], "p_wechat" "text"[], "p_source" "text"[], "p_leadtype" "text"[], "p_leadstatus" "text"[], "p_community" "text"[], "p_viewresult" "text"[], "p_showingsales" bigint[], "p_trueshowingsales" bigint[], "p_budget_min" integer, "p_budget_max" integer, "p_scheduletime_start" timestamp with time zone, "p_scheduletime_end" timestamp with time zone, "p_arrivaltime_start" timestamp with time zone, "p_arrivaltime_end" timestamp with time zone, "p_contractdate_start" "date", "p_contractdate_end" "date", "p_contractnumber" "text"[], "p_roomnumber" "text"[], "p_deal_community" "text"[], "p_limit" integer, "p_offset" integer) OWNER TO "postgres";


COMMENT ON FUNCTION "public"."filter_all_analysis_multi"("p_leadid" "text"[], "p_phone" "text"[], "p_wechat" "text"[], "p_source" "text"[], "p_leadtype" "text"[], "p_leadstatus" "text"[], "p_community" "text"[], "p_viewresult" "text"[], "p_showingsales" bigint[], "p_trueshowingsales" bigint[], "p_budget_min" integer, "p_budget_max" integer, "p_scheduletime_start" timestamp with time zone, "p_scheduletime_end" timestamp with time zone, "p_arrivaltime_start" timestamp with time zone, "p_arrivaltime_end" timestamp with time zone, "p_contractdate_start" "date", "p_contractdate_end" "date", "p_contractnumber" "text"[], "p_roomnumber" "text"[], "p_deal_community" "text"[], "p_limit" integer, "p_offset" integer) IS '支持多选的四表联合分析函数，以followups为主表，支持透视表分析，自动过滤无效记录';



CREATE OR REPLACE FUNCTION "public"."filter_deals"("p_id" "uuid"[] DEFAULT NULL::"uuid"[], "p_leadid" "text"[] DEFAULT NULL::"text"[], "p_contractdate_start" "date" DEFAULT NULL::"date", "p_contractdate_end" "date" DEFAULT NULL::"date", "p_community" "public"."community"[] DEFAULT NULL::"public"."community"[], "p_contractnumber" "text"[] DEFAULT NULL::"text"[], "p_roomnumber" "text"[] DEFAULT NULL::"text"[], "p_created_at_start" timestamp with time zone DEFAULT NULL::timestamp with time zone, "p_created_at_end" timestamp with time zone DEFAULT NULL::timestamp with time zone, "p_source" "public"."source"[] DEFAULT NULL::"public"."source"[], "p_order_by" "text" DEFAULT 'created_at'::"text", "p_ascending" boolean DEFAULT false, "p_limit" integer DEFAULT 10, "p_offset" integer DEFAULT 0) RETURNS TABLE("id" "uuid", "leadid" "text", "contractdate" "date", "community" "public"."community", "contractnumber" "text", "roomnumber" "text", "created_at" timestamp with time zone, "invalid" boolean, "interviewsales" "text", "channel" "public"."source", "lead_phone" "text", "lead_wechat" "text")
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  RETURN QUERY
  SELECT
    d.id,
    d.leadid,
    d.contractdate,
    d.community,
    d.contractnumber,
    d.roomnumber,
    d.created_at,
    d.invalid,
    u.nickname as interviewsales,
    l.source as channel,
    l.phone as lead_phone,
    l.wechat as lead_wechat
  FROM deals d
  LEFT JOIN leads l ON d.leadid = l.leadid
  LEFT JOIN followups f ON d.leadid = f.leadid
  LEFT JOIN users_profile u ON f.interviewsales_user_id = u.id
  WHERE
    (p_id IS NULL OR d.id = ANY(p_id))
    AND (p_leadid IS NULL OR d.leadid = ANY(p_leadid))
    AND (p_contractdate_start IS NULL OR d.contractdate >= p_contractdate_start)
    AND (p_contractdate_end IS NULL OR d.contractdate <= p_contractdate_end)
    AND (p_community IS NULL OR d.community = ANY(p_community))
    AND (p_contractnumber IS NULL OR d.contractnumber = ANY(p_contractnumber))
    AND (p_roomnumber IS NULL OR d.roomnumber = ANY(p_roomnumber))
    AND (p_created_at_start IS NULL OR d.created_at >= p_created_at_start)
    AND (p_created_at_end IS NULL OR d.created_at <= p_created_at_end)
    AND (p_source IS NULL OR l.source = ANY(p_source))
    AND (d.invalid IS NULL OR d.invalid = false)
  ORDER BY 
    CASE WHEN p_ascending THEN 
      CASE p_order_by
        WHEN 'leadid' THEN d.leadid
        WHEN 'contractdate' THEN d.contractdate::TEXT
        WHEN 'community' THEN d.community::TEXT
        WHEN 'contractnumber' THEN d.contractnumber
        WHEN 'roomnumber' THEN d.roomnumber
        WHEN 'created_at' THEN d.created_at::TEXT
        WHEN 'lead_phone' THEN l.phone
        WHEN 'lead_wechat' THEN l.wechat
        WHEN 'interviewsales' THEN u.nickname
        WHEN 'channel' THEN l.source::TEXT
        ELSE d.created_at::TEXT
      END
    END ASC,
    CASE WHEN NOT p_ascending THEN 
      CASE p_order_by
        WHEN 'leadid' THEN d.leadid
        WHEN 'contractdate' THEN d.contractdate::TEXT
        WHEN 'community' THEN d.community::TEXT
        WHEN 'contractnumber' THEN d.contractnumber
        WHEN 'roomnumber' THEN d.roomnumber
        WHEN 'created_at' THEN d.created_at::TEXT
        WHEN 'lead_phone' THEN l.phone
        WHEN 'lead_wechat' THEN l.wechat
        WHEN 'interviewsales' THEN u.nickname
        WHEN 'channel' THEN l.source::TEXT
        ELSE d.created_at::TEXT
      END
    END DESC
  LIMIT p_limit OFFSET p_offset;
END;
$$;


ALTER FUNCTION "public"."filter_deals"("p_id" "uuid"[], "p_leadid" "text"[], "p_contractdate_start" "date", "p_contractdate_end" "date", "p_community" "public"."community"[], "p_contractnumber" "text"[], "p_roomnumber" "text"[], "p_created_at_start" timestamp with time zone, "p_created_at_end" timestamp with time zone, "p_source" "public"."source"[], "p_order_by" "text", "p_ascending" boolean, "p_limit" integer, "p_offset" integer) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."filter_followups"("p_created_at_end" timestamp with time zone DEFAULT NULL::timestamp with time zone, "p_created_at_start" timestamp with time zone DEFAULT NULL::timestamp with time zone, "p_customerprofile" "public"."customerprofile"[] DEFAULT NULL::"public"."customerprofile"[], "p_followupresult" "text"[] DEFAULT NULL::"text"[], "p_followupstage" "public"."followupstage"[] DEFAULT NULL::"public"."followupstage"[], "p_interviewsales_user_id" bigint[] DEFAULT NULL::bigint[], "p_leadid" "text"[] DEFAULT NULL::"text"[], "p_leadtype" "text"[] DEFAULT NULL::"text"[], "p_limit" integer DEFAULT NULL::integer, "p_majorcategory" "text"[] DEFAULT NULL::"text"[], "p_moveintime_end" timestamp with time zone DEFAULT NULL::timestamp with time zone, "p_moveintime_start" timestamp with time zone DEFAULT NULL::timestamp with time zone, "p_offset" integer DEFAULT 0, "p_remark" "text" DEFAULT NULL::"text", "p_scheduledcommunity" "public"."community"[] DEFAULT NULL::"public"."community"[], "p_showingsales_user" bigint[] DEFAULT NULL::bigint[], "p_source" "public"."source"[] DEFAULT NULL::"public"."source"[], "p_userbudget" "text"[] DEFAULT NULL::"text"[], "p_userbudget_min" numeric DEFAULT NULL::numeric, "p_userbudget_max" numeric DEFAULT NULL::numeric, "p_userrating" "public"."userrating"[] DEFAULT NULL::"public"."userrating"[], "p_wechat" "text"[] DEFAULT NULL::"text"[], "p_worklocation" "text"[] DEFAULT NULL::"text"[], "p_phone" "text"[] DEFAULT NULL::"text"[], "p_qq" "text"[] DEFAULT NULL::"text"[], "p_location" "text"[] DEFAULT NULL::"text"[], "p_budget" "text"[] DEFAULT NULL::"text"[], "p_douyinid" "text"[] DEFAULT NULL::"text"[], "p_douyin_accountname" "text"[] DEFAULT NULL::"text"[], "p_staffname" "text"[] DEFAULT NULL::"text"[], "p_redbookid" "text"[] DEFAULT NULL::"text"[], "p_area" "text"[] DEFAULT NULL::"text"[], "p_notelink" "text"[] DEFAULT NULL::"text"[], "p_campaignid" "text"[] DEFAULT NULL::"text"[], "p_campaignname" "text"[] DEFAULT NULL::"text"[], "p_unitid" "text"[] DEFAULT NULL::"text"[], "p_unitname" "text"[] DEFAULT NULL::"text"[], "p_creativedid" "text"[] DEFAULT NULL::"text"[], "p_creativename" "text"[] DEFAULT NULL::"text"[], "p_traffictype" "text"[] DEFAULT NULL::"text"[], "p_interactiontype" "text"[] DEFAULT NULL::"text"[], "p_douyinleadid" "text"[] DEFAULT NULL::"text"[], "p_leadstatus" "text"[] DEFAULT NULL::"text"[], "p_keyword" "text" DEFAULT NULL::"text") RETURNS TABLE("id" "uuid", "leadid" "text", "lead_uuid" "uuid", "leadtype" "text", "followupstage" "public"."followupstage", "followupstage_name" "text", "customerprofile" "public"."customerprofile", "customerprofile_name" "text", "worklocation" "text", "worklocation_id" "text", "userbudget" "text", "userbudget_id" "text", "moveintime" timestamp with time zone, "scheduletime" timestamp with time zone, "created_at" timestamp with time zone, "updated_at" timestamp with time zone, "userrating" "public"."userrating", "userrating_name" "text", "majorcategory" "text", "majorcategory_id" "text", "followupresult" "text", "followupresult_id" "text", "scheduledcommunity" "public"."community", "scheduledcommunity_name" "text", "phone" "text", "wechat" "text", "source" "public"."source", "source_name" "text", "remark" "text", "interviewsales_user_id" bigint, "interviewsales_user_name" "text", "showingsales_user_id" bigint, "showingsales_user_name" "text", "qq" "text", "location" "text", "budget" "text", "douyinid" "text", "douyin_accountname" "text", "staffname" "text", "redbookid" "text", "area" "text", "notelink" "text", "campaignid" "text", "campaignname" "text", "unitid" "text", "unitname" "text", "creativedid" "text", "creativename" "text", "traffictype" "text", "interactiontype" "text", "douyinleadid" "text", "leadstatus" "text", "invalid" boolean, "total_count" bigint)
    LANGUAGE "plpgsql"
    AS $_$DECLARE
    v_total_count bigint;
    v_query text;
    v_count_query text;
    v_where_clause text;
    v_join_clause text;
BEGIN
    -- 构建JOIN子句
    v_join_clause := '
    LEFT JOIN public.leads l ON f.leadid = l.leadid 
    LEFT JOIN public.users_profile up_interview ON f.interviewsales_user_id = up_interview.id
    LEFT JOIN (
        SELECT 
            s.leadid, 
            s.showingsales,
            up_showing.nickname as showingsales_name,
            s.scheduletime as showing_scheduletime,
            s.community as showing_community
        FROM public.showings s
        LEFT JOIN public.users_profile up_showing ON s.showingsales = up_showing.id
        WHERE s.id = (
            SELECT s2.id 
            FROM public.showings s2 
            WHERE s2.leadid = s.leadid 
            ORDER BY s2.created_at DESC 
            LIMIT 1
        )
    ) s ON f.leadid = s.leadid';
    
    -- 构建WHERE子句
    v_where_clause := '
    WHERE ($7 IS NULL OR f.leadid = ANY($7))
      AND ($8 IS NULL OR f.leadtype = ANY($8) OR (ARRAY_LENGTH($8, 1) = 1 AND $8[1] IS NULL AND f.leadtype IS NULL))
      AND ($5 IS NULL OR f.followupstage = ANY($5) OR (ARRAY_LENGTH($5, 1) = 1 AND $5[1] IS NULL AND f.followupstage IS NULL))
      AND ($3 IS NULL OR f.customerprofile = ANY($3) OR (ARRAY_LENGTH($3, 1) = 1 AND $3[1] IS NULL AND f.customerprofile IS NULL))
      AND ($23 IS NULL OR f.worklocation = ANY($23) OR (ARRAY_LENGTH($23, 1) = 1 AND $23[1] IS NULL AND f.worklocation IS NULL))
      AND ($18 IS NULL OR f.userbudget = ANY($18) OR (ARRAY_LENGTH($18, 1) = 1 AND $18[1] IS NULL AND f.userbudget IS NULL))
      AND ($19 IS NULL OR (CASE WHEN f.userbudget ~ ''^[0-9]+$'' THEN CAST(f.userbudget AS numeric) ELSE NULL END) >= $19)
      AND ($20 IS NULL OR (CASE WHEN f.userbudget ~ ''^[0-9]+$'' THEN CAST(f.userbudget AS numeric) ELSE NULL END) <= $20)
      AND ($12 IS NULL OR f.moveintime >= $12 OR f.moveintime IS NULL)
      AND ($11 IS NULL OR f.moveintime <= $11 OR f.moveintime IS NULL)
      AND ($21 IS NULL OR f.userrating = ANY($21) OR (ARRAY_LENGTH($21, 1) = 1 AND $21[1] IS NULL AND f.userrating IS NULL))
      AND ($10 IS NULL OR (
        CASE 
          WHEN f.majorcategory IN (''已预约'') THEN ''已预约''
          WHEN f.majorcategory IN (''房子未到期，提前了解'', ''多房源对比'', ''未到上海'', ''工作地点不确定'', ''价格原因'', ''位置原因'', ''户型原因'', ''短租'', ''其他'') THEN ''观望中''
          WHEN f.majorcategory IN (''房间太贵'', ''面积太小'', ''通勤太远'', ''房间无厨房'', ''到地铁站太远'', ''重客已签约'', ''其他'') THEN ''已流失''
          WHEN f.majorcategory IN (''电话空号'', ''微信号搜索不到'', ''好友申请不通过'', ''消息未回复'', ''电话不接'') THEN ''未触达''
          ELSE f.majorcategory
        END = ANY($10)
      ) OR (ARRAY_LENGTH($10, 1) = 1 AND $10[1] IS NULL AND f.majorcategory IS NULL))
      AND ($4 IS NULL OR f.followupresult = ANY($4) OR (ARRAY_LENGTH($4, 1) = 1 AND $4[1] IS NULL AND f.followupresult IS NULL))
      AND ($15 IS NULL OR f.scheduledcommunity = ANY($15) OR (ARRAY_LENGTH($15, 1) = 1 AND $15[1] IS NULL AND f.scheduledcommunity IS NULL))
      AND ($22 IS NULL OR l.wechat = ANY($22) OR (ARRAY_LENGTH($22, 1) = 1 AND $22[1] IS NULL AND l.wechat IS NULL))
      AND ($17 IS NULL OR l.source = ANY($17) OR (ARRAY_LENGTH($17, 1) = 1 AND $17[1] IS NULL AND l.source IS NULL))
      AND ($2 IS NULL OR f.created_at >= $2)
      AND ($1 IS NULL OR f.created_at <= $1)
      AND ($14 IS NULL OR l.remark ILIKE ''%'' || $14 || ''%'' OR ($14 = '''' AND (l.remark IS NULL OR l.remark = '''')))
      AND ($6 IS NULL OR f.interviewsales_user_id = ANY($6) OR (ARRAY_LENGTH($6, 1) = 1 AND $6[1] IS NULL AND f.interviewsales_user_id IS NULL))
      AND ($16 IS NULL OR s.showingsales = ANY($16) OR (ARRAY_LENGTH($16, 1) = 1 AND $16[1] IS NULL AND s.showingsales IS NULL))
      AND ($24 IS NULL OR l.phone = ANY($24) OR (ARRAY_LENGTH($24, 1) = 1 AND $24[1] IS NULL AND l.phone IS NULL))
      AND ($25 IS NULL OR l.qq = ANY($25) OR (ARRAY_LENGTH($25, 1) = 1 AND $25[1] IS NULL AND l.qq IS NULL))
      AND ($26 IS NULL OR l.location = ANY($26) OR (ARRAY_LENGTH($26, 1) = 1 AND $26[1] IS NULL AND l.location IS NULL))
      AND ($27 IS NULL OR l.budget = ANY($27) OR (ARRAY_LENGTH($27, 1) = 1 AND $27[1] IS NULL AND l.budget IS NULL))
      AND ($28 IS NULL OR l.douyinid = ANY($28) OR (ARRAY_LENGTH($28, 1) = 1 AND $28[1] IS NULL AND l.douyinid IS NULL))
      AND ($29 IS NULL OR l.douyin_accountname = ANY($29) OR (ARRAY_LENGTH($29, 1) = 1 AND $29[1] IS NULL AND l.douyin_accountname IS NULL))
      AND ($30 IS NULL OR l.staffname = ANY($30) OR (ARRAY_LENGTH($30, 1) = 1 AND $30[1] IS NULL AND l.staffname IS NULL))
      AND ($31 IS NULL OR l.redbookid = ANY($31) OR (ARRAY_LENGTH($31, 1) = 1 AND $31[1] IS NULL AND l.redbookid IS NULL))
      AND ($32 IS NULL OR l.area = ANY($32) OR (ARRAY_LENGTH($32, 1) = 1 AND $32[1] IS NULL AND l.area IS NULL))
      AND ($33 IS NULL OR l.notelink = ANY($33) OR (ARRAY_LENGTH($33, 1) = 1 AND $33[1] IS NULL AND l.notelink IS NULL))
      AND ($34 IS NULL OR l.campaignid = ANY($34) OR (ARRAY_LENGTH($34, 1) = 1 AND $34[1] IS NULL AND l.campaignid IS NULL))
      AND ($35 IS NULL OR l.campaignname = ANY($35) OR (ARRAY_LENGTH($35, 1) = 1 AND $35[1] IS NULL AND l.campaignname IS NULL))
      AND ($36 IS NULL OR l.unitid = ANY($36) OR (ARRAY_LENGTH($36, 1) = 1 AND $36[1] IS NULL AND l.unitid IS NULL))
      AND ($37 IS NULL OR l.unitname = ANY($37) OR (ARRAY_LENGTH($37, 1) = 1 AND $37[1] IS NULL AND l.unitname IS NULL))
      AND ($38 IS NULL OR l.creativedid = ANY($38) OR (ARRAY_LENGTH($38, 1) = 1 AND $38[1] IS NULL AND l.creativedid IS NULL))
      AND ($39 IS NULL OR l.creativename = ANY($39) OR (ARRAY_LENGTH($39, 1) = 1 AND $39[1] IS NULL AND l.creativename IS NULL))
      AND ($40 IS NULL OR l.traffictype = ANY($40) OR (ARRAY_LENGTH($40, 1) = 1 AND $40[1] IS NULL AND l.traffictype IS NULL))
      AND ($41 IS NULL OR l.interactiontype = ANY($41) OR (ARRAY_LENGTH($41, 1) = 1 AND $41[1] IS NULL AND l.interactiontype IS NULL))
      AND ($42 IS NULL OR l.douyinleadid = ANY($42) OR (ARRAY_LENGTH($42, 1) = 1 AND $42[1] IS NULL AND l.douyinleadid IS NULL))
      AND ($43 IS NULL OR l.leadstatus = ANY($43) OR (ARRAY_LENGTH($43, 1) = 1 AND $43[1] IS NULL AND l.leadstatus IS NULL))
      AND ($44 IS NULL OR (f.leadid::text ILIKE ''%'' || $44 || ''%'' OR 
                           f.leadtype ILIKE ''%'' || $44 || ''%'' OR 
                           up_interview.nickname ILIKE ''%'' || $44 || ''%'' OR 
                           s.showingsales_name ILIKE ''%'' || $44 || ''%'' OR
                           f.worklocation ILIKE ''%'' || $44 || ''%'' OR 
                           f.userbudget ILIKE ''%'' || $44 || ''%'' OR 
                           f.majorcategory ILIKE ''%'' || $44 || ''%'' OR 
                           f.followupresult ILIKE ''%'' || $44 || ''%'' OR
                           l.phone ILIKE ''%'' || $44 || ''%'' OR
                           l.wechat ILIKE ''%'' || $44 || ''%''))';
    
    -- Count total records
    v_count_query := 'SELECT COUNT(*) FROM public.followups f ' || v_join_clause || v_where_clause;
    EXECUTE v_count_query INTO v_total_count USING 
        p_created_at_end, p_created_at_start, p_customerprofile, p_followupresult, p_followupstage,
        p_interviewsales_user_id, p_leadid, p_leadtype, p_limit, p_majorcategory, p_moveintime_end,
        p_moveintime_start, p_offset, p_remark, p_scheduledcommunity, p_showingsales_user,
        p_source, p_userbudget, p_userbudget_min, p_userbudget_max, p_userrating, p_wechat, p_worklocation,
        p_phone, p_qq, p_location, p_budget, p_douyinid, p_douyin_accountname, p_staffname,
        p_redbookid, p_area, p_notelink, p_campaignid, p_campaignname, p_unitid, p_unitname,
        p_creativedid, p_creativename, p_traffictype, p_interactiontype, p_douyinleadid, p_leadstatus, p_keyword;
    
    -- Build main query
    v_query := 'SELECT
        f.id,
        f.leadid,
        l.id as lead_uuid,
        f.leadtype,
        f.followupstage,
        f.followupstage::text as followupstage_name,
        f.customerprofile,
        f.customerprofile::text as customerprofile_name,
        f.worklocation,
        f.worklocation as worklocation_id,
        f.userbudget,
        f.userbudget as userbudget_id,
        f.moveintime,
        f.scheduletime,
        f.created_at,
        f.updated_at,
        f.userrating,
        f.userrating::text as userrating_name,
        f.majorcategory,
        f.majorcategory as majorcategory_id,
        f.followupresult,
        f.followupresult as followupresult_id,
        f.scheduledcommunity,
        f.scheduledcommunity::text as scheduledcommunity_name,
        l.phone,
        l.wechat,
        l.source,
        l.source::text as source_name,
        l.remark,
        f.interviewsales_user_id,
        up_interview.nickname as interviewsales_user_name,
        s.showingsales as showingsales_user_id,
        s.showingsales_name as showingsales_user_name,
        l.qq,
        l.location,
        l.budget,
        l.douyinid,
        l.douyin_accountname,
        l.staffname,
        l.redbookid,
        l.area,
        l.notelink,
        l.campaignid,
        l.campaignname,
        l.unitid,
        l.unitname,
        l.creativedid,
        l.creativename,
        l.traffictype,
        l.interactiontype,
        l.douyinleadid,
        l.leadstatus,
        f.invalid,
        ' || v_total_count || '::bigint as total_count
    FROM public.followups f ' || v_join_clause || v_where_clause;
    
    -- Add pagination and sorting
    IF p_limit IS NOT NULL THEN
        v_query := v_query || ' ORDER BY f.created_at DESC LIMIT ' || p_limit;
    ELSE
        v_query := v_query || ' ORDER BY f.created_at DESC';
    END IF;
    v_query := v_query || ' OFFSET ' || p_offset;
    
    -- Execute query and return results
    RETURN QUERY EXECUTE v_query USING 
        p_created_at_end, p_created_at_start, p_customerprofile, p_followupresult, p_followupstage,
        p_interviewsales_user_id, p_leadid, p_leadtype, p_limit, p_majorcategory, p_moveintime_end,
        p_moveintime_start, p_offset, p_remark, p_scheduledcommunity, p_showingsales_user,
        p_source, p_userbudget, p_userbudget_min, p_userbudget_max, p_userrating, p_wechat, p_worklocation,
        p_phone, p_qq, p_location, p_budget, p_douyinid, p_douyin_accountname, p_staffname,
        p_redbookid, p_area, p_notelink, p_campaignid, p_campaignname, p_unitid, p_unitname,
        p_creativedid, p_creativename, p_traffictype, p_interactiontype, p_douyinleadid, p_leadstatus, p_keyword;
END;$_$;


ALTER FUNCTION "public"."filter_followups"("p_created_at_end" timestamp with time zone, "p_created_at_start" timestamp with time zone, "p_customerprofile" "public"."customerprofile"[], "p_followupresult" "text"[], "p_followupstage" "public"."followupstage"[], "p_interviewsales_user_id" bigint[], "p_leadid" "text"[], "p_leadtype" "text"[], "p_limit" integer, "p_majorcategory" "text"[], "p_moveintime_end" timestamp with time zone, "p_moveintime_start" timestamp with time zone, "p_offset" integer, "p_remark" "text", "p_scheduledcommunity" "public"."community"[], "p_showingsales_user" bigint[], "p_source" "public"."source"[], "p_userbudget" "text"[], "p_userbudget_min" numeric, "p_userbudget_max" numeric, "p_userrating" "public"."userrating"[], "p_wechat" "text"[], "p_worklocation" "text"[], "p_phone" "text"[], "p_qq" "text"[], "p_location" "text"[], "p_budget" "text"[], "p_douyinid" "text"[], "p_douyin_accountname" "text"[], "p_staffname" "text"[], "p_redbookid" "text"[], "p_area" "text"[], "p_notelink" "text"[], "p_campaignid" "text"[], "p_campaignname" "text"[], "p_unitid" "text"[], "p_unitname" "text"[], "p_creativedid" "text"[], "p_creativename" "text"[], "p_traffictype" "text"[], "p_interactiontype" "text"[], "p_douyinleadid" "text"[], "p_leadstatus" "text"[], "p_keyword" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."filter_leads"("p_leadid" "text" DEFAULT NULL::"text", "p_created_at_start" timestamp with time zone DEFAULT NULL::timestamp with time zone, "p_created_at_end" timestamp with time zone DEFAULT NULL::timestamp with time zone, "p_updata_at_start" timestamp with time zone DEFAULT NULL::timestamp with time zone, "p_updata_at_end" timestamp with time zone DEFAULT NULL::timestamp with time zone, "p_phone" "text" DEFAULT NULL::"text", "p_wechat" "text" DEFAULT NULL::"text", "p_qq" "text" DEFAULT NULL::"text", "p_location" "text" DEFAULT NULL::"text", "p_budget" "text" DEFAULT NULL::"text", "p_remark" "text" DEFAULT NULL::"text", "p_source" "public"."source" DEFAULT NULL::"public"."source", "p_douyinid" "text" DEFAULT NULL::"text", "p_douyin_accountname" "text" DEFAULT NULL::"text", "p_staffname" "text" DEFAULT NULL::"text", "p_redbookid" "text" DEFAULT NULL::"text", "p_area" "text" DEFAULT NULL::"text", "p_notelink" "text" DEFAULT NULL::"text", "p_campaignid" "text" DEFAULT NULL::"text", "p_campaignname" "text" DEFAULT NULL::"text", "p_unitid" "text" DEFAULT NULL::"text", "p_unitname" "text" DEFAULT NULL::"text", "p_creativedid" "text" DEFAULT NULL::"text", "p_creativename" "text" DEFAULT NULL::"text", "p_leadtype" "text" DEFAULT NULL::"text", "p_traffictype" "text" DEFAULT NULL::"text", "p_interactiontype" "text" DEFAULT NULL::"text", "p_douyinleadid" "text" DEFAULT NULL::"text", "p_leadstatus" "text" DEFAULT NULL::"text", "p_keyword" "text" DEFAULT NULL::"text") RETURNS TABLE("id" "uuid", "leadid" "text", "created_at" timestamp with time zone, "updata_at" timestamp with time zone, "phone" "text", "wechat" "text", "qq" "text", "location" "text", "budget" "text", "remark" "text", "source" "public"."source", "douyinid" "text", "douyin_accountname" "text", "staffname" "text", "redbookid" "text", "area" "text", "notelink" "text", "campaignid" "text", "campaignname" "text", "unitid" "text", "unitname" "text", "creativedid" "text", "creativename" "text", "leadtype" "text", "traffictype" "text", "interactiontype" "text", "douyinleadid" "text", "leadstatus" "text", "interviewsales" "text")
    LANGUAGE "plpgsql"
    AS $$
BEGIN
    RETURN QUERY
    SELECT
        l.id,
        l.leadid,
        l.created_at,
        l.updata_at,
        l.phone,
        l.wechat,
        l.qq,
        l.location,
        l.budget,
        l.remark,
        l.source,
        l.douyinid,
        l.douyin_accountname,
        l.staffname,
        l.redbookid,
        l.area,
        l.notelink,
        l.campaignid,
        l.campaignname,
        l.unitid,
        l.unitname,
        l.creativedid,
        l.creativename,
        l.leadtype,
        l.traffictype,
        l.interactiontype,
        l.douyinleadid,
        l.leadstatus,
        up.nickname as interviewsales
    FROM public.leads l
    LEFT JOIN public.followups f ON l.leadid = f.leadid
    LEFT JOIN public.users_profile up ON f.interviewsales_user_id = up.id
    WHERE (p_leadid IS NULL OR l.leadid = p_leadid)
      AND (p_created_at_start IS NULL OR l.created_at >= p_created_at_start)
      AND (p_created_at_end IS NULL OR l.created_at <= p_created_at_end)
      AND (p_updata_at_start IS NULL OR l.updata_at >= p_updata_at_start)
      AND (p_updata_at_end IS NULL OR l.updata_at <= p_updata_at_end)
      AND (p_phone IS NULL OR l.phone = p_phone)
      AND (p_wechat IS NULL OR l.wechat = p_wechat)
      AND (p_qq IS NULL OR l.qq = p_qq)
      AND (p_location IS NULL OR l.location = p_location)
      AND (p_budget IS NULL OR l.budget = p_budget)
      AND (p_remark IS NULL OR l.remark = p_remark)
      AND (p_source IS NULL OR l.source = p_source)
      AND (p_douyinid IS NULL OR l.douyinid = p_douyinid)
      AND (p_douyin_accountname IS NULL OR l.douyin_accountname = p_douyin_accountname)
      AND (p_staffname IS NULL OR l.staffname = p_staffname)
      AND (p_redbookid IS NULL OR l.redbookid = p_redbookid)
      AND (p_area IS NULL OR l.area = p_area)
      AND (p_notelink IS NULL OR l.notelink = p_notelink)
      AND (p_campaignid IS NULL OR l.campaignid = p_campaignid)
      AND (p_campaignname IS NULL OR l.campaignname = p_campaignname)
      AND (p_unitid IS NULL OR l.unitid = p_unitid)
      AND (p_unitname IS NULL OR l.unitname = p_unitname)
      AND (p_creativedid IS NULL OR l.creativedid = p_creativedid)
      AND (p_creativename IS NULL OR l.creativename = p_creativename)
      AND (p_leadtype IS NULL OR l.leadtype = p_leadtype)
      AND (p_traffictype IS NULL OR l.traffictype = p_traffictype)
      AND (p_interactiontype IS NULL OR l.interactiontype = p_interactiontype)
      AND (p_douyinleadid IS NULL OR l.douyinleadid = p_douyinleadid)
      AND (p_leadstatus IS NULL OR l.leadstatus = p_leadstatus)
      AND (p_keyword IS NULL OR trim(p_keyword) = '' OR
           l.leadid ILIKE '%' || p_keyword || '%' OR
           l.phone ILIKE '%' || p_keyword || '%' OR
           l.wechat ILIKE '%' || p_keyword || '%')
    ORDER BY l.created_at DESC;  -- 按创建时间从近到远排序
END;
$$;


ALTER FUNCTION "public"."filter_leads"("p_leadid" "text", "p_created_at_start" timestamp with time zone, "p_created_at_end" timestamp with time zone, "p_updata_at_start" timestamp with time zone, "p_updata_at_end" timestamp with time zone, "p_phone" "text", "p_wechat" "text", "p_qq" "text", "p_location" "text", "p_budget" "text", "p_remark" "text", "p_source" "public"."source", "p_douyinid" "text", "p_douyin_accountname" "text", "p_staffname" "text", "p_redbookid" "text", "p_area" "text", "p_notelink" "text", "p_campaignid" "text", "p_campaignname" "text", "p_unitid" "text", "p_unitname" "text", "p_creativedid" "text", "p_creativename" "text", "p_leadtype" "text", "p_traffictype" "text", "p_interactiontype" "text", "p_douyinleadid" "text", "p_leadstatus" "text", "p_keyword" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."filter_showings"("p_leadid" "text" DEFAULT NULL::"text", "p_community" "text"[] DEFAULT NULL::"text"[], "p_showingsales" bigint[] DEFAULT NULL::bigint[], "p_trueshowingsales" bigint[] DEFAULT NULL::bigint[], "p_interviewsales" bigint[] DEFAULT NULL::bigint[], "p_viewresult" "text"[] DEFAULT NULL::"text"[], "p_budget_min" integer DEFAULT NULL::integer, "p_budget_max" integer DEFAULT NULL::integer, "p_renttime_min" integer DEFAULT NULL::integer, "p_renttime_max" integer DEFAULT NULL::integer, "p_scheduletime_start" timestamp with time zone DEFAULT NULL::timestamp with time zone, "p_scheduletime_end" timestamp with time zone DEFAULT NULL::timestamp with time zone, "p_arrivaltime_start" timestamp with time zone DEFAULT NULL::timestamp with time zone, "p_arrivaltime_end" timestamp with time zone DEFAULT NULL::timestamp with time zone, "p_moveintime_start" timestamp with time zone DEFAULT NULL::timestamp with time zone, "p_moveintime_end" timestamp with time zone DEFAULT NULL::timestamp with time zone, "p_created_at_start" timestamp with time zone DEFAULT NULL::timestamp with time zone, "p_created_at_end" timestamp with time zone DEFAULT NULL::timestamp with time zone, "p_order_by" "text" DEFAULT 'created_at'::"text", "p_ascending" boolean DEFAULT false, "p_limit" integer DEFAULT 10, "p_offset" integer DEFAULT 0, "p_incomplete" boolean DEFAULT false) RETURNS TABLE("id" "uuid", "leadid" "text", "scheduletime" timestamp with time zone, "community" "text", "arrivaltime" timestamp with time zone, "showingsales" bigint, "trueshowingsales" bigint, "viewresult" "text", "budget" integer, "moveintime" timestamp with time zone, "remark" "text", "renttime" integer, "created_at" timestamp with time zone, "updated_at" timestamp with time zone, "invalid" boolean, "showingsales_nickname" "text", "trueshowingsales_nickname" "text", "interviewsales_nickname" "text", "interviewsales_user_id" bigint, "lead_phone" "text", "lead_wechat" "text", "lead_source" "text", "lead_status" "text", "lead_type" "text")
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  RETURN QUERY
  SELECT 
    s.id,
    s.leadid,
    s.scheduletime,
    s.community::TEXT,
    s.arrivaltime,
    s.showingsales,
    s.trueshowingsales,
    s.viewresult,
    s.budget,
    s.moveintime,
    s.remark,
    s.renttime,
    s.created_at,
    s.updated_at,
    COALESCE(s.invalid, false) as invalid,
    COALESCE(sp.nickname::TEXT, '') as showingsales_nickname,
    COALESCE(tsp.nickname::TEXT, '') as trueshowingsales_nickname,
    COALESCE(isp.nickname::TEXT, '') as interviewsales_nickname,
    f.interviewsales_user_id as interviewsales_user_id,
    COALESCE(l.phone::TEXT, '') as lead_phone,
    COALESCE(l.wechat::TEXT, '') as lead_wechat,
    COALESCE(l.source::TEXT, '') as lead_source,
    COALESCE(l.leadstatus::TEXT, '') as lead_status,
    COALESCE(l.leadtype::TEXT, '') as lead_type
  FROM showings s
  LEFT JOIN users_profile sp ON s.showingsales = sp.id
  LEFT JOIN users_profile tsp ON s.trueshowingsales = tsp.id
  LEFT JOIN followups f ON s.leadid = f.leadid
  LEFT JOIN users_profile isp ON f.interviewsales_user_id = isp.id
  LEFT JOIN leads l ON s.leadid = l.leadid
  WHERE 
    (p_leadid IS NULL OR s.leadid = p_leadid)
    AND (p_community IS NULL OR s.community::TEXT = ANY(p_community))
    AND (p_showingsales IS NULL OR s.showingsales = ANY(p_showingsales))
    AND (p_trueshowingsales IS NULL OR s.trueshowingsales = ANY(p_trueshowingsales))
    AND (p_interviewsales IS NULL OR f.interviewsales_user_id = ANY(p_interviewsales))
    AND (p_viewresult IS NULL OR s.viewresult = ANY(p_viewresult))
    AND (p_budget_min IS NULL OR s.budget >= p_budget_min)
    AND (p_budget_max IS NULL OR s.budget <= p_budget_max)
    AND (p_renttime_min IS NULL OR s.renttime >= p_renttime_min)
    AND (p_renttime_max IS NULL OR s.renttime <= p_renttime_max)
    AND (p_scheduletime_start IS NULL OR s.scheduletime >= p_scheduletime_start)
    AND (p_scheduletime_end IS NULL OR s.scheduletime <= p_scheduletime_end)
    AND (p_arrivaltime_start IS NULL OR s.arrivaltime >= p_arrivaltime_start)
    AND (p_arrivaltime_end IS NULL OR s.arrivaltime <= p_arrivaltime_end)
    AND (p_moveintime_start IS NULL OR s.moveintime >= p_moveintime_start)
    AND (p_moveintime_end IS NULL OR s.moveintime <= p_moveintime_end)
    AND (p_created_at_start IS NULL OR s.created_at >= p_created_at_start)
    AND (p_created_at_end IS NULL OR s.created_at <= p_created_at_end)
    AND (s.invalid IS NULL OR s.invalid = false) -- 过滤掉无效记录
    AND (
      NOT p_incomplete OR 
      (s.viewresult IS NULL OR s.viewresult = '')
    )
  ORDER BY 
    CASE WHEN p_ascending THEN 
      CASE p_order_by
        WHEN 'leadid' THEN s.leadid
        WHEN 'community' THEN s.community::TEXT
        WHEN 'scheduletime' THEN s.scheduletime::TEXT
        WHEN 'arrivaltime' THEN s.arrivaltime::TEXT
        WHEN 'viewresult' THEN s.viewresult
        WHEN 'budget' THEN s.budget::TEXT
        WHEN 'moveintime' THEN s.moveintime::TEXT
        WHEN 'renttime' THEN s.renttime::TEXT
        WHEN 'created_at' THEN s.created_at::TEXT
        WHEN 'updated_at' THEN s.updated_at::TEXT
        ELSE s.created_at::TEXT
      END
    END ASC,
    CASE WHEN NOT p_ascending THEN 
      CASE p_order_by
        WHEN 'leadid' THEN s.leadid
        WHEN 'community' THEN s.community::TEXT
        WHEN 'scheduletime' THEN s.scheduletime::TEXT
        WHEN 'arrivaltime' THEN s.arrivaltime::TEXT
        WHEN 'viewresult' THEN s.viewresult
        WHEN 'budget' THEN s.budget::TEXT
        WHEN 'moveintime' THEN s.moveintime::TEXT
        WHEN 'renttime' THEN s.renttime::TEXT
        WHEN 'created_at' THEN s.created_at::TEXT
        WHEN 'updated_at' THEN s.updated_at::TEXT
        ELSE s.created_at::TEXT
      END
    END DESC
  LIMIT p_limit OFFSET p_offset;
END;
$$;


ALTER FUNCTION "public"."filter_showings"("p_leadid" "text", "p_community" "text"[], "p_showingsales" bigint[], "p_trueshowingsales" bigint[], "p_interviewsales" bigint[], "p_viewresult" "text"[], "p_budget_min" integer, "p_budget_max" integer, "p_renttime_min" integer, "p_renttime_max" integer, "p_scheduletime_start" timestamp with time zone, "p_scheduletime_end" timestamp with time zone, "p_arrivaltime_start" timestamp with time zone, "p_arrivaltime_end" timestamp with time zone, "p_moveintime_start" timestamp with time zone, "p_moveintime_end" timestamp with time zone, "p_created_at_start" timestamp with time zone, "p_created_at_end" timestamp with time zone, "p_order_by" "text", "p_ascending" boolean, "p_limit" integer, "p_offset" integer, "p_incomplete" boolean) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."filter_users_by_permission"("user_ids" bigint[]) RETURNS bigint[]
    LANGUAGE "plpgsql"
    AS $$
DECLARE
    filtered_users bigint[] := ARRAY[]::bigint[];
    user_id bigint;
BEGIN
    -- 如果没有启用权限检查，返回所有用户
    IF user_ids IS NULL OR array_length(user_ids, 1) IS NULL THEN
        RETURN user_ids;
    END IF;
    
    -- 检查每个用户是否有分配权限
    FOREACH user_id IN ARRAY user_ids LOOP
        -- 简化的权限检查：检查用户是否处于活跃状态
        IF EXISTS (
            SELECT 1 FROM users_profile 
            WHERE id = user_id AND status = 'active'
        ) THEN
            filtered_users := filtered_users || user_id;
        END IF;
    END LOOP;
    
    RETURN filtered_users;
END;
$$;


ALTER FUNCTION "public"."filter_users_by_permission"("user_ids" bigint[]) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."filter_users_by_quality_control"("p_user_ids" bigint[], "p_group_id" bigint) RETURNS bigint[]
    LANGUAGE "plpgsql"
    AS $$
DECLARE
    eligible_users bigint[] := ARRAY[]::bigint[];
    user_id bigint;
    group_config RECORD;
    daily_assigned integer;
    pending_count integer;
    conversion_rate numeric;
    user_stats jsonb;
BEGIN
    -- 获取用户组质量控制配置
    SELECT 
        ul.enable_quality_control,
        ul.daily_lead_limit,
        ul.conversion_rate_requirement,
        ul.max_pending_leads
    INTO group_config
    FROM users_list ul
    WHERE ul.id = p_group_id;
    
    -- 如果未启用质量控制，直接返回所有用户
    IF NOT COALESCE(group_config.enable_quality_control, false) THEN
        RETURN p_user_ids;
    END IF;
    
    -- 遍历用户ID数组，检查每个用户的质量控制条件
    FOREACH user_id IN ARRAY p_user_ids LOOP
        -- 检查日线索量限制
        SELECT COUNT(*) INTO daily_assigned
        FROM simple_allocation_logs
        WHERE assigned_user_id = user_id
          AND created_at >= CURRENT_DATE;
        
        IF group_config.daily_lead_limit IS NOT NULL AND daily_assigned >= group_config.daily_lead_limit THEN
            CONTINUE;
        END IF;
        
        -- 检查未接受线索数量
        SELECT COUNT(*) INTO pending_count
        FROM followups
        WHERE interviewsales_user_id = user_id
          AND followupstage = '待接收';
        
        IF group_config.max_pending_leads IS NOT NULL AND pending_count > group_config.max_pending_leads THEN
            CONTINUE;
        END IF;
        
        -- 检查转化率（简化版本）
        IF group_config.conversion_rate_requirement IS NOT NULL THEN
            -- 计算简化的转化率
            WITH user_stats AS (
                SELECT 
                    COUNT(*) as total_leads,
                    COUNT(*) FILTER (WHERE followupstage IN ('赢单')) as converted_leads
                FROM followups
                WHERE interviewsales_user_id = user_id
                  AND created_at >= CURRENT_DATE - INTERVAL '30 days'
            )
            SELECT 
                CASE 
                    WHEN total_leads >= 50 THEN 
                        ROUND((converted_leads::numeric / total_leads::numeric) * 100, 2)
                    ELSE 
                        group_config.conversion_rate_requirement -- 样本不足时通过检查
                END
            INTO conversion_rate
            FROM user_stats;
            
            IF conversion_rate < group_config.conversion_rate_requirement THEN
                CONTINUE;
            END IF;
        END IF;
        
        -- 通过所有检查，添加到可用用户列表
        eligible_users := eligible_users || user_id;
    END LOOP;
    
    RETURN eligible_users;
END;
$$;


ALTER FUNCTION "public"."filter_users_by_quality_control"("p_user_ids" bigint[], "p_group_id" bigint) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."freeze_user_on_status_left"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
BEGIN
  -- 当 status 字段更新为 'left' 时
  IF NEW.status = 'left' THEN
    -- 更新 auth.users 表中的 banned_until 字段为 'infinity'
    UPDATE auth.users
    SET banned_until = 'infinity'::timestamptz
    WHERE id = NEW.user_id;
  END IF;
  
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."freeze_user_on_status_left"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."gen_leadid"() RETURNS "text"
    LANGUAGE "plpgsql"
    AS $$
DECLARE
    year2 CHAR(2);
    month_abbr CHAR(1);
    prefix TEXT;
    max_leadid TEXT;
    next_num INT;
    month_map TEXT[] := ARRAY['J','F','M','A','M','X','Y','A','S','O','N','D'];
BEGIN
    -- 年份后两位
    year2 := TO_CHAR(NOW(), 'YY');
    -- 月份英文缩写
    month_abbr := month_map[EXTRACT(MONTH FROM NOW())::INT];
    prefix := year2 || month_abbr;
    
    -- 查找本月最大编号
    SELECT leadid
    INTO max_leadid
    FROM leads
    WHERE leadid LIKE prefix || '%'
    ORDER BY leadid DESC
    LIMIT 1;
    
    IF max_leadid IS NOT NULL THEN
        next_num := (RIGHT(max_leadid, 5))::INT + 1;
    ELSE
        next_num := 1;
    END IF;
    
    RETURN prefix || LPAD(next_num::TEXT, 5, '0');
END;
$$;


ALTER FUNCTION "public"."gen_leadid"() OWNER TO "postgres";


COMMENT ON FUNCTION "public"."gen_leadid"() IS '生成唯一的线索ID，使用序列确保并发安全';



CREATE OR REPLACE FUNCTION "public"."get_all_announcements"() RETURNS TABLE("id" "uuid", "title" "text", "content" "text", "type" "text", "priority" integer, "target_roles" "text"[], "target_organizations" "uuid"[], "is_active" boolean, "start_time" timestamp with time zone, "end_time" timestamp with time zone, "created_by" bigint, "created_at" timestamp with time zone, "updated_at" timestamp with time zone)
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
BEGIN
  RETURN QUERY
  SELECT 
    a.id,
    a.title,
    a.content,
    a.type,
    a.priority,
    a.target_roles,
    a.target_organizations,
    a.is_active,
    a.start_time,
    a.end_time,
    a.created_by,
    a.created_at,
    a.updated_at
  FROM announcements a
  ORDER BY a.created_at DESC;
END;
$$;


ALTER FUNCTION "public"."get_all_announcements"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_approval_instances_count"("p_status_filter" "text"[] DEFAULT NULL::"text"[], "p_target_id_filter" "text" DEFAULT NULL::"text", "p_flow_name_filter" "text" DEFAULT NULL::"text", "p_creator_name_filter" "text" DEFAULT NULL::"text", "p_date_from" timestamp with time zone DEFAULT NULL::timestamp with time zone, "p_date_to" timestamp with time zone DEFAULT NULL::timestamp with time zone) RETURNS bigint
    LANGUAGE "plpgsql"
    AS $$
DECLARE
  v_count BIGINT;
BEGIN
  SELECT COUNT(*) INTO v_count
  FROM approval_instances_with_metadata v
  WHERE (p_status_filter IS NULL OR v.status = ANY(p_status_filter))
    AND (p_target_id_filter IS NULL OR v.target_id ILIKE '%' || p_target_id_filter || '%')
    AND (p_flow_name_filter IS NULL OR v.flow_name ILIKE '%' || p_flow_name_filter || '%')
    AND (p_creator_name_filter IS NULL OR v.creator_nickname ILIKE '%' || p_creator_name_filter || '%')
    AND (p_date_from IS NULL OR v.created_at >= p_date_from)
    AND (p_date_to IS NULL OR v.created_at <= p_date_to);
  
  RETURN v_count;
END;
$$;


ALTER FUNCTION "public"."get_approval_instances_count"("p_status_filter" "text"[], "p_target_id_filter" "text", "p_flow_name_filter" "text", "p_creator_name_filter" "text", "p_date_from" timestamp with time zone, "p_date_to" timestamp with time zone) OWNER TO "postgres";


COMMENT ON FUNCTION "public"."get_approval_instances_count"("p_status_filter" "text"[], "p_target_id_filter" "text", "p_flow_name_filter" "text", "p_creator_name_filter" "text", "p_date_from" timestamp with time zone, "p_date_to" timestamp with time zone) IS '获取审批实例总数';



CREATE OR REPLACE FUNCTION "public"."get_approval_instances_with_sorting"("p_page" integer DEFAULT 1, "p_page_size" integer DEFAULT 10, "p_sort_field" "text" DEFAULT 'created_at'::"text", "p_sort_order" "text" DEFAULT 'DESC'::"text", "p_status_filter" "text"[] DEFAULT NULL::"text"[], "p_target_id_filter" "text" DEFAULT NULL::"text", "p_flow_name_filter" "text" DEFAULT NULL::"text", "p_creator_name_filter" "text" DEFAULT NULL::"text", "p_date_from" timestamp with time zone DEFAULT NULL::timestamp with time zone, "p_date_to" timestamp with time zone DEFAULT NULL::timestamp with time zone) RETURNS TABLE("id" "uuid", "flow_id" "uuid", "target_table" "text", "target_id" "text", "status" "text", "current_step" integer, "created_by" bigint, "created_at" timestamp with time zone, "updated_at" timestamp with time zone, "flow_name" "text", "flow_type" "text", "creator_nickname" "text", "latest_action_time" timestamp with time zone, "approval_duration_minutes" numeric, "pending_steps_count" integer, "total_steps_count" integer)
    LANGUAGE "plpgsql"
    AS $$
DECLARE
  v_offset INTEGER;
BEGIN
  -- 计算偏移量
  v_offset := (p_page - 1) * p_page_size;
  
  -- 返回分页数据（修复返回类型）
  RETURN QUERY
  SELECT 
    v.id,
    v.flow_id,
    v.target_table,
    v.target_id,
    v.status,
    v.current_step,
    v.created_by,
    v.created_at,
    v.updated_at,
    v.flow_name,
    v.flow_type,
    v.creator_nickname,
    v.latest_action_time,
    v.approval_duration_minutes,
    v.pending_steps_count::INTEGER,
    v.total_steps_count::INTEGER
  FROM approval_instances_with_metadata v
  WHERE (p_status_filter IS NULL OR v.status = ANY(p_status_filter))
    AND (p_target_id_filter IS NULL OR v.target_id ILIKE '%' || p_target_id_filter || '%')
    AND (p_flow_name_filter IS NULL OR v.flow_name ILIKE '%' || p_flow_name_filter || '%')
    AND (p_creator_name_filter IS NULL OR v.creator_nickname ILIKE '%' || p_creator_name_filter || '%')
    AND (p_date_from IS NULL OR v.created_at >= p_date_from)
    AND (p_date_to IS NULL OR v.created_at <= p_date_to)
  ORDER BY 
    CASE WHEN p_sort_field = 'created_at' AND p_sort_order = 'ASC' THEN v.created_at END ASC,
    CASE WHEN p_sort_field = 'created_at' AND p_sort_order = 'DESC' THEN v.created_at END DESC,
    CASE WHEN p_sort_field = 'updated_at' AND p_sort_order = 'ASC' THEN v.updated_at END ASC,
    CASE WHEN p_sort_field = 'updated_at' AND p_sort_order = 'DESC' THEN v.updated_at END DESC,
    CASE WHEN p_sort_field = 'flow_name' AND p_sort_order = 'ASC' THEN v.flow_name END ASC,
    CASE WHEN p_sort_field = 'flow_name' AND p_sort_order = 'DESC' THEN v.flow_name END DESC,
    CASE WHEN p_sort_field = 'target_id' AND p_sort_order = 'ASC' THEN v.target_id END ASC,
    CASE WHEN p_sort_field = 'target_id' AND p_sort_order = 'DESC' THEN v.target_id END DESC,
    CASE WHEN p_sort_field = 'status' AND p_sort_order = 'ASC' THEN v.status END ASC,
    CASE WHEN p_sort_field = 'status' AND p_sort_order = 'DESC' THEN v.status END DESC,
    CASE WHEN p_sort_field = 'approval_duration_minutes' AND p_sort_order = 'ASC' THEN v.approval_duration_minutes END ASC,
    CASE WHEN p_sort_field = 'approval_duration_minutes' AND p_sort_order = 'DESC' THEN v.approval_duration_minutes END DESC,
    CASE WHEN p_sort_field = 'latest_action_time' AND p_sort_order = 'ASC' THEN v.latest_action_time END ASC,
    CASE WHEN p_sort_field = 'latest_action_time' AND p_sort_order = 'DESC' THEN v.latest_action_time END DESC,
    CASE WHEN p_sort_field = 'creator_nickname' AND p_sort_order = 'ASC' THEN v.creator_nickname END ASC,
    CASE WHEN p_sort_field = 'creator_nickname' AND p_sort_order = 'DESC' THEN v.creator_nickname END DESC,
    v.created_at DESC
  LIMIT p_page_size OFFSET v_offset;
END;
$$;


ALTER FUNCTION "public"."get_approval_instances_with_sorting"("p_page" integer, "p_page_size" integer, "p_sort_field" "text", "p_sort_order" "text", "p_status_filter" "text"[], "p_target_id_filter" "text", "p_flow_name_filter" "text", "p_creator_name_filter" "text", "p_date_from" timestamp with time zone, "p_date_to" timestamp with time zone) OWNER TO "postgres";


COMMENT ON FUNCTION "public"."get_approval_instances_with_sorting"("p_page" integer, "p_page_size" integer, "p_sort_field" "text", "p_sort_order" "text", "p_status_filter" "text"[], "p_target_id_filter" "text", "p_flow_name_filter" "text", "p_creator_name_filter" "text", "p_date_from" timestamp with time zone, "p_date_to" timestamp with time zone) IS '获取审批实例列表，支持分页、排序和筛选';



CREATE OR REPLACE FUNCTION "public"."get_approval_performance_metrics"() RETURNS TABLE("metric_name" "text", "metric_value" numeric, "description" "text")
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  RETURN QUERY
  SELECT 
    'avg_approval_duration_hours'::TEXT,
    AVG(approval_duration_minutes) / 60,
    '平均审批时长（小时）'
  FROM approval_instances_with_metadata
  WHERE approval_duration_minutes IS NOT NULL
  
  UNION ALL
  
  SELECT 
    'pending_instances_ratio'::TEXT,
    (COUNT(*) FILTER (WHERE status = 'pending')::NUMERIC / COUNT(*)) * 100,
    '待审批实例占比（%）'
  FROM approval_instances_with_metadata
  
  UNION ALL
  
  SELECT 
    'avg_steps_per_instance'::TEXT,
    AVG(total_steps_count),
    '平均每个实例的步骤数'
  FROM approval_instances_with_metadata
  WHERE total_steps_count > 0;
END;
$$;


ALTER FUNCTION "public"."get_approval_performance_metrics"() OWNER TO "postgres";


COMMENT ON FUNCTION "public"."get_approval_performance_metrics"() IS '获取审批性能指标';



CREATE OR REPLACE FUNCTION "public"."get_approval_statistics"() RETURNS TABLE("total_instances" bigint, "pending_instances" bigint, "approved_instances" bigint, "rejected_instances" bigint, "avg_approval_duration_minutes" numeric)
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  RETURN QUERY
  SELECT 
    COUNT(*) as total_instances,
    COUNT(*) FILTER (WHERE status = 'pending') as pending_instances,
    COUNT(*) FILTER (WHERE status = 'approved') as approved_instances,
    COUNT(*) FILTER (WHERE status = 'rejected') as rejected_instances,
    AVG(approval_duration_minutes) FILTER (WHERE approval_duration_minutes IS NOT NULL) as avg_approval_duration_minutes
  FROM approval_instances_with_metadata;
END;
$$;


ALTER FUNCTION "public"."get_approval_statistics"() OWNER TO "postgres";


COMMENT ON FUNCTION "public"."get_approval_statistics"() IS '获取审批统计信息';



CREATE OR REPLACE FUNCTION "public"."get_available_data_sources"() RETURNS TABLE("source_name" "text", "source_description" "text", "table_name" "text", "record_count" bigint)
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  RETURN QUERY
  SELECT 
    'joined_data'::text as source_name,
    '关联数据（leads + followups + showings + deals）'::text as source_description,
    'filter_followups()'::text as table_name,
    (SELECT COUNT(*) FROM filter_followups()) as record_count
  UNION ALL
  SELECT 
    'leads'::text as source_name,
    '线索数据'::text as source_description,
    'leads'::text as table_name,
    (SELECT COUNT(*) FROM leads) as record_count
  UNION ALL
  SELECT 
    'showings_with_leads'::text as source_name,
    '带看数据（含线索信息，处理一对多）'::text as source_description,
    'showings + leads关联'::text as table_name,
    (SELECT COUNT(*) FROM showings) as record_count
  UNION ALL
  SELECT 
    'deals_with_leads'::text as source_name,
    '成交数据（含线索信息，处理一对多）'::text as source_description,
    'deals + leads关联'::text as table_name,
    (SELECT COUNT(*) FROM deals) as record_count;
END;
$$;


ALTER FUNCTION "public"."get_available_data_sources"() OWNER TO "postgres";


COMMENT ON FUNCTION "public"."get_available_data_sources"() IS '获取可用的数据源列表';



CREATE OR REPLACE FUNCTION "public"."get_bi_statistics"() RETURNS TABLE("total_pivot_configs" bigint, "public_configs" bigint, "total_users" bigint, "recent_activity" bigint)
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  RETURN QUERY
  SELECT 
    (SELECT COUNT(*) FROM bi_pivot_configs) as total_pivot_configs,
    (SELECT COUNT(*) FROM bi_pivot_configs WHERE is_public = true) as public_configs,
    (SELECT COUNT(*) FROM users_profile) as total_users,
    (SELECT COUNT(*) FROM bi_pivot_configs WHERE created_at >= now() - interval '7 days') as recent_activity;
END;
$$;


ALTER FUNCTION "public"."get_bi_statistics"() OWNER TO "postgres";


COMMENT ON FUNCTION "public"."get_bi_statistics"() IS '获取BI系统统计信息';



CREATE OR REPLACE FUNCTION "public"."get_conversion_rate_stats"("p_date_start" timestamp with time zone DEFAULT NULL::timestamp with time zone, "p_date_end" timestamp with time zone DEFAULT NULL::timestamp with time zone, "p_previous_date_start" timestamp with time zone DEFAULT NULL::timestamp with time zone, "p_previous_date_end" timestamp with time zone DEFAULT NULL::timestamp with time zone) RETURNS TABLE("sales_id" integer, "sales_name" "text", "showings_count" integer, "direct_deal_count" integer, "reserved_count" integer, "intention_count" integer, "considering_count" integer, "lost_count" integer, "unfilled_count" integer, "direct_rate" numeric, "conversion_rate" numeric, "previous_showings_count" integer, "previous_direct_deal_count" integer, "previous_reserved_count" integer, "previous_intention_count" integer, "previous_considering_count" integer, "previous_lost_count" integer, "previous_unfilled_count" integer, "previous_direct_rate" numeric, "previous_conversion_rate" numeric)
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  RETURN QUERY
  WITH current_period_stats AS (
    SELECT 
      s.showingsales::integer as sales_id,
      up.nickname as sales_name,
      COUNT(*)::integer as showings_count,
      COUNT(CASE WHEN s.viewresult = '直签' THEN 1 END)::integer as direct_deal_count,
      COUNT(CASE WHEN s.viewresult = '预定' THEN 1 END)::integer as reserved_count,
      COUNT(CASE WHEN s.viewresult = '意向金' THEN 1 END)::integer as intention_count,
      COUNT(CASE WHEN s.viewresult = '考虑中' THEN 1 END)::integer as considering_count,
      COUNT(CASE WHEN s.viewresult = '已流失' THEN 1 END)::integer as lost_count,
      COUNT(CASE WHEN s.viewresult IS NULL OR s.viewresult = '' THEN 1 END)::integer as unfilled_count
    FROM showings s
    LEFT JOIN users_profile up ON s.showingsales = up.id
    WHERE s.showingsales IS NOT NULL
      AND (p_date_start IS NULL OR s.created_at >= p_date_start)
      AND (p_date_end IS NULL OR s.created_at <= p_date_end)
      AND (s.invalid IS NULL OR s.invalid = false) -- 过滤无效记录
    GROUP BY s.showingsales, up.nickname
  ),
  previous_period_stats AS (
    SELECT 
      s.showingsales::integer as sales_id,
      up.nickname as sales_name,
      COUNT(*)::integer as showings_count,
      COUNT(CASE WHEN s.viewresult = '直签' THEN 1 END)::integer as direct_deal_count,
      COUNT(CASE WHEN s.viewresult = '预定' THEN 1 END)::integer as reserved_count,
      COUNT(CASE WHEN s.viewresult = '意向金' THEN 1 END)::integer as intention_count,
      COUNT(CASE WHEN s.viewresult = '考虑中' THEN 1 END)::integer as considering_count,
      COUNT(CASE WHEN s.viewresult = '已流失' THEN 1 END)::integer as lost_count,
      COUNT(CASE WHEN s.viewresult IS NULL OR s.viewresult = '' THEN 1 END)::integer as unfilled_count
    FROM showings s
    LEFT JOIN users_profile up ON s.showingsales = up.id
    WHERE s.showingsales IS NOT NULL
      AND (p_previous_date_start IS NULL OR s.created_at >= p_previous_date_start)
      AND (p_previous_date_end IS NULL OR s.created_at <= p_previous_date_end)
      AND (s.invalid IS NULL OR s.invalid = false) -- 过滤无效记录
    GROUP BY s.showingsales, up.nickname
  )
  SELECT 
    c.sales_id,
    c.sales_name,
    c.showings_count,
    c.direct_deal_count,
    c.reserved_count,
    c.intention_count,
    c.considering_count,
    c.lost_count,
    c.unfilled_count,
    CASE 
      WHEN c.showings_count > 0 THEN 
        ROUND((c.direct_deal_count::numeric / c.showings_count::numeric) * 100, 2)
      ELSE 0 
    END as direct_rate,
    CASE 
      WHEN c.showings_count > 0 THEN 
        ROUND(((c.direct_deal_count + c.reserved_count)::numeric / c.showings_count::numeric) * 100, 2)
      ELSE 0 
    END as conversion_rate,
    COALESCE(p.showings_count, 0) as previous_showings_count,
    COALESCE(p.direct_deal_count, 0) as previous_direct_deal_count,
    COALESCE(p.reserved_count, 0) as previous_reserved_count,
    COALESCE(p.intention_count, 0) as previous_intention_count,
    COALESCE(p.considering_count, 0) as previous_considering_count,
    COALESCE(p.lost_count, 0) as previous_lost_count,
    COALESCE(p.unfilled_count, 0) as previous_unfilled_count,
    CASE 
      WHEN COALESCE(p.showings_count, 0) > 0 THEN 
        ROUND((COALESCE(p.direct_deal_count, 0)::numeric / COALESCE(p.showings_count, 0)::numeric) * 100, 2)
      ELSE 0 
    END as previous_direct_rate,
    CASE 
      WHEN COALESCE(p.showings_count, 0) > 0 THEN 
        ROUND(((COALESCE(p.direct_deal_count, 0) + COALESCE(p.reserved_count, 0))::numeric / COALESCE(p.showings_count, 0)::numeric) * 100, 2)
      ELSE 0 
    END as previous_conversion_rate
  FROM current_period_stats c
  LEFT JOIN previous_period_stats p ON c.sales_id = p.sales_id
  ORDER BY c.sales_id;
END;
$$;


ALTER FUNCTION "public"."get_conversion_rate_stats"("p_date_start" timestamp with time zone, "p_date_end" timestamp with time zone, "p_previous_date_start" timestamp with time zone, "p_previous_date_end" timestamp with time zone) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_conversion_rate_stats_with_actual_sales"("p_date_start" timestamp with time zone DEFAULT NULL::timestamp with time zone, "p_date_end" timestamp with time zone DEFAULT NULL::timestamp with time zone, "p_previous_date_start" timestamp with time zone DEFAULT NULL::timestamp with time zone, "p_previous_date_end" timestamp with time zone DEFAULT NULL::timestamp with time zone) RETURNS TABLE("sales_id" integer, "sales_name" "text", "actual_sales_id" integer, "actual_sales_name" "text", "showings_count" integer, "direct_deal_count" integer, "reserved_count" integer, "intention_count" integer, "considering_count" integer, "lost_count" integer, "unfilled_count" integer, "direct_rate" numeric, "conversion_rate" numeric, "is_actual_sales" boolean, "previous_showings_count" integer, "previous_direct_deal_count" integer, "previous_reserved_count" integer, "previous_intention_count" integer, "previous_considering_count" integer, "previous_lost_count" integer, "previous_unfilled_count" integer, "previous_direct_rate" numeric, "previous_conversion_rate" numeric)
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  RETURN QUERY
  WITH current_period_stats AS (
    SELECT 
      s.showingsales::integer as sales_id,
      up_showings.nickname as sales_name,
      s.trueshowingsales::integer as actual_sales_id,
      up_actual.nickname as actual_sales_name,
      COUNT(*)::integer as showings_count,
      COUNT(CASE WHEN s.viewresult = '直签' THEN 1 END)::integer as direct_deal_count,
      COUNT(CASE WHEN s.viewresult = '预定' THEN 1 END)::integer as reserved_count,
      COUNT(CASE WHEN s.viewresult = '意向金' THEN 1 END)::integer as intention_count,
      COUNT(CASE WHEN s.viewresult = '考虑中' THEN 1 END)::integer as considering_count,
      COUNT(CASE WHEN s.viewresult = '已流失' THEN 1 END)::integer as lost_count,
      COUNT(CASE WHEN s.viewresult IS NULL OR s.viewresult = '' THEN 1 END)::integer as unfilled_count
    FROM showings s
    LEFT JOIN users_profile up_showings ON s.showingsales = up_showings.id
    LEFT JOIN users_profile up_actual ON s.trueshowingsales = up_actual.id
    WHERE s.showingsales IS NOT NULL
      AND (p_date_start IS NULL OR s.created_at >= p_date_start)
      AND (p_date_end IS NULL OR s.created_at <= p_date_end)
      AND (s.invalid IS NULL OR s.invalid = false) -- 过滤无效记录
    GROUP BY s.showingsales, up_showings.nickname, s.trueshowingsales, up_actual.nickname
  ),
  previous_period_stats AS (
    SELECT 
      s.showingsales::integer as sales_id,
      up_showings.nickname as sales_name,
      s.trueshowingsales::integer as actual_sales_id,
      up_actual.nickname as actual_sales_name,
      COUNT(*)::integer as showings_count,
      COUNT(CASE WHEN s.viewresult = '直签' THEN 1 END)::integer as direct_deal_count,
      COUNT(CASE WHEN s.viewresult = '预定' THEN 1 END)::integer as reserved_count,
      COUNT(CASE WHEN s.viewresult = '意向金' THEN 1 END)::integer as intention_count,
      COUNT(CASE WHEN s.viewresult = '考虑中' THEN 1 END)::integer as considering_count,
      COUNT(CASE WHEN s.viewresult = '已流失' THEN 1 END)::integer as lost_count,
      COUNT(CASE WHEN s.viewresult IS NULL OR s.viewresult = '' THEN 1 END)::integer as unfilled_count
    FROM showings s
    LEFT JOIN users_profile up_showings ON s.showingsales = up_showings.id
    LEFT JOIN users_profile up_actual ON s.trueshowingsales = up_actual.id
    WHERE s.showingsales IS NOT NULL
      AND (p_previous_date_start IS NULL OR s.created_at >= p_previous_date_start)
      AND (p_previous_date_end IS NULL OR s.created_at <= p_previous_date_end)
      AND (s.invalid IS NULL OR s.invalid = false) -- 过滤无效记录
    GROUP BY s.showingsales, up_showings.nickname, s.trueshowingsales, up_actual.nickname
  )
  SELECT 
    c.sales_id,
    c.sales_name,
    c.actual_sales_id,
    c.actual_sales_name,
    c.showings_count,
    c.direct_deal_count,
    c.reserved_count,
    c.intention_count,
    c.considering_count,
    c.lost_count,
    c.unfilled_count,
    CASE 
      WHEN c.showings_count > 0 THEN 
        ROUND((c.direct_deal_count::numeric / c.showings_count::numeric) * 100, 2)
      ELSE 0 
    END as direct_rate,
    CASE 
      WHEN c.showings_count > 0 THEN 
        ROUND(((c.direct_deal_count + c.reserved_count)::numeric / c.showings_count::numeric) * 100, 2)
      ELSE 0 
    END as conversion_rate,
    (c.actual_sales_id IS NOT NULL) as is_actual_sales,
    COALESCE(p.showings_count, 0) as previous_showings_count,
    COALESCE(p.direct_deal_count, 0) as previous_direct_deal_count,
    COALESCE(p.reserved_count, 0) as previous_reserved_count,
    COALESCE(p.intention_count, 0) as previous_intention_count,
    COALESCE(p.considering_count, 0) as previous_considering_count,
    COALESCE(p.lost_count, 0) as previous_lost_count,
    COALESCE(p.unfilled_count, 0) as previous_unfilled_count,
    CASE 
      WHEN COALESCE(p.showings_count, 0) > 0 THEN 
        ROUND((COALESCE(p.direct_deal_count, 0)::numeric / COALESCE(p.showings_count, 0)::numeric) * 100, 2)
      ELSE 0 
    END as previous_direct_rate,
    CASE 
      WHEN COALESCE(p.showings_count, 0) > 0 THEN 
        ROUND(((COALESCE(p.direct_deal_count, 0) + COALESCE(p.reserved_count, 0))::numeric / COALESCE(p.showings_count, 0)::numeric) * 100, 2)
      ELSE 0 
    END as previous_conversion_rate
  FROM current_period_stats c
  LEFT JOIN previous_period_stats p ON c.sales_id = p.sales_id 
    AND c.actual_sales_id = p.actual_sales_id
  ORDER BY c.sales_id, c.actual_sales_id;
END;
$$;


ALTER FUNCTION "public"."get_conversion_rate_stats_with_actual_sales"("p_date_start" timestamp with time zone, "p_date_end" timestamp with time zone, "p_previous_date_start" timestamp with time zone, "p_previous_date_end" timestamp with time zone) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_data_source_fields"("p_source_name" "text" DEFAULT 'joined_data'::"text") RETURNS TABLE("field_name" "text", "field_label" "text", "field_type" "text", "table_name" "text", "is_dimension" boolean, "is_measure" boolean)
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  CASE p_source_name
    WHEN 'joined_data' THEN
      RETURN QUERY
      SELECT 
        column_name::text as field_name,
        CASE column_name
          -- Leads表字段
          WHEN 'leadid' THEN '线索编号'
          WHEN 'phone' THEN '手机号'
          WHEN 'wechat' THEN '微信号'
          WHEN 'qq' THEN 'QQ号'
          WHEN 'location' THEN '位置'
          WHEN 'budget' THEN '预算'
          WHEN 'remark' THEN '备注'
          WHEN 'source' THEN '渠道'
          WHEN 'douyinid' THEN '抖音ID'
          WHEN 'douyin_accountname' THEN '抖音账号'
          WHEN 'staffname' THEN '员工姓名'
          WHEN 'redbookid' THEN '小红书ID'
          WHEN 'area' THEN '线索来源区域'
          WHEN 'notelink' THEN '笔记链接'
          WHEN 'campaignid' THEN '广告计划ID'
          WHEN 'campaignname' THEN '广告计划名称'
          WHEN 'unitid' THEN '广告单元ID'
          WHEN 'unitname' THEN '广告单元名称'
          WHEN 'creativedid' THEN '创意ID'
          WHEN 'creativename' THEN '创意名称'
          WHEN 'leadtype' THEN '线索类型'
          WHEN 'traffictype' THEN '流量类型'
          WHEN 'interactiontype' THEN '互动类型'
          WHEN 'douyinleadid' THEN '抖音线索ID'
          WHEN 'leadstatus' THEN '线索状态'
          WHEN 'created_at' THEN '线索创建时间'
          WHEN 'updata_at' THEN '线索更新时间'
          
          -- Followups表字段
          WHEN 'followupstage' THEN '跟进阶段'
          WHEN 'customerprofile' THEN '客户画像'
          WHEN 'worklocation' THEN '工作地点'
          WHEN 'userbudget' THEN '用户预算'
          WHEN 'moveintime' THEN '入住时间'
          WHEN 'userrating' THEN '来访意向'
          WHEN 'majorcategory' THEN '跟进结果'
          WHEN 'followupresult' THEN '跟进结果详情'
          WHEN 'scheduletime' THEN '预约时间'
          WHEN 'scheduledcommunity' THEN '意向社区'
          WHEN 'interviewsales_user_name' THEN '约访销售'
          WHEN 'interviewsales_user_id' THEN '约访销售ID'
          
          -- Showings表字段（处理一对多关系）
          WHEN 'viewresult' THEN '看房结果'
          WHEN 'community' THEN '到访社区'
          WHEN 'arrivaltime' THEN '到达时间'
          WHEN 'showingsales_user_name' THEN '分配带看销售'
          WHEN 'trueshowingsales_user_name' THEN '实际带看销售'
          WHEN 'showing_budget' THEN '看房预算'
          WHEN 'showing_moveintime' THEN '看房入住时间'
          WHEN 'showing_remark' THEN '看房备注'
          WHEN 'renttime' THEN '租期'
          WHEN 'scheduletime' THEN '预约时间'
          WHEN 'showing_created_at' THEN '看房创建时间'
          WHEN 'showing_updated_at' THEN '看房更新时间'
          
          -- Deals表字段（处理一对多关系）
          WHEN 'contractdate' THEN '签约日期'
          WHEN 'deal_community' THEN '成交社区'
          WHEN 'contractnumber' THEN '合同编号'
          WHEN 'roomnumber' THEN '房间号'
          WHEN 'deal_created_at' THEN '成交创建时间'
          WHEN 'deal_updated_at' THEN '成交更新时间'
          WHEN 'channel' THEN '成交渠道'
          WHEN 'interviewsales' THEN '约访销售'
          
          ELSE column_name
        END as field_label,
        data_type::text as field_type,
        'joined_data'::text as table_name,
        CASE 
          WHEN data_type IN ('text', 'character varying', 'timestamp', 'date') THEN true
          ELSE false
        END as is_dimension,
        CASE 
          WHEN data_type IN ('integer', 'bigint', 'numeric', 'decimal') THEN true
          ELSE false
        END as is_measure
      FROM information_schema.columns 
      WHERE table_name = 'filter_followups' 
      AND table_schema = 'public';
    ELSE
      -- 其他数据源的处理
      RETURN QUERY SELECT 
        column_name::text as field_name,
        column_name::text as field_label,
        data_type::text as field_type,
        p_source_name::text as table_name,
        CASE 
          WHEN data_type IN ('text', 'character varying', 'timestamp', 'date') THEN true
          ELSE false
        END as is_dimension,
        CASE 
          WHEN data_type IN ('integer', 'bigint', 'numeric', 'decimal') THEN true
          ELSE false
        END as is_measure
      FROM information_schema.columns 
      WHERE table_name = p_source_name 
      AND table_schema = 'public';
  END CASE;
END;
$$;


ALTER FUNCTION "public"."get_data_source_fields"("p_source_name" "text") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."get_data_source_fields"("p_source_name" "text") IS '获取数据源的字段信息';



CREATE OR REPLACE FUNCTION "public"."get_deals_community_options"() RETURNS "text"[]
    LANGUAGE "plpgsql"
    AS $$
DECLARE
  v_communities text[];
BEGIN
  SELECT ARRAY_AGG(DISTINCT community::text ORDER BY community::text)
  INTO v_communities
  FROM deals
  WHERE community IS NOT NULL;
  
  RETURN COALESCE(v_communities, ARRAY[]::text[]);
END;
$$;


ALTER FUNCTION "public"."get_deals_community_options"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_deals_contractnumber_options"() RETURNS "text"[]
    LANGUAGE "plpgsql"
    AS $$
DECLARE
  v_contractnumbers text[];
BEGIN
  SELECT ARRAY_AGG(DISTINCT contractnumber ORDER BY contractnumber)
  INTO v_contractnumbers
  FROM deals
  WHERE contractnumber IS NOT NULL;
  
  RETURN COALESCE(v_contractnumbers, ARRAY[]::text[]);
END;
$$;


ALTER FUNCTION "public"."get_deals_contractnumber_options"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_deals_count"("p_id" "uuid"[] DEFAULT NULL::"uuid"[], "p_leadid" "text"[] DEFAULT NULL::"text"[], "p_contractdate_start" "date" DEFAULT NULL::"date", "p_contractdate_end" "date" DEFAULT NULL::"date", "p_community" "text"[] DEFAULT NULL::"text"[], "p_contractnumber" "text"[] DEFAULT NULL::"text"[], "p_roomnumber" "text"[] DEFAULT NULL::"text"[], "p_created_at_start" timestamp with time zone DEFAULT NULL::timestamp with time zone, "p_created_at_end" timestamp with time zone DEFAULT NULL::timestamp with time zone, "p_source" "text"[] DEFAULT NULL::"text"[]) RETURNS integer
    LANGUAGE "plpgsql"
    AS $$
DECLARE
  count_result integer;
BEGIN
  SELECT COUNT(*)
  INTO count_result
  FROM deals d
  LEFT JOIN leads l ON d.leadid = l.leadid
  LEFT JOIN followups f ON d.leadid = f.leadid
  LEFT JOIN users_profile u ON f.interviewsales_user_id = u.id
  WHERE
    (p_id IS NULL OR d.id = ANY(p_id))
    AND (p_leadid IS NULL OR d.leadid = ANY(p_leadid))
    AND (p_contractdate_start IS NULL OR d.contractdate >= p_contractdate_start)
    AND (p_contractdate_end IS NULL OR d.contractdate <= p_contractdate_end)
    AND (p_community IS NULL OR d.community = ANY(ARRAY(SELECT unnest(p_community)::community)))
    AND (p_contractnumber IS NULL OR d.contractnumber = ANY(p_contractnumber))
    AND (p_roomnumber IS NULL OR d.roomnumber = ANY(p_roomnumber))
    AND (p_created_at_start IS NULL OR d.created_at >= p_created_at_start)
    AND (p_created_at_end IS NULL OR d.created_at <= p_created_at_end)
    AND (p_source IS NULL OR l.source = ANY(ARRAY(SELECT unnest(p_source)::source)))
    AND (d.invalid IS NULL OR d.invalid = false);
  
  RETURN count_result;
END;
$$;


ALTER FUNCTION "public"."get_deals_count"("p_id" "uuid"[], "p_leadid" "text"[], "p_contractdate_start" "date", "p_contractdate_end" "date", "p_community" "text"[], "p_contractnumber" "text"[], "p_roomnumber" "text"[], "p_created_at_start" timestamp with time zone, "p_created_at_end" timestamp with time zone, "p_source" "text"[]) OWNER TO "postgres";


COMMENT ON FUNCTION "public"."get_deals_count"("p_id" "uuid"[], "p_leadid" "text"[], "p_contractdate_start" "date", "p_contractdate_end" "date", "p_community" "text"[], "p_contractnumber" "text"[], "p_roomnumber" "text"[], "p_created_at_start" timestamp with time zone, "p_created_at_end" timestamp with time zone, "p_source" "text"[]) IS '获取成交记录总数，支持多字段筛选，用于分页';



CREATE OR REPLACE FUNCTION "public"."get_deals_roomnumber_options"() RETURNS "text"[]
    LANGUAGE "plpgsql"
    AS $$
DECLARE
  v_roomnumbers text[];
BEGIN
  SELECT ARRAY_AGG(DISTINCT roomnumber ORDER BY roomnumber)
  INTO v_roomnumbers
  FROM deals
  WHERE roomnumber IS NOT NULL;
  
  RETURN COALESCE(v_roomnumbers, ARRAY[]::text[]);
END;
$$;


ALTER FUNCTION "public"."get_deals_roomnumber_options"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_deals_source_options"() RETURNS "text"[]
    LANGUAGE "plpgsql"
    AS $$
DECLARE
  v_sources text[];
BEGIN
  SELECT ARRAY_AGG(DISTINCT l.source::text ORDER BY l.source::text)
  INTO v_sources
  FROM deals d
  LEFT JOIN leads l ON d.leadid = l.leadid
  WHERE l.source IS NOT NULL;
  
  RETURN COALESCE(v_sources, ARRAY[]::text[]);
END;
$$;


ALTER FUNCTION "public"."get_deals_source_options"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_default_user"() RETURNS bigint
    LANGUAGE "plpgsql"
    AS $$
DECLARE
    default_user_id bigint;
BEGIN
    SELECT id INTO default_user_id
    FROM users_profile
    WHERE status = 'active'
    ORDER BY updated_at ASC
    LIMIT 1;
    
    RETURN default_user_id;
END;
$$;


ALTER FUNCTION "public"."get_default_user"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_enum_values"("enum_name" "text") RETURNS "text"[]
    LANGUAGE "plpgsql"
    AS $$
DECLARE
  values text[];
BEGIN
  EXECUTE format(
    'SELECT array_agg(enumlabel ORDER BY enumsortorder) FROM pg_enum WHERE enumtypid = %L::regtype',
    enum_name
  ) INTO values;
  
  RETURN values;
END;
$$;


ALTER FUNCTION "public"."get_enum_values"("enum_name" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_exchange_goods"("p_category" "text" DEFAULT NULL::"text", "p_user_id" bigint DEFAULT NULL::bigint) RETURNS TABLE("id" "uuid", "name" "text", "description" "text", "category" "text", "points_cost" integer, "icon" "text", "icon_type" "text", "icon_url" "text", "color" "text", "is_active" boolean, "is_featured" boolean, "sort_order" integer, "exchange_limit" integer, "daily_limit" integer, "can_exchange" boolean, "remaining_daily_limit" integer)
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  RETURN QUERY
  SELECT 
    eg.id,
    eg.name,
    eg.description,
    eg.category,
    eg.points_cost,
    eg.icon,
    eg.icon_type,
    eg.icon_url,
    eg.color,
    eg.is_active,
    eg.is_featured,
    eg.sort_order,
    eg.exchange_limit,
    eg.daily_limit,
    -- 检查是否可以兑换
    CASE 
      WHEN p_user_id IS NULL THEN true
      WHEN eg.daily_limit IS NOT NULL THEN
        COALESCE(uel.exchange_count, 0) < eg.daily_limit
      ELSE true
    END as can_exchange,
    -- 剩余每日兑换次数
    CASE 
      WHEN eg.daily_limit IS NULL THEN NULL
      ELSE GREATEST(0, eg.daily_limit - COALESCE(uel.exchange_count, 0))
    END as remaining_daily_limit
  FROM exchange_goods eg
  LEFT JOIN user_exchange_limits uel ON 
    uel.user_id = p_user_id AND 
    uel.goods_id = eg.id AND 
    uel.exchange_date = CURRENT_DATE
  WHERE eg.is_active = true
    AND (p_category IS NULL OR eg.category = p_category)
  ORDER BY eg.sort_order ASC, eg.created_at ASC;
END;
$$;


ALTER FUNCTION "public"."get_exchange_goods"("p_category" "text", "p_user_id" bigint) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_filter_options"("p_field_name" "text", "p_filters" "jsonb" DEFAULT '{}'::"jsonb") RETURNS TABLE("text" "text", "value" "text", "search_text" "text")
    LANGUAGE "plpgsql"
    AS $$
DECLARE
  sql_query TEXT;
  where_clause TEXT := '';
  field_mapping JSONB := '{
    "leadid": {"field": "leadid", "display": "leadid", "type": "string"},
    "phone": {"field": "phone", "display": "phone", "type": "phone"},
    "wechat": {"field": "wechat", "display": "wechat", "type": "wechat"},
    "interviewsales_user_id": {"field": "interviewsales_user_id", "display": "nickname", "type": "user"},
    "remark": {"field": "remark", "display": "remark", "type": "string"},
    "worklocation": {"field": "worklocation", "display": "worklocation", "type": "string"},
    "userbudget": {"field": "userbudget", "display": "userbudget", "type": "string"},
    "followupresult": {"field": "followupresult", "display": "followupresult", "type": "string"},
    "majorcategory": {"field": "majorcategory", "display": "majorcategory", "type": "string"},
    "leadtype": {"field": "leadtype", "display": "leadtype", "type": "string"}
  }'::JSONB;
  field_config JSONB;
  field_name TEXT;
  display_name TEXT;
  field_type TEXT;
BEGIN
  -- 获取字段配置
  field_config := field_mapping->p_field_name;
  IF field_config IS NULL THEN
    RAISE EXCEPTION '不支持的字段: %', p_field_name;
  END IF;
  
  field_name := field_config->>'field';
  display_name := field_config->>'display';
  field_type := field_config->>'type';
  
  -- 构建WHERE子句（基于传入的筛选条件）
  IF p_filters IS NOT NULL AND p_filters != '{}'::JSONB THEN
    -- 这里可以添加基于当前筛选条件的逻辑
    -- 例如：如果已经筛选了某个用户，那么其他字段的选项应该基于这个筛选结果
  END IF;
  
  -- 根据字段类型构建不同的查询
  IF field_type = 'phone' THEN
    -- 手机号字段：显示脱敏版本，但保留原始值用于搜索
    sql_query := format('
      SELECT DISTINCT
        CASE 
          WHEN l.%I IS NULL OR l.%I = '''' THEN ''为空''
          ELSE 
            CASE 
              WHEN LENGTH(l.%I) = 11 THEN 
                LEFT(l.%I, 3) || ''****'' || RIGHT(l.%I, 4)
              ELSE l.%I
            END
        END as text,
        CASE 
          WHEN l.%I IS NULL OR l.%I = '''' THEN NULL
          ELSE l.%I::TEXT
        END as value,
        CASE 
          WHEN l.%I IS NULL OR l.%I = '''' THEN NULL
          ELSE l.%I::TEXT
        END as search_text
      FROM followups f
      LEFT JOIN leads l ON f.leadid = l.leadid
      WHERE 1=1
      ORDER BY text
    ', 
      field_name, field_name, field_name, field_name, field_name, field_name,
      field_name, field_name, field_name,
      field_name, field_name, field_name,
      field_name, field_name, field_name
    );
  ELSIF field_type = 'wechat' THEN
    -- 微信号字段：显示脱敏版本
    sql_query := format('
      SELECT DISTINCT
        CASE 
          WHEN l.%I IS NULL OR l.%I = '''' THEN ''为空''
          ELSE 
            CASE 
              WHEN LENGTH(l.%I) > 3 THEN 
                LEFT(l.%I, 2) || ''***'' || RIGHT(l.%I, 2)
              ELSE l.%I
            END
        END as text,
        CASE 
          WHEN l.%I IS NULL OR l.%I = '''' THEN NULL
          ELSE l.%I::TEXT
        END as value,
        CASE 
          WHEN l.%I IS NULL OR l.%I = '''' THEN NULL
          ELSE l.%I::TEXT
        END as search_text
      FROM followups f
      LEFT JOIN leads l ON f.leadid = l.leadid
      WHERE 1=1
      ORDER BY text
    ', 
      field_name, field_name, field_name, field_name, field_name, field_name,
      field_name, field_name, field_name,
      field_name, field_name, field_name,
      field_name, field_name, field_name
    );
  ELSIF field_type = 'user' THEN
    -- 用户字段：显示用户名，值为用户ID，需要关联users_profile表
    sql_query := format('
      SELECT DISTINCT
        CASE 
          WHEN f.%I IS NULL OR f.%I = 0 THEN ''未分配''
          ELSE COALESCE(up.%I, f.%I::TEXT)
        END as text,
        CASE 
          WHEN f.%I IS NULL OR f.%I = 0 THEN NULL
          ELSE f.%I::TEXT
        END as value,
        CASE 
          WHEN f.%I IS NULL OR f.%I = 0 THEN NULL
          ELSE COALESCE(up.%I, f.%I::TEXT)
        END as search_text
      FROM followups f
      LEFT JOIN users_profile up ON f.%I = up.id
      WHERE 1=1
      ORDER BY text
    ', 
      field_name, field_name, display_name, field_name,
      field_name, field_name, field_name,
      field_name, field_name, display_name, field_name,
      field_name, field_name, field_name,
      display_name, field_name, field_name
    );
  ELSIF p_field_name = 'majorcategory' THEN
    -- 跟进结果字段：返回一级选项
    sql_query := '
      SELECT DISTINCT
        CASE 
          WHEN f.majorcategory IS NULL OR f.majorcategory = '''' THEN ''为空''
          ELSE 
            CASE 
              WHEN f.majorcategory IN (''已预约'') THEN ''已预约''
              WHEN f.majorcategory IN (''房子未到期，提前了解'', ''多房源对比'', ''未到上海'', ''工作地点不确定'', ''价格原因'', ''位置原因'', ''户型原因'', ''短租'', ''其他'') THEN ''观望中''
              WHEN f.majorcategory IN (''房间太贵'', ''面积太小'', ''通勤太远'', ''房间无厨房'', ''到地铁站太远'', ''重客已签约'', ''其他'') THEN ''已流失''
              WHEN f.majorcategory IN (''电话空号'', ''微信号搜索不到'', ''好友申请不通过'', ''消息未回复'', ''电话不接'') THEN ''未触达''
              ELSE f.majorcategory
            END
        END as text,
        CASE 
          WHEN f.majorcategory IS NULL OR f.majorcategory = '''' THEN NULL
          ELSE 
            CASE 
              WHEN f.majorcategory IN (''已预约'') THEN ''已预约''
              WHEN f.majorcategory IN (''房子未到期，提前了解'', ''多房源对比'', ''未到上海'', ''工作地点不确定'', ''价格原因'', ''位置原因'', ''户型原因'', ''短租'', ''其他'') THEN ''观望中''
              WHEN f.majorcategory IN (''房间太贵'', ''面积太小'', ''通勤太远'', ''房间无厨房'', ''到地铁站太远'', ''重客已签约'', ''其他'') THEN ''已流失''
              WHEN f.majorcategory IN (''电话空号'', ''微信号搜索不到'', ''好友申请不通过'', ''消息未回复'', ''电话不接'') THEN ''未触达''
              ELSE f.majorcategory
            END
        END as value,
        CASE 
          WHEN f.majorcategory IS NULL OR f.majorcategory = '''' THEN NULL
          ELSE 
            CASE 
              WHEN f.majorcategory IN (''已预约'') THEN ''已预约''
              WHEN f.majorcategory IN (''房子未到期，提前了解'', ''多房源对比'', ''未到上海'', ''工作地点不确定'', ''价格原因'', ''位置原因'', ''户型原因'', ''短租'', ''其他'') THEN ''观望中''
              WHEN f.majorcategory IN (''房间太贵'', ''面积太小'', ''通勤太远'', ''房间无厨房'', ''到地铁站太远'', ''重客已签约'', ''其他'') THEN ''已流失''
              WHEN f.majorcategory IN (''电话空号'', ''微信号搜索不到'', ''好友申请不通过'', ''消息未回复'', ''电话不接'') THEN ''未触达''
              ELSE f.majorcategory
            END
        END as search_text
      FROM followups f
      WHERE 1=1
      ORDER BY text
    ';
  ELSE
    -- 普通字符串字段
    sql_query := format('
      SELECT DISTINCT
        CASE 
          WHEN f.%I IS NULL OR f.%I = '''' THEN ''为空''
          ELSE COALESCE(f.%I::TEXT, f.%I::TEXT)
        END as text,
        CASE 
          WHEN f.%I IS NULL OR f.%I = '''' THEN NULL
          ELSE f.%I::TEXT
        END as value,
        CASE 
          WHEN f.%I IS NULL OR f.%I = '''' THEN NULL
          ELSE f.%I::TEXT
        END as search_text
      FROM followups f
      WHERE 1=1
      ORDER BY text
    ', 
      field_name, field_name, field_name, field_name,
      field_name, field_name, field_name,
      field_name, field_name, field_name
    );
  END IF;
  
  -- 执行查询
  RETURN QUERY EXECUTE sql_query;
  
EXCEPTION
  WHEN OTHERS THEN
    RAISE EXCEPTION '获取筛选选项失败: %', SQLERRM;
END;
$$;


ALTER FUNCTION "public"."get_filter_options"("p_field_name" "text", "p_filters" "jsonb") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_filtered_live_stream_schedules_with_users"("p_date_range_start" "date" DEFAULT NULL::"date", "p_date_range_end" "date" DEFAULT NULL::"date", "p_time_slots" "text"[] DEFAULT NULL::"text"[], "p_statuses" "text"[] DEFAULT NULL::"text"[], "p_scoring_statuses" "text"[] DEFAULT NULL::"text"[], "p_score_min" numeric DEFAULT NULL::numeric, "p_score_max" numeric DEFAULT NULL::numeric, "p_lock_types" "text"[] DEFAULT NULL::"text"[], "p_participants" "text"[] DEFAULT NULL::"text"[], "p_scored_by" bigint[] DEFAULT NULL::bigint[], "p_created_by" bigint[] DEFAULT NULL::bigint[], "p_editing_by" bigint[] DEFAULT NULL::bigint[], "p_locations" "text"[] DEFAULT NULL::"text"[], "p_page" integer DEFAULT 1, "p_page_size" integer DEFAULT 10) RETURNS TABLE("id" bigint, "date" "date", "time_slot_id" "text", "participant_ids" bigint[], "participant_names" "text"[], "participant_emails" "text"[], "location" "text", "notes" "text", "status" "text", "created_by" bigint, "created_by_name" "text", "created_by_email" "text", "created_at" timestamp with time zone, "updated_at" timestamp with time zone, "editing_by" bigint, "editing_by_name" "text", "editing_by_email" "text", "editing_at" timestamp with time zone, "editing_expires_at" timestamp with time zone, "lock_type" "text", "lock_reason" "text", "lock_end_time" timestamp with time zone, "average_score" numeric, "scoring_data" "jsonb", "scoring_status" "text", "scored_by" bigint, "scored_by_name" "text", "scored_by_email" "text", "scored_at" timestamp with time zone, "total_count" bigint)
    LANGUAGE "plpgsql"
    AS $$
DECLARE
  v_query TEXT;
  v_where_conditions TEXT[] := ARRAY[]::TEXT[];
  v_offset INTEGER;
  v_limit INTEGER;
BEGIN
  -- 构建基础查询，使用JOIN获取用户信息
  v_query := '
    SELECT 
      lss.*,
      COUNT(*) OVER() as total_count,
      -- 参与人员信息
      ARRAY_AGG(DISTINCT up_participant.nickname) FILTER (WHERE up_participant.id IS NOT NULL) as participant_names,
      ARRAY_AGG(DISTINCT up_participant.email) FILTER (WHERE up_participant.id IS NOT NULL) as participant_emails,
      -- 创建人员信息
      up_created.nickname as created_by_name,
      up_created.email as created_by_email,
      -- 编辑人员信息
      up_editing.nickname as editing_by_name,
      up_editing.email as editing_by_email,
      -- 评分人员信息
      up_scored.nickname as scored_by_name,
      up_scored.email as scored_by_email
    FROM live_stream_schedules lss
    -- 参与人员JOIN
    LEFT JOIN LATERAL (
      SELECT unnest(lss.participant_ids) as participant_id
    ) participant_ids ON true
    LEFT JOIN users_profile up_participant ON up_participant.id = participant_ids.participant_id
    -- 创建人员JOIN
    LEFT JOIN users_profile up_created ON up_created.id = lss.created_by
    -- 编辑人员JOIN
    LEFT JOIN users_profile up_editing ON up_editing.id = lss.editing_by
    -- 评分人员JOIN
    LEFT JOIN users_profile up_scored ON up_scored.id = lss.scored_by
    WHERE 1=1';
  
  -- 日期范围筛选
  IF p_date_range_start IS NOT NULL THEN
    v_where_conditions := array_append(v_where_conditions, 'lss.date >= ' || quote_literal(p_date_range_start));
  END IF;
  
  IF p_date_range_end IS NOT NULL THEN
    v_where_conditions := array_append(v_where_conditions, 'lss.date <= ' || quote_literal(p_date_range_end));
  END IF;
  
  -- 时间段多选筛选
  IF p_time_slots IS NOT NULL AND array_length(p_time_slots, 1) > 0 THEN
    v_where_conditions := array_append(v_where_conditions, 'lss.time_slot_id = ANY(' || quote_literal(p_time_slots) || ')');
  END IF;
  
  -- 状态多选筛选
  IF p_statuses IS NOT NULL AND array_length(p_statuses, 1) > 0 THEN
    v_where_conditions := array_append(v_where_conditions, 'lss.status = ANY(' || quote_literal(p_statuses) || ')');
  END IF;
  
  -- 评分状态多选筛选
  IF p_scoring_statuses IS NOT NULL AND array_length(p_scoring_statuses, 1) > 0 THEN
    v_where_conditions := array_append(v_where_conditions, 'lss.scoring_status = ANY(' || quote_literal(p_scoring_statuses) || ')');
  END IF;
  
  -- 评分范围筛选
  IF p_score_min IS NOT NULL THEN
    v_where_conditions := array_append(v_where_conditions, 'lss.average_score >= ' || p_score_min);
  END IF;
  
  IF p_score_max IS NOT NULL THEN
    v_where_conditions := array_append(v_where_conditions, 'lss.average_score <= ' || p_score_max);
  END IF;
  
  -- 锁定类型多选筛选
  IF p_lock_types IS NOT NULL AND array_length(p_lock_types, 1) > 0 THEN
    v_where_conditions := array_append(v_where_conditions, 'lss.lock_type = ANY(' || quote_literal(p_lock_types) || ')');
  END IF;
  
  -- 评分人员筛选
  IF p_scored_by IS NOT NULL AND array_length(p_scored_by, 1) > 0 THEN
    v_where_conditions := array_append(v_where_conditions, 'lss.scored_by = ANY(' || quote_literal(p_scored_by) || ')');
  END IF;
  
  -- 创建人员筛选
  IF p_created_by IS NOT NULL AND array_length(p_created_by, 1) > 0 THEN
    v_where_conditions := array_append(v_where_conditions, 'lss.created_by = ANY(' || quote_literal(p_created_by) || ')');
  END IF;
  
  -- 编辑人员筛选
  IF p_editing_by IS NOT NULL AND array_length(p_editing_by, 1) > 0 THEN
    v_where_conditions := array_append(v_where_conditions, 'lss.editing_by = ANY(' || quote_literal(p_editing_by) || ')');
  END IF;
  
  -- 地点筛选
  IF p_locations IS NOT NULL AND array_length(p_locations, 1) > 0 THEN
    v_where_conditions := array_append(v_where_conditions, 'lss.location = ANY(' || quote_literal(p_locations) || ')');
  END IF;
  
  -- 参与人员筛选（支持模糊搜索）
  IF p_participants IS NOT NULL AND array_length(p_participants, 1) > 0 THEN
    v_where_conditions := array_append(v_where_conditions, '(
      up_participant.nickname ILIKE ANY(' || quote_literal(p_participants) || ') OR
      up_participant.email ILIKE ANY(' || quote_literal(p_participants) || ')
    )');
  END IF;
  
  -- 添加WHERE条件
  IF array_length(v_where_conditions, 1) > 0 THEN
    v_query := v_query || ' AND ' || array_to_string(v_where_conditions, ' AND ');
  END IF;
  
  -- 分组和排序
  v_query := v_query || ' GROUP BY lss.id, up_created.nickname, up_created.email, up_editing.nickname, up_editing.email, up_scored.nickname, up_scored.email';
  v_query := v_query || ' ORDER BY lss.date DESC, lss.time_slot_id';
  
  -- 分页
  v_offset := (p_page - 1) * p_page_size;
  v_limit := p_page_size;
  v_query := v_query || ' LIMIT ' || v_limit || ' OFFSET ' || v_offset;
  
  -- 执行查询
  RETURN QUERY EXECUTE v_query;
END;
$$;


ALTER FUNCTION "public"."get_filtered_live_stream_schedules_with_users"("p_date_range_start" "date", "p_date_range_end" "date", "p_time_slots" "text"[], "p_statuses" "text"[], "p_scoring_statuses" "text"[], "p_score_min" numeric, "p_score_max" numeric, "p_lock_types" "text"[], "p_participants" "text"[], "p_scored_by" bigint[], "p_created_by" bigint[], "p_editing_by" bigint[], "p_locations" "text"[], "p_page" integer, "p_page_size" integer) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_group_users"("group_id" bigint) RETURNS bigint[]
    LANGUAGE "plpgsql"
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


ALTER FUNCTION "public"."get_group_users"("group_id" bigint) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_managed_org_ids"("admin_id" "uuid") RETURNS TABLE("org_id" "uuid")
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
BEGIN
  RETURN QUERY
  WITH RECURSIVE org_hierarchy AS (
    -- 基础查询：找到用户直接管理的部门
    SELECT id
    FROM public.organizations
    WHERE admin = admin_id
    
    UNION ALL
    
    -- 递归查询：找到所有子部门
    SELECT o.id
    FROM public.organizations o
    JOIN org_hierarchy oh ON o.parent_id = oh.id
  )
  SELECT id FROM org_hierarchy;
END;
$$;


ALTER FUNCTION "public"."get_managed_org_ids"("admin_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_metrostations"() RETURNS TABLE("line" "text", "name" "text")
    LANGUAGE "plpgsql"
    AS $_$
BEGIN
  RETURN QUERY
  SELECT 
    ms.line,
    ms.name
  FROM public.metrostations ms
  ORDER BY 
    -- 按线路名称的自然排序，确保1号线、2号线、3号线等按顺序
    CASE 
      WHEN ms.line ~ '^[0-9]+号线$' THEN 
        -- 提取数字部分进行排序
        (regexp_replace(ms.line, '[^0-9]', '', 'g'))::integer
      ELSE 
        -- 非数字线路排在后面
        999999
    END,
    ms.line,
    -- 保持站点在数据库中的原有顺序（地理顺序），不按字母排序
    ms.id;
END;
$_$;


ALTER FUNCTION "public"."get_metrostations"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_schedule_logs"("p_schedule_id" bigint, "p_limit" integer DEFAULT 50) RETURNS TABLE("id" bigint, "operator_name" "text", "operation_time" timestamp with time zone, "participants" bigint[])
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  RETURN QUERY
  SELECT 
    l.id,
    l.operator_name,
    l.operation_time,
    l.participants
  FROM live_stream_schedule_logs l
  WHERE l.schedule_id = p_schedule_id
  ORDER BY l.operation_time DESC
  LIMIT p_limit;
END;
$$;


ALTER FUNCTION "public"."get_schedule_logs"("p_schedule_id" bigint, "p_limit" integer) OWNER TO "postgres";


COMMENT ON FUNCTION "public"."get_schedule_logs"("p_schedule_id" bigint, "p_limit" integer) IS '获取特定安排的操作日志';



CREATE OR REPLACE FUNCTION "public"."get_showings_count"("p_leadid" "text" DEFAULT NULL::"text", "p_community" "text"[] DEFAULT NULL::"text"[], "p_showingsales" bigint[] DEFAULT NULL::bigint[], "p_trueshowingsales" bigint[] DEFAULT NULL::bigint[], "p_interviewsales" bigint[] DEFAULT NULL::bigint[], "p_viewresult" "text"[] DEFAULT NULL::"text"[], "p_budget_min" integer DEFAULT NULL::integer, "p_budget_max" integer DEFAULT NULL::integer, "p_renttime_min" integer DEFAULT NULL::integer, "p_renttime_max" integer DEFAULT NULL::integer, "p_scheduletime_start" timestamp with time zone DEFAULT NULL::timestamp with time zone, "p_scheduletime_end" timestamp with time zone DEFAULT NULL::timestamp with time zone, "p_arrivaltime_start" timestamp with time zone DEFAULT NULL::timestamp with time zone, "p_arrivaltime_end" timestamp with time zone DEFAULT NULL::timestamp with time zone, "p_moveintime_start" timestamp with time zone DEFAULT NULL::timestamp with time zone, "p_moveintime_end" timestamp with time zone DEFAULT NULL::timestamp with time zone, "p_created_at_start" timestamp with time zone DEFAULT NULL::timestamp with time zone, "p_created_at_end" timestamp with time zone DEFAULT NULL::timestamp with time zone, "p_incomplete" boolean DEFAULT false) RETURNS integer
    LANGUAGE "plpgsql"
    AS $$
DECLARE
  count_result integer;
BEGIN
  SELECT COUNT(*)
  INTO count_result
  FROM showings s
  LEFT JOIN followups f ON s.leadid = f.leadid
  WHERE 
    (p_leadid IS NULL OR s.leadid = p_leadid)
    AND (p_community IS NULL OR s.community::TEXT = ANY(p_community))
    AND (p_showingsales IS NULL OR s.showingsales = ANY(p_showingsales))
    AND (p_trueshowingsales IS NULL OR s.trueshowingsales = ANY(p_trueshowingsales))
    AND (p_interviewsales IS NULL OR f.interviewsales_user_id = ANY(p_interviewsales))
    AND (p_viewresult IS NULL OR s.viewresult = ANY(p_viewresult))
    AND (p_budget_min IS NULL OR s.budget >= p_budget_min)
    AND (p_budget_max IS NULL OR s.budget <= p_budget_max)
    AND (p_renttime_min IS NULL OR s.renttime >= p_renttime_min)
    AND (p_renttime_max IS NULL OR s.renttime <= p_renttime_max)
    AND (p_scheduletime_start IS NULL OR s.scheduletime >= p_scheduletime_start)
    AND (p_scheduletime_end IS NULL OR s.scheduletime <= p_scheduletime_end)
    AND (p_arrivaltime_start IS NULL OR s.arrivaltime >= p_arrivaltime_start)
    AND (p_arrivaltime_end IS NULL OR s.arrivaltime <= p_arrivaltime_end)
    AND (p_moveintime_start IS NULL OR s.moveintime >= p_moveintime_start)
    AND (p_moveintime_end IS NULL OR s.moveintime <= p_moveintime_end)
    AND (p_created_at_start IS NULL OR s.created_at >= p_created_at_start)
    AND (p_created_at_end IS NULL OR s.created_at <= p_created_at_end)
    -- 新增未填写工单筛选
    AND (NOT p_incomplete OR s.viewresult IS NULL OR s.viewresult = '');
  
  RETURN count_result;
END;
$$;


ALTER FUNCTION "public"."get_showings_count"("p_leadid" "text", "p_community" "text"[], "p_showingsales" bigint[], "p_trueshowingsales" bigint[], "p_interviewsales" bigint[], "p_viewresult" "text"[], "p_budget_min" integer, "p_budget_max" integer, "p_renttime_min" integer, "p_renttime_max" integer, "p_scheduletime_start" timestamp with time zone, "p_scheduletime_end" timestamp with time zone, "p_arrivaltime_start" timestamp with time zone, "p_arrivaltime_end" timestamp with time zone, "p_moveintime_start" timestamp with time zone, "p_moveintime_end" timestamp with time zone, "p_created_at_start" timestamp with time zone, "p_created_at_end" timestamp with time zone, "p_incomplete" boolean) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_showings_viewresult_options"() RETURNS "text"[]
    LANGUAGE "plpgsql"
    AS $$
DECLARE
  v_results TEXT[];
BEGIN
  SELECT ARRAY_AGG(DISTINCT viewresult ORDER BY viewresult)
  INTO v_results
  FROM showings
  WHERE viewresult IS NOT NULL;
  
  RETURN COALESCE(v_results, ARRAY[]::TEXT[]);
END;
$$;


ALTER FUNCTION "public"."get_showings_viewresult_options"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_user_achievements"("p_user_id" bigint) RETURNS TABLE("achievement_id" "uuid", "code" "text", "name" "text", "description" "text", "category" "text", "icon" "text", "icon_type" "text", "icon_url" "text", "color" "text", "points_reward" integer, "avatar_frame_id" "uuid", "badge_id" "uuid", "progress" integer, "target" integer, "is_completed" boolean, "completed_at" timestamp with time zone, "points_earned" integer, "progress_percentage" numeric)
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
BEGIN
  RETURN QUERY
  SELECT 
    a.id as achievement_id,
    a.code,
    a.name,
    a.description,
    a.category,
    a.icon,
    a.icon_type,
    a.icon_url,
    a.color,
    a.points_reward,
    a.avatar_frame_id,
    a.badge_id,
    COALESCE(ua.progress, 0) as progress,
    COALESCE(ua.target, 1) as target,
    COALESCE(ua.is_completed, false) as is_completed,
    ua.completed_at,
    COALESCE(ua.points_earned, 0) as points_earned,
    CASE 
      WHEN ua.target > 0 THEN 
        ROUND((COALESCE(ua.progress, 0)::numeric / ua.target::numeric) * 100, 1)
      ELSE 0 
    END as progress_percentage
  FROM achievements a
  LEFT JOIN user_achievements ua ON a.id = ua.achievement_id AND ua.user_id = p_user_id
  WHERE a.is_active = true
  ORDER BY a.sort_order, a.name;
END;
$$;


ALTER FUNCTION "public"."get_user_achievements"("p_user_id" bigint) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_user_admin_organizations"() RETURNS "uuid"[]
    LANGUAGE "plpgsql"
    SET "search_path" TO ''
    AS $$
BEGIN
  RETURN ARRAY(
    SELECT id 
    FROM public.organizations
    WHERE admin = (select auth.uid())
  );
END;
$$;


ALTER FUNCTION "public"."get_user_admin_organizations"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_user_allocation_status"("p_user_id" bigint, "p_source" "text" DEFAULT NULL::"text", "p_leadtype" "text" DEFAULT NULL::"text", "p_community" "text" DEFAULT NULL::"text") RETURNS "jsonb"
    LANGUAGE "plpgsql"
    AS $$
declare
  user_group record;
  can_allocate boolean := false;
  reasons text[] := array[]::text[];
  filtered_users bigint[];
  group_config record;
  daily_assigned integer;
  pending_count integer;
  conversion_rate numeric;
  total_leads integer;
  converted_leads integer;
begin
  -- 查找用户所属销售组
  select * into user_group
  from users_list
  where list @> array[p_user_id];

  if user_group is null then
    return jsonb_build_object(
      'groupname', null,
      'can_allocate', false,
      'reason', array['未找到所属销售组']
    );
  end if;

  -- 获取组质量控制配置
  select
    enable_quality_control,
    daily_lead_limit,
    conversion_rate_requirement,
    max_pending_leads
  into group_config
  from users_list
  where id = user_group.id;

  -- 检查日线索量限制
  if group_config.daily_lead_limit is not null then
    select count(*) into daily_assigned
    from simple_allocation_logs
    where assigned_user_id = p_user_id
      and created_at >= current_date;
    if daily_assigned >= group_config.daily_lead_limit then
      reasons := reasons || format('今日已分配线索达到上限（%s/%s）', daily_assigned, group_config.daily_lead_limit);
    end if;
  end if;

  -- 检查未接受线索数量
  if group_config.max_pending_leads is not null then
    select count(*) into pending_count
    from followups
    where interviewsales_user_id = p_user_id
      and followupstage = '待接收';
    if pending_count > group_config.max_pending_leads then
      reasons := reasons || format('待接收线索数超限（%s/%s）', pending_count, group_config.max_pending_leads);
    end if;
  end if;

  -- 检查转化率
  if group_config.conversion_rate_requirement is not null then
    select
      count(*) as total_leads,
      count(*) filter (where followupstage in ('赢单')) as converted_leads
    into total_leads, converted_leads
    from followups
    where interviewsales_user_id = p_user_id
      and created_at >= current_date - interval '30 days';

    if total_leads >= 50 then
      conversion_rate := round((converted_leads::numeric / total_leads::numeric) * 100, 2);
    else
      conversion_rate := group_config.conversion_rate_requirement; -- 样本不足时视为通过
    end if;

    if conversion_rate < group_config.conversion_rate_requirement then
      reasons := reasons || format('转化率低于要求（当前%.2f%%，要求%.2f%%）', coalesce(conversion_rate,0), group_config.conversion_rate_requirement);
    end if;
  end if;

  -- 最终判断
  filtered_users := apply_allocation_filters(
    user_group.list,
    user_group.id,
    p_community::community,
    true,  -- 启用质量控制
    false, -- 禁用社区匹配
    false  -- 权限检查
  );

  if filtered_users is not null and array_position(filtered_users, p_user_id) is not null then
    can_allocate := true;
  else
    can_allocate := false;
    if array_length(reasons,1) is null then
      reasons := array['不满足销售组分配要求'];
    end if;
  end if;

  return jsonb_build_object(
    'groupname', user_group.groupname,
    'can_allocate', can_allocate,
    'reason', reasons
  );
end;
$$;


ALTER FUNCTION "public"."get_user_allocation_status"("p_user_id" bigint, "p_source" "text", "p_leadtype" "text", "p_community" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_user_allocation_status_multi"("p_user_id" bigint, "p_source" "text" DEFAULT NULL::"text", "p_leadtype" "text" DEFAULT NULL::"text", "p_community" "text" DEFAULT NULL::"text") RETURNS "jsonb"
    LANGUAGE "plpgsql"
    AS $$
declare
  group_row record;
  result jsonb := '[]'::jsonb;
begin
  for group_row in
    select id from users_list where list @> array[p_user_id]
  loop
    result := result || check_user_group_status(
      p_user_id, group_row.id, p_source, p_leadtype, p_community
    );
  end loop;
  return result;
end;
$$;


ALTER FUNCTION "public"."get_user_allocation_status_multi"("p_user_id" bigint, "p_source" "text", "p_leadtype" "text", "p_community" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_user_announcements"("p_user_id" bigint) RETURNS TABLE("id" "uuid", "title" "text", "content" "text", "type" "text", "priority" integer, "target_roles" "text"[], "target_organizations" "uuid"[], "is_active" boolean, "start_time" timestamp with time zone, "end_time" timestamp with time zone, "created_by" bigint, "created_at" timestamp with time zone, "is_read" boolean)
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
BEGIN
  RETURN QUERY
  SELECT 
    a.id,
    a.title,
    a.content,
    a.type,
    a.priority,
    a.target_roles,
    a.target_organizations,
    a.is_active,
    a.start_time,
    a.end_time,
    a.created_by,
    a.created_at,
    ar.id IS NOT NULL as is_read
  FROM announcements a
  LEFT JOIN announcement_reads ar ON a.id = ar.announcement_id AND ar.user_id = p_user_id
  WHERE a.is_active = true 
    AND a.start_time <= now() 
    AND (a.end_time IS NULL OR a.end_time > now())
  ORDER BY a.priority DESC, a.created_at DESC;
END;
$$;


ALTER FUNCTION "public"."get_user_announcements"("p_user_id" bigint) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_user_approval_statistics"("p_user_id" bigint) RETURNS TABLE("total_pending" bigint, "total_approved" bigint, "total_rejected" bigint, "avg_response_time_minutes" numeric)
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  RETURN QUERY
  SELECT 
    COUNT(*) FILTER (WHERE status = 'pending') as total_pending,
    COUNT(*) FILTER (WHERE status = 'approved') as total_approved,
    COUNT(*) FILTER (WHERE status = 'rejected') as total_rejected,
    AVG(EXTRACT(EPOCH FROM (action_time - created_at)) / 60) FILTER (WHERE action_time IS NOT NULL) as avg_response_time_minutes
  FROM approval_steps s
  JOIN approval_instances i ON s.instance_id = i.id
  WHERE s.approver_id = p_user_id;
END;
$$;


ALTER FUNCTION "public"."get_user_approval_statistics"("p_user_id" bigint) OWNER TO "postgres";


COMMENT ON FUNCTION "public"."get_user_approval_statistics"("p_user_id" bigint) IS '获取用户审批统计信息';



CREATE OR REPLACE FUNCTION "public"."get_user_avatar_frames"("p_user_id" bigint) RETURNS TABLE("frame_id" "uuid", "name" "text", "description" "text", "frame_type" "text", "frame_data" "jsonb", "rarity" "text", "icon_url" "text", "is_equipped" boolean, "unlocked_at" timestamp with time zone)
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
BEGIN
  RETURN QUERY
  SELECT 
    af.id as frame_id,
    af.name,
    af.description,
    af.frame_type,
    af.frame_data,
    af.rarity,
    af.icon_url,         -- 新增
    uaf.is_equipped,
    uaf.unlocked_at
  FROM avatar_frames af
  INNER JOIN user_avatar_frames uaf ON af.id = uaf.frame_id
  WHERE uaf.user_id = p_user_id AND af.is_active = true
  ORDER BY af.sort_order, af.name;
END;
$$;


ALTER FUNCTION "public"."get_user_avatar_frames"("p_user_id" bigint) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_user_badges"("p_user_id" bigint) RETURNS TABLE("badge_id" "uuid", "name" "text", "description" "text", "icon" "text", "icon_type" "text", "icon_url" "text", "color" "text", "rarity" "text", "is_equipped" boolean, "unlocked_at" timestamp with time zone)
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
BEGIN
  RETURN QUERY
  SELECT 
    b.id as badge_id,
    b.name,
    b.description,
    b.icon,
    b.icon_type,
    b.icon_url,
    b.color,
    b.rarity,
    ub.is_equipped,
    ub.unlocked_at
  FROM badges b
  INNER JOIN user_badges ub ON b.id = ub.badge_id
  WHERE ub.user_id = p_user_id AND b.is_active = true
  ORDER BY b.sort_order, b.name;
END;
$$;


ALTER FUNCTION "public"."get_user_badges"("p_user_id" bigint) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_user_notifications"("p_user_id" bigint) RETURNS TABLE("id" "uuid", "user_id" bigint, "type" "text", "title" "text", "content" "text", "metadata" "jsonb", "status" "text", "priority" integer, "expires_at" timestamp with time zone, "created_at" timestamp with time zone, "read_at" timestamp with time zone, "handled_at" timestamp with time zone)
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
BEGIN
  RETURN QUERY
  SELECT 
    n.id,
    n.user_id,
    n.type,
    n.title,
    n.content,
    n.metadata,
    n.status,
    n.priority,
    n.expires_at,
    n.created_at,
    n.read_at,
    n.handled_at
  FROM notifications n
  WHERE n.user_id = p_user_id
  ORDER BY n.created_at DESC;
END;
$$;


ALTER FUNCTION "public"."get_user_notifications"("p_user_id" bigint) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_user_permissions"("p_user_id" "uuid") RETURNS TABLE("permission_id" "uuid", "permission_name" "text", "permission_description" "text", "resource" "text", "action" "text")
    LANGUAGE "plpgsql"
    SET "search_path" TO ''
    AS $$
BEGIN
    RETURN QUERY
    SELECT DISTINCT
        p.id AS permission_id,
        p.name AS permission_name,
        p.description AS permission_description,
        p.resource,
        p.action
    FROM
        public.permissions p
    JOIN
        public.role_permissions rp ON p.id = rp.permission_id
    JOIN
        public.user_roles ur ON rp.role_id = ur.role_id
    WHERE
        ur.user_id = p_user_id;
END;
$$;


ALTER FUNCTION "public"."get_user_permissions"("p_user_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_user_pivot_configs"("p_user_id" "text" DEFAULT NULL::"text") RETURNS TABLE("id" "uuid", "name" "text", "description" "text", "config" "jsonb", "data_source" "text", "created_by" "text", "is_public" boolean, "created_at" timestamp with time zone, "updated_at" timestamp with time zone)
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  IF p_user_id IS NULL THEN
    SELECT auth.uid()::text INTO p_user_id;
  END IF;
  
  RETURN QUERY
  SELECT 
    c.id,
    c.name,
    c.description,
    c.config,
    c.data_source,
    c.created_by,
    c.is_public,
    c.created_at,
    c.updated_at
  FROM bi_pivot_configs c
  WHERE c.created_by = p_user_id OR c.is_public = true
  ORDER BY c.created_at DESC;
END;
$$;


ALTER FUNCTION "public"."get_user_pivot_configs"("p_user_id" "text") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."get_user_pivot_configs"("p_user_id" "text") IS '获取用户透视表配置';



CREATE OR REPLACE FUNCTION "public"."get_user_points_info"("p_user_id" bigint) RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
  v_wallet_info JSONB;
  v_recent_transactions JSONB;
  v_result JSONB;
BEGIN
  -- 获取钱包信息
  SELECT jsonb_build_object(
    'total_points', total_points,
    'total_earned_points', total_earned_points,
    'total_consumed_points', total_consumed_points,
    'updated_at', updated_at
  )
  INTO v_wallet_info
  FROM user_points_wallet
  WHERE user_id = p_user_id;

  -- 获取最近交易记录（修复 ORDER BY 问题）
  SELECT jsonb_agg(
    jsonb_build_object(
      'id', t.id,
      'points_change', t.points_change,
      'balance_after', t.balance_after,
      'transaction_type', t.transaction_type,
      'source_type', t.source_type,
      'description', t.description,
      'created_at', t.created_at
    ) ORDER BY t.created_at DESC
  )
  INTO v_recent_transactions
  FROM (
    SELECT 
      id,
      points_change,
      balance_after,
      transaction_type,
      source_type,
      description,
      created_at
    FROM user_points_transactions
    WHERE user_id = p_user_id
    ORDER BY created_at DESC
    LIMIT 10
  ) t;

  v_result := jsonb_build_object(
    'wallet', COALESCE(v_wallet_info, '{}'::jsonb),
    'recent_transactions', COALESCE(v_recent_transactions, '[]'::jsonb)
  );

  RETURN v_result;
END;
$$;


ALTER FUNCTION "public"."get_user_points_info"("p_user_id" bigint) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_user_roles"("p_user_id" "uuid") RETURNS TABLE("role_id" "uuid", "role_name" "text", "role_description" "text")
    LANGUAGE "plpgsql"
    SET "search_path" TO ''
    AS $$
BEGIN
    RETURN QUERY
    SELECT
        r.id AS role_id,
        r.name AS role_name,
        r.description AS role_description
    FROM
        public.roles r
    JOIN
        public.user_roles ur ON r.id = ur.role_id
    WHERE
        ur.user_id = p_user_id;
END;
$$;


ALTER FUNCTION "public"."get_user_roles"("p_user_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_users_by_permission"("permission" "text") RETURNS TABLE("id" bigint)
    LANGUAGE "sql"
    AS $$
SELECT up.id
FROM users_profile up
JOIN user_roles ur ON ur.user_id = up.user_id
JOIN role_permissions rp ON rp.role_id = ur.role_id
JOIN permissions p ON p.id = rp.permission_id
WHERE p.name = permission
  AND up.status = 'active';
$$;


ALTER FUNCTION "public"."get_users_by_permission"("permission" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."group_count_filter_followups"("p_groupby_field" "text", "p_leadid" "text"[] DEFAULT NULL::"text"[], "p_leadtype" "text"[] DEFAULT NULL::"text"[], "p_interviewsales_user_id" bigint[] DEFAULT NULL::bigint[], "p_followupstage" "public"."followupstage"[] DEFAULT NULL::"public"."followupstage"[], "p_customerprofile" "public"."customerprofile"[] DEFAULT NULL::"public"."customerprofile"[], "p_worklocation" "text"[] DEFAULT NULL::"text"[], "p_userbudget" "text"[] DEFAULT NULL::"text"[], "p_moveintime_start" timestamp with time zone DEFAULT NULL::timestamp with time zone, "p_moveintime_end" timestamp with time zone DEFAULT NULL::timestamp with time zone, "p_userrating" "public"."userrating"[] DEFAULT NULL::"public"."userrating"[], "p_majorcategory" "text"[] DEFAULT NULL::"text"[], "p_subcategory" "text"[] DEFAULT NULL::"text"[], "p_followupresult" "text"[] DEFAULT NULL::"text"[], "p_scheduletime_start" timestamp with time zone DEFAULT NULL::timestamp with time zone, "p_scheduletime_end" timestamp with time zone DEFAULT NULL::timestamp with time zone, "p_scheduledcommunity" "public"."community"[] DEFAULT NULL::"public"."community"[], "p_keyword" "text" DEFAULT NULL::"text", "p_wechat" "text"[] DEFAULT NULL::"text"[], "p_phone" "text"[] DEFAULT NULL::"text"[], "p_source" "public"."source"[] DEFAULT NULL::"public"."source"[], "p_created_at_start" timestamp with time zone DEFAULT NULL::timestamp with time zone, "p_created_at_end" timestamp with time zone DEFAULT NULL::timestamp with time zone, "p_remark" "text" DEFAULT NULL::"text", "p_showingsales_user" bigint[] DEFAULT NULL::bigint[]) RETURNS TABLE("group_id" "text", "group_value" "text", "count" bigint)
    LANGUAGE "plpgsql"
    AS $_$DECLARE
    query_text text;
    where_conditions text := '';
    group_by_clause text;
    select_clause text;
    join_clause text;
BEGIN
    -- 添加与users_profile表和showings表的连接，并关联showing.showingsales与users_profile
    join_clause := 'LEFT JOIN public.leads l ON f.leadid = l.leadid 
                   LEFT JOIN public.users_profile up ON f.interviewsales_user_id = up.id
                   LEFT JOIN public.showings s ON f.leadid = s.leadid
                   LEFT JOIN public.users_profile up_showing ON s.showingsales = up_showing.id';
    
    -- Build WHERE conditions based on parameters
    IF p_leadid IS NOT NULL THEN
        where_conditions := where_conditions || ' AND f.leadid = ANY($1)';
    END IF;
    IF p_leadtype IS NOT NULL THEN
        where_conditions := where_conditions || ' AND f.leadtype = ANY($2)';
    END IF;
    IF p_interviewsales_user_id IS NOT NULL THEN
        where_conditions := where_conditions || ' AND f.interviewsales_user_id = ANY($3)';
    END IF;
    IF p_followupstage IS NOT NULL THEN
        where_conditions := where_conditions || ' AND f.followupstage = ANY($4)';
    END IF;
    IF p_customerprofile IS NOT NULL THEN
        where_conditions := where_conditions || ' AND f.customerprofile = ANY($5)';
    END IF;
    IF p_worklocation IS NOT NULL THEN
        where_conditions := where_conditions || ' AND f.worklocation = ANY($6)';
    END IF;
    IF p_userbudget IS NOT NULL THEN
        where_conditions := where_conditions || ' AND f.userbudget = ANY($7)';
    END IF;
    IF p_moveintime_start IS NOT NULL THEN
        where_conditions := where_conditions || ' AND f.moveintime >= $8';
    END IF;
    IF p_moveintime_end IS NOT NULL THEN
        where_conditions := where_conditions || ' AND f.moveintime <= $9';
    END IF;
    IF p_userrating IS NOT NULL THEN
        where_conditions := where_conditions || ' AND f.userrating = ANY($10)';
    END IF;
    IF p_majorcategory IS NOT NULL THEN
        where_conditions := where_conditions || ' AND f.majorcategory = ANY($11)';
    END IF;
    IF p_followupresult IS NOT NULL THEN
        where_conditions := where_conditions || ' AND f.followupresult = ANY($13)';
    END IF;
    IF p_scheduletime_start IS NOT NULL THEN
        where_conditions := where_conditions || ' AND f.scheduletime >= $14';
    END IF;
    IF p_scheduletime_end IS NOT NULL THEN
        where_conditions := where_conditions || ' AND f.scheduletime <= $15';
    END IF;
    IF p_scheduledcommunity IS NOT NULL AND array_length(p_scheduledcommunity, 1) > 0 THEN
        where_conditions := where_conditions || ' AND f.scheduledcommunity = ANY($16)';
    END IF;
    
    -- 修改keyword搜索，使用up.nickname替代f.interviewsales
    IF p_keyword IS NOT NULL THEN
        where_conditions := where_conditions || ' AND (f.leadid::text ILIKE ''%'' || $17 || ''%'' OR 
                                                     f.leadtype ILIKE ''%'' || $17 || ''%'' OR 
                                                     up.nickname ILIKE ''%'' || $17 || ''%'' OR 
                                                     up_showing.nickname ILIKE ''%'' || $17 || ''%'' OR
                                                     f.worklocation ILIKE ''%'' || $17 || ''%'' OR 
                                                     f.userbudget ILIKE ''%'' || $17 || ''%'' OR 
                                                     f.majorcategory ILIKE ''%'' || $17 || ''%'' OR 
                                                     f.followupresult ILIKE ''%'' || $17 || ''%'' OR
                                                     l.phone ILIKE ''%'' || $17 || ''%'' OR
                                                     l.wechat ILIKE ''%'' || $17 || ''%'')';
    END IF;
    IF p_wechat IS NOT NULL THEN
        where_conditions := where_conditions || ' AND l.wechat = ANY($18)';
    END IF;
    IF p_phone IS NOT NULL THEN
        where_conditions := where_conditions || ' AND l.phone = ANY($19)';
    END IF;
    IF p_source IS NOT NULL THEN
        where_conditions := where_conditions || ' AND l.source = ANY($20)';
    END IF;
    IF p_created_at_start IS NOT NULL THEN
        where_conditions := where_conditions || ' AND f.created_at >= $21';
    END IF;
    IF p_created_at_end IS NOT NULL THEN
        where_conditions := where_conditions || ' AND f.created_at <= $22';
    END IF;
    IF p_remark IS NOT NULL THEN
        where_conditions := where_conditions || ' AND l.remark ILIKE ''%'' || $23 || ''%''';
    END IF;
    
    -- 添加showingsales_user过滤条件
    IF p_showingsales_user IS NOT NULL THEN
        where_conditions := where_conditions || ' AND s.showingsales = ANY($24)';
    END IF;
    
    -- Remove the leading ' AND ' if there are conditions
    IF length(where_conditions) > 0 THEN
        where_conditions := ' WHERE ' || substring(where_conditions from 6);
    END IF;
    
    -- 修改SELECT和GROUP BY子句，处理不同字段类型，同时返回ID和文本值
    CASE p_groupby_field
        WHEN 'leadtype' THEN
            select_clause := 'f.leadtype::text as group_id, COALESCE(f.leadtype, ''未分组'')::text as group_value';
            group_by_clause := 'f.leadtype';
        WHEN 'interviewsales' THEN
            select_clause := 'f.interviewsales_user_id::text as group_id, COALESCE(up.nickname, ''未分组'')::text as group_value';
            group_by_clause := 'f.interviewsales_user_id, up.nickname';
        WHEN 'interviewsales_user_id' THEN
            select_clause := 'f.interviewsales_user_id::text as group_id, COALESCE(up.nickname, ''未分组'')::text as group_value';
            group_by_clause := 'f.interviewsales_user_id, up.nickname';
        WHEN 'followupstage' THEN
            select_clause := 'f.followupstage::text as group_id, COALESCE(f.followupstage::text, ''未分组'') as group_value';
            group_by_clause := 'f.followupstage';
        WHEN 'customerprofile' THEN
            select_clause := 'f.customerprofile::text as group_id, COALESCE(f.customerprofile::text, ''未分组'') as group_value';
            group_by_clause := 'f.customerprofile';
        WHEN 'worklocation' THEN
            select_clause := 'f.worklocation::text as group_id, COALESCE(f.worklocation, ''未分组'')::text as group_value';
            group_by_clause := 'f.worklocation';
        WHEN 'userbudget' THEN
            select_clause := 'f.userbudget::text as group_id, COALESCE(f.userbudget, ''未分组'')::text as group_value';
            group_by_clause := 'f.userbudget';
        WHEN 'userrating' THEN
            select_clause := 'f.userrating::text as group_id, COALESCE(f.userrating::text, ''未分组'') as group_value';
            group_by_clause := 'f.userrating';
        WHEN 'majorcategory' THEN
            select_clause := 'f.majorcategory::text as group_id, COALESCE(f.majorcategory, ''未分组'')::text as group_value';
            group_by_clause := 'f.majorcategory';
        WHEN 'followupresult' THEN
            select_clause := 'f.followupresult::text as group_id, COALESCE(f.followupresult, ''未分组'')::text as group_value';
            group_by_clause := 'f.followupresult';
        WHEN 'scheduledcommunity' THEN
            select_clause := 'f.scheduledcommunity::text as group_id, COALESCE(f.scheduledcommunity::text, ''未分组'') as group_value';
            group_by_clause := 'f.scheduledcommunity';
        WHEN 'source' THEN
            select_clause := 'l.source::text as group_id, COALESCE(l.source::text, ''未分组'') as group_value';
            group_by_clause := 'l.source';
        WHEN 'created_at' THEN
            select_clause := 'DATE(f.created_at)::text as group_id, COALESCE(DATE(f.created_at)::text, ''未分组'') as group_value';
            group_by_clause := 'DATE(f.created_at)';
        WHEN 'showingsales' THEN
            select_clause := 's.showingsales::text as group_id, COALESCE(up_showing.nickname, ''未分组'')::text as group_value';
            group_by_clause := 's.showingsales, up_showing.nickname';
        WHEN 'remark' THEN
            select_clause := 'l.remark::text as group_id, COALESCE(l.remark, ''未分组'')::text as group_value';
            group_by_clause := 'l.remark';
        WHEN 'phone' THEN
            select_clause := 'l.phone::text as group_id, COALESCE(l.phone, ''未分组'')::text as group_value';
            group_by_clause := 'l.phone';
        WHEN 'wechat' THEN
            select_clause := 'l.wechat::text as group_id, COALESCE(l.wechat, ''未分组'')::text as group_value';
            group_by_clause := 'l.wechat';
        ELSE
            -- 检查是否是interviewsales_user或showingsales_user相关字段
            IF p_groupby_field = 'interviewsales_user' THEN
                select_clause := 'f.interviewsales_user_id::text as group_id, COALESCE(up.nickname, ''未分组'')::text as group_value';
                group_by_clause := 'f.interviewsales_user_id, up.nickname';
            ELSIF p_groupby_field = 'showingsales_user' THEN
                select_clause := 's.showingsales::text as group_id, COALESCE(up_showing.nickname, ''未分组'')::text as group_value';
                group_by_clause := 's.showingsales, up_showing.nickname';
            ELSE
                -- 对于其他未知字段，默认从 followups 表查找
                select_clause := 'f.' || p_groupby_field || '::text as group_id, COALESCE(f.' || p_groupby_field || '::text, ''未分组'') as group_value';
                group_by_clause := 'f.' || p_groupby_field;
            END IF;
    END CASE;
    
    -- 构建并执行动态查询
    query_text := 'SELECT ' || select_clause || ', COUNT(*)::bigint as count 
                  FROM public.followups f ' || join_clause || ' ' || where_conditions || 
                  ' GROUP BY ' || group_by_clause || 
                  ' ORDER BY ' || 
                  CASE WHEN p_groupby_field = 'created_at' THEN 'group_value' ELSE 'count DESC' END;
    
    RETURN QUERY EXECUTE query_text
    USING p_leadid, p_leadtype, p_interviewsales_user_id, p_followupstage, p_customerprofile,
          p_worklocation, p_userbudget, p_moveintime_start, p_moveintime_end, p_userrating,
          p_majorcategory, p_followupresult, p_scheduletime_start, p_scheduletime_end,
          p_scheduledcommunity, p_keyword, p_wechat, p_phone, p_source,
          p_created_at_start, p_created_at_end, p_remark, p_showingsales_user;
END;$_$;


ALTER FUNCTION "public"."group_count_filter_followups"("p_groupby_field" "text", "p_leadid" "text"[], "p_leadtype" "text"[], "p_interviewsales_user_id" bigint[], "p_followupstage" "public"."followupstage"[], "p_customerprofile" "public"."customerprofile"[], "p_worklocation" "text"[], "p_userbudget" "text"[], "p_moveintime_start" timestamp with time zone, "p_moveintime_end" timestamp with time zone, "p_userrating" "public"."userrating"[], "p_majorcategory" "text"[], "p_subcategory" "text"[], "p_followupresult" "text"[], "p_scheduletime_start" timestamp with time zone, "p_scheduletime_end" timestamp with time zone, "p_scheduledcommunity" "public"."community"[], "p_keyword" "text", "p_wechat" "text"[], "p_phone" "text"[], "p_source" "public"."source"[], "p_created_at_start" timestamp with time zone, "p_created_at_end" timestamp with time zone, "p_remark" "text", "p_showingsales_user" bigint[]) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."has_permission"("resource" "text", "action" "text") RETURNS boolean
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
  result BOOLEAN;
  res_name ALIAS FOR resource;
  act_name ALIAS FOR action;
BEGIN
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles ur
    JOIN public.role_permissions rp ON ur.role_id = rp.role_id
    JOIN public.permissions p ON rp.permission_id = p.id
    WHERE ur.user_id = auth.uid()
    AND p.resource = res_name
    AND p.action = act_name
  ) INTO result;
  
  RETURN result;
END;
$$;


ALTER FUNCTION "public"."has_permission"("resource" "text", "action" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."has_role"("role_name" "text") RETURNS boolean
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
  result BOOLEAN;
BEGIN
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles ur
    JOIN public.roles r ON ur.role_id = r.id
    WHERE ur.user_id = auth.uid()
    AND r.name = role_name
  ) INTO result;
  
  RETURN result;
END;
$$;


ALTER FUNCTION "public"."has_role"("role_name" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."insert_user_points_transaction"("p_created_by" bigint, "p_description" "text", "p_points_change" integer, "p_source_id" "text", "p_source_type" character varying, "p_transaction_type" character varying, "p_user_id" bigint) RETURNS "void"
    LANGUAGE "plpgsql"
    AS $$
DECLARE
  last_balance integer;
BEGIN
  SELECT balance_after INTO last_balance
  FROM user_points_transactions
  WHERE user_id = p_user_id
  ORDER BY created_at DESC, id DESC
  LIMIT 1;

  INSERT INTO user_points_transactions (
    user_id, points_change, balance_after, transaction_type, source_type, source_id, description, created_at, created_by
  ) VALUES (
    p_user_id,
    p_points_change,
    COALESCE(last_balance, 0) + p_points_change,
    p_transaction_type,
    p_source_type,
    p_source_id,
    p_description,
    NOW(),
    p_created_by
  );
END;
$$;


ALTER FUNCTION "public"."insert_user_points_transaction"("p_created_by" bigint, "p_description" "text", "p_points_change" integer, "p_source_id" "text", "p_source_type" character varying, "p_transaction_type" character varying, "p_user_id" bigint) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."is_organization_admin"("org_id" "uuid") RETURNS boolean
    LANGUAGE "plpgsql"
    SET "search_path" TO ''
    AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 
    FROM public.organizations
    WHERE id = org_id 
    AND admin = (select auth.uid())
  );
END;
$$;


ALTER FUNCTION "public"."is_organization_admin"("org_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."issue_exchange_reward"("p_user_id" bigint, "p_goods_category" "text", "p_goods_name" "text", "p_description" "text" DEFAULT NULL::"text") RETURNS "jsonb"
    LANGUAGE "plpgsql"
    AS $$
DECLARE
  result jsonb;
  v_community community;
  v_reward_issued boolean := false;
  v_reward_type text;
  v_reward_description text;
BEGIN
  -- 根据商品类型发放不同奖励
  CASE p_goods_category
    WHEN 'LEAD' THEN
      -- 发放带看直通卡
      v_reward_type := 'direct';
      v_reward_description := '兑换奖励：' || COALESCE(p_description, p_goods_name);
      
      -- 获取用户默认社区（这里可以根据业务逻辑调整）
      SELECT community INTO v_community
      FROM users_profile
      WHERE id = p_user_id;
      
      -- 如果没有社区信息，使用默认社区
      IF v_community IS NULL THEN
        v_community := 'DOWNTON'::community; -- 默认社区
      END IF;
      
      -- 发放直通卡（通过issue-direct-card函数，确保发放给组长）
      -- 注意：这里需要先获取兑换记录ID，然后调用issue-direct-card函数
      -- 由于数据库函数无法直接调用HTTP函数，我们需要在应用层处理
      -- 暂时保持原有逻辑，在应用层调用issue-direct-card
      INSERT INTO public.showings_queue_record (
        user_id,
        community,
        queue_type,
        created_at,
        consumed,
        consumed_at,
        remark
      ) VALUES (
        p_user_id,
        v_community,
        v_reward_type,
        now(),
        false,
        null,
        v_reward_description
      );
      v_reward_issued := true;
      
    WHEN 'GIFT' THEN
      -- 发放礼品（可以扩展为其他奖励类型）
      v_reward_type := 'gift';
      v_reward_description := '兑换奖励：' || COALESCE(p_description, p_goods_name);
      v_reward_issued := true;
      
    WHEN 'PRIVILEGE' THEN
      -- 发放特权（可以扩展为其他奖励类型）
      v_reward_type := 'privilege';
      v_reward_description := '兑换奖励：' || COALESCE(p_description, p_goods_name);
      v_reward_issued := true;
      
    WHEN 'ACHIEVEMENT' THEN
      -- 发放成就（可以扩展为其他奖励类型）
      v_reward_type := 'achievement';
      v_reward_description := '兑换奖励：' || COALESCE(p_description, p_goods_name);
      v_reward_issued := true;
      
    ELSE
      -- 未知类型，不发放奖励
      v_reward_type := 'unknown';
      v_reward_issued := false;
  END CASE;
  
  -- 构建返回结果
  result := jsonb_build_object(
    'success', v_reward_issued,
    'reward_type', v_reward_type,
    'reward_description', v_reward_description,
    'community', v_community,
    'message', CASE 
      WHEN v_reward_issued THEN '奖励发放成功'
      ELSE '该商品类型暂不支持自动发放奖励'
    END
  );
  
  RETURN result;
END;
$$;


ALTER FUNCTION "public"."issue_exchange_reward"("p_user_id" bigint, "p_goods_category" "text", "p_goods_name" "text", "p_description" "text") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."issue_exchange_reward"("p_user_id" bigint, "p_goods_category" "text", "p_goods_name" "text", "p_description" "text") IS '根据兑换商品类型自动发放相应奖励，如带看直通卡、礼品等';



CREATE OR REPLACE FUNCTION "public"."jsonb_to_bigint_array"("jsonb") RETURNS bigint[]
    LANGUAGE "plpgsql"
    AS $_$
        DECLARE
            result bigint[];
            item jsonb;
        BEGIN
            result := ARRAY[]::bigint[];
            FOR item IN SELECT jsonb_array_elements($1)
            LOOP
                result := array_append(result, (item#>>'{}')::bigint);
            END LOOP;
            RETURN result;
        END;
        $_$;


ALTER FUNCTION "public"."jsonb_to_bigint_array"("jsonb") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."log_schedule_change"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
  v_user_id bigint;
  v_user_name text;
  v_auth_user_id uuid;
BEGIN
  -- 只处理插入和更新操作，跳过删除操作
  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;
  
  -- 获取当前用户信息
  v_user_id := current_setting('app.current_user_id', true)::bigint;
  
  IF v_user_id IS NULL THEN
    -- 获取认证用户ID（UUID类型）
    v_auth_user_id := auth.uid();
    
    -- 从users_profile表获取对应的bigint ID
    IF v_auth_user_id IS NOT NULL THEN
      SELECT id INTO v_user_id 
      FROM users_profile 
      WHERE user_id = v_auth_user_id;
    END IF;
  END IF;
  
  -- 获取用户昵称
  SELECT nickname INTO v_user_name 
  FROM users_profile 
  WHERE id = v_user_id;
  
  IF v_user_name IS NULL THEN
    v_user_name := '未知用户';
  END IF;
  
  -- 插入日志记录（只对插入和更新操作）
  INSERT INTO live_stream_schedule_logs (
    schedule_id,
    operator_id,
    operator_name,
    operation_time,
    participants
  ) VALUES (
    NEW.id,
    v_user_id,
    v_user_name,
    now(),
    NEW.participant_ids
  );
  
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."log_schedule_change"() OWNER TO "postgres";


COMMENT ON FUNCTION "public"."log_schedule_change"() IS '记录直播安排变更的触发器函数';



CREATE OR REPLACE FUNCTION "public"."manual_sync_all_users_profile"() RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
    auth_user RECORD;
BEGIN
    RAISE LOG 'Starting manual sync of all users profile...';
    
    -- 同步所有已确认邮箱的用户
    UPDATE public.users_profile
    SET
        nickname = COALESCE(auth_users.raw_user_meta_data->>'name', users_profile.nickname),
        user_id = auth_users.id,
        organization_id = COALESCE(
            (auth_users.raw_user_meta_data->>'organization_id')::uuid, 
            users_profile.organization_id
        ),
        status = CASE 
            WHEN users_profile.status = 'invited' THEN 'active'
            ELSE users_profile.status
        END,
        updated_at = NOW()
    FROM auth.users auth_users
    WHERE users_profile.email = auth_users.email
        AND auth_users.email_confirmed_at IS NOT NULL
        AND users_profile.user_id IS NULL;
    
    -- 为没有profile的已注册用户创建profile
    INSERT INTO public.users_profile (
        user_id,
        email,
        nickname,
        status,
        organization_id,
        created_at,
        updated_at
    )
    SELECT
        auth_users.id,
        auth_users.email,
        COALESCE(auth_users.raw_user_meta_data->>'name', split_part(auth_users.email, '@', 1)),
        'active',
        (auth_users.raw_user_meta_data->>'organization_id')::uuid,
        NOW(),
        NOW()
    FROM auth.users auth_users
    LEFT JOIN public.users_profile ON users_profile.email = auth_users.email
    WHERE auth_users.email_confirmed_at IS NOT NULL
        AND users_profile.email IS NULL;
    
    RAISE LOG 'Manual sync completed';
END;
$$;


ALTER FUNCTION "public"."manual_sync_all_users_profile"() OWNER TO "postgres";


COMMENT ON FUNCTION "public"."manual_sync_all_users_profile"() IS '手动同步所有用户数据到users_profile表';



CREATE OR REPLACE FUNCTION "public"."manual_sync_user_metadata"() RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
BEGIN
  -- 同步所有已确认邮箱的用户
  UPDATE public.users_profile
  SET
    nickname = COALESCE(auth_users.raw_user_meta_data->>'name', users_profile.nickname),
    user_id = auth_users.id,
    -- 同步organization_id（优先使用metadata中的值）
    organization_id = COALESCE(
      (auth_users.raw_user_meta_data->>'organization_id')::uuid, 
      users_profile.organization_id
    ),
    status = CASE 
      WHEN users_profile.status = 'invited' THEN 'active'
      ELSE users_profile.status
    END,
    updated_at = NOW()
  FROM auth.users auth_users
  WHERE users_profile.email = auth_users.email
    AND auth_users.email_confirmed_at IS NOT NULL
    AND users_profile.user_id IS NULL;
  
  -- 为没有profile的已注册用户创建profile
  INSERT INTO public.users_profile (
    user_id,
    email,
    nickname,
    status,
    organization_id,
    created_at,
    updated_at
  )
  SELECT
    auth_users.id,
    auth_users.email,
    COALESCE(auth_users.raw_user_meta_data->>'name', split_part(auth_users.email, '@', 1)),
    'active',
    (auth_users.raw_user_meta_data->>'organization_id')::uuid,
    NOW(),
    NOW()
  FROM auth.users auth_users
  LEFT JOIN public.users_profile ON users_profile.email = auth_users.email
  WHERE auth_users.email_confirmed_at IS NOT NULL
    AND users_profile.email IS NULL;
END;
$$;


ALTER FUNCTION "public"."manual_sync_user_metadata"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."mark_announcement_read"("p_announcement_id" "uuid", "p_user_id" bigint) RETURNS boolean
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
BEGIN
  INSERT INTO announcement_reads (announcement_id, user_id)
  VALUES (p_announcement_id, p_user_id)
  ON CONFLICT (announcement_id, user_id) DO NOTHING;
  
  RETURN FOUND;
END;
$$;


ALTER FUNCTION "public"."mark_announcement_read"("p_announcement_id" "uuid", "p_user_id" bigint) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."mark_notification_handled"("p_notification_id" "uuid", "p_user_id" bigint) RETURNS boolean
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
BEGIN
  UPDATE notifications 
  SET status = 'handled', handled_at = now()
  WHERE id = p_notification_id AND user_id = p_user_id;
  
  RETURN FOUND;
END;
$$;


ALTER FUNCTION "public"."mark_notification_handled"("p_notification_id" "uuid", "p_user_id" bigint) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."mark_notification_read"("p_notification_id" "uuid", "p_user_id" bigint) RETURNS boolean
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
BEGIN
  UPDATE notifications 
  SET status = 'read', read_at = now()
  WHERE id = p_notification_id AND user_id = p_user_id;
  
  RETURN FOUND;
END;
$$;


ALTER FUNCTION "public"."mark_notification_read"("p_notification_id" "uuid", "p_user_id" bigint) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."match_community_to_organization"("p_community" "public"."community", "user_ids" bigint[]) RETURNS "jsonb"
    LANGUAGE "plpgsql"
    AS $$
DECLARE
    matched_users bigint[];
BEGIN
    /* ---------- 递归向上查找用户所属部门链并比对社区 ---------- */
    WITH RECURSIVE org_chain AS (          -- ① 基础 + 递归
        /* 锚点：用户所在的直接部门 */
        SELECT up.id AS uid,
               up.organization_id AS org_id
        FROM   users_profile up
        WHERE  up.id = ANY(user_ids)

        UNION ALL

        /* 向上递归 parent_id，直到根部门 */
        SELECT oc.uid,
               o.parent_id AS org_id
        FROM   org_chain oc
        JOIN   organizations o ON o.id = oc.org_id
        WHERE  o.parent_id IS NOT NULL
    ),
    matched AS (                           -- ② 过滤社区匹配
        SELECT DISTINCT oc.uid
        FROM   org_chain oc
        JOIN   organizations o
               ON o.id = oc.org_id
              AND o.name = p_community::text   -- ← 关键比较：部门名 = 目标社区
    )
    SELECT array_agg(uid) INTO matched_users  -- ③ 聚合为 bigint[]
    FROM   matched;

    /* 若无人匹配，返回空数组 */
    IF matched_users IS NULL THEN
        matched_users := ARRAY[]::bigint[];
    END IF;

    RETURN jsonb_build_object(
        'matched_users', matched_users,
        'community',     p_community,
        'matched_count', COALESCE(array_length(matched_users,1),0)
    );
END;
$$;


ALTER FUNCTION "public"."match_community_to_organization"("p_community" "public"."community", "user_ids" bigint[]) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."notify_approval_result"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$BEGIN
  IF NEW.status IN ('approved', 'rejected') AND OLD.status IS DISTINCT FROM NEW.status THEN
    INSERT INTO public.notifications (
      user_id,
      type,
      title,
      content,
      status,
      related_table,
      related_id,
      created_at
    ) VALUES (
      NEW.created_by,
      'approval',
      CASE 
        WHEN NEW.status = 'approved' THEN '审批通过通知'
        ELSE '审批拒绝通知'
      END,
      CASE 
        WHEN NEW.status = 'approved' THEN 
          '您的审批申请已通过，操作编号：' || NEW.target_id
        ELSE 
          '您的审批申请已被拒绝，操作编号：' || NEW.target_id
      END,
      'unread',
      'approval_instances',
      NEW.id::text,
      now()
    );
  END IF;
  RETURN NEW;
END;$$;


ALTER FUNCTION "public"."notify_approval_result"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."notify_approver_on_step_insert"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
DECLARE
  v_target_id text;
BEGIN
  RAISE NOTICE 'Trigger fired for id: %, status: %, approver_id: %', NEW.id, NEW.status, NEW.approver_id;
  
  IF NEW.status = 'pending' THEN
    -- 获取操作编号（target_id）
    SELECT ai.target_id INTO v_target_id
    FROM approval_instances ai
    WHERE ai.id = NEW.instance_id;
    
    -- 如果没有找到target_id，使用instance_id作为备选
    IF v_target_id IS NULL THEN
      v_target_id := NEW.instance_id::text;
    END IF;
    
    INSERT INTO notifications (
      user_id, type, title, content, status, priority, created_at, related_table, related_id
    )
    VALUES (
      NEW.approver_id,
      'approval',
      '有新的审批待处理',
      '你有一条新的审批待处理，操作编号：' || v_target_id || '，请及时处理。',
      'unread',
      1,
      now(),
      'approval_steps',
      NEW.id::text
    );
    RAISE NOTICE 'Notification inserted for approver_id: % with operation_id: %', NEW.approver_id, v_target_id;
  END IF;
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."notify_approver_on_step_insert"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."notify_followup_assignment"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
  v_user_nickname text;
  v_lead_phone text;
  v_lead_wechat text;
  v_lead_source text;
  v_lead_type text;
  v_notification_id uuid;
BEGIN
  -- 只在新增记录且有分配用户时发送通知
  IF TG_OP = 'INSERT' AND NEW.interviewsales_user_id IS NOT NULL THEN
    
    -- 获取用户昵称
    SELECT nickname INTO v_user_nickname
    FROM users_profile
    WHERE id = NEW.interviewsales_user_id;
    
    -- 获取线索信息
    SELECT phone, wechat, source, leadtype 
    INTO v_lead_phone, v_lead_wechat, v_lead_source, v_lead_type
    FROM leads
    WHERE leadid = NEW.leadid;
    
    -- 构建通知内容
    DECLARE
      v_title text := '新线索分配通知';
      v_content text;
      v_metadata jsonb;
    BEGIN
      -- 构建通知内容
      v_content := format('您有新的线索需要跟进：%s', NEW.leadid);
      
      -- 如果有客户联系方式，添加到内容中
      IF v_lead_phone IS NOT NULL OR v_lead_wechat IS NOT NULL THEN
        v_content := v_content || format(' (联系方式：%s)', 
          CASE 
            WHEN v_lead_phone IS NOT NULL AND v_lead_wechat IS NOT NULL 
              THEN format('电话：%s，微信：%s', v_lead_phone, v_lead_wechat)
            WHEN v_lead_phone IS NOT NULL 
              THEN format('电话：%s', v_lead_phone)
            ELSE format('微信：%s', v_lead_wechat)
          END
        );
      END IF;
      
      -- 构建元数据
      v_metadata := jsonb_build_object(
        'leadid', NEW.leadid,
        'leadtype', v_lead_type,
        'source', v_lead_source,
        'phone', v_lead_phone,
        'wechat', v_lead_wechat,
        'followupstage', NEW.followupstage,
        'assigned_user_id', NEW.interviewsales_user_id,
        'assigned_user_nickname', v_user_nickname,
        'created_at', NEW.created_at
      );
      
      -- 创建通知
      v_notification_id := create_notification(
        p_user_id := NEW.interviewsales_user_id,
        p_type := 'followup_assignment',
        p_title := v_title,
        p_content := v_content,
        p_metadata := v_metadata,
        p_priority := 1
      );
      
      -- 记录日志（可选）
      RAISE NOTICE '已为用户 % (ID: %) 创建followup分配通知，通知ID: %', 
        v_user_nickname, NEW.interviewsales_user_id, v_notification_id;
      
    END;
  END IF;
  
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."notify_followup_assignment"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."notify_followup_reassignment"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
  v_old_user_nickname text;
  v_new_user_nickname text;
  v_lead_phone text;
  v_lead_wechat text;
  v_lead_source text;
  v_lead_type text;
  v_notification_id uuid;
BEGIN
  -- 只在分配用户变更时发送通知
  IF TG_OP = 'UPDATE' AND 
     OLD.interviewsales_user_id IS DISTINCT FROM NEW.interviewsales_user_id AND
     NEW.interviewsales_user_id IS NOT NULL THEN
    
    -- 获取用户昵称
    SELECT nickname INTO v_old_user_nickname
    FROM users_profile
    WHERE id = OLD.interviewsales_user_id;
    
    SELECT nickname INTO v_new_user_nickname
    FROM users_profile
    WHERE id = NEW.interviewsales_user_id;
    
    -- 获取线索信息
    SELECT phone, wechat, source, leadtype 
    INTO v_lead_phone, v_lead_wechat, v_lead_source, v_lead_type
    FROM leads
    WHERE leadid = NEW.leadid;
    
    -- 构建通知内容
    DECLARE
      v_title text := '线索重新分配通知';
      v_content text;
      v_metadata jsonb;
    BEGIN
      -- 构建通知内容
      v_content := format('线索 %s 已重新分配给您', NEW.leadid);
      
      -- 如果有客户联系方式，添加到内容中
      IF v_lead_phone IS NOT NULL OR v_lead_wechat IS NOT NULL THEN
        v_content := v_content || format(' (联系方式：%s)', 
          CASE 
            WHEN v_lead_phone IS NOT NULL AND v_lead_wechat IS NOT NULL 
              THEN format('电话：%s，微信：%s', v_lead_phone, v_lead_wechat)
            WHEN v_lead_phone IS NOT NULL 
              THEN format('电话：%s', v_lead_phone)
            ELSE format('微信：%s', v_lead_wechat)
          END
        );
      END IF;
      
      -- 构建元数据
      v_metadata := jsonb_build_object(
        'leadid', NEW.leadid,
        'leadtype', v_lead_type,
        'source', v_lead_source,
        'phone', v_lead_phone,
        'wechat', v_lead_wechat,
        'followupstage', NEW.followupstage,
        'old_assigned_user_id', OLD.interviewsales_user_id,
        'old_assigned_user_nickname', v_old_user_nickname,
        'new_assigned_user_id', NEW.interviewsales_user_id,
        'new_assigned_user_nickname', v_new_user_nickname,
        'updated_at', NEW.updated_at
      );
      
      -- 创建通知
      v_notification_id := create_notification(
        p_user_id := NEW.interviewsales_user_id,
        p_type := 'followup_reassignment',
        p_title := v_title,
        p_content := v_content,
        p_metadata := v_metadata,
        p_priority := 2
      );
      
      -- 记录日志（可选）
      RAISE NOTICE '已为用户 % (ID: %) 创建followup重新分配通知，通知ID: %', 
        v_new_user_nickname, NEW.interviewsales_user_id, v_notification_id;
      
    END;
  END IF;
  
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."notify_followup_reassignment"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."process_points_deduction"("p_user_id" bigint, "p_leadid" "text", "p_source" "public"."source", "p_leadtype" "text", "p_campaignname" "text" DEFAULT NULL::"text", "p_unitname" "text" DEFAULT NULL::"text", "p_remark" "text" DEFAULT NULL::"text") RETURNS "jsonb"
    LANGUAGE "plpgsql"
    AS $$
DECLARE
    points_cost_result jsonb;
    points_cost integer;
    current_balance integer;
    new_balance integer;
    transaction_id bigint;
    cost_rule_id uuid;
    points_details jsonb := '{}';
BEGIN
    -- 计算积分成本
    points_cost_result := calculate_lead_points_cost(
        p_source, p_leadtype, p_campaignname, p_unitname, p_remark
    );
    
    IF (points_cost_result->>'success')::boolean THEN
        points_cost := (points_cost_result->>'points_cost')::integer;
        cost_rule_id := (points_cost_result->'cost_details'->>'rule_id')::uuid;
        
        -- 获取用户当前积分余额
        SELECT COALESCE(total_points, 0) INTO current_balance
        FROM user_points_wallet
        WHERE user_id = p_user_id;
        
        -- 检查余额是否足够
        IF current_balance >= points_cost THEN
            -- 计算新余额
            new_balance := current_balance - points_cost;
            
            -- 插入积分交易记录
            INSERT INTO user_points_transactions (
                user_id, points_change, balance_after,
                transaction_type, source_type, source_id, description
            ) VALUES (
                p_user_id, -points_cost, new_balance,
                'DEDUCT', 'ALLOCATION_LEAD', p_leadid,
                '线索分配扣除积分：' || p_leadid
            ) RETURNING id INTO transaction_id;
            
            -- 构建积分详情
            points_details := jsonb_build_object(
                'points_cost', points_cost,
                'user_balance_before', current_balance,
                'user_balance_after', new_balance,
                'transaction_id', transaction_id,
                'cost_rule_id', cost_rule_id,
                'deduction_reason', '线索分配',
                'cost_details', points_cost_result->'cost_details',
                'success', true
            );
        ELSE
            -- 积分不足
            points_details := jsonb_build_object(
                'error', '积分不足',
                'required_points', points_cost,
                'available_points', current_balance,
                'success', false
            );
        END IF;
    ELSE
        -- 积分成本计算失败
        points_details := jsonb_build_object(
            'error', '积分成本计算失败',
            'error_details', points_cost_result,
            'success', false
        );
    END IF;
    
    RETURN points_details;
END;
$$;


ALTER FUNCTION "public"."process_points_deduction"("p_user_id" bigint, "p_leadid" "text", "p_source" "public"."source", "p_leadtype" "text", "p_campaignname" "text", "p_unitname" "text", "p_remark" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."process_showing_rollback"("p_showing_id" "uuid", "p_applicant_id" bigint, "p_community" "public"."community", "p_reason" "text", "p_leadid" "text" DEFAULT NULL::"text") RETURNS "jsonb"
    LANGUAGE "plpgsql"
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
    
    -- 3. 为申请人发放直通卡（可以有多张），包含操作理由
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
        'community', v_community,
        'remark', '带看回退补偿：' || COALESCE(p_reason, '未知原因')
    );
    
    RETURN result;
END;
$$;


ALTER FUNCTION "public"."process_showing_rollback"("p_showing_id" "uuid", "p_applicant_id" bigint, "p_community" "public"."community", "p_reason" "text", "p_leadid" "text") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."process_showing_rollback"("p_showing_id" "uuid", "p_applicant_id" bigint, "p_community" "public"."community", "p_reason" "text", "p_leadid" "text") IS '带看回退处理函数：标记带看记录无效，发放直通卡（可多张），通知由统一系统处理。参数：p_showing_id(带看记录ID), p_applicant_id(申请人ID), p_community(社区), p_reason(回退理由), p_leadid(线索编号，可选)';



CREATE OR REPLACE FUNCTION "public"."recalculate_all_scores"() RETURNS integer
    LANGUAGE "plpgsql"
    AS $$
DECLARE
  updated_count INTEGER := 0;
  schedule_record RECORD;
BEGIN
  -- 遍历所有有评分数据的记录
  FOR schedule_record IN 
    SELECT id, scoring_data 
    FROM live_stream_schedules 
    WHERE scoring_data IS NOT NULL
  LOOP
    -- 重新计算评分
    UPDATE live_stream_schedules 
    SET average_score = calculate_weighted_score(scoring_data)
    WHERE id = schedule_record.id;
    
    updated_count := updated_count + 1;
  END LOOP;
  
  RETURN updated_count;
END;
$$;


ALTER FUNCTION "public"."recalculate_all_scores"() OWNER TO "postgres";


COMMENT ON FUNCTION "public"."recalculate_all_scores"() IS '重新计算所有评分函数（权重变更后使用）';



CREATE OR REPLACE FUNCTION "public"."record_operation"("p_user_id" bigint, "p_operation_type" "text" DEFAULT 'update'::"text") RETURNS "void"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  INSERT INTO public.frequency_control (user_id, operation_type)
  VALUES (p_user_id, p_operation_type);
END;
$$;


ALTER FUNCTION "public"."record_operation"("p_user_id" bigint, "p_operation_type" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."record_operation"("p_user_id" bigint, "p_operation_type" character varying, "p_record_id" character varying DEFAULT NULL::character varying, "p_old_value" "text" DEFAULT NULL::"text", "p_new_value" "text" DEFAULT NULL::"text", "p_ip_address" "inet" DEFAULT NULL::"inet", "p_user_agent" "text" DEFAULT NULL::"text") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
    v_config RECORD;
    v_window_start TIMESTAMP WITH TIME ZONE;
    v_window_end TIMESTAMP WITH TIME ZONE;
    v_existing_record RECORD;
    v_result JSONB;
BEGIN
    -- 获取配置
    SELECT * INTO v_config 
    FROM public.frequency_control_config 
    WHERE operation_type = p_operation_type AND is_active = true;
    
    IF NOT FOUND THEN
        -- 没有配置，只记录日志
        INSERT INTO public.operation_logs (
            user_id, operation_type, record_id, old_value, new_value, 
            operation_result, ip_address, user_agent
        ) VALUES (
            p_user_id, p_operation_type, p_record_id, p_old_value, p_new_value,
            'success', p_ip_address, p_user_agent
        );
        
        RETURN jsonb_build_object('success', true, 'message', '操作已记录');
    END IF;
    
    -- 计算时间窗口
    v_window_start := NOW() - INTERVAL '1 minute' * v_config.time_window_minutes;
    v_window_end := NOW();
    
    -- 查找现有记录
    SELECT * INTO v_existing_record
    FROM public.operation_frequency_control
    WHERE user_id = p_user_id 
      AND operation_type = p_operation_type
      AND window_start >= v_window_start
      AND window_end <= v_window_end
    LIMIT 1;
    
    IF FOUND THEN
        -- 更新现有记录
        UPDATE public.operation_frequency_control
        SET operation_count = operation_count + 1,
            updated_at = NOW()
        WHERE id = v_existing_record.id;
    ELSE
        -- 创建新记录
        INSERT INTO public.operation_frequency_control (
            user_id, operation_type, operation_count, window_start, window_end
        ) VALUES (
            p_user_id, p_operation_type, 1, v_window_start, v_window_end
        );
    END IF;
    
    -- 记录操作日志
    INSERT INTO public.operation_logs (
        user_id, operation_type, record_id, old_value, new_value, 
        operation_result, ip_address, user_agent
    ) VALUES (
        p_user_id, p_operation_type, p_record_id, p_old_value, p_new_value,
        'success', p_ip_address, p_user_agent
    );
    
    RETURN jsonb_build_object('success', true, 'message', '操作已记录');
END;
$$;


ALTER FUNCTION "public"."record_operation"("p_user_id" bigint, "p_operation_type" character varying, "p_record_id" character varying, "p_old_value" "text", "p_new_value" "text", "p_ip_address" "inet", "p_user_agent" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."remove_role_from_user"("target_user_id" "uuid", "role_name" "text") RETURNS boolean
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
  role_id UUID;
BEGIN
  -- 检查调用者是否有权限
  IF NOT has_permission('user_roles', 'manage') THEN
    RAISE EXCEPTION '没有权限移除角色';
  END IF;
  
  -- 获取角色 ID
  SELECT id INTO role_id FROM public.roles WHERE name = role_name;
  IF role_id IS NULL THEN
    RAISE EXCEPTION '角色不存在: %', role_name;
  END IF;
  
  -- 移除角色
  DELETE FROM public.user_roles
  WHERE user_id = target_user_id AND role_id = role_id;
  
  RETURN TRUE;
END;
$$;


ALTER FUNCTION "public"."remove_role_from_user"("target_user_id" "uuid", "role_name" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."save_pivot_config"("p_name" "text", "p_description" "text", "p_config" "jsonb", "p_data_source" "text", "p_is_public" boolean DEFAULT false) RETURNS "uuid"
    LANGUAGE "plpgsql"
    AS $$
DECLARE
  v_config_id uuid;
  v_user_id text;
BEGIN
  -- 获取当前用户ID
  SELECT auth.uid()::text INTO v_user_id;
  
  -- 插入配置
  INSERT INTO bi_pivot_configs (name, description, config, data_source, created_by, is_public)
  VALUES (p_name, p_description, p_config, p_data_source, v_user_id, p_is_public)
  RETURNING id INTO v_config_id;
  
  RETURN v_config_id;
END;
$$;


ALTER FUNCTION "public"."save_pivot_config"("p_name" "text", "p_description" "text", "p_config" "jsonb", "p_data_source" "text", "p_is_public" boolean) OWNER TO "postgres";


COMMENT ON FUNCTION "public"."save_pivot_config"("p_name" "text", "p_description" "text", "p_config" "jsonb", "p_data_source" "text", "p_is_public" boolean) IS '保存透视表配置';



CREATE OR REPLACE FUNCTION "public"."set_initial_admin"("admin_user_id" "uuid") RETURNS boolean
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
  admin_role_id UUID; -- 修复：正确声明变量
BEGIN
  -- 获取管理员角色 ID
  SELECT id INTO admin_role_id FROM public.roles WHERE name = 'admin';
  IF admin_role_id IS NULL THEN
    RAISE EXCEPTION '管理员角色不存在';
  END IF;
  
  -- 分配管理员角色
  INSERT INTO public.user_roles (user_id, role_id)
  VALUES (admin_user_id, admin_role_id)
  ON CONFLICT (user_id, role_id) DO NOTHING;
  
  RETURN TRUE;
END;
$$;


ALTER FUNCTION "public"."set_initial_admin"("admin_user_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."simple_lead_allocation_trigger"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'pg_temp'
    AS $_$
DECLARE
    allocation_result jsonb;
    target_user_id bigint;
    duplicate_count integer;
    lead_community community;
    debug_info jsonb := '{}';
    original_leadid text;
    duplicate_details jsonb;
    lock_key text;
    is_concurrent_duplicate boolean := false;
    manual_user_id bigint := NULL;
    cleaned_remark text;
    cleaned_leadtype text;
BEGIN
    -- 构建锁键（基于手机号或微信）
    lock_key := COALESCE(NEW.phone, NEW.wechat, NEW.leadid);
    
    -- 使用advisory lock防止并发插入相同手机号/微信的线索
    IF NOT pg_try_advisory_xact_lock(hashtext(lock_key)) THEN
        -- 如果无法获取锁，说明有并发插入，等待一下再检查
        PERFORM pg_sleep(0.1);
        is_concurrent_duplicate := true;
    END IF;
    
    -- �� 第一步：检查手动指定分配（最高优先级）
    -- 从remark中提取手动分配信息
    IF NEW.remark IS NOT NULL AND NEW.remark ~ 'MANUAL_ASSIGN:(\d+)' THEN
        manual_user_id := (regexp_match(NEW.remark, 'MANUAL_ASSIGN:(\d+)'))[1]::bigint;
        debug_info := debug_info || jsonb_build_object('manual_assignment_detected', manual_user_id);
    END IF;
    
    -- 从leadtype中提取手动分配信息
    IF manual_user_id IS NULL AND NEW.leadtype IS NOT NULL AND NEW.leadtype ~ '\|ASSIGN:(\d+)' THEN
        manual_user_id := (regexp_match(NEW.leadtype, '\|ASSIGN:(\d+)'))[1]::bigint;
        debug_info := debug_info || jsonb_build_object('manual_assignment_from_leadtype', manual_user_id);
    END IF;
    
    -- 验证手动指定的用户是否有效
    IF manual_user_id IS NOT NULL THEN
        IF NOT EXISTS (SELECT 1 FROM public.users_profile WHERE id = manual_user_id AND status = 'active') THEN
            -- 手动指定的用户无效，重置为NULL
            manual_user_id := NULL;
            debug_info := debug_info || jsonb_build_object('manual_assignment_invalid', true);
        END IF;
    END IF;
    
    -- �� 第二步：如果有手动指定，直接执行分配（跳过重复检测）
    IF manual_user_id IS NOT NULL THEN
        -- 清理字段中的分配信息
        cleaned_remark := NEW.remark;
        cleaned_leadtype := NEW.leadtype;
        
        IF NEW.remark IS NOT NULL AND NEW.remark ~ 'MANUAL_ASSIGN:\d+' THEN
            cleaned_remark := regexp_replace(NEW.remark, '\|?MANUAL_ASSIGN:\d+\|?', '');
            -- 清理多余的管道符
            cleaned_remark := regexp_replace(cleaned_remark, '^\|+|\|+$', '');
        END IF;
        
        IF NEW.leadtype IS NOT NULL AND NEW.leadtype ~ '\|ASSIGN:\d+' THEN
            cleaned_leadtype := regexp_replace(NEW.leadtype, '\|ASSIGN:\d+', '');
        END IF;
        
        -- 优先从remark中提取community信息
        IF cleaned_remark IS NOT NULL AND cleaned_remark ~ '\[COMMUNITY:([^\]]+)\]' THEN
            SELECT (regexp_match(cleaned_remark, '\[COMMUNITY:([^\]]+)\]'))[1]::community INTO lead_community;
            debug_info := debug_info || jsonb_build_object('community_from_remark', lead_community);
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
                 OR cleaned_remark ILIKE '%' || k || '%')
            )
            ORDER BY priority DESC
            LIMIT 1;
            
            IF lead_community IS NOT NULL THEN
                debug_info := debug_info || jsonb_build_object('community_from_keywords', lead_community);
            END IF;
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
        
        -- 执行手动分配
        allocation_result := allocate_lead_simple(
            NEW.leadid,
            NEW.source,
            cleaned_leadtype,
            lead_community,
            manual_user_id  -- 传递手动指定的用户ID
        );
        
        -- 处理分配结果
        IF allocation_result IS NOT NULL AND (allocation_result->>'success')::boolean THEN
            target_user_id := (allocation_result->>'assigned_user_id')::bigint;
            
            -- 记录手动分配日志
            INSERT INTO simple_allocation_logs (
                leadid, 
                assigned_user_id, 
                allocation_method,
                processing_details
            ) VALUES (
                NEW.leadid,
                target_user_id,
                'manual',
                jsonb_build_object(
                    'manual_assignment', true,
                    'manual_user_id', manual_user_id,
                    'original_remark', NEW.remark,
                    'cleaned_remark', cleaned_remark,
                    'original_leadtype', NEW.leadtype,
                    'cleaned_leadtype', cleaned_leadtype,
                    'debug_info', debug_info
                )
            );
            
            -- 创建followups记录
            IF target_user_id IS NOT NULL THEN
                -- 检查用户是否存在
                IF NOT EXISTS (SELECT 1 FROM public.users_profile WHERE id = target_user_id) THEN
                    RAISE EXCEPTION '用户ID % 不存在', target_user_id;
                END IF;
                
                -- 检查leadid是否已存在followups记录
                IF NOT EXISTS (SELECT 1 FROM public.followups WHERE leadid = NEW.leadid) THEN
                    INSERT INTO public.followups (
                        leadid, 
                        leadtype, 
                        followupstage, 
                        interviewsales_user_id,
                        created_at, 
                        updated_at
                    ) VALUES (
                        NEW.leadid, 
                        cleaned_leadtype, 
                        '待接收', 
                        target_user_id,
                        NOW(), 
                        NOW()
                    );
                END IF;
            END IF;
            
            RETURN NEW;
        ELSE
            -- 手动分配失败，记录失败日志
            INSERT INTO simple_allocation_logs (
                leadid,
                processing_details
            ) VALUES (
                NEW.leadid,
                jsonb_build_object(
                    'manual_assignment_failed', true,
                    'manual_user_id', manual_user_id,
                    'allocation_result', allocation_result,
                    'debug_info', debug_info
                )
            );
        END IF;
    END IF;
    
    -- �� 第三步：检查重复客户（次高优先级）
    SELECT COUNT(*) INTO duplicate_count
    FROM public.leads l
    WHERE (
            (NEW.phone IS NOT NULL AND NEW.phone != '' AND l.phone = NEW.phone) OR
            (NEW.wechat IS NOT NULL AND NEW.wechat != '' AND l.wechat = NEW.wechat)
    )
    AND l.created_at >= NOW() - INTERVAL '7 days'
    AND l.leadid != NEW.leadid;  -- 排除当前记录
    
    -- 如果发现重复，更新线索状态并记录日志
    IF duplicate_count > 0 THEN
        -- 获取原始线索ID（用于记录）
        SELECT leadid INTO original_leadid
        FROM public.leads l
        WHERE (
                (NEW.phone IS NOT NULL AND NEW.phone != '' AND l.phone = NEW.phone) OR
                (NEW.wechat IS NOT NULL AND NEW.wechat != '' AND l.wechat = NEW.wechat)
        )
        AND l.created_at >= NOW() - INTERVAL '7 days'
        AND l.leadid != NEW.leadid
        ORDER BY l.created_at ASC
        LIMIT 1;
        
        -- 构建重复详情
        duplicate_details := jsonb_build_object(
            'duplicate_found', true,
            'duplicate_count', duplicate_count,
            'original_leadid', original_leadid,
            'duplicate_reason', CASE 
                WHEN is_concurrent_duplicate THEN '并发插入检测到重复'
                WHEN NEW.phone IS NOT NULL AND NEW.phone != '' THEN 'phone重复'
                WHEN NEW.wechat IS NOT NULL AND NEW.wechat != '' THEN 'wechat重复'
                ELSE '未知重复原因'
            END,
            'is_concurrent', is_concurrent_duplicate,
            'check_time', NOW()
        );
        
        -- 更新当前线索状态为"重复"
        UPDATE public.leads 
        SET leadtype = '重复'
        WHERE leadid = NEW.leadid;
        
        -- 记录重复日志
        INSERT INTO simple_allocation_logs (
            leadid,
            processing_details
        ) VALUES (
            NEW.leadid,
            duplicate_details
        );
        
        RETURN NEW;
    END IF;
    
    -- 🎯 第四步：常规分配逻辑（规则匹配）
    -- 优先从remark中提取community信息
    IF NEW.remark IS NOT NULL AND NEW.remark ~ '\[COMMUNITY:([^\]]+)\]' THEN
        SELECT (regexp_match(NEW.remark, '\[COMMUNITY:([^\]]+)\]'))[1]::community INTO lead_community;
        debug_info := debug_info || jsonb_build_object('community_from_remark', lead_community);
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
        
        IF lead_community IS NOT NULL THEN
            debug_info := debug_info || jsonb_build_object('community_from_keywords', lead_community);
        END IF;
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
        
        -- 获取分配结果
        IF allocation_result IS NOT NULL AND (allocation_result->>'success')::boolean THEN
            target_user_id := (allocation_result->>'assigned_user_id')::bigint;
            
            -- 记录成功分配日志
            INSERT INTO simple_allocation_logs (
                leadid, 
                rule_id, 
                assigned_user_id, 
                allocation_method,
                selected_group_index, 
                processing_details
            ) VALUES (
                NEW.leadid,
                (allocation_result->>'rule_id')::uuid,
                target_user_id,
                allocation_result->>'allocation_method',
                (allocation_result->>'selected_group_index')::integer,
                jsonb_build_object(
                    'debug_info', jsonb_build_object(
                        'target_user_id', target_user_id,
                        'followup_created', true,
                        'allocation_result', allocation_result,
                        'community_from_remark', debug_info->>'community_from_remark'
                    ),
                    'followup_created', true,
                    'allocation_success', true
                )
            );
            
            -- 创建followups记录
            IF target_user_id IS NOT NULL THEN
                -- 检查用户是否存在
                IF NOT EXISTS (SELECT 1 FROM public.users_profile WHERE id = target_user_id) THEN
                    RAISE EXCEPTION '用户ID % 不存在', target_user_id;
                END IF;
                
                -- 检查leadid是否已存在followups记录
                IF NOT EXISTS (SELECT 1 FROM public.followups WHERE leadid = NEW.leadid) THEN
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
                END IF;
            END IF;
        ELSE
            -- 记录分配失败的情况
            INSERT INTO simple_allocation_logs (
                leadid,
                processing_details
            ) VALUES (
                NEW.leadid,
                jsonb_build_object(
                    'allocation_failed', true,
                    'error_details', allocation_result,
                    'debug_info', debug_info
                )
            );
        END IF;
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
$_$;


ALTER FUNCTION "public"."simple_lead_allocation_trigger"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."sync_user_metadata_to_profile"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
BEGIN
  -- 记录调试信息
  RAISE LOG 'Trigger fired: old_confirmed=%, new_confirmed=%', OLD.email_confirmed_at, NEW.email_confirmed_at;
  
  -- 检查是否为首次邮箱确认（email_confirmed_at从NULL变为非NULL）
  IF OLD.email_confirmed_at IS NULL AND NEW.email_confirmed_at IS NOT NULL THEN
    RAISE LOG 'Email confirmed for user: %', NEW.email;
    
    -- 更新users_profile表
    UPDATE public.users_profile
    SET
      -- 将auth.users的metadata.name同步到nickname字段
      nickname = COALESCE(NEW.raw_user_meta_data->>'name', nickname),
      -- 将user_id设置为auth.users的id
      user_id = NEW.id,
      -- 同步organization_id（如果metadata中有的话）
      organization_id = COALESCE(
        (NEW.raw_user_meta_data->>'organization_id')::uuid, 
        organization_id
      ),
      -- 将状态从invited改为active
      status = 'active',
      -- 更新时间戳
      updated_at = NOW()
    WHERE email = NEW.email;
    
    -- 注意：已移除创建新记录的部分
  END IF;
  
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."sync_user_metadata_to_profile"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."sync_user_profile_data"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
BEGIN
    -- 当email、状态或元数据中的名称发生变化时，更新对应的users_profile记录
    IF OLD.email IS DISTINCT FROM NEW.email OR 
       OLD.raw_user_meta_data IS DISTINCT FROM NEW.raw_user_meta_data THEN
        
        UPDATE public.users_profile
        SET 
            email = NEW.email,
            -- 从用户元数据中提取名称，如果不存在则使用现有值
            nickname = COALESCE(NEW.raw_user_meta_data->>'name', NEW.raw_user_meta_data->>'full_name'),
            -- 根据用户是否被禁用设置状态
            status = CASE 
                WHEN NEW.banned_until IS NOT NULL AND NEW.banned_until > NOW() THEN 'banned'
                WHEN NEW.deleted_at IS NOT NULL THEN 'deleted'
                WHEN NEW.email_confirmed_at IS NOT NULL OR NEW.phone_confirmed_at IS NOT NULL THEN 'active'
                ELSE 'pending'
            END
        WHERE user_id = NEW.id;
    END IF;
    
    RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."sync_user_profile_data"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."sync_user_profile_on_auth_insert"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
DECLARE
    existing_profile_id bigint;
    user_name text;
    user_status text;
    organization_id uuid;
BEGIN
    -- 记录调试信息
    RAISE LOG 'Trigger fired: new_user_id=%, new_email=%', NEW.id, NEW.email;
    
    -- 从用户元数据中提取名称
    user_name := COALESCE(NEW.raw_user_meta_data->>'name', NEW.raw_user_meta_data->>'full_name');
    
    -- 从用户元数据中提取组织ID
    organization_id := (NEW.raw_user_meta_data->>'organization_id')::uuid;
    
    -- 确定用户状态
    IF NEW.banned_until IS NOT NULL AND NEW.banned_until > NOW() THEN
        user_status := 'banned';
    ELSIF NEW.deleted_at IS NOT NULL THEN
        user_status := 'deleted';
    ELSIF NEW.email_confirmed_at IS NOT NULL OR NEW.phone_confirmed_at IS NOT NULL THEN
        user_status := 'active';
    ELSE
        user_status := 'pending';
    END IF;
    
    -- 检查是否已存在对应的profile记录
    SELECT id INTO existing_profile_id
    FROM public.users_profile
    WHERE email = NEW.email;
    
    IF existing_profile_id IS NOT NULL THEN
        -- 更新现有记录
        RAISE LOG 'Updating existing profile: id=%, email=%', existing_profile_id, NEW.email;
        
        UPDATE public.users_profile
        SET
            user_id = NEW.id,
            nickname = COALESCE(user_name, nickname),
            organization_id = COALESCE(organization_id, organization_id),
            status = user_status,
            updated_at = NOW()
        WHERE id = existing_profile_id;
        
        RAISE LOG 'Profile updated successfully: user_id=%, status=%', NEW.id, user_status;
    ELSE
        -- 创建新记录
        RAISE LOG 'Creating new profile for user: id=%, email=%', NEW.id, NEW.email;
        
        INSERT INTO public.users_profile (
            user_id,
            email,
            nickname,
            organization_id,
            status,
            created_at,
            updated_at
        ) VALUES (
            NEW.id,
            NEW.email,
            COALESCE(user_name, split_part(NEW.email, '@', 1)),
            organization_id,
            user_status,
            NOW(),
            NOW()
        );
        
        RAISE LOG 'Profile created successfully: user_id=%, status=%', NEW.id, user_status;
    END IF;
    
    RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."sync_user_profile_on_auth_insert"() OWNER TO "postgres";


COMMENT ON FUNCTION "public"."sync_user_profile_on_auth_insert"() IS '用户创建时自动同步到users_profile表';



CREATE OR REPLACE FUNCTION "public"."sync_user_profile_on_email_confirmed"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
DECLARE
    existing_profile_id bigint;
BEGIN
    -- 记录调试信息
    RAISE LOG 'Email confirmation trigger: old_confirmed=%, new_confirmed=%', OLD.email_confirmed_at, NEW.email_confirmed_at;
    
    -- 检查是否为首次邮箱确认（email_confirmed_at从NULL变为非NULL）
    IF OLD.email_confirmed_at IS NULL AND NEW.email_confirmed_at IS NOT NULL THEN
        RAISE LOG 'Email confirmed for user: %', NEW.email;
        
        -- 查找对应的profile记录
        SELECT id INTO existing_profile_id
        FROM public.users_profile
        WHERE email = NEW.email;
        
        IF existing_profile_id IS NOT NULL THEN
            -- 更新现有记录
            UPDATE public.users_profile
            SET
                user_id = NEW.id,
                nickname = COALESCE(NEW.raw_user_meta_data->>'name', nickname),
                organization_id = COALESCE(
                    (NEW.raw_user_meta_data->>'organization_id')::uuid, 
                    organization_id
                ),
                status = 'active',
                updated_at = NOW()
            WHERE id = existing_profile_id;
            
            RAISE LOG 'Profile updated on email confirmation: user_id=%, status=active', NEW.id;
        ELSE
            -- 创建新记录（如果不存在）
            INSERT INTO public.users_profile (
                user_id,
                email,
                nickname,
                organization_id,
                status,
                created_at,
                updated_at
            ) VALUES (
                NEW.id,
                NEW.email,
                COALESCE(NEW.raw_user_meta_data->>'name', split_part(NEW.email, '@', 1)),
                (NEW.raw_user_meta_data->>'organization_id')::uuid,
                'active',
                NOW(),
                NOW()
            );
            
            RAISE LOG 'Profile created on email confirmation: user_id=%, status=active', NEW.id;
        END IF;
    END IF;
    
    RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."sync_user_profile_on_email_confirmed"() OWNER TO "postgres";


COMMENT ON FUNCTION "public"."sync_user_profile_on_email_confirmed"() IS '邮箱确认时自动同步到users_profile表';



CREATE OR REPLACE FUNCTION "public"."sync_user_profile_on_metadata_update"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
BEGIN
    -- 当email、状态或元数据中的名称发生变化时，更新对应的users_profile记录
    IF OLD.email IS DISTINCT FROM NEW.email OR 
       OLD.raw_user_meta_data IS DISTINCT FROM NEW.raw_user_meta_data THEN
        
        UPDATE public.users_profile
        SET 
            email = NEW.email,
            nickname = COALESCE(NEW.raw_user_meta_data->>'name', NEW.raw_user_meta_data->>'full_name', nickname),
            organization_id = COALESCE(
                (NEW.raw_user_meta_data->>'organization_id')::uuid, 
                organization_id
            ),
            status = CASE 
                WHEN NEW.banned_until IS NOT NULL AND NEW.banned_until > NOW() THEN 'banned'
                WHEN NEW.deleted_at IS NOT NULL THEN 'deleted'
                WHEN NEW.email_confirmed_at IS NOT NULL OR NEW.phone_confirmed_at IS NOT NULL THEN 'active'
                ELSE 'pending'
            END,
            updated_at = NOW()
        WHERE user_id = NEW.id;
        
        RAISE LOG 'Profile updated on metadata change: user_id=%, email=%', NEW.id, NEW.email;
    END IF;
    
    RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."sync_user_profile_on_metadata_update"() OWNER TO "postgres";


COMMENT ON FUNCTION "public"."sync_user_profile_on_metadata_update"() IS '用户元数据更新时自动同步到users_profile表';



CREATE OR REPLACE FUNCTION "public"."test_allocation_system"() RETURNS "jsonb"
    LANGUAGE "plpgsql"
    AS $$
DECLARE
    test_result jsonb;
    test_leadid text;
BEGIN
    -- 创建测试线索ID
    test_leadid := 'TEST_' || EXTRACT(EPOCH FROM NOW())::bigint;
    
    -- 测试分配功能
    SELECT allocate_lead_simple(
        test_leadid,
        '抖音'::source,
        '意向客户',
        '浦江公园社区'::community,
        NULL
    ) INTO test_result;
    
    RETURN jsonb_build_object(
        'test_leadid', test_leadid,
        'allocation_result', test_result,
        'test_time', NOW()
    );
END;
$$;


ALTER FUNCTION "public"."test_allocation_system"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_achievement_progress"("p_user_id" bigint, "p_achievement_code" "text", "p_progress_change" integer, "p_trigger_source" "text", "p_trigger_data" "jsonb" DEFAULT NULL::"jsonb") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
  v_achievement_id uuid;
  v_current_progress integer;
  v_target integer;
  v_new_progress integer;
  v_is_completed boolean;
  v_points_reward integer;
  v_avatar_frame_id uuid;
  v_badge_id uuid;
  v_result jsonb;
BEGIN
  -- 获取成就信息
  SELECT id, points_reward, avatar_frame_id, badge_id
  INTO v_achievement_id, v_points_reward, v_avatar_frame_id, v_badge_id
  FROM achievements 
  WHERE code = p_achievement_code AND is_active = true;
  
  IF v_achievement_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Achievement not found');
  END IF;
  
  -- 获取当前进度
  SELECT COALESCE(progress, 0), COALESCE(target, 1), is_completed
  INTO v_current_progress, v_target, v_is_completed
  FROM user_achievements 
  WHERE user_id = p_user_id AND achievement_id = v_achievement_id;
  
  -- 如果已完成，不再更新
  IF v_is_completed THEN
    RETURN jsonb_build_object('success', true, 'message', 'Achievement already completed');
  END IF;
  
  v_new_progress := LEAST(v_current_progress + p_progress_change, v_target);
  v_is_completed := (v_new_progress >= v_target);
  
  -- 插入或更新用户成就记录
  INSERT INTO user_achievements (
    user_id, achievement_id, progress, target, is_completed, 
    completed_at, points_earned
  ) VALUES (
    p_user_id, v_achievement_id, v_new_progress, v_target, v_is_completed,
    CASE WHEN v_is_completed THEN now() ELSE NULL END,
    CASE WHEN v_is_completed THEN v_points_reward ELSE 0 END
  )
  ON CONFLICT (user_id, achievement_id) DO UPDATE SET
    progress = v_new_progress,
    is_completed = v_is_completed,
    completed_at = CASE WHEN v_is_completed AND user_achievements.completed_at IS NULL THEN now() ELSE user_achievements.completed_at END,
    points_earned = CASE WHEN v_is_completed AND user_achievements.points_earned = 0 THEN v_points_reward ELSE user_achievements.points_earned END,
    updated_at = now();
  
  -- 记录进度变化
  INSERT INTO achievement_progress_logs (
    user_id, achievement_id, old_progress, new_progress, 
    progress_change, trigger_source, trigger_data
  ) VALUES (
    p_user_id, v_achievement_id, v_current_progress, v_new_progress,
    p_progress_change, p_trigger_source, p_trigger_data
  );
  
  -- 如果成就完成，解锁相关奖励
  IF v_is_completed THEN
    -- 解锁头像框
    IF v_avatar_frame_id IS NOT NULL THEN
      INSERT INTO user_avatar_frames (user_id, frame_id)
      VALUES (p_user_id, v_avatar_frame_id)
      ON CONFLICT (user_id, frame_id) DO NOTHING;
    END IF;
    
    -- 解锁勋章
    IF v_badge_id IS NOT NULL THEN
      INSERT INTO user_badges (user_id, badge_id)
      VALUES (p_user_id, v_badge_id)
      ON CONFLICT (user_id, badge_id) DO NOTHING;
    END IF;
    
    -- 发放积分奖励
    IF v_points_reward > 0 THEN
      PERFORM award_points(p_user_id, 'ACHIEVEMENT', v_achievement_id, '成就奖励：' || p_achievement_code);
    END IF;
  END IF;
  
  v_result := jsonb_build_object(
    'success', true,
    'achievement_id', v_achievement_id,
    'old_progress', v_current_progress,
    'new_progress', v_new_progress,
    'is_completed', v_is_completed,
    'points_reward', CASE WHEN v_is_completed THEN v_points_reward ELSE 0 END
  );
  
  RETURN v_result;
END;
$$;


ALTER FUNCTION "public"."update_achievement_progress"("p_user_id" bigint, "p_achievement_code" "text", "p_progress_change" integer, "p_trigger_source" "text", "p_trigger_data" "jsonb") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_approval_instance_status"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
DECLARE
  total_steps integer;
  approved_steps integer;
BEGIN
  SELECT COUNT(*) INTO total_steps FROM approval_steps WHERE approval_steps.instance_id = NEW.instance_id;
  SELECT COUNT(*) INTO approved_steps FROM approval_steps WHERE approval_steps.instance_id = NEW.instance_id AND status = 'approved';

  IF total_steps > 0 AND total_steps = approved_steps THEN
    UPDATE approval_instances SET status = 'approved', updated_at = now() WHERE id = NEW.instance_id;
  END IF;

  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."update_approval_instance_status"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_bi_pivot_configs_timestamp"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."update_bi_pivot_configs_timestamp"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_dimension_weight"("p_dimension_code" "text", "p_new_weight" numeric) RETURNS boolean
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  -- 更新维度权重
  UPDATE live_stream_scoring_dimensions 
  SET weight = p_new_weight, updated_at = now()
  WHERE dimension_code = p_dimension_code AND is_active = true;
  
  -- 返回是否成功更新
  RETURN FOUND;
END;
$$;


ALTER FUNCTION "public"."update_dimension_weight"("p_dimension_code" "text", "p_new_weight" numeric) OWNER TO "postgres";


COMMENT ON FUNCTION "public"."update_dimension_weight"("p_dimension_code" "text", "p_new_weight" numeric) IS '更新维度权重函数';



CREATE OR REPLACE FUNCTION "public"."update_exchange_goods_timestamp"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."update_exchange_goods_timestamp"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_instance_status_on_reject"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  IF NEW.status = 'rejected' THEN
    UPDATE approval_instances
    SET status = 'rejected'
    WHERE id = NEW.instance_id AND status != 'rejected';
  END IF;
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."update_instance_status_on_reject"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_live_stream_schedules_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."update_live_stream_schedules_updated_at"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_live_stream_scoring"("p_schedule_id" bigint, "p_scoring_data" "jsonb", "p_scored_by" bigint, "p_average_score" numeric) RETURNS boolean
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  -- 使用PostgreSQL的JSON函数来验证和格式化数据
  UPDATE live_stream_schedules 
  SET 
    scoring_data = p_scoring_data,
    scored_by = p_scored_by,
    scored_at = now(),
    average_score = p_average_score,
    scoring_status = 'scored'
  WHERE id = p_schedule_id;
  
  RETURN FOUND;
END;
$$;


ALTER FUNCTION "public"."update_live_stream_scoring"("p_schedule_id" bigint, "p_scoring_data" "jsonb", "p_scored_by" bigint, "p_average_score" numeric) OWNER TO "postgres";


COMMENT ON FUNCTION "public"."update_live_stream_scoring"("p_schedule_id" bigint, "p_scoring_data" "jsonb", "p_scored_by" bigint, "p_average_score" numeric) IS '安全的评分更新函数（避免JSON解析错误）';



CREATE OR REPLACE FUNCTION "public"."update_scoring_status"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  -- 当有评分数据时，更新评分状态
  IF NEW.scoring_data IS NOT NULL AND NEW.scored_by IS NOT NULL THEN
    NEW.scoring_status := 'scored';
    NEW.scored_at := now();
  ELSIF NEW.scoring_data IS NULL THEN
    NEW.scoring_status := 'not_scored';
    NEW.scored_by := NULL;
    NEW.scored_at := NULL;
  END IF;
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."update_scoring_status"() OWNER TO "postgres";


COMMENT ON FUNCTION "public"."update_scoring_status"() IS '自动更新评分状态触发器函数';



CREATE OR REPLACE FUNCTION "public"."update_simple_allocation_rules_timestamp"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
    NEW.updated_at := NOW();
    RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."update_simple_allocation_rules_timestamp"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_updated_at_column"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."update_updated_at_column"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_user_points_wallet"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  -- 插入或更新积分钱包
  INSERT INTO user_points_wallet (user_id, total_points, total_earned_points, total_consumed_points, updated_at)
  VALUES (
    NEW.user_id,
    COALESCE((SELECT total_points FROM user_points_wallet WHERE user_id = NEW.user_id), 0) + NEW.points_change,
    CASE 
      WHEN NEW.points_change > 0 THEN COALESCE((SELECT total_earned_points FROM user_points_wallet WHERE user_id = NEW.user_id), 0) + NEW.points_change
      ELSE COALESCE((SELECT total_earned_points FROM user_points_wallet WHERE user_id = NEW.user_id), 0)
    END,
    CASE 
      WHEN NEW.points_change < 0 THEN COALESCE((SELECT total_consumed_points FROM user_points_wallet WHERE user_id = NEW.user_id), 0) + ABS(NEW.points_change)
      ELSE COALESCE((SELECT total_consumed_points FROM user_points_wallet WHERE user_id = NEW.user_id), 0)
    END,
    NOW()
  )
  ON CONFLICT (user_id) DO UPDATE SET
    total_points = user_points_wallet.total_points + NEW.points_change,
    total_earned_points = CASE 
      WHEN NEW.points_change > 0 THEN user_points_wallet.total_earned_points + NEW.points_change
      ELSE user_points_wallet.total_earned_points
    END,
    total_consumed_points = CASE 
      WHEN NEW.points_change < 0 THEN user_points_wallet.total_consumed_points + ABS(NEW.points_change)
      ELSE user_points_wallet.total_consumed_points
    END,
    updated_at = NOW();
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."update_user_points_wallet"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_weighted_score"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  -- 当scoring_data更新时，直接计算评分
  IF NEW.scoring_data IS NOT NULL THEN
    NEW.average_score := calculate_weighted_score(NEW.scoring_data);
  END IF;
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."update_weighted_score"() OWNER TO "postgres";


COMMENT ON FUNCTION "public"."update_weighted_score"() IS '自动更新加权评分触发器函数';



CREATE OR REPLACE FUNCTION "public"."validate_allocation_system"() RETURNS "jsonb"
    LANGUAGE "plpgsql"
    AS $$
DECLARE
    result jsonb := '{}';
    active_users_count integer;
    user_groups_count integer;
    allocation_rules_count integer;
BEGIN
    -- 检查活跃用户数量
    SELECT COUNT(*) INTO active_users_count
    FROM users_profile
    WHERE status = 'active';
    
    -- 检查用户组数量
    SELECT COUNT(*) INTO user_groups_count
    FROM users_list
    WHERE list IS NOT NULL AND array_length(list, 1) > 0;
    
    -- 检查分配规则数量
    SELECT COUNT(*) INTO allocation_rules_count
    FROM simple_allocation_rules
    WHERE is_active = true;
    
    -- 构建结果
    result := jsonb_build_object(
        'active_users', active_users_count,
        'user_groups', user_groups_count,
        'allocation_rules', allocation_rules_count,
        'system_ready', (active_users_count > 0 AND user_groups_count > 0 AND allocation_rules_count > 0),
        'validation_time', NOW()
    );
    
    RETURN result;
END;
$$;


ALTER FUNCTION "public"."validate_allocation_system"() OWNER TO "postgres";

SET default_tablespace = '';

SET default_table_access_method = "heap";


CREATE TABLE IF NOT EXISTS "public"."Selection" (
    "id" bigint NOT NULL,
    "name" "text",
    "selection" json,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."Selection" OWNER TO "postgres";


COMMENT ON TABLE "public"."Selection" IS '选择数据';



ALTER TABLE "public"."Selection" ALTER COLUMN "id" ADD GENERATED BY DEFAULT AS IDENTITY (
    SEQUENCE NAME "public"."Selection_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);



CREATE TABLE IF NOT EXISTS "public"."achievement_progress_logs" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" bigint NOT NULL,
    "achievement_id" "uuid" NOT NULL,
    "old_progress" integer NOT NULL,
    "new_progress" integer NOT NULL,
    "progress_change" integer NOT NULL,
    "trigger_source" "text" NOT NULL,
    "trigger_data" "jsonb",
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."achievement_progress_logs" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."achievements" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "code" "text" NOT NULL,
    "name" "text" NOT NULL,
    "description" "text" NOT NULL,
    "category" "text" NOT NULL,
    "icon" "text" NOT NULL,
    "icon_type" "text" DEFAULT 'emoji'::"text",
    "icon_url" "text",
    "color" "text" DEFAULT '#1890ff'::"text",
    "points_reward" integer DEFAULT 0,
    "avatar_frame_id" "uuid",
    "badge_id" "uuid",
    "requirements" "jsonb" NOT NULL,
    "is_active" boolean DEFAULT true,
    "is_hidden" boolean DEFAULT false,
    "sort_order" integer DEFAULT 0,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "achievements_category_check" CHECK (("category" = ANY (ARRAY['milestone'::"text", 'skill'::"text", 'social'::"text", 'special'::"text"]))),
    CONSTRAINT "achievements_icon_type_check" CHECK (("icon_type" = ANY (ARRAY['emoji'::"text", 'svg'::"text", 'png'::"text", 'jpg'::"text", 'webp'::"text"])))
);


ALTER TABLE "public"."achievements" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."announcement_reads" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "announcement_id" "uuid",
    "user_id" bigint,
    "read_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."announcement_reads" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."announcements" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "title" "text" NOT NULL,
    "content" "text" NOT NULL,
    "type" "text" DEFAULT 'info'::"text" NOT NULL,
    "priority" integer DEFAULT 0,
    "target_roles" "text"[],
    "target_organizations" "uuid"[],
    "is_active" boolean DEFAULT true,
    "start_time" timestamp with time zone DEFAULT "now"(),
    "end_time" timestamp with time zone,
    "created_by" bigint,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "announcements_type_check" CHECK (("type" = ANY (ARRAY['info'::"text", 'warning'::"text", 'success'::"text", 'error'::"text"])))
);


ALTER TABLE "public"."announcements" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."approval_flows" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "name" "text" NOT NULL,
    "type" "text" NOT NULL,
    "config" "jsonb" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."approval_flows" OWNER TO "postgres";


COMMENT ON TABLE "public"."approval_flows" IS '审批流模板表，定义各业务类型的审批流程结构';



COMMENT ON COLUMN "public"."approval_flows"."config" IS 'JSON格式，定义审批节点、权限、审批模式、默认审批人等';



CREATE TABLE IF NOT EXISTS "public"."approval_instances" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "flow_id" "uuid" NOT NULL,
    "target_table" "text" NOT NULL,
    "target_id" "text" NOT NULL,
    "status" "text" DEFAULT 'pending'::"text" NOT NULL,
    "current_step" integer DEFAULT 0 NOT NULL,
    "created_by" bigint NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "config" "jsonb",
    "type" "text"
);


ALTER TABLE "public"."approval_instances" OWNER TO "postgres";


COMMENT ON TABLE "public"."approval_instances" IS '审批实例表，记录每次审批流的实际运行情况，created_by为users_profile.id';



COMMENT ON COLUMN "public"."approval_instances"."config" IS '业务自定义配置，如回退理由、证据等';



COMMENT ON COLUMN "public"."approval_instances"."type" IS '业务类型，如lead_rollback、points等';



CREATE TABLE IF NOT EXISTS "public"."approval_steps" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "instance_id" "uuid" NOT NULL,
    "step_index" integer NOT NULL,
    "approver_id" bigint NOT NULL,
    "status" "text" DEFAULT 'pending'::"text" NOT NULL,
    "comment" "text",
    "action_time" timestamp with time zone,
    "node_config" "jsonb",
    "updated_at" timestamp with time zone
);


ALTER TABLE "public"."approval_steps" OWNER TO "postgres";


COMMENT ON TABLE "public"."approval_steps" IS '审批节点表，记录每个审批实例的各节点审批情况，approver_id为users_profile.id';



COMMENT ON COLUMN "public"."approval_steps"."node_config" IS 'JSON格式，记录节点配置快照，便于追溯审批人分配规则等';



CREATE TABLE IF NOT EXISTS "public"."users_profile" (
    "id" bigint NOT NULL,
    "user_id" "uuid",
    "organization_id" "uuid",
    "nickname" "text",
    "email" "text",
    "status" "text",
    "updated_at" timestamp with time zone DEFAULT ("now"() AT TIME ZONE 'UTC'::"text"),
    "avatar_url" "text",
    "created_at" timestamp with time zone DEFAULT ("now"() AT TIME ZONE 'UTC'::"text"),
    "wechat_work_corpid" character varying(64),
    "wechat_work_userid" character varying(64),
    "wechat_work_name" character varying(100),
    "wechat_work_avatar" character varying(500),
    "wechat_work_department" "text"[],
    "wechat_work_position" character varying(100),
    "wechat_work_mobile" character varying(20),
    "wechat_work_status" character varying(20) DEFAULT 'active'::character varying
);


ALTER TABLE "public"."users_profile" OWNER TO "postgres";


COMMENT ON COLUMN "public"."users_profile"."wechat_work_corpid" IS '企业微信企业ID (corpid)';



COMMENT ON COLUMN "public"."users_profile"."wechat_work_userid" IS '企业微信用户ID (userid)';



COMMENT ON COLUMN "public"."users_profile"."wechat_work_name" IS '企业微信用户姓名';



COMMENT ON COLUMN "public"."users_profile"."wechat_work_avatar" IS '企业微信头像URL';



COMMENT ON COLUMN "public"."users_profile"."wechat_work_department" IS '企业微信部门信息';



COMMENT ON COLUMN "public"."users_profile"."wechat_work_position" IS '企业微信职位';



COMMENT ON COLUMN "public"."users_profile"."wechat_work_mobile" IS '企业微信手机号';



COMMENT ON COLUMN "public"."users_profile"."wechat_work_status" IS '企业微信账号状态';



CREATE OR REPLACE VIEW "public"."approval_instances_with_metadata" AS
 SELECT "ai"."id",
    "ai"."flow_id",
    "ai"."target_table",
    "ai"."target_id",
    "ai"."status",
    "ai"."current_step",
    "ai"."created_by",
    "ai"."created_at",
    "ai"."updated_at",
    "af"."name" AS "flow_name",
    "af"."type" AS "flow_type",
    "up"."nickname" AS "creator_nickname",
    ( SELECT "max"("approval_steps"."action_time") AS "max"
           FROM "public"."approval_steps"
          WHERE (("approval_steps"."instance_id" = "ai"."id") AND ("approval_steps"."action_time" IS NOT NULL))) AS "latest_action_time",
        CASE
            WHEN ("ai"."status" = 'pending'::"text") THEN NULL::numeric
            ELSE (EXTRACT(epoch FROM (( SELECT "max"("approval_steps"."action_time") AS "max"
               FROM "public"."approval_steps"
              WHERE (("approval_steps"."instance_id" = "ai"."id") AND ("approval_steps"."action_time" IS NOT NULL))) - "ai"."created_at")) / (60)::numeric)
        END AS "approval_duration_minutes",
    ( SELECT "count"(*) AS "count"
           FROM "public"."approval_steps"
          WHERE (("approval_steps"."instance_id" = "ai"."id") AND ("approval_steps"."status" = 'pending'::"text"))) AS "pending_steps_count",
    ( SELECT "count"(*) AS "count"
           FROM "public"."approval_steps"
          WHERE ("approval_steps"."instance_id" = "ai"."id")) AS "total_steps_count"
   FROM (("public"."approval_instances" "ai"
     LEFT JOIN "public"."approval_flows" "af" ON (("ai"."flow_id" = "af"."id")))
     LEFT JOIN "public"."users_profile" "up" ON (("ai"."created_by" = "up"."id")));


ALTER VIEW "public"."approval_instances_with_metadata" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."avatar_frames" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "name" "text" NOT NULL,
    "description" "text",
    "frame_type" "text" NOT NULL,
    "frame_data" "jsonb" NOT NULL,
    "rarity" "text" DEFAULT 'common'::"text",
    "is_active" boolean DEFAULT true,
    "sort_order" integer DEFAULT 0,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "code" "text",
    "icon_url" "text",
    "updated_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "avatar_frames_frame_type_check" CHECK (("frame_type" = ANY (ARRAY['border'::"text", 'background'::"text", 'overlay'::"text"]))),
    CONSTRAINT "avatar_frames_rarity_check" CHECK (("rarity" = ANY (ARRAY['common'::"text", 'rare'::"text", 'epic'::"text", 'legendary'::"text"])))
);


ALTER TABLE "public"."avatar_frames" OWNER TO "postgres";


COMMENT ON COLUMN "public"."avatar_frames"."icon_url" IS '头像框图片URL，支持PNG、JPG等格式';



CREATE TABLE IF NOT EXISTS "public"."badges" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "name" "text" NOT NULL,
    "description" "text",
    "icon" "text" NOT NULL,
    "icon_type" "text" DEFAULT 'emoji'::"text",
    "icon_url" "text",
    "color" "text" DEFAULT '#1890ff'::"text",
    "rarity" "text" DEFAULT 'common'::"text",
    "is_active" boolean DEFAULT true,
    "sort_order" integer DEFAULT 0,
    "created_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "badges_icon_type_check" CHECK (("icon_type" = ANY (ARRAY['emoji'::"text", 'svg'::"text", 'png'::"text", 'jpg'::"text", 'webp'::"text"]))),
    CONSTRAINT "badges_rarity_check" CHECK (("rarity" = ANY (ARRAY['common'::"text", 'rare'::"text", 'epic'::"text", 'legendary'::"text"])))
);


ALTER TABLE "public"."badges" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."banners" (
    "id" bigint NOT NULL,
    "title" character varying(100) NOT NULL,
    "image_url" character varying(255) NOT NULL,
    "description" "text",
    "sort_order" integer DEFAULT 0,
    "is_active" boolean DEFAULT true,
    "start_time" timestamp without time zone,
    "end_time" timestamp without time zone,
    "jump_type" character varying(20) NOT NULL,
    "jump_target" character varying(255) NOT NULL,
    "created_at" timestamp without time zone DEFAULT "now"(),
    "updated_at" timestamp without time zone DEFAULT "now"(),
    "page_type" character varying(50) DEFAULT 'home'::character varying NOT NULL,
    CONSTRAINT "check_page_type" CHECK ((("page_type")::"text" = ANY ((ARRAY['home'::character varying, 'live_stream_registration'::character varying, 'other'::character varying])::"text"[])))
);


ALTER TABLE "public"."banners" OWNER TO "postgres";


CREATE SEQUENCE IF NOT EXISTS "public"."banners_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE "public"."banners_id_seq" OWNER TO "postgres";


ALTER SEQUENCE "public"."banners_id_seq" OWNED BY "public"."banners"."id";



CREATE TABLE IF NOT EXISTS "public"."bi_pivot_configs" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "name" "text" NOT NULL,
    "description" "text",
    "config" "jsonb" NOT NULL,
    "data_source" "text" NOT NULL,
    "created_by" "text",
    "is_public" boolean DEFAULT false,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."bi_pivot_configs" OWNER TO "postgres";


COMMENT ON TABLE "public"."bi_pivot_configs" IS 'BI透视表配置表';



COMMENT ON COLUMN "public"."bi_pivot_configs"."config" IS 'JSON格式的透视表配置，包含行维度、列维度、值字段等';



COMMENT ON COLUMN "public"."bi_pivot_configs"."data_source" IS '数据源表名，如joined_data、leads等';



CREATE TABLE IF NOT EXISTS "public"."community_keywords" (
    "id" integer NOT NULL,
    "keyword" "text"[] NOT NULL,
    "community" "public"."community" NOT NULL,
    "priority" integer DEFAULT 0
);


ALTER TABLE "public"."community_keywords" OWNER TO "postgres";


CREATE SEQUENCE IF NOT EXISTS "public"."community_keywords_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE "public"."community_keywords_id_seq" OWNER TO "postgres";


ALTER SEQUENCE "public"."community_keywords_id_seq" OWNED BY "public"."community_keywords"."id";



CREATE TABLE IF NOT EXISTS "public"."deals" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "leadid" "text" NOT NULL,
    "contractdate" "date",
    "community" "public"."community",
    "contractnumber" "text",
    "roomnumber" "text",
    "created_at" timestamp with time zone DEFAULT ("now"() AT TIME ZONE 'UTC'::"text"),
    "updated_at" timestamp with time zone DEFAULT ("now"() AT TIME ZONE 'UTC'::"text"),
    "invalid" boolean DEFAULT false
);


ALTER TABLE "public"."deals" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."dimension_performance_stats" AS
SELECT
    NULL::"text" AS "dimension_name",
    NULL::"text" AS "dimension_code",
    NULL::numeric(3,2) AS "weight",
    NULL::bigint AS "total_evaluations",
    NULL::numeric AS "avg_dimension_score",
    NULL::numeric AS "min_dimension_score",
    NULL::numeric AS "max_dimension_score";


ALTER VIEW "public"."dimension_performance_stats" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."exchange_goods" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "name" "text" NOT NULL,
    "description" "text",
    "category" "text" NOT NULL,
    "points_cost" integer NOT NULL,
    "icon" "text",
    "icon_type" "text" DEFAULT 'emoji'::"text",
    "icon_url" "text",
    "color" "text" DEFAULT '#1890ff'::"text",
    "is_active" boolean DEFAULT true,
    "is_featured" boolean DEFAULT false,
    "sort_order" integer DEFAULT 0,
    "exchange_limit" integer,
    "daily_limit" integer,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "exchange_goods_icon_type_check" CHECK (("icon_type" = ANY (ARRAY['emoji'::"text", 'svg'::"text", 'png'::"text", 'jpg'::"text", 'webp'::"text"]))),
    CONSTRAINT "exchange_goods_points_cost_check" CHECK (("points_cost" > 0))
);


ALTER TABLE "public"."exchange_goods" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."followups" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "leadid" "text" NOT NULL,
    "leadtype" "text",
    "followupstage" "public"."followupstage" DEFAULT '待接收'::"public"."followupstage",
    "customerprofile" "public"."customerprofile",
    "worklocation" "text",
    "userbudget" "text",
    "moveintime" timestamp with time zone DEFAULT ("now"() AT TIME ZONE 'UTC'::"text"),
    "userrating" "public"."userrating",
    "majorcategory" "text",
    "invalid" boolean,
    "followupresult" "text",
    "scheduletime" timestamp with time zone DEFAULT ("now"() AT TIME ZONE 'UTC'::"text"),
    "scheduledcommunity" "public"."community",
    "created_at" timestamp with time zone DEFAULT ("now"() AT TIME ZONE 'UTC'::"text"),
    "updated_at" timestamp with time zone DEFAULT ("now"() AT TIME ZONE 'UTC'::"text"),
    "interviewsales_user_id" bigint
);


ALTER TABLE "public"."followups" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."frequency_control_config" (
    "id" bigint NOT NULL,
    "operation_type" character varying(50) NOT NULL,
    "max_operations" integer NOT NULL,
    "time_window_minutes" integer NOT NULL,
    "warning_message" "text" NOT NULL,
    "is_active" boolean DEFAULT true,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."frequency_control_config" OWNER TO "postgres";


COMMENT ON TABLE "public"."frequency_control_config" IS '频率控制配置表';



COMMENT ON COLUMN "public"."frequency_control_config"."operation_type" IS '操作类型';



COMMENT ON COLUMN "public"."frequency_control_config"."max_operations" IS '最大操作次数';



COMMENT ON COLUMN "public"."frequency_control_config"."time_window_minutes" IS '时间窗口（分钟）';



COMMENT ON COLUMN "public"."frequency_control_config"."warning_message" IS '警告消息';



CREATE SEQUENCE IF NOT EXISTS "public"."frequency_control_config_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE "public"."frequency_control_config_id_seq" OWNER TO "postgres";


ALTER SEQUENCE "public"."frequency_control_config_id_seq" OWNED BY "public"."frequency_control_config"."id";



CREATE TABLE IF NOT EXISTS "public"."operation_frequency_control" (
    "id" bigint NOT NULL,
    "user_id" bigint NOT NULL,
    "operation_type" character varying(50) NOT NULL,
    "operation_count" integer DEFAULT 1,
    "window_start" timestamp with time zone NOT NULL,
    "window_end" timestamp with time zone NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."operation_frequency_control" OWNER TO "postgres";


COMMENT ON TABLE "public"."operation_frequency_control" IS '操作频率控制表';



COMMENT ON COLUMN "public"."operation_frequency_control"."user_id" IS '用户ID';



COMMENT ON COLUMN "public"."operation_frequency_control"."operation_type" IS '操作类型：dropout(丢单)、followup(跟进)、stage_change(阶段变更)';



COMMENT ON COLUMN "public"."operation_frequency_control"."operation_count" IS '操作次数';



COMMENT ON COLUMN "public"."operation_frequency_control"."window_start" IS '时间窗口开始时间';



COMMENT ON COLUMN "public"."operation_frequency_control"."window_end" IS '时间窗口结束时间';



CREATE OR REPLACE VIEW "public"."frequency_control_summary" AS
 SELECT "fc"."operation_type",
    "fc"."max_operations",
    "fc"."time_window_minutes",
    "fc"."warning_message",
    "count"("ofc"."id") AS "active_records",
    "sum"("ofc"."operation_count") AS "total_operations",
    "fc"."is_active"
   FROM ("public"."frequency_control_config" "fc"
     LEFT JOIN "public"."operation_frequency_control" "ofc" ON (((("fc"."operation_type")::"text" = ("ofc"."operation_type")::"text") AND ("ofc"."window_end" > ("now"() - ('00:01:00'::interval * ("fc"."time_window_minutes")::double precision))))))
  GROUP BY "fc"."operation_type", "fc"."max_operations", "fc"."time_window_minutes", "fc"."warning_message", "fc"."is_active"
  ORDER BY "fc"."operation_type";


ALTER VIEW "public"."frequency_control_summary" OWNER TO "postgres";


COMMENT ON VIEW "public"."frequency_control_summary" IS '频率控制汇总视图';



CREATE TABLE IF NOT EXISTS "public"."frequency_cooldown" (
    "user_id" bigint NOT NULL,
    "operation_type" character varying NOT NULL,
    "cooldown_level" integer DEFAULT 0,
    "last_blocked_at" timestamp with time zone,
    "cooldown_until" timestamp with time zone,
    "total_blocked_count" integer DEFAULT 0
);


ALTER TABLE "public"."frequency_cooldown" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."lead_points_cost" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "name" "text" NOT NULL,
    "description" "text",
    "is_active" boolean DEFAULT true,
    "base_points_cost" integer DEFAULT 30 NOT NULL,
    "dynamic_cost_config" "jsonb" DEFAULT '{}'::"jsonb",
    "conditions" "jsonb" DEFAULT '{}'::"jsonb",
    "priority" integer DEFAULT 0,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "lead_points_cost_positive" CHECK (("base_points_cost" > 0))
);


ALTER TABLE "public"."lead_points_cost" OWNER TO "postgres";


CREATE SEQUENCE IF NOT EXISTS "public"."leadid_sequence"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    MAXVALUE 99999
    CACHE 1
    CYCLE;


ALTER SEQUENCE "public"."leadid_sequence" OWNER TO "postgres";


COMMENT ON SEQUENCE "public"."leadid_sequence" IS '线索ID序列，用于生成唯一的leadid';



CREATE TABLE IF NOT EXISTS "public"."leads" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "leadid" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT ("now"() AT TIME ZONE 'UTC'::"text") NOT NULL,
    "updata_at" timestamp with time zone DEFAULT ("now"() AT TIME ZONE 'UTC'::"text") NOT NULL,
    "phone" "text",
    "wechat" "text",
    "qq" "text",
    "location" "text",
    "budget" "text",
    "remark" "text",
    "source" "public"."source",
    "douyinid" "text",
    "douyin_accountname" "text",
    "staffname" "text",
    "redbookid" "text",
    "area" "text",
    "notelink" "text",
    "campaignid" "text",
    "campaignname" "text",
    "unitid" "text",
    "unitname" "text",
    "creativedid" "text",
    "creativename" "text",
    "leadtype" "text",
    "traffictype" "text",
    "interactiontype" "text",
    "douyinleadid" "text",
    "leadstatus" "text",
    "approval_instance_id" "uuid"
);


ALTER TABLE "public"."leads" OWNER TO "postgres";


COMMENT ON COLUMN "public"."leads"."approval_instance_id" IS '关联的审批流实例ID';



CREATE TABLE IF NOT EXISTS "public"."live_stream_schedule_logs" (
    "id" bigint NOT NULL,
    "schedule_id" bigint NOT NULL,
    "operator_id" bigint,
    "operator_name" "text" NOT NULL,
    "operation_time" timestamp with time zone DEFAULT "now"(),
    "participants" bigint[] DEFAULT '{}'::bigint[] NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."live_stream_schedule_logs" OWNER TO "postgres";


COMMENT ON TABLE "public"."live_stream_schedule_logs" IS '直播安排操作日志表';



COMMENT ON COLUMN "public"."live_stream_schedule_logs"."schedule_id" IS '关联的直播安排ID';



COMMENT ON COLUMN "public"."live_stream_schedule_logs"."operator_id" IS '操作人ID';



COMMENT ON COLUMN "public"."live_stream_schedule_logs"."operator_name" IS '操作人姓名';



COMMENT ON COLUMN "public"."live_stream_schedule_logs"."operation_time" IS '操作时间';



COMMENT ON COLUMN "public"."live_stream_schedule_logs"."participants" IS '操作后的参与者列表';



CREATE SEQUENCE IF NOT EXISTS "public"."live_stream_schedule_logs_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE "public"."live_stream_schedule_logs_id_seq" OWNER TO "postgres";


ALTER SEQUENCE "public"."live_stream_schedule_logs_id_seq" OWNED BY "public"."live_stream_schedule_logs"."id";



CREATE TABLE IF NOT EXISTS "public"."live_stream_schedules" (
    "id" bigint NOT NULL,
    "date" "date" NOT NULL,
    "time_slot_id" "text" NOT NULL,
    "participant_ids" bigint[] DEFAULT '{}'::bigint[],
    "location" "text",
    "notes" "text",
    "status" "text" DEFAULT 'editing'::"text",
    "created_by" bigint,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "editing_by" bigint,
    "editing_at" timestamp with time zone,
    "editing_expires_at" timestamp with time zone,
    "lock_type" "text" DEFAULT 'none'::"text",
    "lock_reason" "text",
    "lock_end_time" timestamp with time zone,
    "average_score" numeric(3,1),
    "scoring_data" "jsonb",
    "scoring_status" "text" DEFAULT 'not_scored'::"text",
    "scored_by" bigint,
    "scored_at" timestamp with time zone,
    CONSTRAINT "live_stream_schedules_lock_type_check" CHECK (("lock_type" = ANY (ARRAY['none'::"text", 'manual'::"text", 'system'::"text", 'maintenance'::"text"]))),
    CONSTRAINT "live_stream_schedules_scoring_status_check" CHECK (("scoring_status" = ANY (ARRAY['not_scored'::"text", 'scoring_in_progress'::"text", 'scored'::"text", 'approved'::"text"]))),
    CONSTRAINT "live_stream_schedules_status_check" CHECK (("status" = ANY (ARRAY['available'::"text", 'booked'::"text", 'completed'::"text", 'cancelled'::"text", 'editing'::"text", 'locked'::"text"])))
);


ALTER TABLE "public"."live_stream_schedules" OWNER TO "postgres";


COMMENT ON TABLE "public"."live_stream_schedules" IS '直播日程表，包含评分相关字段';



COMMENT ON COLUMN "public"."live_stream_schedules"."status" IS '状态：editing(编辑中-默认), available(可报名), booked(已报名), completed(已完成), cancelled(已取消), locked(锁定)';



COMMENT ON COLUMN "public"."live_stream_schedules"."average_score" IS '平均评分';



COMMENT ON COLUMN "public"."live_stream_schedules"."scoring_data" IS '评分过程数据（JSONB格式）';



COMMENT ON COLUMN "public"."live_stream_schedules"."scoring_status" IS '评分状态：not_scored/scoring_in_progress/scored/approved';



COMMENT ON COLUMN "public"."live_stream_schedules"."scored_by" IS '评分人ID';



COMMENT ON COLUMN "public"."live_stream_schedules"."scored_at" IS '评分时间';



CREATE SEQUENCE IF NOT EXISTS "public"."live_stream_schedules_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE "public"."live_stream_schedules_id_seq" OWNER TO "postgres";


ALTER SEQUENCE "public"."live_stream_schedules_id_seq" OWNED BY "public"."live_stream_schedules"."id";



CREATE OR REPLACE VIEW "public"."live_stream_schedules_with_scoring" AS
 SELECT "lss"."id",
    "lss"."date",
    "lss"."time_slot_id",
    "lss"."created_by",
    "lss"."average_score",
    "lss"."scoring_status",
    "lss"."scored_by",
    "lss"."scored_at",
    "up"."nickname" AS "evaluator_name"
   FROM ("public"."live_stream_schedules" "lss"
     LEFT JOIN "public"."users_profile" "up" ON (("lss"."scored_by" = "up"."id")))
  ORDER BY "lss"."date" DESC, "lss"."time_slot_id";


ALTER VIEW "public"."live_stream_schedules_with_scoring" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."live_stream_scoring_dimensions" (
    "id" bigint NOT NULL,
    "dimension_name" "text" NOT NULL,
    "dimension_code" "text" NOT NULL,
    "description" "text",
    "weight" numeric(3,2) DEFAULT 1.00 NOT NULL,
    "sort_order" integer DEFAULT 0 NOT NULL,
    "is_active" boolean DEFAULT true NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."live_stream_scoring_dimensions" OWNER TO "postgres";


COMMENT ON TABLE "public"."live_stream_scoring_dimensions" IS '评分维度表';



CREATE SEQUENCE IF NOT EXISTS "public"."live_stream_scoring_dimensions_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE "public"."live_stream_scoring_dimensions_id_seq" OWNER TO "postgres";


ALTER SEQUENCE "public"."live_stream_scoring_dimensions_id_seq" OWNED BY "public"."live_stream_scoring_dimensions"."id";



CREATE TABLE IF NOT EXISTS "public"."live_stream_scoring_log" (
    "id" bigint NOT NULL,
    "schedule_id" bigint NOT NULL,
    "evaluator_id" bigint NOT NULL,
    "scoring_data" "jsonb" NOT NULL,
    "average_score" numeric(3,1) NOT NULL,
    "evaluation_notes" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."live_stream_scoring_log" OWNER TO "postgres";


COMMENT ON TABLE "public"."live_stream_scoring_log" IS '评分日志表';



CREATE SEQUENCE IF NOT EXISTS "public"."live_stream_scoring_log_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE "public"."live_stream_scoring_log_id_seq" OWNER TO "postgres";


ALTER SEQUENCE "public"."live_stream_scoring_log_id_seq" OWNED BY "public"."live_stream_scoring_log"."id";



CREATE TABLE IF NOT EXISTS "public"."live_stream_scoring_options" (
    "id" bigint NOT NULL,
    "dimension_code" "text" NOT NULL,
    "option_code" "text" NOT NULL,
    "option_text" "text" NOT NULL,
    "score" numeric(3,1) NOT NULL,
    "sort_order" integer DEFAULT 0 NOT NULL,
    "is_active" boolean DEFAULT true NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."live_stream_scoring_options" OWNER TO "postgres";


COMMENT ON TABLE "public"."live_stream_scoring_options" IS '评分选项表';



CREATE SEQUENCE IF NOT EXISTS "public"."live_stream_scoring_options_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE "public"."live_stream_scoring_options_id_seq" OWNER TO "postgres";


ALTER SEQUENCE "public"."live_stream_scoring_options_id_seq" OWNED BY "public"."live_stream_scoring_options"."id";



CREATE TABLE IF NOT EXISTS "public"."metrostations" (
    "id" bigint NOT NULL,
    "line" "text",
    "name" "text"
);


ALTER TABLE "public"."metrostations" OWNER TO "postgres";


COMMENT ON TABLE "public"."metrostations" IS '地铁点';



ALTER TABLE "public"."metrostations" ALTER COLUMN "id" ADD GENERATED BY DEFAULT AS IDENTITY (
    SEQUENCE NAME "public"."metrostations_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);



CREATE TABLE IF NOT EXISTS "public"."notification_templates" (
    "id" integer NOT NULL,
    "type" character varying(64) NOT NULL,
    "title" character varying(128) NOT NULL,
    "content" "text" NOT NULL,
    "is_active" boolean DEFAULT true NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."notification_templates" OWNER TO "postgres";


CREATE SEQUENCE IF NOT EXISTS "public"."notification_templates_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE "public"."notification_templates_id_seq" OWNER TO "postgres";


ALTER SEQUENCE "public"."notification_templates_id_seq" OWNED BY "public"."notification_templates"."id";



CREATE TABLE IF NOT EXISTS "public"."notifications" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" bigint NOT NULL,
    "type" "text" NOT NULL,
    "title" "text" NOT NULL,
    "content" "text",
    "metadata" "jsonb",
    "status" "text" DEFAULT 'unread'::"text",
    "priority" integer DEFAULT 0,
    "expires_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "read_at" timestamp with time zone,
    "handled_at" timestamp with time zone,
    "related_table" "text",
    "related_id" "text",
    CONSTRAINT "notifications_status_check" CHECK (("status" = ANY (ARRAY['unread'::"text", 'read'::"text", 'handled'::"text"])))
);


ALTER TABLE "public"."notifications" OWNER TO "postgres";


CREATE SEQUENCE IF NOT EXISTS "public"."operation_frequency_control_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE "public"."operation_frequency_control_id_seq" OWNER TO "postgres";


ALTER SEQUENCE "public"."operation_frequency_control_id_seq" OWNED BY "public"."operation_frequency_control"."id";



CREATE TABLE IF NOT EXISTS "public"."operation_logs" (
    "id" bigint NOT NULL,
    "user_id" bigint NOT NULL,
    "operation_type" character varying(50) NOT NULL,
    "record_id" character varying(50),
    "old_value" "text",
    "new_value" "text",
    "operation_result" character varying(20) NOT NULL,
    "ip_address" "inet",
    "user_agent" "text",
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."operation_logs" OWNER TO "postgres";


COMMENT ON TABLE "public"."operation_logs" IS '操作日志表';



COMMENT ON COLUMN "public"."operation_logs"."user_id" IS '用户ID';



COMMENT ON COLUMN "public"."operation_logs"."operation_type" IS '操作类型';



COMMENT ON COLUMN "public"."operation_logs"."record_id" IS '记录ID';



COMMENT ON COLUMN "public"."operation_logs"."old_value" IS '旧值';



COMMENT ON COLUMN "public"."operation_logs"."new_value" IS '新值';



COMMENT ON COLUMN "public"."operation_logs"."operation_result" IS '操作结果';



COMMENT ON COLUMN "public"."operation_logs"."ip_address" IS 'IP地址';



COMMENT ON COLUMN "public"."operation_logs"."user_agent" IS '用户代理';



CREATE SEQUENCE IF NOT EXISTS "public"."operation_logs_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE "public"."operation_logs_id_seq" OWNER TO "postgres";


ALTER SEQUENCE "public"."operation_logs_id_seq" OWNED BY "public"."operation_logs"."id";



CREATE TABLE IF NOT EXISTS "public"."organizations" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "name" "text" NOT NULL,
    "parent_id" "uuid",
    "description" "text",
    "admin" "uuid"
);


ALTER TABLE "public"."organizations" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."permissions" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "name" "text" NOT NULL,
    "description" "text",
    "resource" "text" NOT NULL,
    "action" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."permissions" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."points_exchange_records" (
    "id" integer NOT NULL,
    "user_id" bigint NOT NULL,
    "exchange_type" character varying(50) NOT NULL,
    "target_id" bigint NOT NULL,
    "points_used" integer NOT NULL,
    "exchange_time" timestamp without time zone DEFAULT "now"(),
    "status" character varying(20) DEFAULT 'SUCCESS'::character varying,
    "created_at" timestamp without time zone DEFAULT "now"(),
    "description" "text"
);


ALTER TABLE "public"."points_exchange_records" OWNER TO "postgres";


CREATE SEQUENCE IF NOT EXISTS "public"."points_exchange_records_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE "public"."points_exchange_records_id_seq" OWNER TO "postgres";


ALTER SEQUENCE "public"."points_exchange_records_id_seq" OWNED BY "public"."points_exchange_records"."id";



CREATE TABLE IF NOT EXISTS "public"."points_rules" (
    "id" integer NOT NULL,
    "rule_name" character varying(100) NOT NULL,
    "rule_type" character varying(50) NOT NULL,
    "source_type" character varying(50) NOT NULL,
    "points_value" integer NOT NULL,
    "is_active" boolean DEFAULT true,
    "start_time" timestamp without time zone,
    "end_time" timestamp without time zone,
    "max_times_per_day" integer,
    "max_times_total" integer,
    "conditions" "jsonb",
    "description" "text",
    "created_at" timestamp without time zone DEFAULT "now"(),
    "updated_at" timestamp without time zone DEFAULT "now"(),
    "created_by" bigint
);


ALTER TABLE "public"."points_rules" OWNER TO "postgres";


CREATE SEQUENCE IF NOT EXISTS "public"."points_rules_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE "public"."points_rules_id_seq" OWNER TO "postgres";


ALTER SEQUENCE "public"."points_rules_id_seq" OWNED BY "public"."points_rules"."id";



CREATE TABLE IF NOT EXISTS "public"."role_permissions" (
    "role_id" "uuid" NOT NULL,
    "permission_id" "uuid" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."role_permissions" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."roles" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "name" "text" NOT NULL,
    "description" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."roles" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."scoring_log_detail" AS
 SELECT "lssl"."id" AS "log_id",
    "lssl"."schedule_id",
    "lss"."date",
    "lss"."time_slot_id",
    "lss"."created_by",
    "lssl"."evaluator_id",
    "up_evaluator"."nickname" AS "evaluator_name",
    "lssl"."average_score",
    "lssl"."evaluation_notes",
    "lssl"."scoring_data",
    "lssl"."created_at" AS "scoring_created_at"
   FROM (("public"."live_stream_scoring_log" "lssl"
     JOIN "public"."live_stream_schedules" "lss" ON (("lssl"."schedule_id" = "lss"."id")))
     JOIN "public"."users_profile" "up_evaluator" ON (("lssl"."evaluator_id" = "up_evaluator"."id")))
  ORDER BY "lssl"."created_at" DESC;


ALTER VIEW "public"."scoring_log_detail" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."scoring_statistics" AS
 SELECT "date_trunc"('day'::"text", ("date")::timestamp with time zone) AS "score_date",
    "count"(*) AS "total_schedules",
    "count"(
        CASE
            WHEN ("scoring_status" = 'scored'::"text") THEN 1
            ELSE NULL::integer
        END) AS "scored_count",
    "count"(
        CASE
            WHEN ("scoring_status" = 'approved'::"text") THEN 1
            ELSE NULL::integer
        END) AS "approved_count",
    "avg"("average_score") AS "avg_score",
    "min"("average_score") AS "min_score",
    "max"("average_score") AS "max_score"
   FROM "public"."live_stream_schedules" "lss"
  WHERE ("average_score" IS NOT NULL)
  GROUP BY ("date_trunc"('day'::"text", ("date")::timestamp with time zone))
  ORDER BY ("date_trunc"('day'::"text", ("date")::timestamp with time zone)) DESC;


ALTER VIEW "public"."scoring_statistics" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."showings" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "leadid" "text" NOT NULL,
    "scheduletime" timestamp with time zone,
    "community" "public"."community",
    "arrivaltime" timestamp with time zone,
    "showingsales" bigint,
    "trueshowingsales" bigint,
    "viewresult" "text",
    "budget" integer,
    "moveintime" timestamp with time zone,
    "remark" "text",
    "renttime" integer,
    "created_at" timestamp with time zone DEFAULT ("now"() AT TIME ZONE 'UTC'::"text"),
    "updated_at" timestamp with time zone DEFAULT ("now"() AT TIME ZONE 'UTC'::"text"),
    "invalid" boolean
);


ALTER TABLE "public"."showings" OWNER TO "postgres";


COMMENT ON COLUMN "public"."showings"."showingsales" IS '本次带看分配到的用户ID';



CREATE TABLE IF NOT EXISTS "public"."showings_allocation_logs" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "community" "public"."community" NOT NULL,
    "assigned_user_id" bigint,
    "allocation_method" "text",
    "queue_type" "text",
    "processing_details" "jsonb",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "skip_card_consumed" boolean DEFAULT false,
    "direct_card_consumed" boolean DEFAULT false,
    "quality_check_passed" boolean,
    "remark" "text"
);


ALTER TABLE "public"."showings_allocation_logs" OWNER TO "postgres";


COMMENT ON TABLE "public"."showings_allocation_logs" IS '带看分配日志表，记录每次带看分配的执行情况';



COMMENT ON COLUMN "public"."showings_allocation_logs"."id" IS '日志记录唯一标识';



COMMENT ON COLUMN "public"."showings_allocation_logs"."community" IS '社区标识';



COMMENT ON COLUMN "public"."showings_allocation_logs"."assigned_user_id" IS '分配的带看人ID';



COMMENT ON COLUMN "public"."showings_allocation_logs"."allocation_method" IS '分配方法：direct(直通队列)、skip(轮空)、basic(基础队列)、assigned(指定人)';



COMMENT ON COLUMN "public"."showings_allocation_logs"."queue_type" IS '队列类型：direct(直通)、skip(轮空)、basic(基础)';



COMMENT ON COLUMN "public"."showings_allocation_logs"."processing_details" IS '处理详情JSON';



COMMENT ON COLUMN "public"."showings_allocation_logs"."created_at" IS '创建时间';



COMMENT ON COLUMN "public"."showings_allocation_logs"."skip_card_consumed" IS '是否消耗了轮空卡';



COMMENT ON COLUMN "public"."showings_allocation_logs"."direct_card_consumed" IS '是否消耗了直通卡';



COMMENT ON COLUMN "public"."showings_allocation_logs"."quality_check_passed" IS '质量控制是否通过';



COMMENT ON COLUMN "public"."showings_allocation_logs"."remark" IS '备注信息';



CREATE TABLE IF NOT EXISTS "public"."showings_queue_record" (
    "id" integer NOT NULL,
    "user_id" bigint NOT NULL,
    "community" "public"."community" NOT NULL,
    "queue_type" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "consumed" boolean DEFAULT false,
    "consumed_at" timestamp with time zone,
    "remark" "text"
);


ALTER TABLE "public"."showings_queue_record" OWNER TO "postgres";


COMMENT ON TABLE "public"."showings_queue_record" IS '带看分配队列消耗记录表，直通/轮空每次消耗一条记录';



COMMENT ON COLUMN "public"."showings_queue_record"."queue_type" IS '队列类型，direct=直通，skip=轮空';



COMMENT ON COLUMN "public"."showings_queue_record"."consumed" IS '是否已被消耗，true=已消耗，false=未消耗';



COMMENT ON COLUMN "public"."showings_queue_record"."consumed_at" IS '消耗时间';



COMMENT ON COLUMN "public"."showings_queue_record"."remark" IS '操作理由，记录直通卡/轮空卡的发放或消耗原因';



CREATE SEQUENCE IF NOT EXISTS "public"."showings_queue_record_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE "public"."showings_queue_record_id_seq" OWNER TO "postgres";


ALTER SEQUENCE "public"."showings_queue_record_id_seq" OWNED BY "public"."showings_queue_record"."id";



CREATE TABLE IF NOT EXISTS "public"."simple_allocation_logs" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "leadid" "text" NOT NULL,
    "rule_id" "uuid",
    "assigned_user_id" bigint,
    "allocation_method" "text",
    "selected_group_index" integer,
    "processing_details" "jsonb",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "points_cost" integer,
    "user_balance_before" integer,
    "user_balance_after" integer,
    "points_transaction_id" bigint,
    "cost_rule_id" "uuid"
);


ALTER TABLE "public"."simple_allocation_logs" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."simple_allocation_rules" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "name" "text" NOT NULL,
    "description" "text",
    "is_active" boolean DEFAULT true,
    "priority" integer DEFAULT 0,
    "conditions" "jsonb" DEFAULT '{}'::"jsonb",
    "user_groups" bigint[],
    "allocation_method" "public"."allocation_method" DEFAULT 'round_robin'::"public"."allocation_method",
    "enable_permission_check" boolean DEFAULT false,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."simple_allocation_rules" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."simple_allocation_stats" AS
 SELECT "r"."name" AS "rule_name",
    "count"(*) AS "total_allocations",
    "count"(DISTINCT "l"."assigned_user_id") AS "unique_users",
    "avg"("l"."selected_group_index") AS "avg_group_index",
    "count"(*) FILTER (WHERE ("l"."selected_group_index" = 1)) AS "first_group_success",
    "round"(((("count"(*) FILTER (WHERE ("l"."selected_group_index" = 1)))::numeric / ("count"(*))::numeric) * (100)::numeric), 2) AS "first_group_success_rate",
    "min"("l"."created_at") AS "first_allocation",
    "max"("l"."created_at") AS "last_allocation"
   FROM ("public"."simple_allocation_logs" "l"
     JOIN "public"."simple_allocation_rules" "r" ON (("l"."rule_id" = "r"."id")))
  GROUP BY "r"."id", "r"."name"
  ORDER BY ("count"(*)) DESC;


ALTER VIEW "public"."simple_allocation_stats" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."user_achievements" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" bigint NOT NULL,
    "achievement_id" "uuid" NOT NULL,
    "progress" integer DEFAULT 0,
    "target" integer DEFAULT 1,
    "is_completed" boolean DEFAULT false,
    "completed_at" timestamp with time zone,
    "points_earned" integer DEFAULT 0,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."user_achievements" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."user_avatar_frames" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" bigint NOT NULL,
    "frame_id" "uuid" NOT NULL,
    "is_equipped" boolean DEFAULT false,
    "unlocked_at" timestamp with time zone DEFAULT "now"(),
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."user_avatar_frames" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."user_badges" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" bigint NOT NULL,
    "badge_id" "uuid" NOT NULL,
    "is_equipped" boolean DEFAULT false,
    "unlocked_at" timestamp with time zone DEFAULT "now"(),
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."user_badges" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."user_exchange_limits" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" bigint NOT NULL,
    "goods_id" "uuid" NOT NULL,
    "exchange_date" "date" NOT NULL,
    "exchange_count" integer DEFAULT 0,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."user_exchange_limits" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."user_points_transactions" (
    "id" integer NOT NULL,
    "user_id" bigint NOT NULL,
    "points_change" integer NOT NULL,
    "balance_after" integer NOT NULL,
    "transaction_type" character varying(50) NOT NULL,
    "source_type" character varying(50) NOT NULL,
    "source_id" "text",
    "description" "text",
    "created_at" timestamp without time zone DEFAULT "now"(),
    "created_by" bigint
);


ALTER TABLE "public"."user_points_transactions" OWNER TO "postgres";


CREATE SEQUENCE IF NOT EXISTS "public"."user_points_transactions_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE "public"."user_points_transactions_id_seq" OWNER TO "postgres";


ALTER SEQUENCE "public"."user_points_transactions_id_seq" OWNED BY "public"."user_points_transactions"."id";



CREATE TABLE IF NOT EXISTS "public"."user_points_wallet" (
    "id" integer NOT NULL,
    "user_id" bigint NOT NULL,
    "total_points" integer DEFAULT 0,
    "total_earned_points" integer DEFAULT 0,
    "total_consumed_points" integer DEFAULT 0,
    "created_at" timestamp without time zone DEFAULT "now"(),
    "updated_at" timestamp without time zone DEFAULT "now"()
);


ALTER TABLE "public"."user_points_wallet" OWNER TO "postgres";


CREATE SEQUENCE IF NOT EXISTS "public"."user_points_wallet_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE "public"."user_points_wallet_id_seq" OWNER TO "postgres";


ALTER SEQUENCE "public"."user_points_wallet_id_seq" OWNED BY "public"."user_points_wallet"."id";



CREATE TABLE IF NOT EXISTS "public"."user_roles" (
    "user_id" "uuid" NOT NULL,
    "role_id" "uuid" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."user_roles" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."users_list" (
    "id" bigint NOT NULL,
    "groupname" "text",
    "list" bigint[],
    "description" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "allocation" "public"."allocation_method" DEFAULT 'round_robin'::"public"."allocation_method",
    "enable_quality_control" boolean DEFAULT false,
    "daily_lead_limit" integer,
    "conversion_rate_requirement" numeric(5,2) DEFAULT NULL::numeric,
    "max_pending_leads" integer,
    "quality_control_config" "jsonb",
    "enable_community_matching" boolean DEFAULT true,
    "community" "public"."community"
);


ALTER TABLE "public"."users_list" OWNER TO "postgres";


COMMENT ON COLUMN "public"."users_list"."list" IS '基础队列用户ID数组';



COMMENT ON COLUMN "public"."users_list"."enable_quality_control" IS '是否启用质量控制';



COMMENT ON COLUMN "public"."users_list"."daily_lead_limit" IS '每日线索分配上限';



COMMENT ON COLUMN "public"."users_list"."conversion_rate_requirement" IS '30天转化率要求（百分比0-100）';



COMMENT ON COLUMN "public"."users_list"."max_pending_leads" IS '未接受线索数量上限';



COMMENT ON COLUMN "public"."users_list"."quality_control_config" IS '质量控制配置JSON，支持更复杂的规则';



COMMENT ON COLUMN "public"."users_list"."enable_community_matching" IS '是否启用社区匹配功能';



COMMENT ON COLUMN "public"."users_list"."community" IS '队列所属社区';



ALTER TABLE "public"."users_list" ALTER COLUMN "id" ADD GENERATED BY DEFAULT AS IDENTITY (
    SEQUENCE NAME "public"."users_list_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);



CREATE SEQUENCE IF NOT EXISTS "public"."users_profile_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE "public"."users_profile_id_seq" OWNER TO "postgres";


ALTER SEQUENCE "public"."users_profile_id_seq" OWNED BY "public"."users_profile"."id";



ALTER TABLE ONLY "public"."banners" ALTER COLUMN "id" SET DEFAULT "nextval"('"public"."banners_id_seq"'::"regclass");



ALTER TABLE ONLY "public"."community_keywords" ALTER COLUMN "id" SET DEFAULT "nextval"('"public"."community_keywords_id_seq"'::"regclass");



ALTER TABLE ONLY "public"."frequency_control_config" ALTER COLUMN "id" SET DEFAULT "nextval"('"public"."frequency_control_config_id_seq"'::"regclass");



ALTER TABLE ONLY "public"."live_stream_schedule_logs" ALTER COLUMN "id" SET DEFAULT "nextval"('"public"."live_stream_schedule_logs_id_seq"'::"regclass");



ALTER TABLE ONLY "public"."live_stream_schedules" ALTER COLUMN "id" SET DEFAULT "nextval"('"public"."live_stream_schedules_id_seq"'::"regclass");



ALTER TABLE ONLY "public"."live_stream_scoring_dimensions" ALTER COLUMN "id" SET DEFAULT "nextval"('"public"."live_stream_scoring_dimensions_id_seq"'::"regclass");



ALTER TABLE ONLY "public"."live_stream_scoring_log" ALTER COLUMN "id" SET DEFAULT "nextval"('"public"."live_stream_scoring_log_id_seq"'::"regclass");



ALTER TABLE ONLY "public"."live_stream_scoring_options" ALTER COLUMN "id" SET DEFAULT "nextval"('"public"."live_stream_scoring_options_id_seq"'::"regclass");



ALTER TABLE ONLY "public"."notification_templates" ALTER COLUMN "id" SET DEFAULT "nextval"('"public"."notification_templates_id_seq"'::"regclass");



ALTER TABLE ONLY "public"."operation_frequency_control" ALTER COLUMN "id" SET DEFAULT "nextval"('"public"."operation_frequency_control_id_seq"'::"regclass");



ALTER TABLE ONLY "public"."operation_logs" ALTER COLUMN "id" SET DEFAULT "nextval"('"public"."operation_logs_id_seq"'::"regclass");



ALTER TABLE ONLY "public"."points_exchange_records" ALTER COLUMN "id" SET DEFAULT "nextval"('"public"."points_exchange_records_id_seq"'::"regclass");



ALTER TABLE ONLY "public"."points_rules" ALTER COLUMN "id" SET DEFAULT "nextval"('"public"."points_rules_id_seq"'::"regclass");



ALTER TABLE ONLY "public"."showings_queue_record" ALTER COLUMN "id" SET DEFAULT "nextval"('"public"."showings_queue_record_id_seq"'::"regclass");



ALTER TABLE ONLY "public"."user_points_transactions" ALTER COLUMN "id" SET DEFAULT "nextval"('"public"."user_points_transactions_id_seq"'::"regclass");



ALTER TABLE ONLY "public"."user_points_wallet" ALTER COLUMN "id" SET DEFAULT "nextval"('"public"."user_points_wallet_id_seq"'::"regclass");



ALTER TABLE ONLY "public"."users_profile" ALTER COLUMN "id" SET DEFAULT "nextval"('"public"."users_profile_id_seq"'::"regclass");



ALTER TABLE ONLY "public"."Selection"
    ADD CONSTRAINT "Selection_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."achievement_progress_logs"
    ADD CONSTRAINT "achievement_progress_logs_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."achievements"
    ADD CONSTRAINT "achievements_code_key" UNIQUE ("code");



ALTER TABLE ONLY "public"."achievements"
    ADD CONSTRAINT "achievements_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."announcement_reads"
    ADD CONSTRAINT "announcement_reads_announcement_id_user_id_key" UNIQUE ("announcement_id", "user_id");



ALTER TABLE ONLY "public"."announcement_reads"
    ADD CONSTRAINT "announcement_reads_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."announcements"
    ADD CONSTRAINT "announcements_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."approval_flows"
    ADD CONSTRAINT "approval_flows_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."approval_instances"
    ADD CONSTRAINT "approval_instances_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."approval_steps"
    ADD CONSTRAINT "approval_steps_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."avatar_frames"
    ADD CONSTRAINT "avatar_frames_code_key" UNIQUE ("code");



ALTER TABLE ONLY "public"."avatar_frames"
    ADD CONSTRAINT "avatar_frames_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."badges"
    ADD CONSTRAINT "badges_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."banners"
    ADD CONSTRAINT "banners_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."bi_pivot_configs"
    ADD CONSTRAINT "bi_pivot_configs_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."community_keywords"
    ADD CONSTRAINT "community_keywords_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."deals"
    ADD CONSTRAINT "deals_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."exchange_goods"
    ADD CONSTRAINT "exchange_goods_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."followups"
    ADD CONSTRAINT "followups_leadid_key" UNIQUE ("leadid");



ALTER TABLE ONLY "public"."followups"
    ADD CONSTRAINT "followups_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."frequency_control_config"
    ADD CONSTRAINT "frequency_control_config_operation_type_key" UNIQUE ("operation_type");



ALTER TABLE ONLY "public"."frequency_control_config"
    ADD CONSTRAINT "frequency_control_config_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."frequency_cooldown"
    ADD CONSTRAINT "frequency_cooldown_pkey" PRIMARY KEY ("user_id", "operation_type");



ALTER TABLE ONLY "public"."lead_points_cost"
    ADD CONSTRAINT "lead_points_cost_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."leads"
    ADD CONSTRAINT "leads_leadid_key" UNIQUE ("leadid");



ALTER TABLE ONLY "public"."leads"
    ADD CONSTRAINT "leads_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."live_stream_schedule_logs"
    ADD CONSTRAINT "live_stream_schedule_logs_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."live_stream_schedules"
    ADD CONSTRAINT "live_stream_schedules_date_time_slot_unique" UNIQUE ("date", "time_slot_id");



ALTER TABLE ONLY "public"."live_stream_schedules"
    ADD CONSTRAINT "live_stream_schedules_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."live_stream_scoring_dimensions"
    ADD CONSTRAINT "live_stream_scoring_dimensions_dimension_code_key" UNIQUE ("dimension_code");



ALTER TABLE ONLY "public"."live_stream_scoring_dimensions"
    ADD CONSTRAINT "live_stream_scoring_dimensions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."live_stream_scoring_log"
    ADD CONSTRAINT "live_stream_scoring_log_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."live_stream_scoring_options"
    ADD CONSTRAINT "live_stream_scoring_options_dimension_option_unique" UNIQUE ("dimension_code", "option_code");



ALTER TABLE ONLY "public"."live_stream_scoring_options"
    ADD CONSTRAINT "live_stream_scoring_options_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."metrostations"
    ADD CONSTRAINT "metrostations_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."notification_templates"
    ADD CONSTRAINT "notification_templates_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."notifications"
    ADD CONSTRAINT "notifications_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."operation_frequency_control"
    ADD CONSTRAINT "operation_frequency_control_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."operation_logs"
    ADD CONSTRAINT "operation_logs_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."organizations"
    ADD CONSTRAINT "organizations_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."permissions"
    ADD CONSTRAINT "permissions_name_key" UNIQUE ("name");



ALTER TABLE ONLY "public"."permissions"
    ADD CONSTRAINT "permissions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."permissions"
    ADD CONSTRAINT "permissions_resource_action_key" UNIQUE ("resource", "action");



ALTER TABLE ONLY "public"."points_exchange_records"
    ADD CONSTRAINT "points_exchange_records_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."points_rules"
    ADD CONSTRAINT "points_rules_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."role_permissions"
    ADD CONSTRAINT "role_permissions_pkey" PRIMARY KEY ("role_id", "permission_id");



ALTER TABLE ONLY "public"."roles"
    ADD CONSTRAINT "roles_name_key" UNIQUE ("name");



ALTER TABLE ONLY "public"."roles"
    ADD CONSTRAINT "roles_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."showings_allocation_logs"
    ADD CONSTRAINT "showings_allocation_logs_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."showings"
    ADD CONSTRAINT "showings_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."showings_queue_record"
    ADD CONSTRAINT "showings_queue_record_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."simple_allocation_logs"
    ADD CONSTRAINT "simple_allocation_logs_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."simple_allocation_rules"
    ADD CONSTRAINT "simple_allocation_rules_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."user_achievements"
    ADD CONSTRAINT "user_achievements_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."user_achievements"
    ADD CONSTRAINT "user_achievements_user_id_achievement_id_key" UNIQUE ("user_id", "achievement_id");



ALTER TABLE ONLY "public"."user_avatar_frames"
    ADD CONSTRAINT "user_avatar_frames_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."user_avatar_frames"
    ADD CONSTRAINT "user_avatar_frames_user_id_frame_id_key" UNIQUE ("user_id", "frame_id");



ALTER TABLE ONLY "public"."user_badges"
    ADD CONSTRAINT "user_badges_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."user_badges"
    ADD CONSTRAINT "user_badges_user_id_badge_id_key" UNIQUE ("user_id", "badge_id");



ALTER TABLE ONLY "public"."user_exchange_limits"
    ADD CONSTRAINT "user_exchange_limits_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."user_exchange_limits"
    ADD CONSTRAINT "user_exchange_limits_user_id_goods_id_exchange_date_key" UNIQUE ("user_id", "goods_id", "exchange_date");



ALTER TABLE ONLY "public"."user_points_transactions"
    ADD CONSTRAINT "user_points_transactions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."user_points_wallet"
    ADD CONSTRAINT "user_points_wallet_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."user_points_wallet"
    ADD CONSTRAINT "user_points_wallet_user_id_key" UNIQUE ("user_id");



ALTER TABLE ONLY "public"."user_roles"
    ADD CONSTRAINT "user_roles_pkey" PRIMARY KEY ("user_id", "role_id");



ALTER TABLE ONLY "public"."users_list"
    ADD CONSTRAINT "users_list_community_key" UNIQUE ("community");



ALTER TABLE ONLY "public"."users_list"
    ADD CONSTRAINT "users_list_groupname_unique" UNIQUE ("groupname");



ALTER TABLE ONLY "public"."users_list"
    ADD CONSTRAINT "users_list_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."users_profile"
    ADD CONSTRAINT "users_profile_pkey" PRIMARY KEY ("id");



CREATE INDEX "idx_achievement_progress_logs_user_achievement" ON "public"."achievement_progress_logs" USING "btree" ("user_id", "achievement_id");



CREATE INDEX "idx_achievements_category" ON "public"."achievements" USING "btree" ("category", "is_active");



CREATE INDEX "idx_achievements_code" ON "public"."achievements" USING "btree" ("code");



CREATE INDEX "idx_announcement_reads_user" ON "public"."announcement_reads" USING "btree" ("user_id");



CREATE INDEX "idx_announcements_active_time" ON "public"."announcements" USING "btree" ("is_active", "start_time", "end_time");



CREATE INDEX "idx_announcements_priority" ON "public"."announcements" USING "btree" ("priority" DESC);



CREATE INDEX "idx_approval_instances_created_at_desc" ON "public"."approval_instances" USING "btree" ("created_at" DESC);



CREATE INDEX "idx_approval_instances_created_by" ON "public"."approval_instances" USING "btree" ("created_by");



CREATE INDEX "idx_approval_instances_flow_id" ON "public"."approval_instances" USING "btree" ("flow_id");



CREATE INDEX "idx_approval_instances_status" ON "public"."approval_instances" USING "btree" ("status");



CREATE INDEX "idx_approval_instances_status_created_at" ON "public"."approval_instances" USING "btree" ("status", "created_at" DESC);



CREATE INDEX "idx_approval_instances_target_id" ON "public"."approval_instances" USING "btree" ("target_id");



CREATE INDEX "idx_approval_steps_action_time" ON "public"."approval_steps" USING "btree" ("action_time" DESC);



CREATE INDEX "idx_approval_steps_approver_id" ON "public"."approval_steps" USING "btree" ("approver_id");



CREATE INDEX "idx_approval_steps_approver_id_status" ON "public"."approval_steps" USING "btree" ("approver_id", "status");



CREATE INDEX "idx_approval_steps_instance_id" ON "public"."approval_steps" USING "btree" ("instance_id");



CREATE INDEX "idx_approval_steps_instance_id_status" ON "public"."approval_steps" USING "btree" ("instance_id", "status");



CREATE INDEX "idx_approval_steps_status" ON "public"."approval_steps" USING "btree" ("status");



CREATE INDEX "idx_avatar_frames_icon_url" ON "public"."avatar_frames" USING "btree" ("icon_url") WHERE ("icon_url" IS NOT NULL);



CREATE INDEX "idx_banners_active" ON "public"."banners" USING "btree" ("is_active", "sort_order");



CREATE INDEX "idx_banners_page_type" ON "public"."banners" USING "btree" ("page_type");



CREATE INDEX "idx_banners_time" ON "public"."banners" USING "btree" ("start_time", "end_time");



CREATE INDEX "idx_bi_pivot_configs_created_at" ON "public"."bi_pivot_configs" USING "btree" ("created_at");



CREATE INDEX "idx_bi_pivot_configs_created_by" ON "public"."bi_pivot_configs" USING "btree" ("created_by");



CREATE INDEX "idx_bi_pivot_configs_is_public" ON "public"."bi_pivot_configs" USING "btree" ("is_public");



CREATE INDEX "idx_exchange_goods_active" ON "public"."exchange_goods" USING "btree" ("is_active", "sort_order");



CREATE INDEX "idx_exchange_goods_category" ON "public"."exchange_goods" USING "btree" ("category");



CREATE INDEX "idx_exchange_goods_featured" ON "public"."exchange_goods" USING "btree" ("is_featured") WHERE ("is_featured" = true);



CREATE INDEX "idx_followups_created_at" ON "public"."followups" USING "btree" ("created_at");



CREATE INDEX "idx_followups_user_stage" ON "public"."followups" USING "btree" ("interviewsales_user_id", "followupstage");



CREATE INDEX "idx_lead_points_cost_active" ON "public"."lead_points_cost" USING "btree" ("is_active", "priority") WHERE ("is_active" = true);



CREATE INDEX "idx_lead_points_cost_conditions" ON "public"."lead_points_cost" USING "gin" ("conditions");



CREATE INDEX "idx_leads_phone_created" ON "public"."leads" USING "btree" ("phone", "created_at") WHERE (("phone" IS NOT NULL) AND ("phone" <> ''::"text"));



CREATE INDEX "idx_leads_phone_wechat_concurrent" ON "public"."leads" USING "btree" ("phone", "wechat") WHERE (("phone" IS NOT NULL) OR ("wechat" IS NOT NULL));



CREATE INDEX "idx_leads_phone_wechat_created" ON "public"."leads" USING "btree" ("phone", "wechat", "created_at");



CREATE INDEX "idx_leads_wechat_created" ON "public"."leads" USING "btree" ("wechat", "created_at") WHERE (("wechat" IS NOT NULL) AND ("wechat" <> ''::"text"));



CREATE INDEX "idx_live_stream_logs_operation_time" ON "public"."live_stream_schedule_logs" USING "btree" ("operation_time");



CREATE INDEX "idx_live_stream_logs_operator_id" ON "public"."live_stream_schedule_logs" USING "btree" ("operator_id");



CREATE INDEX "idx_live_stream_logs_schedule_id" ON "public"."live_stream_schedule_logs" USING "btree" ("schedule_id");



CREATE INDEX "idx_live_stream_schedules_average_score" ON "public"."live_stream_schedules" USING "btree" ("average_score");



CREATE INDEX "idx_live_stream_schedules_composite_filter" ON "public"."live_stream_schedules" USING "btree" ("date", "time_slot_id", "status", "scoring_status", "average_score", "lock_type");



CREATE INDEX "idx_live_stream_schedules_date" ON "public"."live_stream_schedules" USING "btree" ("date");



CREATE INDEX "idx_live_stream_schedules_editing_by" ON "public"."live_stream_schedules" USING "btree" ("editing_by");



CREATE INDEX "idx_live_stream_schedules_editing_expires_at" ON "public"."live_stream_schedules" USING "btree" ("editing_expires_at");



CREATE INDEX "idx_live_stream_schedules_location" ON "public"."live_stream_schedules" USING "btree" ("location");



CREATE INDEX "idx_live_stream_schedules_participant_ids" ON "public"."live_stream_schedules" USING "gin" ("participant_ids");



CREATE INDEX "idx_live_stream_schedules_participant_search" ON "public"."live_stream_schedules" USING "gin" ("participant_ids");



CREATE INDEX "idx_live_stream_schedules_scored_at" ON "public"."live_stream_schedules" USING "btree" ("scored_at");



CREATE INDEX "idx_live_stream_schedules_scored_by" ON "public"."live_stream_schedules" USING "btree" ("scored_by");



CREATE INDEX "idx_live_stream_schedules_scoring_data" ON "public"."live_stream_schedules" USING "gin" ("scoring_data");



CREATE INDEX "idx_live_stream_schedules_scoring_status" ON "public"."live_stream_schedules" USING "btree" ("scoring_status");



CREATE INDEX "idx_live_stream_schedules_status" ON "public"."live_stream_schedules" USING "btree" ("status");



CREATE INDEX "idx_live_stream_schedules_time_slot" ON "public"."live_stream_schedules" USING "btree" ("time_slot_id");



CREATE INDEX "idx_live_stream_scoring_dimensions_active" ON "public"."live_stream_scoring_dimensions" USING "btree" ("is_active");



CREATE INDEX "idx_live_stream_scoring_dimensions_code" ON "public"."live_stream_scoring_dimensions" USING "btree" ("dimension_code");



CREATE INDEX "idx_live_stream_scoring_dimensions_sort" ON "public"."live_stream_scoring_dimensions" USING "btree" ("sort_order");



CREATE INDEX "idx_live_stream_scoring_log_created" ON "public"."live_stream_scoring_log" USING "btree" ("created_at");



CREATE INDEX "idx_live_stream_scoring_log_evaluator" ON "public"."live_stream_scoring_log" USING "btree" ("evaluator_id");



CREATE INDEX "idx_live_stream_scoring_log_schedule" ON "public"."live_stream_scoring_log" USING "btree" ("schedule_id");



CREATE INDEX "idx_live_stream_scoring_options_active" ON "public"."live_stream_scoring_options" USING "btree" ("is_active");



CREATE INDEX "idx_live_stream_scoring_options_dimension" ON "public"."live_stream_scoring_options" USING "btree" ("dimension_code");



CREATE INDEX "idx_live_stream_scoring_options_sort" ON "public"."live_stream_scoring_options" USING "btree" ("sort_order");



CREATE INDEX "idx_notifications_created_at" ON "public"."notifications" USING "btree" ("created_at" DESC);



CREATE INDEX "idx_notifications_user_status" ON "public"."notifications" USING "btree" ("user_id", "status");



CREATE INDEX "idx_operation_frequency_created" ON "public"."operation_frequency_control" USING "btree" ("created_at");



CREATE INDEX "idx_operation_frequency_user_type" ON "public"."operation_frequency_control" USING "btree" ("user_id", "operation_type");



CREATE INDEX "idx_operation_frequency_window" ON "public"."operation_frequency_control" USING "btree" ("window_start", "window_end");



CREATE INDEX "idx_operation_logs_created" ON "public"."operation_logs" USING "btree" ("created_at");



CREATE INDEX "idx_operation_logs_result" ON "public"."operation_logs" USING "btree" ("operation_result");



CREATE INDEX "idx_operation_logs_user_type" ON "public"."operation_logs" USING "btree" ("user_id", "operation_type");



CREATE INDEX "idx_organizations_admin" ON "public"."organizations" USING "btree" ("admin");



CREATE INDEX "idx_points_exchange_records_exchange_time" ON "public"."points_exchange_records" USING "btree" ("exchange_time");



CREATE INDEX "idx_points_exchange_records_status" ON "public"."points_exchange_records" USING "btree" ("status");



CREATE INDEX "idx_points_exchange_records_type" ON "public"."points_exchange_records" USING "btree" ("exchange_type");



CREATE INDEX "idx_points_exchange_records_user" ON "public"."points_exchange_records" USING "btree" ("user_id", "exchange_time");



CREATE INDEX "idx_points_exchange_records_user_id" ON "public"."points_exchange_records" USING "btree" ("user_id");



CREATE INDEX "idx_points_rules_is_active" ON "public"."points_rules" USING "btree" ("is_active");



CREATE INDEX "idx_points_rules_source_type" ON "public"."points_rules" USING "btree" ("source_type");



CREATE INDEX "idx_showings_allocation_logs_community" ON "public"."showings_allocation_logs" USING "btree" ("community");



CREATE INDEX "idx_showings_allocation_logs_created_at" ON "public"."showings_allocation_logs" USING "btree" ("created_at");



CREATE INDEX "idx_showings_allocation_logs_method" ON "public"."showings_allocation_logs" USING "btree" ("allocation_method");



CREATE INDEX "idx_showings_allocation_logs_queue_type" ON "public"."showings_allocation_logs" USING "btree" ("queue_type");



CREATE INDEX "idx_showings_allocation_logs_user_date" ON "public"."showings_allocation_logs" USING "btree" ("assigned_user_id", "created_at");



CREATE INDEX "idx_showings_community" ON "public"."showings" USING "btree" ("community");



CREATE INDEX "idx_showings_invalid" ON "public"."showings" USING "btree" ("invalid");



CREATE INDEX "idx_showings_queue_record_community_type" ON "public"."showings_queue_record" USING "btree" ("community", "queue_type", "consumed");



CREATE INDEX "idx_showings_queue_record_main" ON "public"."showings_queue_record" USING "btree" ("user_id", "community", "queue_type", "consumed");



CREATE INDEX "idx_showings_rollback_instances" ON "public"."approval_instances" USING "btree" ("type", "target_id") WHERE ("type" = 'showing_rollback'::"text");



CREATE INDEX "idx_simple_allocation_logs_leadid" ON "public"."simple_allocation_logs" USING "btree" ("leadid");



CREATE INDEX "idx_simple_allocation_logs_points_cost" ON "public"."simple_allocation_logs" USING "btree" ("points_cost") WHERE ("points_cost" IS NOT NULL);



CREATE INDEX "idx_simple_allocation_logs_points_transaction" ON "public"."simple_allocation_logs" USING "btree" ("points_transaction_id") WHERE ("points_transaction_id" IS NOT NULL);



CREATE INDEX "idx_simple_allocation_logs_user_date" ON "public"."simple_allocation_logs" USING "btree" ("assigned_user_id", "created_at");



CREATE INDEX "idx_simple_allocation_rules_active" ON "public"."simple_allocation_rules" USING "btree" ("is_active", "priority") WHERE ("is_active" = true);



CREATE INDEX "idx_user_achievements_completed" ON "public"."user_achievements" USING "btree" ("is_completed");



CREATE INDEX "idx_user_achievements_user_id" ON "public"."user_achievements" USING "btree" ("user_id");



CREATE INDEX "idx_user_avatar_frames_user_id" ON "public"."user_avatar_frames" USING "btree" ("user_id");



CREATE INDEX "idx_user_badges_user_id" ON "public"."user_badges" USING "btree" ("user_id");



CREATE INDEX "idx_user_exchange_limits_date" ON "public"."user_exchange_limits" USING "btree" ("exchange_date");



CREATE INDEX "idx_user_exchange_limits_user_goods" ON "public"."user_exchange_limits" USING "btree" ("user_id", "goods_id");



CREATE INDEX "idx_user_points_transactions_created_at" ON "public"."user_points_transactions" USING "btree" ("created_at");



CREATE INDEX "idx_user_points_transactions_source_type" ON "public"."user_points_transactions" USING "btree" ("source_type");



CREATE INDEX "idx_user_points_transactions_transaction_type" ON "public"."user_points_transactions" USING "btree" ("transaction_type");



CREATE INDEX "idx_user_points_transactions_user_id" ON "public"."user_points_transactions" USING "btree" ("user_id");



CREATE INDEX "idx_user_points_wallet_user_id" ON "public"."user_points_wallet" USING "btree" ("user_id");



CREATE INDEX "idx_users_list_allocation" ON "public"."users_list" USING "btree" ("allocation");



CREATE INDEX "idx_users_list_array_elements" ON "public"."users_list" USING "gin" ("list");



CREATE INDEX "idx_users_list_community" ON "public"."users_list" USING "btree" ("community");



CREATE INDEX "idx_users_list_list_gin" ON "public"."users_list" USING "gin" ("list");



CREATE UNIQUE INDEX "idx_users_profile_id" ON "public"."users_profile" USING "btree" ("id");



CREATE INDEX "idx_users_profile_userid" ON "public"."users_profile" USING "btree" ("user_id");



CREATE INDEX "users_list_array_elements_idx" ON "public"."users_list" USING "gin" ("list");



CREATE OR REPLACE VIEW "public"."dimension_performance_stats" AS
 SELECT "lsd"."dimension_name",
    "lsd"."dimension_code",
    "lsd"."weight",
    "count"(DISTINCT "lss"."id") AS "total_evaluations",
    "avg"((((("lss"."scoring_data" -> 'dimensions'::"text") -> "lsd"."dimension_code") ->> 'score'::"text"))::numeric(3,1)) AS "avg_dimension_score",
    "min"((((("lss"."scoring_data" -> 'dimensions'::"text") -> "lsd"."dimension_code") ->> 'score'::"text"))::numeric(3,1)) AS "min_dimension_score",
    "max"((((("lss"."scoring_data" -> 'dimensions'::"text") -> "lsd"."dimension_code") ->> 'score'::"text"))::numeric(3,1)) AS "max_dimension_score"
   FROM ("public"."live_stream_scoring_dimensions" "lsd"
     LEFT JOIN "public"."live_stream_schedules" "lss" ON ((("lss"."scoring_data" IS NOT NULL) AND (("lss"."scoring_data" -> 'dimensions'::"text") ? "lsd"."dimension_code"))))
  WHERE ("lsd"."is_active" = true)
  GROUP BY "lsd"."id", "lsd"."dimension_name", "lsd"."dimension_code", "lsd"."weight"
  ORDER BY "lsd"."sort_order";



CREATE OR REPLACE TRIGGER "approval-action-hook-update" AFTER UPDATE ON "public"."approval_instances" FOR EACH ROW EXECUTE FUNCTION "supabase_functions"."http_request"('https://wteqgprgiylmxzszcnws.supabase.co/functions/v1/approval-action-hook', 'POST', '{"Authorization":"Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Ind0ZXFncHJnaXlsbXh6c3pjbndzIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1MTE3Nzk4MSwiZXhwIjoyMDY2NzUzOTgxfQ.Mm3-pQUxKFvrQ96K_R8uxaLPjm3iPrrTlB2oVXli1Mc"}', '{}', '5000');



CREATE OR REPLACE TRIGGER "approval-steps-auto-create" AFTER INSERT ON "public"."approval_instances" FOR EACH ROW EXECUTE FUNCTION "supabase_functions"."http_request"('https://wteqgprgiylmxzszcnws.supabase.co/functions/v1/approval-steps-auto-create', 'POST', '{"Authorization":"Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Ind0ZXFncHJnaXlsbXh6c3pjbndzIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1MTE3Nzk4MSwiZXhwIjoyMDY2NzUzOTgxfQ.Mm3-pQUxKFvrQ96K_R8uxaLPjm3iPrrTlB2oVXli1Mc"}', '{}', '5000');



CREATE OR REPLACE TRIGGER "approval_steps_notify" AFTER INSERT ON "public"."approval_steps" FOR EACH ROW EXECUTE FUNCTION "public"."notify_approver_on_step_insert"();



CREATE OR REPLACE TRIGGER "check_users_profile_ids_trigger" BEFORE INSERT OR UPDATE ON "public"."users_list" FOR EACH ROW EXECUTE FUNCTION "public"."check_users_profile_ids"();



CREATE OR REPLACE TRIGGER "ensure_profile_consistency" BEFORE INSERT OR UPDATE ON "public"."users_profile" FOR EACH ROW EXECUTE FUNCTION "public"."check_profile_consistency"();



CREATE OR REPLACE TRIGGER "freeze_user_on_status_left_trigger" AFTER UPDATE OF "status" ON "public"."users_profile" FOR EACH ROW WHEN (("new"."status" = 'left'::"text")) EXECUTE FUNCTION "public"."freeze_user_on_status_left"();



CREATE OR REPLACE TRIGGER "trg_approval_instance_approved" AFTER UPDATE OF "status" ON "public"."approval_instances" FOR EACH ROW EXECUTE FUNCTION "public"."approval_instance_approved_hook"();



CREATE OR REPLACE TRIGGER "trg_before_insert_lead" BEFORE INSERT ON "public"."leads" FOR EACH ROW EXECUTE FUNCTION "public"."before_insert_lead"();



CREATE OR REPLACE TRIGGER "trg_notify_approval_result" AFTER UPDATE OF "status" ON "public"."approval_instances" FOR EACH ROW EXECUTE FUNCTION "public"."notify_approval_result"();



CREATE OR REPLACE TRIGGER "trg_notify_followup_assignment" AFTER INSERT ON "public"."followups" FOR EACH ROW EXECUTE FUNCTION "public"."notify_followup_assignment"();



CREATE OR REPLACE TRIGGER "trg_notify_followup_reassignment" AFTER UPDATE ON "public"."followups" FOR EACH ROW EXECUTE FUNCTION "public"."notify_followup_reassignment"();



CREATE OR REPLACE TRIGGER "trg_simple_allocation_rules_updated" BEFORE UPDATE ON "public"."simple_allocation_rules" FOR EACH ROW EXECUTE FUNCTION "public"."update_simple_allocation_rules_timestamp"();



CREATE OR REPLACE TRIGGER "trg_simple_lead_allocation" AFTER INSERT ON "public"."leads" FOR EACH ROW EXECUTE FUNCTION "public"."simple_lead_allocation_trigger"();



CREATE OR REPLACE TRIGGER "trg_update_approval_flows" BEFORE UPDATE ON "public"."approval_flows" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "trg_update_approval_instance_status" AFTER UPDATE ON "public"."approval_steps" FOR EACH ROW EXECUTE FUNCTION "public"."update_approval_instance_status"();



CREATE OR REPLACE TRIGGER "trg_update_approval_instances" BEFORE UPDATE ON "public"."approval_instances" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "trg_update_bi_pivot_configs" BEFORE UPDATE ON "public"."bi_pivot_configs" FOR EACH ROW EXECUTE FUNCTION "public"."update_bi_pivot_configs_timestamp"();



CREATE OR REPLACE TRIGGER "trg_update_exchange_goods" BEFORE UPDATE ON "public"."exchange_goods" FOR EACH ROW EXECUTE FUNCTION "public"."update_exchange_goods_timestamp"();



CREATE OR REPLACE TRIGGER "trg_update_instance_status_on_reject" AFTER UPDATE OF "status" ON "public"."approval_steps" FOR EACH ROW EXECUTE FUNCTION "public"."update_instance_status_on_reject"();



CREATE OR REPLACE TRIGGER "trigger_log_schedule_changes" AFTER INSERT OR DELETE OR UPDATE ON "public"."live_stream_schedules" FOR EACH ROW EXECUTE FUNCTION "public"."log_schedule_change"();



CREATE OR REPLACE TRIGGER "trigger_update_live_stream_schedules_updated_at" BEFORE UPDATE ON "public"."live_stream_schedules" FOR EACH ROW EXECUTE FUNCTION "public"."update_live_stream_schedules_updated_at"();



CREATE OR REPLACE TRIGGER "trigger_update_scoring_status" BEFORE INSERT OR UPDATE ON "public"."live_stream_schedules" FOR EACH ROW EXECUTE FUNCTION "public"."update_scoring_status"();



CREATE OR REPLACE TRIGGER "trigger_update_user_points_wallet" AFTER INSERT ON "public"."user_points_transactions" FOR EACH ROW EXECUTE FUNCTION "public"."update_user_points_wallet"();



CREATE OR REPLACE TRIGGER "trigger_update_weighted_score" BEFORE UPDATE ON "public"."live_stream_schedules" FOR EACH ROW EXECUTE FUNCTION "public"."update_weighted_score"();



ALTER TABLE ONLY "public"."achievement_progress_logs"
    ADD CONSTRAINT "achievement_progress_logs_achievement_id_fkey" FOREIGN KEY ("achievement_id") REFERENCES "public"."achievements"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."achievement_progress_logs"
    ADD CONSTRAINT "achievement_progress_logs_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users_profile"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."announcement_reads"
    ADD CONSTRAINT "announcement_reads_announcement_id_fkey" FOREIGN KEY ("announcement_id") REFERENCES "public"."announcements"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."announcement_reads"
    ADD CONSTRAINT "announcement_reads_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users_profile"("id");



ALTER TABLE ONLY "public"."announcements"
    ADD CONSTRAINT "announcements_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "public"."users_profile"("id");



ALTER TABLE ONLY "public"."approval_instances"
    ADD CONSTRAINT "approval_instances_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "public"."users_profile"("id");



ALTER TABLE ONLY "public"."approval_instances"
    ADD CONSTRAINT "approval_instances_flow_id_fkey" FOREIGN KEY ("flow_id") REFERENCES "public"."approval_flows"("id");



ALTER TABLE ONLY "public"."approval_steps"
    ADD CONSTRAINT "approval_steps_approver_id_fkey" FOREIGN KEY ("approver_id") REFERENCES "public"."users_profile"("id");



ALTER TABLE ONLY "public"."approval_steps"
    ADD CONSTRAINT "approval_steps_instance_id_fkey" FOREIGN KEY ("instance_id") REFERENCES "public"."approval_instances"("id");



ALTER TABLE ONLY "public"."deals"
    ADD CONSTRAINT "deals_leadid_fkey" FOREIGN KEY ("leadid") REFERENCES "public"."followups"("leadid") ON UPDATE CASCADE;



ALTER TABLE ONLY "public"."deals"
    ADD CONSTRAINT "deals_leadid_fkey1" FOREIGN KEY ("leadid") REFERENCES "public"."leads"("leadid");



ALTER TABLE ONLY "public"."showings_queue_record"
    ADD CONSTRAINT "fk_queue_record_user" FOREIGN KEY ("user_id") REFERENCES "public"."users_profile"("id");



ALTER TABLE ONLY "public"."showings"
    ADD CONSTRAINT "fk_showings_showingsales" FOREIGN KEY ("showingsales") REFERENCES "public"."users_profile"("id");



ALTER TABLE ONLY "public"."followups"
    ADD CONSTRAINT "followups_interviewsales_user_id_fkey" FOREIGN KEY ("interviewsales_user_id") REFERENCES "public"."users_profile"("id");



ALTER TABLE ONLY "public"."followups"
    ADD CONSTRAINT "followups_leadid_fkey" FOREIGN KEY ("leadid") REFERENCES "public"."leads"("leadid") ON UPDATE CASCADE;



ALTER TABLE ONLY "public"."leads"
    ADD CONSTRAINT "leads_approval_instance_id_fkey" FOREIGN KEY ("approval_instance_id") REFERENCES "public"."approval_instances"("id");



ALTER TABLE ONLY "public"."live_stream_schedule_logs"
    ADD CONSTRAINT "live_stream_schedule_logs_operator_id_fkey" FOREIGN KEY ("operator_id") REFERENCES "public"."users_profile"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."live_stream_schedule_logs"
    ADD CONSTRAINT "live_stream_schedule_logs_schedule_id_fkey" FOREIGN KEY ("schedule_id") REFERENCES "public"."live_stream_schedules"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."live_stream_schedules"
    ADD CONSTRAINT "live_stream_schedules_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "public"."users_profile"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."live_stream_schedules"
    ADD CONSTRAINT "live_stream_schedules_editing_by_fkey" FOREIGN KEY ("editing_by") REFERENCES "public"."users_profile"("id");



ALTER TABLE ONLY "public"."live_stream_schedules"
    ADD CONSTRAINT "live_stream_schedules_scored_by_fkey" FOREIGN KEY ("scored_by") REFERENCES "public"."users_profile"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."live_stream_scoring_log"
    ADD CONSTRAINT "live_stream_scoring_log_evaluator_fkey" FOREIGN KEY ("evaluator_id") REFERENCES "public"."users_profile"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."live_stream_scoring_log"
    ADD CONSTRAINT "live_stream_scoring_log_schedule_fkey" FOREIGN KEY ("schedule_id") REFERENCES "public"."live_stream_schedules"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."live_stream_scoring_options"
    ADD CONSTRAINT "live_stream_scoring_options_dimension_fkey" FOREIGN KEY ("dimension_code") REFERENCES "public"."live_stream_scoring_dimensions"("dimension_code") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."notifications"
    ADD CONSTRAINT "notifications_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users_profile"("id");



ALTER TABLE ONLY "public"."organizations"
    ADD CONSTRAINT "organizations_admin_fkey" FOREIGN KEY ("admin") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."organizations"
    ADD CONSTRAINT "organizations_parent_id_fkey" FOREIGN KEY ("parent_id") REFERENCES "public"."organizations"("id");



ALTER TABLE ONLY "public"."role_permissions"
    ADD CONSTRAINT "role_permissions_permission_id_fkey" FOREIGN KEY ("permission_id") REFERENCES "public"."permissions"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."role_permissions"
    ADD CONSTRAINT "role_permissions_role_id_fkey" FOREIGN KEY ("role_id") REFERENCES "public"."roles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."showings"
    ADD CONSTRAINT "showings_leadid_fkey" FOREIGN KEY ("leadid") REFERENCES "public"."followups"("leadid") ON UPDATE CASCADE;



ALTER TABLE ONLY "public"."showings"
    ADD CONSTRAINT "showings_showingsales_fkey" FOREIGN KEY ("showingsales") REFERENCES "public"."users_profile"("id");



ALTER TABLE ONLY "public"."showings"
    ADD CONSTRAINT "showings_trueshowingsales_fkey" FOREIGN KEY ("trueshowingsales") REFERENCES "public"."users_profile"("id");



ALTER TABLE ONLY "public"."simple_allocation_logs"
    ADD CONSTRAINT "simple_allocation_logs_cost_rule_id_fkey" FOREIGN KEY ("cost_rule_id") REFERENCES "public"."lead_points_cost"("id");



ALTER TABLE ONLY "public"."simple_allocation_logs"
    ADD CONSTRAINT "simple_allocation_logs_rule_id_fkey" FOREIGN KEY ("rule_id") REFERENCES "public"."simple_allocation_rules"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."user_achievements"
    ADD CONSTRAINT "user_achievements_achievement_id_fkey" FOREIGN KEY ("achievement_id") REFERENCES "public"."achievements"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."user_achievements"
    ADD CONSTRAINT "user_achievements_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users_profile"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."user_avatar_frames"
    ADD CONSTRAINT "user_avatar_frames_frame_id_fkey" FOREIGN KEY ("frame_id") REFERENCES "public"."avatar_frames"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."user_avatar_frames"
    ADD CONSTRAINT "user_avatar_frames_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users_profile"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."user_badges"
    ADD CONSTRAINT "user_badges_badge_id_fkey" FOREIGN KEY ("badge_id") REFERENCES "public"."badges"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."user_badges"
    ADD CONSTRAINT "user_badges_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users_profile"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."user_exchange_limits"
    ADD CONSTRAINT "user_exchange_limits_goods_id_fkey" FOREIGN KEY ("goods_id") REFERENCES "public"."exchange_goods"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."user_exchange_limits"
    ADD CONSTRAINT "user_exchange_limits_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users_profile"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."user_roles"
    ADD CONSTRAINT "user_roles_role_id_fkey" FOREIGN KEY ("role_id") REFERENCES "public"."roles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."user_roles"
    ADD CONSTRAINT "user_roles_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."users_profile"
    ADD CONSTRAINT "users_profile_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON UPDATE CASCADE ON DELETE SET NULL;



ALTER TABLE ONLY "public"."users_profile"
    ADD CONSTRAINT "users_profile_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON UPDATE CASCADE ON DELETE CASCADE;



CREATE POLICY "Admins can manage all notifications" ON "public"."notifications" USING ((EXISTS ( SELECT 1
   FROM ("public"."user_roles" "ur"
     JOIN "public"."roles" "r" ON (("ur"."role_id" = "r"."id")))
  WHERE (("ur"."user_id" = "auth"."uid"()) AND ("r"."name" = 'admin'::"text")))));



CREATE POLICY "Admins can manage exchange goods" ON "public"."exchange_goods" USING ("public"."has_permission"('points'::"text", 'manage'::"text"));



CREATE POLICY "All users can select users_profile" ON "public"."users_profile" FOR SELECT USING (true);



CREATE POLICY "Allow delete for authenticated users" ON "public"."avatar_frames" FOR DELETE TO "authenticated" USING (true);



CREATE POLICY "Allow delete for authenticated users" ON "public"."user_avatar_frames" FOR DELETE TO "authenticated" USING (true);



CREATE POLICY "Allow insert for authenticated users" ON "public"."avatar_frames" FOR INSERT TO "authenticated" WITH CHECK (true);



CREATE POLICY "Allow insert for authenticated users" ON "public"."user_avatar_frames" FOR INSERT TO "authenticated" WITH CHECK (true);



CREATE POLICY "Allow select for authenticated users" ON "public"."avatar_frames" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "Allow select for authenticated users" ON "public"."user_avatar_frames" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "Allow update for authenticated users" ON "public"."avatar_frames" FOR UPDATE TO "authenticated" USING (true) WITH CHECK (true);



CREATE POLICY "Allow update for authenticated users" ON "public"."user_avatar_frames" FOR UPDATE TO "authenticated" USING (true) WITH CHECK (true);



CREATE POLICY "Service role can manage all notifications" ON "public"."notifications" USING (("auth"."role"() = 'service_role'::"text"));



CREATE POLICY "Users can access their own or public pivot configs" ON "public"."bi_pivot_configs" USING ((("created_by" = ("auth"."uid"())::"text") OR ("is_public" = true)));



CREATE POLICY "Users can delete their own notifications" ON "public"."notifications" FOR DELETE USING (("user_id" = ( SELECT "users_profile"."id"
   FROM "public"."users_profile"
  WHERE ("users_profile"."user_id" = "auth"."uid"()))));



CREATE POLICY "Users can insert their own exchange limits" ON "public"."user_exchange_limits" FOR INSERT WITH CHECK (("user_id" = ( SELECT "users_profile"."id"
   FROM "public"."users_profile"
  WHERE ("users_profile"."user_id" = "auth"."uid"()))));



CREATE POLICY "Users can insert their own exchange records" ON "public"."points_exchange_records" FOR INSERT WITH CHECK (("user_id" = ( SELECT "users_profile"."id"
   FROM "public"."users_profile"
  WHERE ("users_profile"."user_id" = "auth"."uid"()))));



CREATE POLICY "Users can insert their own notifications" ON "public"."notifications" FOR INSERT WITH CHECK (("user_id" = ( SELECT "users_profile"."id"
   FROM "public"."users_profile"
  WHERE ("users_profile"."user_id" = "auth"."uid"()))));



CREATE POLICY "Users can manage their own announcement reads" ON "public"."announcement_reads" USING (("user_id" = ( SELECT "users_profile"."id"
   FROM "public"."users_profile"
  WHERE ("users_profile"."user_id" = "auth"."uid"()))));



CREATE POLICY "Users can update their own exchange limits" ON "public"."user_exchange_limits" FOR UPDATE USING (("user_id" = ( SELECT "users_profile"."id"
   FROM "public"."users_profile"
  WHERE ("users_profile"."user_id" = "auth"."uid"()))));



CREATE POLICY "Users can update their own notifications" ON "public"."notifications" FOR UPDATE USING (("user_id" = ( SELECT "users_profile"."id"
   FROM "public"."users_profile"
  WHERE ("users_profile"."user_id" = "auth"."uid"())))) WITH CHECK (("user_id" = ( SELECT "users_profile"."id"
   FROM "public"."users_profile"
  WHERE ("users_profile"."user_id" = "auth"."uid"()))));



CREATE POLICY "Users can view active announcements" ON "public"."announcements" FOR SELECT USING ((("is_active" = true) AND ("start_time" <= "now"()) AND (("end_time" IS NULL) OR ("end_time" > "now"()))));



CREATE POLICY "Users can view active exchange goods" ON "public"."exchange_goods" FOR SELECT USING (("is_active" = true));



CREATE POLICY "Users can view their own announcement reads" ON "public"."announcement_reads" USING (("user_id" = (("auth"."uid"())::"text")::bigint));



CREATE POLICY "Users can view their own exchange limits" ON "public"."user_exchange_limits" FOR SELECT USING ((("user_id" = ( SELECT "users_profile"."id"
   FROM "public"."users_profile"
  WHERE ("users_profile"."user_id" = "auth"."uid"()))) OR "public"."has_permission"('points'::"text", 'manage'::"text")));



CREATE POLICY "Users can view their own exchange records" ON "public"."points_exchange_records" FOR SELECT USING ((("user_id" = ( SELECT "users_profile"."id"
   FROM "public"."users_profile"
  WHERE ("users_profile"."user_id" = "auth"."uid"()))) OR "public"."has_permission"('points'::"text", 'manage'::"text")));



CREATE POLICY "Users can view their own notifications" ON "public"."notifications" FOR SELECT USING (("user_id" = ( SELECT "users_profile"."id"
   FROM "public"."users_profile"
  WHERE ("users_profile"."user_id" = "auth"."uid"()))));



ALTER TABLE "public"."achievement_progress_logs" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."achievements" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."announcement_reads" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."announcements" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "announcements_delete_policy" ON "public"."announcements" FOR DELETE USING ("public"."has_permission"('user'::"text", 'manage'::"text"));



CREATE POLICY "announcements_insert_policy" ON "public"."announcements" FOR INSERT WITH CHECK ("public"."has_permission"('user'::"text", 'manage'::"text"));



CREATE POLICY "announcements_update_policy" ON "public"."announcements" FOR UPDATE USING ("public"."has_permission"('user'::"text", 'manage'::"text")) WITH CHECK ("public"."has_permission"('user'::"text", 'manage'::"text"));



ALTER TABLE "public"."approval_flows" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "approval_flows_delete_policy" ON "public"."approval_flows" FOR DELETE USING ("public"."has_permission"('approval'::"text", 'manage'::"text"));



COMMENT ON POLICY "approval_flows_delete_policy" ON "public"."approval_flows" IS '审批流模板删除权限：只有管理权限可以删除';



CREATE POLICY "approval_flows_insert_policy" ON "public"."approval_flows" FOR INSERT WITH CHECK ("public"."has_permission"('approval'::"text", 'manage'::"text"));



COMMENT ON POLICY "approval_flows_insert_policy" ON "public"."approval_flows" IS '审批流模板创建权限：只有管理权限可以创建';



CREATE POLICY "approval_flows_select_policy" ON "public"."approval_flows" FOR SELECT USING (("public"."has_permission"('approval'::"text", 'manage'::"text") OR (EXISTS ( SELECT 1
   FROM ("public"."approval_instances" "ai"
     JOIN "public"."users_profile" "up" ON (("up"."id" = "ai"."created_by")))
  WHERE (("ai"."flow_id" = "approval_flows"."id") AND ("up"."user_id" = "auth"."uid"()))))));



COMMENT ON POLICY "approval_flows_select_policy" ON "public"."approval_flows" IS '审批流模板查看权限：管理权限可查看所有，普通用户只能查看自己相关的';



CREATE POLICY "approval_flows_update_policy" ON "public"."approval_flows" FOR UPDATE USING ("public"."has_permission"('approval'::"text", 'manage'::"text")) WITH CHECK ("public"."has_permission"('approval'::"text", 'manage'::"text"));



COMMENT ON POLICY "approval_flows_update_policy" ON "public"."approval_flows" IS '审批流模板更新权限：只有管理权限可以更新';



ALTER TABLE "public"."approval_instances" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "approval_instances_delete_policy" ON "public"."approval_instances" FOR DELETE USING (("public"."has_permission"('approval'::"text", 'manage'::"text") OR (EXISTS ( SELECT 1
   FROM "public"."users_profile" "up"
  WHERE (("up"."user_id" = "auth"."uid"()) AND ("up"."id" = "approval_instances"."created_by"))))));



COMMENT ON POLICY "approval_instances_delete_policy" ON "public"."approval_instances" IS '审批实例删除权限：管理权限可删除所有，普通用户只能删除自己创建的';



CREATE POLICY "approval_instances_insert_policy" ON "public"."approval_instances" FOR INSERT WITH CHECK (("public"."has_permission"('approval'::"text", 'manage'::"text") OR (EXISTS ( SELECT 1
   FROM "public"."users_profile" "up"
  WHERE (("up"."user_id" = "auth"."uid"()) AND ("up"."id" = "approval_instances"."created_by"))))));



COMMENT ON POLICY "approval_instances_insert_policy" ON "public"."approval_instances" IS '审批实例创建权限：管理权限可创建所有，普通用户可创建自己的';



CREATE POLICY "approval_instances_select_policy" ON "public"."approval_instances" FOR SELECT USING (("public"."has_permission"('approval'::"text", 'manage'::"text") OR (EXISTS ( SELECT 1
   FROM "public"."users_profile" "up"
  WHERE (("up"."user_id" = "auth"."uid"()) AND ("up"."id" = "approval_instances"."created_by"))))));



COMMENT ON POLICY "approval_instances_select_policy" ON "public"."approval_instances" IS '审批实例查看权限：管理权限可查看所有，普通用户只能查看自己创建的';



CREATE POLICY "approval_instances_update_policy" ON "public"."approval_instances" FOR UPDATE USING (("public"."has_permission"('approval'::"text", 'manage'::"text") OR (EXISTS ( SELECT 1
   FROM "public"."users_profile" "up"
  WHERE (("up"."user_id" = "auth"."uid"()) AND ("up"."id" = "approval_instances"."created_by")))))) WITH CHECK (("public"."has_permission"('approval'::"text", 'manage'::"text") OR (EXISTS ( SELECT 1
   FROM "public"."users_profile" "up"
  WHERE (("up"."user_id" = "auth"."uid"()) AND ("up"."id" = "approval_instances"."created_by"))))));



COMMENT ON POLICY "approval_instances_update_policy" ON "public"."approval_instances" IS '审批实例更新权限：管理权限可更新所有，普通用户只能更新自己创建的';



ALTER TABLE "public"."approval_steps" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "approval_steps_delete_policy" ON "public"."approval_steps" FOR DELETE USING ("public"."has_permission"('approval'::"text", 'manage'::"text"));



COMMENT ON POLICY "approval_steps_delete_policy" ON "public"."approval_steps" IS '审批步骤删除权限：只有管理权限可以删除';



CREATE POLICY "approval_steps_insert_policy" ON "public"."approval_steps" FOR INSERT WITH CHECK ("public"."has_permission"('approval'::"text", 'manage'::"text"));



COMMENT ON POLICY "approval_steps_insert_policy" ON "public"."approval_steps" IS '审批步骤创建权限：只有管理权限可以创建';



CREATE POLICY "approval_steps_select_policy" ON "public"."approval_steps" FOR SELECT USING (("public"."has_permission"('approval'::"text", 'manage'::"text") OR (EXISTS ( SELECT 1
   FROM "public"."users_profile" "up"
  WHERE (("up"."user_id" = "auth"."uid"()) AND ("up"."id" = "approval_steps"."approver_id")))) OR (EXISTS ( SELECT 1
   FROM ("public"."approval_instances" "ai"
     JOIN "public"."users_profile" "up" ON (("up"."id" = "ai"."created_by")))
  WHERE (("ai"."id" = "approval_steps"."instance_id") AND ("up"."user_id" = "auth"."uid"()))))));



COMMENT ON POLICY "approval_steps_select_policy" ON "public"."approval_steps" IS '审批步骤查看权限：管理权限可查看所有，普通用户只能查看自己相关的';



CREATE POLICY "approval_steps_update_policy" ON "public"."approval_steps" FOR UPDATE USING (("public"."has_permission"('approval'::"text", 'manage'::"text") OR (EXISTS ( SELECT 1
   FROM "public"."users_profile" "up"
  WHERE (("up"."user_id" = "auth"."uid"()) AND ("up"."id" = "approval_steps"."approver_id")))))) WITH CHECK (("public"."has_permission"('approval'::"text", 'manage'::"text") OR (EXISTS ( SELECT 1
   FROM "public"."users_profile" "up"
  WHERE (("up"."user_id" = "auth"."uid"()) AND ("up"."id" = "approval_steps"."approver_id"))))));



COMMENT ON POLICY "approval_steps_update_policy" ON "public"."approval_steps" IS '审批步骤更新权限：管理权限可更新所有，普通用户只能更新自己作为审批人的步骤';



ALTER TABLE "public"."avatar_frames" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."badges" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."bi_pivot_configs" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."deals" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "deals_delete_policy" ON "public"."deals" FOR DELETE USING (false);



CREATE POLICY "deals_insert_policy" ON "public"."deals" FOR INSERT WITH CHECK (((EXISTS ( SELECT 1
   FROM ("public"."followups" "f"
     JOIN "public"."users_profile" "up" ON (("f"."interviewsales_user_id" = "up"."id")))
  WHERE (("f"."leadid" = "deals"."leadid") AND ("up"."user_id" = "auth"."uid"())))) OR (EXISTS ( SELECT 1
   FROM (("public"."followups" "f"
     JOIN "public"."users_profile" "up" ON (("f"."interviewsales_user_id" = "up"."id")))
     JOIN "public"."get_managed_org_ids"("auth"."uid"()) "managed_orgs"("org_id") ON (("up"."organization_id" = "managed_orgs"."org_id")))
  WHERE ("f"."leadid" = "deals"."leadid")))));



CREATE POLICY "deals_select_policy" ON "public"."deals" FOR SELECT USING (("public"."has_permission"('deals'::"text", 'view'::"text") OR (EXISTS ( SELECT 1
   FROM ("public"."followups" "f"
     JOIN "public"."users_profile" "up" ON (("f"."interviewsales_user_id" = "up"."id")))
  WHERE (("f"."leadid" = "deals"."leadid") AND ("up"."user_id" = "auth"."uid"())))) OR (EXISTS ( SELECT 1
   FROM (("public"."followups" "f"
     JOIN "public"."users_profile" "up" ON (("f"."interviewsales_user_id" = "up"."id")))
     JOIN "public"."get_managed_org_ids"("auth"."uid"()) "managed_orgs"("org_id") ON (("up"."organization_id" = "managed_orgs"."org_id")))
  WHERE ("f"."leadid" = "deals"."leadid")))));



CREATE POLICY "deals_update_policy" ON "public"."deals" FOR UPDATE USING (((EXISTS ( SELECT 1
   FROM ("public"."followups" "f"
     JOIN "public"."users_profile" "up" ON (("f"."interviewsales_user_id" = "up"."id")))
  WHERE (("f"."leadid" = "deals"."leadid") AND ("up"."user_id" = "auth"."uid"())))) OR (EXISTS ( SELECT 1
   FROM (("public"."followups" "f"
     JOIN "public"."users_profile" "up" ON (("f"."interviewsales_user_id" = "up"."id")))
     JOIN "public"."get_managed_org_ids"("auth"."uid"()) "managed_orgs"("org_id") ON (("up"."organization_id" = "managed_orgs"."org_id")))
  WHERE ("f"."leadid" = "deals"."leadid"))))) WITH CHECK (((EXISTS ( SELECT 1
   FROM ("public"."followups" "f"
     JOIN "public"."users_profile" "up" ON (("f"."interviewsales_user_id" = "up"."id")))
  WHERE (("f"."leadid" = "deals"."leadid") AND ("up"."user_id" = "auth"."uid"())))) OR (EXISTS ( SELECT 1
   FROM (("public"."followups" "f"
     JOIN "public"."users_profile" "up" ON (("f"."interviewsales_user_id" = "up"."id")))
     JOIN "public"."get_managed_org_ids"("auth"."uid"()) "managed_orgs"("org_id") ON (("up"."organization_id" = "managed_orgs"."org_id")))
  WHERE ("f"."leadid" = "deals"."leadid")))));



ALTER TABLE "public"."exchange_goods" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."followups" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "followups_delete_policy" ON "public"."followups" FOR DELETE USING (false);



CREATE POLICY "followups_insert_policy" ON "public"."followups" FOR INSERT WITH CHECK (false);



CREATE POLICY "followups_select_policy" ON "public"."followups" FOR SELECT USING (("public"."has_permission"('followups'::"text", 'view'::"text") OR (EXISTS ( SELECT 1
   FROM "public"."users_profile" "up"
  WHERE (("up"."user_id" = "auth"."uid"()) AND ("up"."id" = "followups"."interviewsales_user_id")))) OR (EXISTS ( SELECT 1
   FROM ("public"."users_profile" "up"
     JOIN "public"."get_managed_org_ids"("auth"."uid"()) "managed_orgs"("org_id") ON (("up"."organization_id" = "managed_orgs"."org_id")))
  WHERE ("up"."id" = "followups"."interviewsales_user_id")))));



CREATE POLICY "followups_update_policy" ON "public"."followups" FOR UPDATE USING (((EXISTS ( SELECT 1
   FROM "public"."users_profile" "up"
  WHERE (("up"."user_id" = "auth"."uid"()) AND ("up"."id" = "followups"."interviewsales_user_id")))) OR (EXISTS ( SELECT 1
   FROM ("public"."users_profile" "up"
     JOIN "public"."get_managed_org_ids"("auth"."uid"()) "managed_orgs"("org_id") ON (("up"."organization_id" = "managed_orgs"."org_id")))
  WHERE ("up"."id" = "followups"."interviewsales_user_id"))))) WITH CHECK (((EXISTS ( SELECT 1
   FROM "public"."users_profile" "up"
  WHERE (("up"."user_id" = "auth"."uid"()) AND ("up"."id" = "followups"."interviewsales_user_id")))) OR (EXISTS ( SELECT 1
   FROM ("public"."users_profile" "up"
     JOIN "public"."get_managed_org_ids"("auth"."uid"()) "managed_orgs"("org_id") ON (("up"."organization_id" = "managed_orgs"."org_id")))
  WHERE ("up"."id" = "followups"."interviewsales_user_id")))));



ALTER TABLE "public"."leads" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "leads_delete_policy" ON "public"."leads" FOR DELETE USING (false);



CREATE POLICY "leads_insert_policy" ON "public"."leads" FOR INSERT WITH CHECK ("public"."has_permission"('lead'::"text", 'manage'::"text"));



CREATE POLICY "leads_select_policy" ON "public"."leads" FOR SELECT USING (("public"."has_permission"('lead'::"text", 'manage'::"text") OR (EXISTS ( SELECT 1
   FROM ("public"."followups" "f"
     JOIN "public"."users_profile" "up" ON (("f"."interviewsales_user_id" = "up"."id")))
  WHERE (("f"."leadid" = "leads"."leadid") AND (("up"."user_id" = "auth"."uid"()) OR (EXISTS ( SELECT 1
           FROM "public"."get_managed_org_ids"("auth"."uid"()) "managed_orgs"("org_id")
          WHERE ("up"."organization_id" = "managed_orgs"."org_id")))))))));



CREATE POLICY "leads_update_policy" ON "public"."leads" FOR UPDATE USING ("public"."has_permission"('lead'::"text", 'manage'::"text")) WITH CHECK ("public"."has_permission"('lead'::"text", 'manage'::"text"));



ALTER TABLE "public"."live_stream_schedules" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."notifications" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."organizations" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "organizations_delete_policy" ON "public"."organizations" FOR DELETE USING ((EXISTS ( SELECT 1
   FROM ("public"."user_roles" "ur"
     JOIN "public"."roles" "r" ON (("ur"."role_id" = "r"."id")))
  WHERE (("ur"."user_id" = "auth"."uid"()) AND ("r"."name" = 'admin'::"text")))));



CREATE POLICY "organizations_insert_policy" ON "public"."organizations" FOR INSERT WITH CHECK (((EXISTS ( SELECT 1
   FROM ("public"."user_roles" "ur"
     JOIN "public"."roles" "r" ON (("ur"."role_id" = "r"."id")))
  WHERE (("ur"."user_id" = "auth"."uid"()) AND ("r"."name" = ANY (ARRAY['admin'::"text", 'manager'::"text"]))))) OR (EXISTS ( SELECT 1
   FROM "public"."organizations" "organizations_1"
  WHERE ("organizations_1"."admin" = "auth"."uid"())))));



CREATE POLICY "organizations_select_policy" ON "public"."organizations" FOR SELECT USING (true);



CREATE POLICY "organizations_update_policy" ON "public"."organizations" FOR UPDATE USING ((("admin" = "auth"."uid"()) OR (EXISTS ( SELECT 1
   FROM ("public"."user_roles" "ur"
     JOIN "public"."roles" "r" ON (("ur"."role_id" = "r"."id")))
  WHERE (("ur"."user_id" = "auth"."uid"()) AND ("r"."name" = 'admin'::"text")))))) WITH CHECK ((("admin" = "auth"."uid"()) OR (EXISTS ( SELECT 1
   FROM ("public"."user_roles" "ur"
     JOIN "public"."roles" "r" ON (("ur"."role_id" = "r"."id")))
  WHERE (("ur"."user_id" = "auth"."uid"()) AND ("r"."name" = 'admin'::"text"))))));



ALTER TABLE "public"."points_exchange_records" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."role_permissions" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "role_permissions_delete_policy" ON "public"."role_permissions" FOR DELETE USING ("public"."has_permission"('user'::"text", 'manage'::"text"));



CREATE POLICY "role_permissions_insert_policy" ON "public"."role_permissions" FOR INSERT WITH CHECK ("public"."has_permission"('user'::"text", 'manage'::"text"));



CREATE POLICY "role_permissions_select_policy" ON "public"."role_permissions" FOR SELECT USING (("auth"."uid"() IS NOT NULL));



CREATE POLICY "role_permissions_update_policy" ON "public"."role_permissions" FOR UPDATE USING ("public"."has_permission"('user'::"text", 'manage'::"text")) WITH CHECK ("public"."has_permission"('user'::"text", 'manage'::"text"));



ALTER TABLE "public"."showings" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "showings_delete_policy" ON "public"."showings" FOR DELETE USING (false);



CREATE POLICY "showings_insert_policy" ON "public"."showings" FOR INSERT TO "authenticated" WITH CHECK (true);



ALTER TABLE "public"."showings_queue_record" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "showings_queue_record_delete_policy" ON "public"."showings_queue_record" FOR DELETE USING ("public"."has_permission"('allocation'::"text", 'manage'::"text"));



CREATE POLICY "showings_queue_record_insert_policy" ON "public"."showings_queue_record" FOR INSERT WITH CHECK ("public"."has_permission"('allocation'::"text", 'manage'::"text"));



CREATE POLICY "showings_queue_record_select_policy" ON "public"."showings_queue_record" FOR SELECT USING (("public"."has_permission"('allocation'::"text", 'manage'::"text") OR (EXISTS ( SELECT 1
   FROM "public"."users_profile" "up"
  WHERE (("up"."user_id" = "auth"."uid"()) AND ("up"."id" = "showings_queue_record"."user_id"))))));



CREATE POLICY "showings_queue_record_update_policy" ON "public"."showings_queue_record" FOR UPDATE USING ("public"."has_permission"('allocation'::"text", 'manage'::"text")) WITH CHECK ("public"."has_permission"('allocation'::"text", 'manage'::"text"));



CREATE POLICY "showings_select_policy" ON "public"."showings" FOR SELECT USING (("public"."has_permission"('showings'::"text", 'view'::"text") OR (EXISTS ( SELECT 1
   FROM "public"."users_profile" "up"
  WHERE (("up"."user_id" = "auth"."uid"()) AND ("up"."id" = "showings"."showingsales")))) OR (EXISTS ( SELECT 1
   FROM "public"."users_profile" "up"
  WHERE (("up"."user_id" = "auth"."uid"()) AND ("up"."id" = "showings"."trueshowingsales")))) OR (EXISTS ( SELECT 1
   FROM ("public"."followups" "f"
     JOIN "public"."users_profile" "up" ON (("f"."interviewsales_user_id" = "up"."id")))
  WHERE (("f"."leadid" = "showings"."leadid") AND ("up"."user_id" = "auth"."uid"())))) OR (EXISTS ( SELECT 1
   FROM ("public"."users_profile" "up"
     JOIN "public"."get_managed_org_ids"("auth"."uid"()) "managed_orgs"("org_id") ON (("up"."organization_id" = "managed_orgs"."org_id")))
  WHERE ("up"."id" = "showings"."showingsales"))) OR (EXISTS ( SELECT 1
   FROM ("public"."users_profile" "up"
     JOIN "public"."get_managed_org_ids"("auth"."uid"()) "managed_orgs"("org_id") ON (("up"."organization_id" = "managed_orgs"."org_id")))
  WHERE ("up"."id" = "showings"."trueshowingsales"))) OR (EXISTS ( SELECT 1
   FROM (("public"."followups" "f"
     JOIN "public"."users_profile" "up" ON (("f"."interviewsales_user_id" = "up"."id")))
     JOIN "public"."get_managed_org_ids"("auth"."uid"()) "managed_orgs"("org_id") ON (("up"."organization_id" = "managed_orgs"."org_id")))
  WHERE ("f"."leadid" = "showings"."leadid")))));



CREATE POLICY "showings_update_policy" ON "public"."showings" FOR UPDATE USING (((EXISTS ( SELECT 1
   FROM "public"."users_profile" "up"
  WHERE (("up"."user_id" = "auth"."uid"()) AND ("up"."id" = "showings"."showingsales")))) OR (EXISTS ( SELECT 1
   FROM "public"."users_profile" "up"
  WHERE (("up"."user_id" = "auth"."uid"()) AND ("up"."id" = "showings"."trueshowingsales")))) OR (EXISTS ( SELECT 1
   FROM ("public"."followups" "f"
     JOIN "public"."users_profile" "up" ON (("f"."interviewsales_user_id" = "up"."id")))
  WHERE (("f"."leadid" = "showings"."leadid") AND ("up"."user_id" = "auth"."uid"())))) OR (EXISTS ( SELECT 1
   FROM ("public"."users_profile" "up"
     JOIN "public"."get_managed_org_ids"("auth"."uid"()) "managed_orgs"("org_id") ON (("up"."organization_id" = "managed_orgs"."org_id")))
  WHERE ("up"."id" = "showings"."showingsales"))) OR (EXISTS ( SELECT 1
   FROM ("public"."users_profile" "up"
     JOIN "public"."get_managed_org_ids"("auth"."uid"()) "managed_orgs"("org_id") ON (("up"."organization_id" = "managed_orgs"."org_id")))
  WHERE ("up"."id" = "showings"."trueshowingsales"))) OR (EXISTS ( SELECT 1
   FROM (("public"."followups" "f"
     JOIN "public"."users_profile" "up" ON (("f"."interviewsales_user_id" = "up"."id")))
     JOIN "public"."get_managed_org_ids"("auth"."uid"()) "managed_orgs"("org_id") ON (("up"."organization_id" = "managed_orgs"."org_id")))
  WHERE ("f"."leadid" = "showings"."leadid"))))) WITH CHECK (((EXISTS ( SELECT 1
   FROM "public"."users_profile" "up"
  WHERE (("up"."user_id" = "auth"."uid"()) AND ("up"."id" = "showings"."showingsales")))) OR (EXISTS ( SELECT 1
   FROM "public"."users_profile" "up"
  WHERE (("up"."user_id" = "auth"."uid"()) AND ("up"."id" = "showings"."trueshowingsales")))) OR (EXISTS ( SELECT 1
   FROM ("public"."followups" "f"
     JOIN "public"."users_profile" "up" ON (("f"."interviewsales_user_id" = "up"."id")))
  WHERE (("f"."leadid" = "showings"."leadid") AND ("up"."user_id" = "auth"."uid"())))) OR (EXISTS ( SELECT 1
   FROM ("public"."users_profile" "up"
     JOIN "public"."get_managed_org_ids"("auth"."uid"()) "managed_orgs"("org_id") ON (("up"."organization_id" = "managed_orgs"."org_id")))
  WHERE ("up"."id" = "showings"."showingsales"))) OR (EXISTS ( SELECT 1
   FROM ("public"."users_profile" "up"
     JOIN "public"."get_managed_org_ids"("auth"."uid"()) "managed_orgs"("org_id") ON (("up"."organization_id" = "managed_orgs"."org_id")))
  WHERE ("up"."id" = "showings"."trueshowingsales"))) OR (EXISTS ( SELECT 1
   FROM (("public"."followups" "f"
     JOIN "public"."users_profile" "up" ON (("f"."interviewsales_user_id" = "up"."id")))
     JOIN "public"."get_managed_org_ids"("auth"."uid"()) "managed_orgs"("org_id") ON (("up"."organization_id" = "managed_orgs"."org_id")))
  WHERE ("f"."leadid" = "showings"."leadid")))));



ALTER TABLE "public"."user_achievements" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."user_avatar_frames" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."user_badges" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."user_exchange_limits" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."user_points_wallet" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "user_points_wallet_delete_policy" ON "public"."user_points_wallet" FOR DELETE USING ("public"."has_permission"('points'::"text", 'manage'::"text"));



COMMENT ON POLICY "user_points_wallet_delete_policy" ON "public"."user_points_wallet" IS '只允许积分管理权限删除积分钱包记录';



CREATE POLICY "user_points_wallet_insert_policy" ON "public"."user_points_wallet" FOR INSERT WITH CHECK ("public"."has_permission"('points'::"text", 'manage'::"text"));



COMMENT ON POLICY "user_points_wallet_insert_policy" ON "public"."user_points_wallet" IS '只允许积分管理权限新增积分钱包记录';



CREATE POLICY "user_points_wallet_select_policy" ON "public"."user_points_wallet" FOR SELECT USING (("public"."has_permission"('points'::"text", 'manage'::"text") OR ("user_id" = ( SELECT "users_profile"."id"
   FROM "public"."users_profile"
  WHERE ("users_profile"."user_id" = "auth"."uid"()))) OR (EXISTS ( SELECT 1
   FROM ("public"."users_profile" "up"
     JOIN "public"."get_managed_org_ids"("auth"."uid"()) "managed_orgs"("org_id") ON (("up"."organization_id" = "managed_orgs"."org_id")))
  WHERE ("up"."id" = "user_points_wallet"."user_id")))));



COMMENT ON POLICY "user_points_wallet_select_policy" ON "public"."user_points_wallet" IS '本人可查看自己的积分，管理员可查看递归组织成员，积分管理权限可查看所有人';



CREATE POLICY "user_points_wallet_update_policy" ON "public"."user_points_wallet" FOR UPDATE USING ("public"."has_permission"('points'::"text", 'manage'::"text")) WITH CHECK ("public"."has_permission"('points'::"text", 'manage'::"text"));



COMMENT ON POLICY "user_points_wallet_update_policy" ON "public"."user_points_wallet" IS '只允许积分管理权限修改积分钱包记录';



ALTER TABLE "public"."users_list" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "users_list_delete_policy" ON "public"."users_list" FOR DELETE USING ("public"."has_permission"('allocation'::"text", 'manage'::"text"));



CREATE POLICY "users_list_insert_policy" ON "public"."users_list" FOR INSERT WITH CHECK ("public"."has_permission"('allocation'::"text", 'manage'::"text"));



CREATE POLICY "users_list_select_policy" ON "public"."users_list" FOR SELECT USING (("auth"."role"() = 'authenticated'::"text"));



CREATE POLICY "users_list_update_policy" ON "public"."users_list" FOR UPDATE TO "authenticated" USING ("public"."has_permission"('allocation'::"text", 'manage'::"text")) WITH CHECK ("public"."has_permission"('allocation'::"text", 'manage'::"text"));



ALTER TABLE "public"."users_profile" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "users_profile_delete_policy" ON "public"."users_profile" FOR DELETE USING (true);



CREATE POLICY "users_profile_insert_policy" ON "public"."users_profile" FOR INSERT WITH CHECK (true);



CREATE POLICY "users_profile_update_policy" ON "public"."users_profile" FOR UPDATE USING (true) WITH CHECK (true);



CREATE POLICY "允许创建直播安排" ON "public"."live_stream_schedules" FOR INSERT TO "authenticated" WITH CHECK (true);



CREATE POLICY "允许删除直播安排" ON "public"."live_stream_schedules" FOR DELETE TO "authenticated" USING (true);



CREATE POLICY "允许更新直播安排" ON "public"."live_stream_schedules" FOR UPDATE TO "authenticated" USING (true);



CREATE POLICY "允许查看直播安排" ON "public"."live_stream_schedules" FOR SELECT TO "authenticated" USING (true);



GRANT USAGE ON SCHEMA "public" TO "postgres";
GRANT USAGE ON SCHEMA "public" TO "anon";
GRANT USAGE ON SCHEMA "public" TO "authenticated";
GRANT USAGE ON SCHEMA "public" TO "service_role";



GRANT ALL ON FUNCTION "public"."allocate_from_users"("user_list" bigint[], "method" "public"."allocation_method", "p_required_points" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."allocate_from_users"("user_list" bigint[], "method" "public"."allocation_method", "p_required_points" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."allocate_from_users"("user_list" bigint[], "method" "public"."allocation_method", "p_required_points" integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."allocate_lead_simple"("p_leadid" "text", "p_source" "public"."source", "p_leadtype" "text", "p_community" "public"."community", "p_manual_user_id" bigint) TO "anon";
GRANT ALL ON FUNCTION "public"."allocate_lead_simple"("p_leadid" "text", "p_source" "public"."source", "p_leadtype" "text", "p_community" "public"."community", "p_manual_user_id" bigint) TO "authenticated";
GRANT ALL ON FUNCTION "public"."allocate_lead_simple"("p_leadid" "text", "p_source" "public"."source", "p_leadtype" "text", "p_community" "public"."community", "p_manual_user_id" bigint) TO "service_role";



GRANT ALL ON FUNCTION "public"."apply_allocation_filters"("candidate_users" bigint[], "group_id" bigint, "p_community" "public"."community", "enable_quality_control" boolean, "enable_community_matching" boolean, "enable_permission_check" boolean) TO "anon";
GRANT ALL ON FUNCTION "public"."apply_allocation_filters"("candidate_users" bigint[], "group_id" bigint, "p_community" "public"."community", "enable_quality_control" boolean, "enable_community_matching" boolean, "enable_permission_check" boolean) TO "authenticated";
GRANT ALL ON FUNCTION "public"."apply_allocation_filters"("candidate_users" bigint[], "group_id" bigint, "p_community" "public"."community", "enable_quality_control" boolean, "enable_community_matching" boolean, "enable_permission_check" boolean) TO "service_role";



GRANT ALL ON FUNCTION "public"."approval_instance_approved_hook"() TO "anon";
GRANT ALL ON FUNCTION "public"."approval_instance_approved_hook"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."approval_instance_approved_hook"() TO "service_role";



GRANT ALL ON FUNCTION "public"."assign_showings_user"("p_community" "public"."community", "p_assigned_user_id" bigint) TO "anon";
GRANT ALL ON FUNCTION "public"."assign_showings_user"("p_community" "public"."community", "p_assigned_user_id" bigint) TO "authenticated";
GRANT ALL ON FUNCTION "public"."assign_showings_user"("p_community" "public"."community", "p_assigned_user_id" bigint) TO "service_role";



GRANT ALL ON FUNCTION "public"."auto_cleanup_frequency_tables"("p_freq_table_max_rows" integer, "p_freq_table_batch_delete" integer, "p_log_table_max_rows" integer, "p_log_table_batch_delete" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."auto_cleanup_frequency_tables"("p_freq_table_max_rows" integer, "p_freq_table_batch_delete" integer, "p_log_table_max_rows" integer, "p_log_table_batch_delete" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."auto_cleanup_frequency_tables"("p_freq_table_max_rows" integer, "p_freq_table_batch_delete" integer, "p_log_table_max_rows" integer, "p_log_table_batch_delete" integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."award_points"("p_user_id" bigint, "p_source_type" character varying, "p_source_id" bigint, "p_description" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."award_points"("p_user_id" bigint, "p_source_type" character varying, "p_source_id" bigint, "p_description" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."award_points"("p_user_id" bigint, "p_source_type" character varying, "p_source_id" bigint, "p_description" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."before_insert_lead"() TO "anon";
GRANT ALL ON FUNCTION "public"."before_insert_lead"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."before_insert_lead"() TO "service_role";



GRANT ALL ON FUNCTION "public"."calculate_dynamic_cost_adjustments"("dynamic_config" "jsonb", "p_source" "public"."source", "p_leadtype" "text", "p_campaignname" "text", "p_unitname" "text", "p_remark" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."calculate_dynamic_cost_adjustments"("dynamic_config" "jsonb", "p_source" "public"."source", "p_leadtype" "text", "p_campaignname" "text", "p_unitname" "text", "p_remark" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."calculate_dynamic_cost_adjustments"("dynamic_config" "jsonb", "p_source" "public"."source", "p_leadtype" "text", "p_campaignname" "text", "p_unitname" "text", "p_remark" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."calculate_lead_points_cost"("p_source" "public"."source", "p_leadtype" "text", "p_campaignname" "text", "p_unitname" "text", "p_remark" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."calculate_lead_points_cost"("p_source" "public"."source", "p_leadtype" "text", "p_campaignname" "text", "p_unitname" "text", "p_remark" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."calculate_lead_points_cost"("p_source" "public"."source", "p_leadtype" "text", "p_campaignname" "text", "p_unitname" "text", "p_remark" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."calculate_weighted_score"("scoring_data" "jsonb") TO "anon";
GRANT ALL ON FUNCTION "public"."calculate_weighted_score"("scoring_data" "jsonb") TO "authenticated";
GRANT ALL ON FUNCTION "public"."calculate_weighted_score"("scoring_data" "jsonb") TO "service_role";



GRANT ALL ON FUNCTION "public"."check_bi_permission"() TO "anon";
GRANT ALL ON FUNCTION "public"."check_bi_permission"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."check_bi_permission"() TO "service_role";



GRANT ALL ON FUNCTION "public"."check_cost_conditions"("conditions" "jsonb", "p_source" "public"."source", "p_leadtype" "text", "p_campaignname" "text", "p_unitname" "text", "p_remark" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."check_cost_conditions"("conditions" "jsonb", "p_source" "public"."source", "p_leadtype" "text", "p_campaignname" "text", "p_unitname" "text", "p_remark" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."check_cost_conditions"("conditions" "jsonb", "p_source" "public"."source", "p_leadtype" "text", "p_campaignname" "text", "p_unitname" "text", "p_remark" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."check_operation_frequency"("p_user_id" bigint, "p_operation_type" character varying) TO "anon";
GRANT ALL ON FUNCTION "public"."check_operation_frequency"("p_user_id" bigint, "p_operation_type" character varying) TO "authenticated";
GRANT ALL ON FUNCTION "public"."check_operation_frequency"("p_user_id" bigint, "p_operation_type" character varying) TO "service_role";



GRANT ALL ON FUNCTION "public"."check_profile_consistency"() TO "anon";
GRANT ALL ON FUNCTION "public"."check_profile_consistency"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."check_profile_consistency"() TO "service_role";



GRANT ALL ON FUNCTION "public"."check_profile_sync_status"("user_email" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."check_profile_sync_status"("user_email" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."check_profile_sync_status"("user_email" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."check_rule_conditions"("conditions" "jsonb", "p_source" "public"."source", "p_leadtype" "text", "p_community" "public"."community") TO "anon";
GRANT ALL ON FUNCTION "public"."check_rule_conditions"("conditions" "jsonb", "p_source" "public"."source", "p_leadtype" "text", "p_community" "public"."community") TO "authenticated";
GRANT ALL ON FUNCTION "public"."check_rule_conditions"("conditions" "jsonb", "p_source" "public"."source", "p_leadtype" "text", "p_community" "public"."community") TO "service_role";



GRANT ALL ON FUNCTION "public"."check_showing_quality"("user_id" bigint, "community" "public"."community") TO "anon";
GRANT ALL ON FUNCTION "public"."check_showing_quality"("user_id" bigint, "community" "public"."community") TO "authenticated";
GRANT ALL ON FUNCTION "public"."check_showing_quality"("user_id" bigint, "community" "public"."community") TO "service_role";



GRANT ALL ON FUNCTION "public"."check_time_condition"("time_config" "jsonb") TO "anon";
GRANT ALL ON FUNCTION "public"."check_time_condition"("time_config" "jsonb") TO "authenticated";
GRANT ALL ON FUNCTION "public"."check_time_condition"("time_config" "jsonb") TO "service_role";



GRANT ALL ON FUNCTION "public"."check_user_group_status"("p_user_id" bigint, "p_group_id" bigint, "p_source" "text", "p_leadtype" "text", "p_community" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."check_user_group_status"("p_user_id" bigint, "p_group_id" bigint, "p_source" "text", "p_leadtype" "text", "p_community" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."check_user_group_status"("p_user_id" bigint, "p_group_id" bigint, "p_source" "text", "p_leadtype" "text", "p_community" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."check_user_registration_status"("user_email" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."check_user_registration_status"("user_email" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."check_user_registration_status"("user_email" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."check_users_profile_ids"() TO "anon";
GRANT ALL ON FUNCTION "public"."check_users_profile_ids"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."check_users_profile_ids"() TO "service_role";



GRANT ALL ON FUNCTION "public"."cleanup_expired_frequency_data"() TO "anon";
GRANT ALL ON FUNCTION "public"."cleanup_expired_frequency_data"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."cleanup_expired_frequency_data"() TO "service_role";



GRANT ALL ON FUNCTION "public"."cleanup_old_approval_data"("p_days_old" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."cleanup_old_approval_data"("p_days_old" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."cleanup_old_approval_data"("p_days_old" integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."cleanup_old_logs"("p_days_to_keep" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."cleanup_old_logs"("p_days_to_keep" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."cleanup_old_logs"("p_days_to_keep" integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."create_announcement"("p_title" "text", "p_content" "text", "p_type" "text", "p_priority" integer, "p_target_roles" "text"[], "p_target_organizations" "uuid"[], "p_start_time" timestamp with time zone, "p_end_time" timestamp with time zone, "p_created_by" bigint) TO "anon";
GRANT ALL ON FUNCTION "public"."create_announcement"("p_title" "text", "p_content" "text", "p_type" "text", "p_priority" integer, "p_target_roles" "text"[], "p_target_organizations" "uuid"[], "p_start_time" timestamp with time zone, "p_end_time" timestamp with time zone, "p_created_by" bigint) TO "authenticated";
GRANT ALL ON FUNCTION "public"."create_announcement"("p_title" "text", "p_content" "text", "p_type" "text", "p_priority" integer, "p_target_roles" "text"[], "p_target_organizations" "uuid"[], "p_start_time" timestamp with time zone, "p_end_time" timestamp with time zone, "p_created_by" bigint) TO "service_role";



GRANT ALL ON FUNCTION "public"."create_lead_points_cost_rule"("p_name" "text", "p_description" "text", "p_base_points_cost" integer, "p_conditions" "jsonb", "p_dynamic_cost_config" "jsonb", "p_priority" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."create_lead_points_cost_rule"("p_name" "text", "p_description" "text", "p_base_points_cost" integer, "p_conditions" "jsonb", "p_dynamic_cost_config" "jsonb", "p_priority" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."create_lead_points_cost_rule"("p_name" "text", "p_description" "text", "p_base_points_cost" integer, "p_conditions" "jsonb", "p_dynamic_cost_config" "jsonb", "p_priority" integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."create_notification"("p_user_id" bigint, "p_type" "text", "p_title" "text", "p_content" "text", "p_metadata" "jsonb", "p_priority" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."create_notification"("p_user_id" bigint, "p_type" "text", "p_title" "text", "p_content" "text", "p_metadata" "jsonb", "p_priority" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."create_notification"("p_user_id" bigint, "p_type" "text", "p_title" "text", "p_content" "text", "p_metadata" "jsonb", "p_priority" integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."create_simple_allocation_rule"("p_name" "text", "p_description" "text", "p_user_groups" bigint[], "p_conditions" "jsonb", "p_allocation_method" "public"."allocation_method", "p_enable_permission_check" boolean, "p_priority" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."create_simple_allocation_rule"("p_name" "text", "p_description" "text", "p_user_groups" bigint[], "p_conditions" "jsonb", "p_allocation_method" "public"."allocation_method", "p_enable_permission_check" boolean, "p_priority" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."create_simple_allocation_rule"("p_name" "text", "p_description" "text", "p_user_groups" bigint[], "p_conditions" "jsonb", "p_allocation_method" "public"."allocation_method", "p_enable_permission_check" boolean, "p_priority" integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."create_user_profile"() TO "anon";
GRANT ALL ON FUNCTION "public"."create_user_profile"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."create_user_profile"() TO "service_role";



GRANT ALL ON FUNCTION "public"."delete_pivot_config"("p_config_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."delete_pivot_config"("p_config_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."delete_pivot_config"("p_config_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."exchange_goods_item"("p_user_id" bigint, "p_goods_id" "uuid", "p_description" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."exchange_goods_item"("p_user_id" bigint, "p_goods_id" "uuid", "p_description" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."exchange_goods_item"("p_user_id" bigint, "p_goods_id" "uuid", "p_description" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."exchange_points"("p_user_id" bigint, "p_exchange_type" character varying, "p_target_id" bigint, "p_points_required" integer, "p_description" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."exchange_points"("p_user_id" bigint, "p_exchange_type" character varying, "p_target_id" bigint, "p_points_required" integer, "p_description" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."exchange_points"("p_user_id" bigint, "p_exchange_type" character varying, "p_target_id" bigint, "p_points_required" integer, "p_description" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."execute_enhanced_pivot_analysis"("p_data_source" "text", "p_row_fields" "text"[], "p_column_fields" "text"[], "p_value_fields" "jsonb", "p_filters" "jsonb", "p_show_totals" boolean, "p_show_subtotals" boolean) TO "anon";
GRANT ALL ON FUNCTION "public"."execute_enhanced_pivot_analysis"("p_data_source" "text", "p_row_fields" "text"[], "p_column_fields" "text"[], "p_value_fields" "jsonb", "p_filters" "jsonb", "p_show_totals" boolean, "p_show_subtotals" boolean) TO "authenticated";
GRANT ALL ON FUNCTION "public"."execute_enhanced_pivot_analysis"("p_data_source" "text", "p_row_fields" "text"[], "p_column_fields" "text"[], "p_value_fields" "jsonb", "p_filters" "jsonb", "p_show_totals" boolean, "p_show_subtotals" boolean) TO "service_role";



GRANT ALL ON FUNCTION "public"."execute_multi_level_pivot_analysis"("p_data_source" "text", "p_row_fields" "text"[], "p_column_fields" "text"[], "p_value_fields" "jsonb", "p_filters" "jsonb", "p_show_totals" boolean) TO "anon";
GRANT ALL ON FUNCTION "public"."execute_multi_level_pivot_analysis"("p_data_source" "text", "p_row_fields" "text"[], "p_column_fields" "text"[], "p_value_fields" "jsonb", "p_filters" "jsonb", "p_show_totals" boolean) TO "authenticated";
GRANT ALL ON FUNCTION "public"."execute_multi_level_pivot_analysis"("p_data_source" "text", "p_row_fields" "text"[], "p_column_fields" "text"[], "p_value_fields" "jsonb", "p_filters" "jsonb", "p_show_totals" boolean) TO "service_role";



GRANT ALL ON FUNCTION "public"."filter_all_analysis"("p_leadid" "text", "p_phone" "text", "p_community" "text", "p_contractdate_start" "date", "p_contractdate_end" "date", "p_limit" integer, "p_offset" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."filter_all_analysis"("p_leadid" "text", "p_phone" "text", "p_community" "text", "p_contractdate_start" "date", "p_contractdate_end" "date", "p_limit" integer, "p_offset" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."filter_all_analysis"("p_leadid" "text", "p_phone" "text", "p_community" "text", "p_contractdate_start" "date", "p_contractdate_end" "date", "p_limit" integer, "p_offset" integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."filter_all_analysis_multi"("p_leadid" "text"[], "p_phone" "text"[], "p_wechat" "text"[], "p_source" "text"[], "p_leadtype" "text"[], "p_leadstatus" "text"[], "p_community" "text"[], "p_viewresult" "text"[], "p_showingsales" bigint[], "p_trueshowingsales" bigint[], "p_budget_min" integer, "p_budget_max" integer, "p_scheduletime_start" timestamp with time zone, "p_scheduletime_end" timestamp with time zone, "p_arrivaltime_start" timestamp with time zone, "p_arrivaltime_end" timestamp with time zone, "p_contractdate_start" "date", "p_contractdate_end" "date", "p_contractnumber" "text"[], "p_roomnumber" "text"[], "p_deal_community" "text"[], "p_limit" integer, "p_offset" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."filter_all_analysis_multi"("p_leadid" "text"[], "p_phone" "text"[], "p_wechat" "text"[], "p_source" "text"[], "p_leadtype" "text"[], "p_leadstatus" "text"[], "p_community" "text"[], "p_viewresult" "text"[], "p_showingsales" bigint[], "p_trueshowingsales" bigint[], "p_budget_min" integer, "p_budget_max" integer, "p_scheduletime_start" timestamp with time zone, "p_scheduletime_end" timestamp with time zone, "p_arrivaltime_start" timestamp with time zone, "p_arrivaltime_end" timestamp with time zone, "p_contractdate_start" "date", "p_contractdate_end" "date", "p_contractnumber" "text"[], "p_roomnumber" "text"[], "p_deal_community" "text"[], "p_limit" integer, "p_offset" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."filter_all_analysis_multi"("p_leadid" "text"[], "p_phone" "text"[], "p_wechat" "text"[], "p_source" "text"[], "p_leadtype" "text"[], "p_leadstatus" "text"[], "p_community" "text"[], "p_viewresult" "text"[], "p_showingsales" bigint[], "p_trueshowingsales" bigint[], "p_budget_min" integer, "p_budget_max" integer, "p_scheduletime_start" timestamp with time zone, "p_scheduletime_end" timestamp with time zone, "p_arrivaltime_start" timestamp with time zone, "p_arrivaltime_end" timestamp with time zone, "p_contractdate_start" "date", "p_contractdate_end" "date", "p_contractnumber" "text"[], "p_roomnumber" "text"[], "p_deal_community" "text"[], "p_limit" integer, "p_offset" integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."filter_deals"("p_id" "uuid"[], "p_leadid" "text"[], "p_contractdate_start" "date", "p_contractdate_end" "date", "p_community" "public"."community"[], "p_contractnumber" "text"[], "p_roomnumber" "text"[], "p_created_at_start" timestamp with time zone, "p_created_at_end" timestamp with time zone, "p_source" "public"."source"[], "p_order_by" "text", "p_ascending" boolean, "p_limit" integer, "p_offset" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."filter_deals"("p_id" "uuid"[], "p_leadid" "text"[], "p_contractdate_start" "date", "p_contractdate_end" "date", "p_community" "public"."community"[], "p_contractnumber" "text"[], "p_roomnumber" "text"[], "p_created_at_start" timestamp with time zone, "p_created_at_end" timestamp with time zone, "p_source" "public"."source"[], "p_order_by" "text", "p_ascending" boolean, "p_limit" integer, "p_offset" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."filter_deals"("p_id" "uuid"[], "p_leadid" "text"[], "p_contractdate_start" "date", "p_contractdate_end" "date", "p_community" "public"."community"[], "p_contractnumber" "text"[], "p_roomnumber" "text"[], "p_created_at_start" timestamp with time zone, "p_created_at_end" timestamp with time zone, "p_source" "public"."source"[], "p_order_by" "text", "p_ascending" boolean, "p_limit" integer, "p_offset" integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."filter_followups"("p_created_at_end" timestamp with time zone, "p_created_at_start" timestamp with time zone, "p_customerprofile" "public"."customerprofile"[], "p_followupresult" "text"[], "p_followupstage" "public"."followupstage"[], "p_interviewsales_user_id" bigint[], "p_leadid" "text"[], "p_leadtype" "text"[], "p_limit" integer, "p_majorcategory" "text"[], "p_moveintime_end" timestamp with time zone, "p_moveintime_start" timestamp with time zone, "p_offset" integer, "p_remark" "text", "p_scheduledcommunity" "public"."community"[], "p_showingsales_user" bigint[], "p_source" "public"."source"[], "p_userbudget" "text"[], "p_userbudget_min" numeric, "p_userbudget_max" numeric, "p_userrating" "public"."userrating"[], "p_wechat" "text"[], "p_worklocation" "text"[], "p_phone" "text"[], "p_qq" "text"[], "p_location" "text"[], "p_budget" "text"[], "p_douyinid" "text"[], "p_douyin_accountname" "text"[], "p_staffname" "text"[], "p_redbookid" "text"[], "p_area" "text"[], "p_notelink" "text"[], "p_campaignid" "text"[], "p_campaignname" "text"[], "p_unitid" "text"[], "p_unitname" "text"[], "p_creativedid" "text"[], "p_creativename" "text"[], "p_traffictype" "text"[], "p_interactiontype" "text"[], "p_douyinleadid" "text"[], "p_leadstatus" "text"[], "p_keyword" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."filter_followups"("p_created_at_end" timestamp with time zone, "p_created_at_start" timestamp with time zone, "p_customerprofile" "public"."customerprofile"[], "p_followupresult" "text"[], "p_followupstage" "public"."followupstage"[], "p_interviewsales_user_id" bigint[], "p_leadid" "text"[], "p_leadtype" "text"[], "p_limit" integer, "p_majorcategory" "text"[], "p_moveintime_end" timestamp with time zone, "p_moveintime_start" timestamp with time zone, "p_offset" integer, "p_remark" "text", "p_scheduledcommunity" "public"."community"[], "p_showingsales_user" bigint[], "p_source" "public"."source"[], "p_userbudget" "text"[], "p_userbudget_min" numeric, "p_userbudget_max" numeric, "p_userrating" "public"."userrating"[], "p_wechat" "text"[], "p_worklocation" "text"[], "p_phone" "text"[], "p_qq" "text"[], "p_location" "text"[], "p_budget" "text"[], "p_douyinid" "text"[], "p_douyin_accountname" "text"[], "p_staffname" "text"[], "p_redbookid" "text"[], "p_area" "text"[], "p_notelink" "text"[], "p_campaignid" "text"[], "p_campaignname" "text"[], "p_unitid" "text"[], "p_unitname" "text"[], "p_creativedid" "text"[], "p_creativename" "text"[], "p_traffictype" "text"[], "p_interactiontype" "text"[], "p_douyinleadid" "text"[], "p_leadstatus" "text"[], "p_keyword" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."filter_followups"("p_created_at_end" timestamp with time zone, "p_created_at_start" timestamp with time zone, "p_customerprofile" "public"."customerprofile"[], "p_followupresult" "text"[], "p_followupstage" "public"."followupstage"[], "p_interviewsales_user_id" bigint[], "p_leadid" "text"[], "p_leadtype" "text"[], "p_limit" integer, "p_majorcategory" "text"[], "p_moveintime_end" timestamp with time zone, "p_moveintime_start" timestamp with time zone, "p_offset" integer, "p_remark" "text", "p_scheduledcommunity" "public"."community"[], "p_showingsales_user" bigint[], "p_source" "public"."source"[], "p_userbudget" "text"[], "p_userbudget_min" numeric, "p_userbudget_max" numeric, "p_userrating" "public"."userrating"[], "p_wechat" "text"[], "p_worklocation" "text"[], "p_phone" "text"[], "p_qq" "text"[], "p_location" "text"[], "p_budget" "text"[], "p_douyinid" "text"[], "p_douyin_accountname" "text"[], "p_staffname" "text"[], "p_redbookid" "text"[], "p_area" "text"[], "p_notelink" "text"[], "p_campaignid" "text"[], "p_campaignname" "text"[], "p_unitid" "text"[], "p_unitname" "text"[], "p_creativedid" "text"[], "p_creativename" "text"[], "p_traffictype" "text"[], "p_interactiontype" "text"[], "p_douyinleadid" "text"[], "p_leadstatus" "text"[], "p_keyword" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."filter_leads"("p_leadid" "text", "p_created_at_start" timestamp with time zone, "p_created_at_end" timestamp with time zone, "p_updata_at_start" timestamp with time zone, "p_updata_at_end" timestamp with time zone, "p_phone" "text", "p_wechat" "text", "p_qq" "text", "p_location" "text", "p_budget" "text", "p_remark" "text", "p_source" "public"."source", "p_douyinid" "text", "p_douyin_accountname" "text", "p_staffname" "text", "p_redbookid" "text", "p_area" "text", "p_notelink" "text", "p_campaignid" "text", "p_campaignname" "text", "p_unitid" "text", "p_unitname" "text", "p_creativedid" "text", "p_creativename" "text", "p_leadtype" "text", "p_traffictype" "text", "p_interactiontype" "text", "p_douyinleadid" "text", "p_leadstatus" "text", "p_keyword" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."filter_leads"("p_leadid" "text", "p_created_at_start" timestamp with time zone, "p_created_at_end" timestamp with time zone, "p_updata_at_start" timestamp with time zone, "p_updata_at_end" timestamp with time zone, "p_phone" "text", "p_wechat" "text", "p_qq" "text", "p_location" "text", "p_budget" "text", "p_remark" "text", "p_source" "public"."source", "p_douyinid" "text", "p_douyin_accountname" "text", "p_staffname" "text", "p_redbookid" "text", "p_area" "text", "p_notelink" "text", "p_campaignid" "text", "p_campaignname" "text", "p_unitid" "text", "p_unitname" "text", "p_creativedid" "text", "p_creativename" "text", "p_leadtype" "text", "p_traffictype" "text", "p_interactiontype" "text", "p_douyinleadid" "text", "p_leadstatus" "text", "p_keyword" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."filter_leads"("p_leadid" "text", "p_created_at_start" timestamp with time zone, "p_created_at_end" timestamp with time zone, "p_updata_at_start" timestamp with time zone, "p_updata_at_end" timestamp with time zone, "p_phone" "text", "p_wechat" "text", "p_qq" "text", "p_location" "text", "p_budget" "text", "p_remark" "text", "p_source" "public"."source", "p_douyinid" "text", "p_douyin_accountname" "text", "p_staffname" "text", "p_redbookid" "text", "p_area" "text", "p_notelink" "text", "p_campaignid" "text", "p_campaignname" "text", "p_unitid" "text", "p_unitname" "text", "p_creativedid" "text", "p_creativename" "text", "p_leadtype" "text", "p_traffictype" "text", "p_interactiontype" "text", "p_douyinleadid" "text", "p_leadstatus" "text", "p_keyword" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."filter_showings"("p_leadid" "text", "p_community" "text"[], "p_showingsales" bigint[], "p_trueshowingsales" bigint[], "p_interviewsales" bigint[], "p_viewresult" "text"[], "p_budget_min" integer, "p_budget_max" integer, "p_renttime_min" integer, "p_renttime_max" integer, "p_scheduletime_start" timestamp with time zone, "p_scheduletime_end" timestamp with time zone, "p_arrivaltime_start" timestamp with time zone, "p_arrivaltime_end" timestamp with time zone, "p_moveintime_start" timestamp with time zone, "p_moveintime_end" timestamp with time zone, "p_created_at_start" timestamp with time zone, "p_created_at_end" timestamp with time zone, "p_order_by" "text", "p_ascending" boolean, "p_limit" integer, "p_offset" integer, "p_incomplete" boolean) TO "anon";
GRANT ALL ON FUNCTION "public"."filter_showings"("p_leadid" "text", "p_community" "text"[], "p_showingsales" bigint[], "p_trueshowingsales" bigint[], "p_interviewsales" bigint[], "p_viewresult" "text"[], "p_budget_min" integer, "p_budget_max" integer, "p_renttime_min" integer, "p_renttime_max" integer, "p_scheduletime_start" timestamp with time zone, "p_scheduletime_end" timestamp with time zone, "p_arrivaltime_start" timestamp with time zone, "p_arrivaltime_end" timestamp with time zone, "p_moveintime_start" timestamp with time zone, "p_moveintime_end" timestamp with time zone, "p_created_at_start" timestamp with time zone, "p_created_at_end" timestamp with time zone, "p_order_by" "text", "p_ascending" boolean, "p_limit" integer, "p_offset" integer, "p_incomplete" boolean) TO "authenticated";
GRANT ALL ON FUNCTION "public"."filter_showings"("p_leadid" "text", "p_community" "text"[], "p_showingsales" bigint[], "p_trueshowingsales" bigint[], "p_interviewsales" bigint[], "p_viewresult" "text"[], "p_budget_min" integer, "p_budget_max" integer, "p_renttime_min" integer, "p_renttime_max" integer, "p_scheduletime_start" timestamp with time zone, "p_scheduletime_end" timestamp with time zone, "p_arrivaltime_start" timestamp with time zone, "p_arrivaltime_end" timestamp with time zone, "p_moveintime_start" timestamp with time zone, "p_moveintime_end" timestamp with time zone, "p_created_at_start" timestamp with time zone, "p_created_at_end" timestamp with time zone, "p_order_by" "text", "p_ascending" boolean, "p_limit" integer, "p_offset" integer, "p_incomplete" boolean) TO "service_role";



GRANT ALL ON FUNCTION "public"."filter_users_by_permission"("user_ids" bigint[]) TO "anon";
GRANT ALL ON FUNCTION "public"."filter_users_by_permission"("user_ids" bigint[]) TO "authenticated";
GRANT ALL ON FUNCTION "public"."filter_users_by_permission"("user_ids" bigint[]) TO "service_role";



GRANT ALL ON FUNCTION "public"."filter_users_by_quality_control"("p_user_ids" bigint[], "p_group_id" bigint) TO "anon";
GRANT ALL ON FUNCTION "public"."filter_users_by_quality_control"("p_user_ids" bigint[], "p_group_id" bigint) TO "authenticated";
GRANT ALL ON FUNCTION "public"."filter_users_by_quality_control"("p_user_ids" bigint[], "p_group_id" bigint) TO "service_role";



GRANT ALL ON FUNCTION "public"."freeze_user_on_status_left"() TO "anon";
GRANT ALL ON FUNCTION "public"."freeze_user_on_status_left"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."freeze_user_on_status_left"() TO "service_role";



GRANT ALL ON FUNCTION "public"."gen_leadid"() TO "anon";
GRANT ALL ON FUNCTION "public"."gen_leadid"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."gen_leadid"() TO "service_role";



GRANT ALL ON FUNCTION "public"."get_all_announcements"() TO "anon";
GRANT ALL ON FUNCTION "public"."get_all_announcements"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_all_announcements"() TO "service_role";



GRANT ALL ON FUNCTION "public"."get_approval_instances_count"("p_status_filter" "text"[], "p_target_id_filter" "text", "p_flow_name_filter" "text", "p_creator_name_filter" "text", "p_date_from" timestamp with time zone, "p_date_to" timestamp with time zone) TO "anon";
GRANT ALL ON FUNCTION "public"."get_approval_instances_count"("p_status_filter" "text"[], "p_target_id_filter" "text", "p_flow_name_filter" "text", "p_creator_name_filter" "text", "p_date_from" timestamp with time zone, "p_date_to" timestamp with time zone) TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_approval_instances_count"("p_status_filter" "text"[], "p_target_id_filter" "text", "p_flow_name_filter" "text", "p_creator_name_filter" "text", "p_date_from" timestamp with time zone, "p_date_to" timestamp with time zone) TO "service_role";



GRANT ALL ON FUNCTION "public"."get_approval_instances_with_sorting"("p_page" integer, "p_page_size" integer, "p_sort_field" "text", "p_sort_order" "text", "p_status_filter" "text"[], "p_target_id_filter" "text", "p_flow_name_filter" "text", "p_creator_name_filter" "text", "p_date_from" timestamp with time zone, "p_date_to" timestamp with time zone) TO "anon";
GRANT ALL ON FUNCTION "public"."get_approval_instances_with_sorting"("p_page" integer, "p_page_size" integer, "p_sort_field" "text", "p_sort_order" "text", "p_status_filter" "text"[], "p_target_id_filter" "text", "p_flow_name_filter" "text", "p_creator_name_filter" "text", "p_date_from" timestamp with time zone, "p_date_to" timestamp with time zone) TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_approval_instances_with_sorting"("p_page" integer, "p_page_size" integer, "p_sort_field" "text", "p_sort_order" "text", "p_status_filter" "text"[], "p_target_id_filter" "text", "p_flow_name_filter" "text", "p_creator_name_filter" "text", "p_date_from" timestamp with time zone, "p_date_to" timestamp with time zone) TO "service_role";



GRANT ALL ON FUNCTION "public"."get_approval_performance_metrics"() TO "anon";
GRANT ALL ON FUNCTION "public"."get_approval_performance_metrics"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_approval_performance_metrics"() TO "service_role";



GRANT ALL ON FUNCTION "public"."get_approval_statistics"() TO "anon";
GRANT ALL ON FUNCTION "public"."get_approval_statistics"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_approval_statistics"() TO "service_role";



GRANT ALL ON FUNCTION "public"."get_available_data_sources"() TO "anon";
GRANT ALL ON FUNCTION "public"."get_available_data_sources"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_available_data_sources"() TO "service_role";



GRANT ALL ON FUNCTION "public"."get_bi_statistics"() TO "anon";
GRANT ALL ON FUNCTION "public"."get_bi_statistics"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_bi_statistics"() TO "service_role";



GRANT ALL ON FUNCTION "public"."get_conversion_rate_stats"("p_date_start" timestamp with time zone, "p_date_end" timestamp with time zone, "p_previous_date_start" timestamp with time zone, "p_previous_date_end" timestamp with time zone) TO "anon";
GRANT ALL ON FUNCTION "public"."get_conversion_rate_stats"("p_date_start" timestamp with time zone, "p_date_end" timestamp with time zone, "p_previous_date_start" timestamp with time zone, "p_previous_date_end" timestamp with time zone) TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_conversion_rate_stats"("p_date_start" timestamp with time zone, "p_date_end" timestamp with time zone, "p_previous_date_start" timestamp with time zone, "p_previous_date_end" timestamp with time zone) TO "service_role";



GRANT ALL ON FUNCTION "public"."get_conversion_rate_stats_with_actual_sales"("p_date_start" timestamp with time zone, "p_date_end" timestamp with time zone, "p_previous_date_start" timestamp with time zone, "p_previous_date_end" timestamp with time zone) TO "anon";
GRANT ALL ON FUNCTION "public"."get_conversion_rate_stats_with_actual_sales"("p_date_start" timestamp with time zone, "p_date_end" timestamp with time zone, "p_previous_date_start" timestamp with time zone, "p_previous_date_end" timestamp with time zone) TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_conversion_rate_stats_with_actual_sales"("p_date_start" timestamp with time zone, "p_date_end" timestamp with time zone, "p_previous_date_start" timestamp with time zone, "p_previous_date_end" timestamp with time zone) TO "service_role";



GRANT ALL ON FUNCTION "public"."get_data_source_fields"("p_source_name" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."get_data_source_fields"("p_source_name" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_data_source_fields"("p_source_name" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."get_deals_community_options"() TO "anon";
GRANT ALL ON FUNCTION "public"."get_deals_community_options"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_deals_community_options"() TO "service_role";



GRANT ALL ON FUNCTION "public"."get_deals_contractnumber_options"() TO "anon";
GRANT ALL ON FUNCTION "public"."get_deals_contractnumber_options"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_deals_contractnumber_options"() TO "service_role";



GRANT ALL ON FUNCTION "public"."get_deals_count"("p_id" "uuid"[], "p_leadid" "text"[], "p_contractdate_start" "date", "p_contractdate_end" "date", "p_community" "text"[], "p_contractnumber" "text"[], "p_roomnumber" "text"[], "p_created_at_start" timestamp with time zone, "p_created_at_end" timestamp with time zone, "p_source" "text"[]) TO "anon";
GRANT ALL ON FUNCTION "public"."get_deals_count"("p_id" "uuid"[], "p_leadid" "text"[], "p_contractdate_start" "date", "p_contractdate_end" "date", "p_community" "text"[], "p_contractnumber" "text"[], "p_roomnumber" "text"[], "p_created_at_start" timestamp with time zone, "p_created_at_end" timestamp with time zone, "p_source" "text"[]) TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_deals_count"("p_id" "uuid"[], "p_leadid" "text"[], "p_contractdate_start" "date", "p_contractdate_end" "date", "p_community" "text"[], "p_contractnumber" "text"[], "p_roomnumber" "text"[], "p_created_at_start" timestamp with time zone, "p_created_at_end" timestamp with time zone, "p_source" "text"[]) TO "service_role";



GRANT ALL ON FUNCTION "public"."get_deals_roomnumber_options"() TO "anon";
GRANT ALL ON FUNCTION "public"."get_deals_roomnumber_options"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_deals_roomnumber_options"() TO "service_role";



GRANT ALL ON FUNCTION "public"."get_deals_source_options"() TO "anon";
GRANT ALL ON FUNCTION "public"."get_deals_source_options"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_deals_source_options"() TO "service_role";



GRANT ALL ON FUNCTION "public"."get_default_user"() TO "anon";
GRANT ALL ON FUNCTION "public"."get_default_user"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_default_user"() TO "service_role";



GRANT ALL ON FUNCTION "public"."get_enum_values"("enum_name" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."get_enum_values"("enum_name" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_enum_values"("enum_name" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."get_exchange_goods"("p_category" "text", "p_user_id" bigint) TO "anon";
GRANT ALL ON FUNCTION "public"."get_exchange_goods"("p_category" "text", "p_user_id" bigint) TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_exchange_goods"("p_category" "text", "p_user_id" bigint) TO "service_role";



GRANT ALL ON FUNCTION "public"."get_filter_options"("p_field_name" "text", "p_filters" "jsonb") TO "anon";
GRANT ALL ON FUNCTION "public"."get_filter_options"("p_field_name" "text", "p_filters" "jsonb") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_filter_options"("p_field_name" "text", "p_filters" "jsonb") TO "service_role";



GRANT ALL ON FUNCTION "public"."get_filtered_live_stream_schedules_with_users"("p_date_range_start" "date", "p_date_range_end" "date", "p_time_slots" "text"[], "p_statuses" "text"[], "p_scoring_statuses" "text"[], "p_score_min" numeric, "p_score_max" numeric, "p_lock_types" "text"[], "p_participants" "text"[], "p_scored_by" bigint[], "p_created_by" bigint[], "p_editing_by" bigint[], "p_locations" "text"[], "p_page" integer, "p_page_size" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."get_filtered_live_stream_schedules_with_users"("p_date_range_start" "date", "p_date_range_end" "date", "p_time_slots" "text"[], "p_statuses" "text"[], "p_scoring_statuses" "text"[], "p_score_min" numeric, "p_score_max" numeric, "p_lock_types" "text"[], "p_participants" "text"[], "p_scored_by" bigint[], "p_created_by" bigint[], "p_editing_by" bigint[], "p_locations" "text"[], "p_page" integer, "p_page_size" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_filtered_live_stream_schedules_with_users"("p_date_range_start" "date", "p_date_range_end" "date", "p_time_slots" "text"[], "p_statuses" "text"[], "p_scoring_statuses" "text"[], "p_score_min" numeric, "p_score_max" numeric, "p_lock_types" "text"[], "p_participants" "text"[], "p_scored_by" bigint[], "p_created_by" bigint[], "p_editing_by" bigint[], "p_locations" "text"[], "p_page" integer, "p_page_size" integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."get_group_users"("group_id" bigint) TO "anon";
GRANT ALL ON FUNCTION "public"."get_group_users"("group_id" bigint) TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_group_users"("group_id" bigint) TO "service_role";



GRANT ALL ON FUNCTION "public"."get_managed_org_ids"("admin_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."get_managed_org_ids"("admin_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_managed_org_ids"("admin_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."get_metrostations"() TO "anon";
GRANT ALL ON FUNCTION "public"."get_metrostations"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_metrostations"() TO "service_role";



GRANT ALL ON FUNCTION "public"."get_schedule_logs"("p_schedule_id" bigint, "p_limit" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."get_schedule_logs"("p_schedule_id" bigint, "p_limit" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_schedule_logs"("p_schedule_id" bigint, "p_limit" integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."get_showings_count"("p_leadid" "text", "p_community" "text"[], "p_showingsales" bigint[], "p_trueshowingsales" bigint[], "p_interviewsales" bigint[], "p_viewresult" "text"[], "p_budget_min" integer, "p_budget_max" integer, "p_renttime_min" integer, "p_renttime_max" integer, "p_scheduletime_start" timestamp with time zone, "p_scheduletime_end" timestamp with time zone, "p_arrivaltime_start" timestamp with time zone, "p_arrivaltime_end" timestamp with time zone, "p_moveintime_start" timestamp with time zone, "p_moveintime_end" timestamp with time zone, "p_created_at_start" timestamp with time zone, "p_created_at_end" timestamp with time zone, "p_incomplete" boolean) TO "anon";
GRANT ALL ON FUNCTION "public"."get_showings_count"("p_leadid" "text", "p_community" "text"[], "p_showingsales" bigint[], "p_trueshowingsales" bigint[], "p_interviewsales" bigint[], "p_viewresult" "text"[], "p_budget_min" integer, "p_budget_max" integer, "p_renttime_min" integer, "p_renttime_max" integer, "p_scheduletime_start" timestamp with time zone, "p_scheduletime_end" timestamp with time zone, "p_arrivaltime_start" timestamp with time zone, "p_arrivaltime_end" timestamp with time zone, "p_moveintime_start" timestamp with time zone, "p_moveintime_end" timestamp with time zone, "p_created_at_start" timestamp with time zone, "p_created_at_end" timestamp with time zone, "p_incomplete" boolean) TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_showings_count"("p_leadid" "text", "p_community" "text"[], "p_showingsales" bigint[], "p_trueshowingsales" bigint[], "p_interviewsales" bigint[], "p_viewresult" "text"[], "p_budget_min" integer, "p_budget_max" integer, "p_renttime_min" integer, "p_renttime_max" integer, "p_scheduletime_start" timestamp with time zone, "p_scheduletime_end" timestamp with time zone, "p_arrivaltime_start" timestamp with time zone, "p_arrivaltime_end" timestamp with time zone, "p_moveintime_start" timestamp with time zone, "p_moveintime_end" timestamp with time zone, "p_created_at_start" timestamp with time zone, "p_created_at_end" timestamp with time zone, "p_incomplete" boolean) TO "service_role";



GRANT ALL ON FUNCTION "public"."get_showings_viewresult_options"() TO "anon";
GRANT ALL ON FUNCTION "public"."get_showings_viewresult_options"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_showings_viewresult_options"() TO "service_role";



GRANT ALL ON FUNCTION "public"."get_user_achievements"("p_user_id" bigint) TO "anon";
GRANT ALL ON FUNCTION "public"."get_user_achievements"("p_user_id" bigint) TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_user_achievements"("p_user_id" bigint) TO "service_role";



GRANT ALL ON FUNCTION "public"."get_user_admin_organizations"() TO "anon";
GRANT ALL ON FUNCTION "public"."get_user_admin_organizations"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_user_admin_organizations"() TO "service_role";



GRANT ALL ON FUNCTION "public"."get_user_allocation_status"("p_user_id" bigint, "p_source" "text", "p_leadtype" "text", "p_community" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."get_user_allocation_status"("p_user_id" bigint, "p_source" "text", "p_leadtype" "text", "p_community" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_user_allocation_status"("p_user_id" bigint, "p_source" "text", "p_leadtype" "text", "p_community" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."get_user_allocation_status_multi"("p_user_id" bigint, "p_source" "text", "p_leadtype" "text", "p_community" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."get_user_allocation_status_multi"("p_user_id" bigint, "p_source" "text", "p_leadtype" "text", "p_community" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_user_allocation_status_multi"("p_user_id" bigint, "p_source" "text", "p_leadtype" "text", "p_community" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."get_user_announcements"("p_user_id" bigint) TO "anon";
GRANT ALL ON FUNCTION "public"."get_user_announcements"("p_user_id" bigint) TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_user_announcements"("p_user_id" bigint) TO "service_role";



GRANT ALL ON FUNCTION "public"."get_user_approval_statistics"("p_user_id" bigint) TO "anon";
GRANT ALL ON FUNCTION "public"."get_user_approval_statistics"("p_user_id" bigint) TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_user_approval_statistics"("p_user_id" bigint) TO "service_role";



GRANT ALL ON FUNCTION "public"."get_user_avatar_frames"("p_user_id" bigint) TO "anon";
GRANT ALL ON FUNCTION "public"."get_user_avatar_frames"("p_user_id" bigint) TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_user_avatar_frames"("p_user_id" bigint) TO "service_role";



GRANT ALL ON FUNCTION "public"."get_user_badges"("p_user_id" bigint) TO "anon";
GRANT ALL ON FUNCTION "public"."get_user_badges"("p_user_id" bigint) TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_user_badges"("p_user_id" bigint) TO "service_role";



GRANT ALL ON FUNCTION "public"."get_user_notifications"("p_user_id" bigint) TO "anon";
GRANT ALL ON FUNCTION "public"."get_user_notifications"("p_user_id" bigint) TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_user_notifications"("p_user_id" bigint) TO "service_role";



GRANT ALL ON FUNCTION "public"."get_user_permissions"("p_user_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."get_user_permissions"("p_user_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_user_permissions"("p_user_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."get_user_pivot_configs"("p_user_id" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."get_user_pivot_configs"("p_user_id" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_user_pivot_configs"("p_user_id" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."get_user_points_info"("p_user_id" bigint) TO "anon";
GRANT ALL ON FUNCTION "public"."get_user_points_info"("p_user_id" bigint) TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_user_points_info"("p_user_id" bigint) TO "service_role";



GRANT ALL ON FUNCTION "public"."get_user_roles"("p_user_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."get_user_roles"("p_user_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_user_roles"("p_user_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."get_users_by_permission"("permission" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."get_users_by_permission"("permission" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_users_by_permission"("permission" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."group_count_filter_followups"("p_groupby_field" "text", "p_leadid" "text"[], "p_leadtype" "text"[], "p_interviewsales_user_id" bigint[], "p_followupstage" "public"."followupstage"[], "p_customerprofile" "public"."customerprofile"[], "p_worklocation" "text"[], "p_userbudget" "text"[], "p_moveintime_start" timestamp with time zone, "p_moveintime_end" timestamp with time zone, "p_userrating" "public"."userrating"[], "p_majorcategory" "text"[], "p_subcategory" "text"[], "p_followupresult" "text"[], "p_scheduletime_start" timestamp with time zone, "p_scheduletime_end" timestamp with time zone, "p_scheduledcommunity" "public"."community"[], "p_keyword" "text", "p_wechat" "text"[], "p_phone" "text"[], "p_source" "public"."source"[], "p_created_at_start" timestamp with time zone, "p_created_at_end" timestamp with time zone, "p_remark" "text", "p_showingsales_user" bigint[]) TO "anon";
GRANT ALL ON FUNCTION "public"."group_count_filter_followups"("p_groupby_field" "text", "p_leadid" "text"[], "p_leadtype" "text"[], "p_interviewsales_user_id" bigint[], "p_followupstage" "public"."followupstage"[], "p_customerprofile" "public"."customerprofile"[], "p_worklocation" "text"[], "p_userbudget" "text"[], "p_moveintime_start" timestamp with time zone, "p_moveintime_end" timestamp with time zone, "p_userrating" "public"."userrating"[], "p_majorcategory" "text"[], "p_subcategory" "text"[], "p_followupresult" "text"[], "p_scheduletime_start" timestamp with time zone, "p_scheduletime_end" timestamp with time zone, "p_scheduledcommunity" "public"."community"[], "p_keyword" "text", "p_wechat" "text"[], "p_phone" "text"[], "p_source" "public"."source"[], "p_created_at_start" timestamp with time zone, "p_created_at_end" timestamp with time zone, "p_remark" "text", "p_showingsales_user" bigint[]) TO "authenticated";
GRANT ALL ON FUNCTION "public"."group_count_filter_followups"("p_groupby_field" "text", "p_leadid" "text"[], "p_leadtype" "text"[], "p_interviewsales_user_id" bigint[], "p_followupstage" "public"."followupstage"[], "p_customerprofile" "public"."customerprofile"[], "p_worklocation" "text"[], "p_userbudget" "text"[], "p_moveintime_start" timestamp with time zone, "p_moveintime_end" timestamp with time zone, "p_userrating" "public"."userrating"[], "p_majorcategory" "text"[], "p_subcategory" "text"[], "p_followupresult" "text"[], "p_scheduletime_start" timestamp with time zone, "p_scheduletime_end" timestamp with time zone, "p_scheduledcommunity" "public"."community"[], "p_keyword" "text", "p_wechat" "text"[], "p_phone" "text"[], "p_source" "public"."source"[], "p_created_at_start" timestamp with time zone, "p_created_at_end" timestamp with time zone, "p_remark" "text", "p_showingsales_user" bigint[]) TO "service_role";



GRANT ALL ON FUNCTION "public"."has_permission"("resource" "text", "action" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."has_permission"("resource" "text", "action" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."has_permission"("resource" "text", "action" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."has_role"("role_name" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."has_role"("role_name" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."has_role"("role_name" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."insert_user_points_transaction"("p_created_by" bigint, "p_description" "text", "p_points_change" integer, "p_source_id" "text", "p_source_type" character varying, "p_transaction_type" character varying, "p_user_id" bigint) TO "anon";
GRANT ALL ON FUNCTION "public"."insert_user_points_transaction"("p_created_by" bigint, "p_description" "text", "p_points_change" integer, "p_source_id" "text", "p_source_type" character varying, "p_transaction_type" character varying, "p_user_id" bigint) TO "authenticated";
GRANT ALL ON FUNCTION "public"."insert_user_points_transaction"("p_created_by" bigint, "p_description" "text", "p_points_change" integer, "p_source_id" "text", "p_source_type" character varying, "p_transaction_type" character varying, "p_user_id" bigint) TO "service_role";



GRANT ALL ON FUNCTION "public"."is_organization_admin"("org_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."is_organization_admin"("org_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."is_organization_admin"("org_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."issue_exchange_reward"("p_user_id" bigint, "p_goods_category" "text", "p_goods_name" "text", "p_description" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."issue_exchange_reward"("p_user_id" bigint, "p_goods_category" "text", "p_goods_name" "text", "p_description" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."issue_exchange_reward"("p_user_id" bigint, "p_goods_category" "text", "p_goods_name" "text", "p_description" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."jsonb_to_bigint_array"("jsonb") TO "anon";
GRANT ALL ON FUNCTION "public"."jsonb_to_bigint_array"("jsonb") TO "authenticated";
GRANT ALL ON FUNCTION "public"."jsonb_to_bigint_array"("jsonb") TO "service_role";



GRANT ALL ON FUNCTION "public"."log_schedule_change"() TO "anon";
GRANT ALL ON FUNCTION "public"."log_schedule_change"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."log_schedule_change"() TO "service_role";



GRANT ALL ON FUNCTION "public"."manual_sync_all_users_profile"() TO "anon";
GRANT ALL ON FUNCTION "public"."manual_sync_all_users_profile"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."manual_sync_all_users_profile"() TO "service_role";



GRANT ALL ON FUNCTION "public"."manual_sync_user_metadata"() TO "anon";
GRANT ALL ON FUNCTION "public"."manual_sync_user_metadata"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."manual_sync_user_metadata"() TO "service_role";



GRANT ALL ON FUNCTION "public"."mark_announcement_read"("p_announcement_id" "uuid", "p_user_id" bigint) TO "anon";
GRANT ALL ON FUNCTION "public"."mark_announcement_read"("p_announcement_id" "uuid", "p_user_id" bigint) TO "authenticated";
GRANT ALL ON FUNCTION "public"."mark_announcement_read"("p_announcement_id" "uuid", "p_user_id" bigint) TO "service_role";



GRANT ALL ON FUNCTION "public"."mark_notification_handled"("p_notification_id" "uuid", "p_user_id" bigint) TO "anon";
GRANT ALL ON FUNCTION "public"."mark_notification_handled"("p_notification_id" "uuid", "p_user_id" bigint) TO "authenticated";
GRANT ALL ON FUNCTION "public"."mark_notification_handled"("p_notification_id" "uuid", "p_user_id" bigint) TO "service_role";



GRANT ALL ON FUNCTION "public"."mark_notification_read"("p_notification_id" "uuid", "p_user_id" bigint) TO "anon";
GRANT ALL ON FUNCTION "public"."mark_notification_read"("p_notification_id" "uuid", "p_user_id" bigint) TO "authenticated";
GRANT ALL ON FUNCTION "public"."mark_notification_read"("p_notification_id" "uuid", "p_user_id" bigint) TO "service_role";



GRANT ALL ON FUNCTION "public"."match_community_to_organization"("p_community" "public"."community", "user_ids" bigint[]) TO "anon";
GRANT ALL ON FUNCTION "public"."match_community_to_organization"("p_community" "public"."community", "user_ids" bigint[]) TO "authenticated";
GRANT ALL ON FUNCTION "public"."match_community_to_organization"("p_community" "public"."community", "user_ids" bigint[]) TO "service_role";



GRANT ALL ON FUNCTION "public"."notify_approval_result"() TO "anon";
GRANT ALL ON FUNCTION "public"."notify_approval_result"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."notify_approval_result"() TO "service_role";



GRANT ALL ON FUNCTION "public"."notify_approver_on_step_insert"() TO "anon";
GRANT ALL ON FUNCTION "public"."notify_approver_on_step_insert"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."notify_approver_on_step_insert"() TO "service_role";



GRANT ALL ON FUNCTION "public"."notify_followup_assignment"() TO "anon";
GRANT ALL ON FUNCTION "public"."notify_followup_assignment"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."notify_followup_assignment"() TO "service_role";



GRANT ALL ON FUNCTION "public"."notify_followup_reassignment"() TO "anon";
GRANT ALL ON FUNCTION "public"."notify_followup_reassignment"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."notify_followup_reassignment"() TO "service_role";



GRANT ALL ON FUNCTION "public"."process_points_deduction"("p_user_id" bigint, "p_leadid" "text", "p_source" "public"."source", "p_leadtype" "text", "p_campaignname" "text", "p_unitname" "text", "p_remark" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."process_points_deduction"("p_user_id" bigint, "p_leadid" "text", "p_source" "public"."source", "p_leadtype" "text", "p_campaignname" "text", "p_unitname" "text", "p_remark" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."process_points_deduction"("p_user_id" bigint, "p_leadid" "text", "p_source" "public"."source", "p_leadtype" "text", "p_campaignname" "text", "p_unitname" "text", "p_remark" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."process_showing_rollback"("p_showing_id" "uuid", "p_applicant_id" bigint, "p_community" "public"."community", "p_reason" "text", "p_leadid" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."process_showing_rollback"("p_showing_id" "uuid", "p_applicant_id" bigint, "p_community" "public"."community", "p_reason" "text", "p_leadid" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."process_showing_rollback"("p_showing_id" "uuid", "p_applicant_id" bigint, "p_community" "public"."community", "p_reason" "text", "p_leadid" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."recalculate_all_scores"() TO "anon";
GRANT ALL ON FUNCTION "public"."recalculate_all_scores"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."recalculate_all_scores"() TO "service_role";



GRANT ALL ON FUNCTION "public"."record_operation"("p_user_id" bigint, "p_operation_type" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."record_operation"("p_user_id" bigint, "p_operation_type" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."record_operation"("p_user_id" bigint, "p_operation_type" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."record_operation"("p_user_id" bigint, "p_operation_type" character varying, "p_record_id" character varying, "p_old_value" "text", "p_new_value" "text", "p_ip_address" "inet", "p_user_agent" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."record_operation"("p_user_id" bigint, "p_operation_type" character varying, "p_record_id" character varying, "p_old_value" "text", "p_new_value" "text", "p_ip_address" "inet", "p_user_agent" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."record_operation"("p_user_id" bigint, "p_operation_type" character varying, "p_record_id" character varying, "p_old_value" "text", "p_new_value" "text", "p_ip_address" "inet", "p_user_agent" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."remove_role_from_user"("target_user_id" "uuid", "role_name" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."remove_role_from_user"("target_user_id" "uuid", "role_name" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."remove_role_from_user"("target_user_id" "uuid", "role_name" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."save_pivot_config"("p_name" "text", "p_description" "text", "p_config" "jsonb", "p_data_source" "text", "p_is_public" boolean) TO "anon";
GRANT ALL ON FUNCTION "public"."save_pivot_config"("p_name" "text", "p_description" "text", "p_config" "jsonb", "p_data_source" "text", "p_is_public" boolean) TO "authenticated";
GRANT ALL ON FUNCTION "public"."save_pivot_config"("p_name" "text", "p_description" "text", "p_config" "jsonb", "p_data_source" "text", "p_is_public" boolean) TO "service_role";



GRANT ALL ON FUNCTION "public"."set_initial_admin"("admin_user_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."set_initial_admin"("admin_user_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."set_initial_admin"("admin_user_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."simple_lead_allocation_trigger"() TO "anon";
GRANT ALL ON FUNCTION "public"."simple_lead_allocation_trigger"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."simple_lead_allocation_trigger"() TO "service_role";



GRANT ALL ON FUNCTION "public"."sync_user_metadata_to_profile"() TO "anon";
GRANT ALL ON FUNCTION "public"."sync_user_metadata_to_profile"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."sync_user_metadata_to_profile"() TO "service_role";



GRANT ALL ON FUNCTION "public"."sync_user_profile_data"() TO "anon";
GRANT ALL ON FUNCTION "public"."sync_user_profile_data"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."sync_user_profile_data"() TO "service_role";



GRANT ALL ON FUNCTION "public"."sync_user_profile_on_auth_insert"() TO "anon";
GRANT ALL ON FUNCTION "public"."sync_user_profile_on_auth_insert"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."sync_user_profile_on_auth_insert"() TO "service_role";



GRANT ALL ON FUNCTION "public"."sync_user_profile_on_email_confirmed"() TO "anon";
GRANT ALL ON FUNCTION "public"."sync_user_profile_on_email_confirmed"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."sync_user_profile_on_email_confirmed"() TO "service_role";



GRANT ALL ON FUNCTION "public"."sync_user_profile_on_metadata_update"() TO "anon";
GRANT ALL ON FUNCTION "public"."sync_user_profile_on_metadata_update"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."sync_user_profile_on_metadata_update"() TO "service_role";



GRANT ALL ON FUNCTION "public"."test_allocation_system"() TO "anon";
GRANT ALL ON FUNCTION "public"."test_allocation_system"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."test_allocation_system"() TO "service_role";



GRANT ALL ON FUNCTION "public"."update_achievement_progress"("p_user_id" bigint, "p_achievement_code" "text", "p_progress_change" integer, "p_trigger_source" "text", "p_trigger_data" "jsonb") TO "anon";
GRANT ALL ON FUNCTION "public"."update_achievement_progress"("p_user_id" bigint, "p_achievement_code" "text", "p_progress_change" integer, "p_trigger_source" "text", "p_trigger_data" "jsonb") TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_achievement_progress"("p_user_id" bigint, "p_achievement_code" "text", "p_progress_change" integer, "p_trigger_source" "text", "p_trigger_data" "jsonb") TO "service_role";



GRANT ALL ON FUNCTION "public"."update_approval_instance_status"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_approval_instance_status"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_approval_instance_status"() TO "service_role";



GRANT ALL ON FUNCTION "public"."update_bi_pivot_configs_timestamp"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_bi_pivot_configs_timestamp"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_bi_pivot_configs_timestamp"() TO "service_role";



GRANT ALL ON FUNCTION "public"."update_dimension_weight"("p_dimension_code" "text", "p_new_weight" numeric) TO "anon";
GRANT ALL ON FUNCTION "public"."update_dimension_weight"("p_dimension_code" "text", "p_new_weight" numeric) TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_dimension_weight"("p_dimension_code" "text", "p_new_weight" numeric) TO "service_role";



GRANT ALL ON FUNCTION "public"."update_exchange_goods_timestamp"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_exchange_goods_timestamp"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_exchange_goods_timestamp"() TO "service_role";



GRANT ALL ON FUNCTION "public"."update_instance_status_on_reject"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_instance_status_on_reject"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_instance_status_on_reject"() TO "service_role";



GRANT ALL ON FUNCTION "public"."update_live_stream_schedules_updated_at"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_live_stream_schedules_updated_at"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_live_stream_schedules_updated_at"() TO "service_role";



GRANT ALL ON FUNCTION "public"."update_live_stream_scoring"("p_schedule_id" bigint, "p_scoring_data" "jsonb", "p_scored_by" bigint, "p_average_score" numeric) TO "anon";
GRANT ALL ON FUNCTION "public"."update_live_stream_scoring"("p_schedule_id" bigint, "p_scoring_data" "jsonb", "p_scored_by" bigint, "p_average_score" numeric) TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_live_stream_scoring"("p_schedule_id" bigint, "p_scoring_data" "jsonb", "p_scored_by" bigint, "p_average_score" numeric) TO "service_role";



GRANT ALL ON FUNCTION "public"."update_scoring_status"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_scoring_status"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_scoring_status"() TO "service_role";



GRANT ALL ON FUNCTION "public"."update_simple_allocation_rules_timestamp"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_simple_allocation_rules_timestamp"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_simple_allocation_rules_timestamp"() TO "service_role";



GRANT ALL ON FUNCTION "public"."update_updated_at_column"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_updated_at_column"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_updated_at_column"() TO "service_role";



GRANT ALL ON FUNCTION "public"."update_user_points_wallet"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_user_points_wallet"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_user_points_wallet"() TO "service_role";



GRANT ALL ON FUNCTION "public"."update_weighted_score"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_weighted_score"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_weighted_score"() TO "service_role";



GRANT ALL ON FUNCTION "public"."validate_allocation_system"() TO "anon";
GRANT ALL ON FUNCTION "public"."validate_allocation_system"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."validate_allocation_system"() TO "service_role";



GRANT ALL ON TABLE "public"."Selection" TO "anon";
GRANT ALL ON TABLE "public"."Selection" TO "authenticated";
GRANT ALL ON TABLE "public"."Selection" TO "service_role";



GRANT ALL ON SEQUENCE "public"."Selection_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."Selection_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."Selection_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."achievement_progress_logs" TO "anon";
GRANT ALL ON TABLE "public"."achievement_progress_logs" TO "authenticated";
GRANT ALL ON TABLE "public"."achievement_progress_logs" TO "service_role";



GRANT ALL ON TABLE "public"."achievements" TO "anon";
GRANT ALL ON TABLE "public"."achievements" TO "authenticated";
GRANT ALL ON TABLE "public"."achievements" TO "service_role";



GRANT ALL ON TABLE "public"."announcement_reads" TO "anon";
GRANT ALL ON TABLE "public"."announcement_reads" TO "authenticated";
GRANT ALL ON TABLE "public"."announcement_reads" TO "service_role";



GRANT ALL ON TABLE "public"."announcements" TO "anon";
GRANT ALL ON TABLE "public"."announcements" TO "authenticated";
GRANT ALL ON TABLE "public"."announcements" TO "service_role";



GRANT ALL ON TABLE "public"."approval_flows" TO "anon";
GRANT ALL ON TABLE "public"."approval_flows" TO "authenticated";
GRANT ALL ON TABLE "public"."approval_flows" TO "service_role";



GRANT ALL ON TABLE "public"."approval_instances" TO "anon";
GRANT ALL ON TABLE "public"."approval_instances" TO "authenticated";
GRANT ALL ON TABLE "public"."approval_instances" TO "service_role";



GRANT ALL ON TABLE "public"."approval_steps" TO "anon";
GRANT ALL ON TABLE "public"."approval_steps" TO "authenticated";
GRANT ALL ON TABLE "public"."approval_steps" TO "service_role";



GRANT ALL ON TABLE "public"."users_profile" TO "anon";
GRANT ALL ON TABLE "public"."users_profile" TO "authenticated";
GRANT ALL ON TABLE "public"."users_profile" TO "service_role";



GRANT ALL ON TABLE "public"."approval_instances_with_metadata" TO "anon";
GRANT ALL ON TABLE "public"."approval_instances_with_metadata" TO "authenticated";
GRANT ALL ON TABLE "public"."approval_instances_with_metadata" TO "service_role";



GRANT ALL ON TABLE "public"."avatar_frames" TO "anon";
GRANT ALL ON TABLE "public"."avatar_frames" TO "authenticated";
GRANT ALL ON TABLE "public"."avatar_frames" TO "service_role";



GRANT ALL ON TABLE "public"."badges" TO "anon";
GRANT ALL ON TABLE "public"."badges" TO "authenticated";
GRANT ALL ON TABLE "public"."badges" TO "service_role";



GRANT ALL ON TABLE "public"."banners" TO "anon";
GRANT ALL ON TABLE "public"."banners" TO "authenticated";
GRANT ALL ON TABLE "public"."banners" TO "service_role";



GRANT ALL ON SEQUENCE "public"."banners_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."banners_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."banners_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."bi_pivot_configs" TO "anon";
GRANT ALL ON TABLE "public"."bi_pivot_configs" TO "authenticated";
GRANT ALL ON TABLE "public"."bi_pivot_configs" TO "service_role";



GRANT ALL ON TABLE "public"."community_keywords" TO "anon";
GRANT ALL ON TABLE "public"."community_keywords" TO "authenticated";
GRANT ALL ON TABLE "public"."community_keywords" TO "service_role";



GRANT ALL ON SEQUENCE "public"."community_keywords_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."community_keywords_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."community_keywords_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."deals" TO "anon";
GRANT ALL ON TABLE "public"."deals" TO "authenticated";
GRANT ALL ON TABLE "public"."deals" TO "service_role";



GRANT ALL ON TABLE "public"."dimension_performance_stats" TO "anon";
GRANT ALL ON TABLE "public"."dimension_performance_stats" TO "authenticated";
GRANT ALL ON TABLE "public"."dimension_performance_stats" TO "service_role";



GRANT ALL ON TABLE "public"."exchange_goods" TO "anon";
GRANT ALL ON TABLE "public"."exchange_goods" TO "authenticated";
GRANT ALL ON TABLE "public"."exchange_goods" TO "service_role";



GRANT ALL ON TABLE "public"."followups" TO "anon";
GRANT ALL ON TABLE "public"."followups" TO "authenticated";
GRANT ALL ON TABLE "public"."followups" TO "service_role";



GRANT ALL ON TABLE "public"."frequency_control_config" TO "anon";
GRANT ALL ON TABLE "public"."frequency_control_config" TO "authenticated";
GRANT ALL ON TABLE "public"."frequency_control_config" TO "service_role";



GRANT ALL ON SEQUENCE "public"."frequency_control_config_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."frequency_control_config_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."frequency_control_config_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."operation_frequency_control" TO "anon";
GRANT ALL ON TABLE "public"."operation_frequency_control" TO "authenticated";
GRANT ALL ON TABLE "public"."operation_frequency_control" TO "service_role";



GRANT ALL ON TABLE "public"."frequency_control_summary" TO "anon";
GRANT ALL ON TABLE "public"."frequency_control_summary" TO "authenticated";
GRANT ALL ON TABLE "public"."frequency_control_summary" TO "service_role";



GRANT ALL ON TABLE "public"."frequency_cooldown" TO "anon";
GRANT ALL ON TABLE "public"."frequency_cooldown" TO "authenticated";
GRANT ALL ON TABLE "public"."frequency_cooldown" TO "service_role";



GRANT ALL ON TABLE "public"."lead_points_cost" TO "anon";
GRANT ALL ON TABLE "public"."lead_points_cost" TO "authenticated";
GRANT ALL ON TABLE "public"."lead_points_cost" TO "service_role";



GRANT ALL ON SEQUENCE "public"."leadid_sequence" TO "anon";
GRANT ALL ON SEQUENCE "public"."leadid_sequence" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."leadid_sequence" TO "service_role";



GRANT ALL ON TABLE "public"."leads" TO "anon";
GRANT ALL ON TABLE "public"."leads" TO "authenticated";
GRANT ALL ON TABLE "public"."leads" TO "service_role";



GRANT ALL ON TABLE "public"."live_stream_schedule_logs" TO "anon";
GRANT ALL ON TABLE "public"."live_stream_schedule_logs" TO "authenticated";
GRANT ALL ON TABLE "public"."live_stream_schedule_logs" TO "service_role";



GRANT ALL ON SEQUENCE "public"."live_stream_schedule_logs_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."live_stream_schedule_logs_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."live_stream_schedule_logs_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."live_stream_schedules" TO "anon";
GRANT ALL ON TABLE "public"."live_stream_schedules" TO "authenticated";
GRANT ALL ON TABLE "public"."live_stream_schedules" TO "service_role";



GRANT ALL ON SEQUENCE "public"."live_stream_schedules_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."live_stream_schedules_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."live_stream_schedules_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."live_stream_schedules_with_scoring" TO "anon";
GRANT ALL ON TABLE "public"."live_stream_schedules_with_scoring" TO "authenticated";
GRANT ALL ON TABLE "public"."live_stream_schedules_with_scoring" TO "service_role";



GRANT ALL ON TABLE "public"."live_stream_scoring_dimensions" TO "anon";
GRANT ALL ON TABLE "public"."live_stream_scoring_dimensions" TO "authenticated";
GRANT ALL ON TABLE "public"."live_stream_scoring_dimensions" TO "service_role";



GRANT ALL ON SEQUENCE "public"."live_stream_scoring_dimensions_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."live_stream_scoring_dimensions_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."live_stream_scoring_dimensions_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."live_stream_scoring_log" TO "anon";
GRANT ALL ON TABLE "public"."live_stream_scoring_log" TO "authenticated";
GRANT ALL ON TABLE "public"."live_stream_scoring_log" TO "service_role";



GRANT ALL ON SEQUENCE "public"."live_stream_scoring_log_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."live_stream_scoring_log_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."live_stream_scoring_log_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."live_stream_scoring_options" TO "anon";
GRANT ALL ON TABLE "public"."live_stream_scoring_options" TO "authenticated";
GRANT ALL ON TABLE "public"."live_stream_scoring_options" TO "service_role";



GRANT ALL ON SEQUENCE "public"."live_stream_scoring_options_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."live_stream_scoring_options_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."live_stream_scoring_options_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."metrostations" TO "anon";
GRANT ALL ON TABLE "public"."metrostations" TO "authenticated";
GRANT ALL ON TABLE "public"."metrostations" TO "service_role";



GRANT ALL ON SEQUENCE "public"."metrostations_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."metrostations_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."metrostations_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."notification_templates" TO "anon";
GRANT ALL ON TABLE "public"."notification_templates" TO "authenticated";
GRANT ALL ON TABLE "public"."notification_templates" TO "service_role";



GRANT ALL ON SEQUENCE "public"."notification_templates_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."notification_templates_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."notification_templates_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."notifications" TO "anon";
GRANT ALL ON TABLE "public"."notifications" TO "authenticated";
GRANT ALL ON TABLE "public"."notifications" TO "service_role";



GRANT ALL ON SEQUENCE "public"."operation_frequency_control_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."operation_frequency_control_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."operation_frequency_control_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."operation_logs" TO "anon";
GRANT ALL ON TABLE "public"."operation_logs" TO "authenticated";
GRANT ALL ON TABLE "public"."operation_logs" TO "service_role";



GRANT ALL ON SEQUENCE "public"."operation_logs_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."operation_logs_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."operation_logs_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."organizations" TO "anon";
GRANT ALL ON TABLE "public"."organizations" TO "authenticated";
GRANT ALL ON TABLE "public"."organizations" TO "service_role";



GRANT ALL ON TABLE "public"."permissions" TO "anon";
GRANT ALL ON TABLE "public"."permissions" TO "authenticated";
GRANT ALL ON TABLE "public"."permissions" TO "service_role";



GRANT ALL ON TABLE "public"."points_exchange_records" TO "anon";
GRANT ALL ON TABLE "public"."points_exchange_records" TO "authenticated";
GRANT ALL ON TABLE "public"."points_exchange_records" TO "service_role";



GRANT ALL ON SEQUENCE "public"."points_exchange_records_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."points_exchange_records_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."points_exchange_records_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."points_rules" TO "anon";
GRANT ALL ON TABLE "public"."points_rules" TO "authenticated";
GRANT ALL ON TABLE "public"."points_rules" TO "service_role";



GRANT ALL ON SEQUENCE "public"."points_rules_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."points_rules_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."points_rules_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."role_permissions" TO "anon";
GRANT ALL ON TABLE "public"."role_permissions" TO "authenticated";
GRANT ALL ON TABLE "public"."role_permissions" TO "service_role";



GRANT ALL ON TABLE "public"."roles" TO "anon";
GRANT ALL ON TABLE "public"."roles" TO "authenticated";
GRANT ALL ON TABLE "public"."roles" TO "service_role";



GRANT ALL ON TABLE "public"."scoring_log_detail" TO "anon";
GRANT ALL ON TABLE "public"."scoring_log_detail" TO "authenticated";
GRANT ALL ON TABLE "public"."scoring_log_detail" TO "service_role";



GRANT ALL ON TABLE "public"."scoring_statistics" TO "anon";
GRANT ALL ON TABLE "public"."scoring_statistics" TO "authenticated";
GRANT ALL ON TABLE "public"."scoring_statistics" TO "service_role";



GRANT ALL ON TABLE "public"."showings" TO "anon";
GRANT ALL ON TABLE "public"."showings" TO "authenticated";
GRANT ALL ON TABLE "public"."showings" TO "service_role";



GRANT ALL ON TABLE "public"."showings_allocation_logs" TO "anon";
GRANT ALL ON TABLE "public"."showings_allocation_logs" TO "authenticated";
GRANT ALL ON TABLE "public"."showings_allocation_logs" TO "service_role";



GRANT ALL ON TABLE "public"."showings_queue_record" TO "anon";
GRANT ALL ON TABLE "public"."showings_queue_record" TO "authenticated";
GRANT ALL ON TABLE "public"."showings_queue_record" TO "service_role";



GRANT ALL ON SEQUENCE "public"."showings_queue_record_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."showings_queue_record_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."showings_queue_record_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."simple_allocation_logs" TO "anon";
GRANT ALL ON TABLE "public"."simple_allocation_logs" TO "authenticated";
GRANT ALL ON TABLE "public"."simple_allocation_logs" TO "service_role";



GRANT ALL ON TABLE "public"."simple_allocation_rules" TO "anon";
GRANT ALL ON TABLE "public"."simple_allocation_rules" TO "authenticated";
GRANT ALL ON TABLE "public"."simple_allocation_rules" TO "service_role";



GRANT ALL ON TABLE "public"."simple_allocation_stats" TO "anon";
GRANT ALL ON TABLE "public"."simple_allocation_stats" TO "authenticated";
GRANT ALL ON TABLE "public"."simple_allocation_stats" TO "service_role";



GRANT ALL ON TABLE "public"."user_achievements" TO "anon";
GRANT ALL ON TABLE "public"."user_achievements" TO "authenticated";
GRANT ALL ON TABLE "public"."user_achievements" TO "service_role";



GRANT ALL ON TABLE "public"."user_avatar_frames" TO "anon";
GRANT ALL ON TABLE "public"."user_avatar_frames" TO "authenticated";
GRANT ALL ON TABLE "public"."user_avatar_frames" TO "service_role";



GRANT ALL ON TABLE "public"."user_badges" TO "anon";
GRANT ALL ON TABLE "public"."user_badges" TO "authenticated";
GRANT ALL ON TABLE "public"."user_badges" TO "service_role";



GRANT ALL ON TABLE "public"."user_exchange_limits" TO "anon";
GRANT ALL ON TABLE "public"."user_exchange_limits" TO "authenticated";
GRANT ALL ON TABLE "public"."user_exchange_limits" TO "service_role";



GRANT ALL ON TABLE "public"."user_points_transactions" TO "anon";
GRANT ALL ON TABLE "public"."user_points_transactions" TO "authenticated";
GRANT ALL ON TABLE "public"."user_points_transactions" TO "service_role";



GRANT ALL ON SEQUENCE "public"."user_points_transactions_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."user_points_transactions_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."user_points_transactions_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."user_points_wallet" TO "anon";
GRANT ALL ON TABLE "public"."user_points_wallet" TO "authenticated";
GRANT ALL ON TABLE "public"."user_points_wallet" TO "service_role";



GRANT ALL ON SEQUENCE "public"."user_points_wallet_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."user_points_wallet_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."user_points_wallet_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."user_roles" TO "anon";
GRANT ALL ON TABLE "public"."user_roles" TO "authenticated";
GRANT ALL ON TABLE "public"."user_roles" TO "service_role";



GRANT ALL ON TABLE "public"."users_list" TO "anon";
GRANT ALL ON TABLE "public"."users_list" TO "authenticated";
GRANT ALL ON TABLE "public"."users_list" TO "service_role";



GRANT ALL ON SEQUENCE "public"."users_list_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."users_list_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."users_list_id_seq" TO "service_role";



GRANT ALL ON SEQUENCE "public"."users_profile_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."users_profile_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."users_profile_id_seq" TO "service_role";



ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "service_role";






RESET ALL;
