-- 验证用户ID数组的触发器函数
-- 用于 users_list 表的数据完整性检查

CREATE OR REPLACE FUNCTION public.check_users_profile_ids()
RETURNS trigger
LANGUAGE plpgsql
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

-- 验证函数是否创建成功
DO $$
BEGIN
    -- 检查函数是否存在
    IF EXISTS (
        SELECT 1 FROM pg_proc 
        WHERE proname = 'check_users_profile_ids' 
        AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
    ) THEN
        RAISE NOTICE '函数 check_users_profile_ids() 创建成功';
    ELSE
        RAISE EXCEPTION '函数 check_users_profile_ids() 创建失败';
    END IF;
END;
$$;
