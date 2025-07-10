-- 第四步：精简 allocate_from_users 函数
-- 删除调试插入，保留核心逻辑

CREATE OR REPLACE FUNCTION public.allocate_from_users(
    user_list bigint[],
    method allocation_method
) RETURNS bigint
LANGUAGE plpgsql
AS $$
DECLARE
    target_user_id bigint;
BEGIN
    -- 如果用户列表为空，返回NULL
    IF user_list IS NULL OR array_length(user_list, 1) IS NULL THEN
        RETURN NULL;
    END IF;
    
    BEGIN
    CASE method
        WHEN 'round_robin' THEN
            -- 轮流分配：选择今日分配数量最少的用户
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
            -- 按工作量分配：选择近7天内分配线索最少的用户
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
        
    EXCEPTION WHEN OTHERS THEN
        target_user_id := NULL;
    END;
    
    RETURN target_user_id;
END;
$$;

-- 验证函数更新成功
SELECT 'allocate_from_users function cleaned up' AS status; 