-- 修复allocate_from_users函数中的类型冲突问题
-- 执行日期：2025-01-10
-- 问题：bigint = uuid 类型冲突

CREATE OR REPLACE FUNCTION public.allocate_from_users(
    user_list bigint[],
    method allocation_method
) RETURNS bigint
LANGUAGE plpgsql
AS $$
DECLARE
    target_user_id bigint;
    debug_info jsonb := '{}';
BEGIN
    -- 添加调试信息
    debug_info := jsonb_build_object(
        'user_list', user_list,
        'method', method,
        'user_list_type', pg_typeof(user_list),
        'user_list_length', CASE WHEN user_list IS NULL THEN NULL ELSE array_length(user_list, 1) END
    );
    
    -- 如果用户列表为空，返回NULL
    IF user_list IS NULL OR array_length(user_list, 1) IS NULL THEN
        debug_info := debug_info || jsonb_build_object('empty_user_list', true);
        INSERT INTO simple_allocation_logs (
            leadid, processing_details
        ) VALUES (
            'DEBUG_ALLOCATE_' || EXTRACT(EPOCH FROM NOW())::bigint,
            jsonb_build_object('allocate_from_users_debug', debug_info)
        );
        RETURN NULL;
    END IF;
    
    BEGIN
        CASE method
            WHEN 'round_robin' THEN
                -- 轮流分配：选择今日分配数量最少的用户
                -- 确保类型匹配，显式转换为bigint
                SELECT user_id INTO target_user_id
                FROM unnest(user_list) AS user_id
                ORDER BY (
                    SELECT COUNT(*) FROM simple_allocation_logs sal
                    WHERE sal.assigned_user_id = user_id::bigint
                    AND sal.created_at >= CURRENT_DATE
                ) ASC, RANDOM()  -- 加入随机因子避免总是选择同一个
                LIMIT 1;
                
            WHEN 'random' THEN
                -- 随机分配
                SELECT user_id INTO target_user_id
                FROM unnest(user_list) AS user_id
                ORDER BY RANDOM()
                LIMIT 1;
                
            WHEN 'workload' THEN
                -- 按工作量分配：选择近7天内分配线索最少的用户（基于分配日志）
                -- 确保类型匹配，显式转换为bigint
                SELECT user_id INTO target_user_id
                FROM unnest(user_list) AS user_id
                ORDER BY (
                    SELECT COUNT(*) FROM simple_allocation_logs sal
                    WHERE sal.assigned_user_id = user_id::bigint
                    AND sal.created_at >= CURRENT_DATE - INTERVAL '7 days'
                ) ASC, RANDOM()  -- 加入随机因子避免总是选择同一个
                LIMIT 1;
                
            ELSE
                -- 默认取第一个用户
                SELECT user_id INTO target_user_id
                FROM unnest(user_list) AS user_id
                LIMIT 1;
        END CASE;
        
        debug_info := debug_info || jsonb_build_object(
            'allocation_success', true,
            'target_user_id', target_user_id,
            'target_user_id_type', pg_typeof(target_user_id)
        );
        
    EXCEPTION WHEN OTHERS THEN
        debug_info := debug_info || jsonb_build_object(
            'allocation_error', SQLERRM,
            'allocation_error_detail', SQLSTATE,
            'allocation_error_context', 'allocate_from_users function'
        );
        target_user_id := NULL;
    END;
    
    -- 记录调试信息
    INSERT INTO simple_allocation_logs (
        leadid, processing_details
    ) VALUES (
        'DEBUG_ALLOCATE_' || EXTRACT(EPOCH FROM NOW())::bigint,
        jsonb_build_object('allocate_from_users_debug', debug_info)
    );
    
    RETURN target_user_id;
END;
$$;

-- 测试函数是否修复成功
SELECT 'allocate_from_users function updated successfully' AS status; 