-- ========================================
-- users_profile 表联动逻辑函数
-- 在 auth.users 添加记录后自动调用
-- ========================================

-- 1. 创建用户档案同步函数
CREATE OR REPLACE FUNCTION public.sync_user_profile_on_auth_insert()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
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

-- 2. 创建邮箱确认同步函数
CREATE OR REPLACE FUNCTION public.sync_user_profile_on_email_confirmed()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
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

-- 3. 创建用户元数据更新同步函数
CREATE OR REPLACE FUNCTION public.sync_user_profile_on_metadata_update()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
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

-- 4. 创建触发器
-- 4.1 用户创建时同步
DROP TRIGGER IF EXISTS sync_profile_on_auth_insert ON auth.users;
CREATE TRIGGER sync_profile_on_auth_insert
    AFTER INSERT ON auth.users
    FOR EACH ROW
    EXECUTE FUNCTION public.sync_user_profile_on_auth_insert();

-- 4.2 邮箱确认时同步
DROP TRIGGER IF EXISTS sync_profile_on_email_confirmed ON auth.users;
CREATE TRIGGER sync_profile_on_email_confirmed
    AFTER UPDATE OF email_confirmed_at ON auth.users
    FOR EACH ROW
    EXECUTE FUNCTION public.sync_user_profile_on_email_confirmed();

-- 4.3 元数据更新时同步
DROP TRIGGER IF EXISTS sync_profile_on_metadata_update ON auth.users;
CREATE TRIGGER sync_profile_on_metadata_update
    AFTER UPDATE ON auth.users
    FOR EACH ROW
    EXECUTE FUNCTION public.sync_user_profile_on_metadata_update();

-- 5. 创建手动同步函数（用于同步现有数据）
CREATE OR REPLACE FUNCTION public.manual_sync_all_users_profile()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
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

-- 6. 创建检查函数（用于诊断）
CREATE OR REPLACE FUNCTION public.check_profile_sync_status(user_email text DEFAULT NULL)
RETURNS TABLE(
    auth_user_id uuid,
    auth_email text,
    auth_confirmed boolean,
    profile_user_id uuid,
    profile_email text,
    profile_status text,
    profile_organization_id uuid,
    profile_nickname text,
    sync_status text
)
LANGUAGE plpgsql
SECURITY DEFINER
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

-- 7. 验证函数创建
DO $$
BEGIN
    -- 检查函数是否存在
    IF EXISTS (
        SELECT 1 FROM pg_proc 
        WHERE proname = 'sync_user_profile_on_auth_insert' 
        AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
    ) THEN
        RAISE NOTICE '✅ 函数 sync_user_profile_on_auth_insert() 创建成功';
    ELSE
        RAISE EXCEPTION '❌ 函数 sync_user_profile_on_auth_insert() 创建失败';
    END IF;
    
    IF EXISTS (
        SELECT 1 FROM pg_proc 
        WHERE proname = 'sync_user_profile_on_email_confirmed' 
        AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
    ) THEN
        RAISE NOTICE '✅ 函数 sync_user_profile_on_email_confirmed() 创建成功';
    ELSE
        RAISE EXCEPTION '❌ 函数 sync_user_profile_on_email_confirmed() 创建失败';
    END IF;
    
    IF EXISTS (
        SELECT 1 FROM pg_proc 
        WHERE proname = 'sync_user_profile_on_metadata_update' 
        AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
    ) THEN
        RAISE NOTICE '✅ 函数 sync_user_profile_on_metadata_update() 创建成功';
    ELSE
        RAISE EXCEPTION '❌ 函数 sync_user_profile_on_metadata_update() 创建失败';
    END IF;
    
    IF EXISTS (
        SELECT 1 FROM pg_proc 
        WHERE proname = 'manual_sync_all_users_profile' 
        AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
    ) THEN
        RAISE NOTICE '✅ 函数 manual_sync_all_users_profile() 创建成功';
    ELSE
        RAISE EXCEPTION '❌ 函数 manual_sync_all_users_profile() 创建失败';
    END IF;
    
    IF EXISTS (
        SELECT 1 FROM pg_proc 
        WHERE proname = 'check_profile_sync_status' 
        AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
    ) THEN
        RAISE NOTICE '✅ 函数 check_profile_sync_status() 创建成功';
    ELSE
        RAISE EXCEPTION '❌ 函数 check_profile_sync_status() 创建失败';
    END IF;
    
    RAISE NOTICE '🎉 所有函数创建成功！';
END;
$$;

-- 8. 使用说明
COMMENT ON FUNCTION public.sync_user_profile_on_auth_insert() IS '用户创建时自动同步到users_profile表';
COMMENT ON FUNCTION public.sync_user_profile_on_email_confirmed() IS '邮箱确认时自动同步到users_profile表';
COMMENT ON FUNCTION public.sync_user_profile_on_metadata_update() IS '用户元数据更新时自动同步到users_profile表';
COMMENT ON FUNCTION public.manual_sync_all_users_profile() IS '手动同步所有用户数据到users_profile表';
COMMENT ON FUNCTION public.check_profile_sync_status(text) IS '检查用户profile同步状态';

-- 9. 测试查询
-- 检查同步状态
-- SELECT * FROM check_profile_sync_status();

-- 手动同步现有数据
-- SELECT manual_sync_all_users_profile(); 