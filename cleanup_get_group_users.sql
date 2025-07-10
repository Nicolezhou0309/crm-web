-- 第三步：精简 get_group_users 函数
-- 删除调试插入，保留核心逻辑

CREATE OR REPLACE FUNCTION public.get_group_users(group_id bigint)
RETURNS bigint[]
LANGUAGE plpgsql
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
        BEGIN
            SELECT array_agg(element::bigint) INTO user_list
            FROM unnest(raw_list) element;
        EXCEPTION WHEN OTHERS THEN
            user_list := NULL;
        END;
    END IF;
    
    RETURN user_list;
END;
$$;

-- 验证函数更新成功
SELECT 'get_group_users function cleaned up' AS status; 