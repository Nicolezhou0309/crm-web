-- 用户注册完成后的数据同步触发器
-- 该触发器在用户首次登录时将auth.users的metadata同步到users_profile表

CREATE OR REPLACE FUNCTION sync_user_metadata_to_profile()
RETURNS TRIGGER AS $$
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
    
    -- 检查是否更新了行
    IF FOUND THEN
      RAISE LOG 'Updated existing profile for user: %', NEW.email;
    ELSE
      -- 如果没有找到对应的profile记录，创建一个新的
      RAISE LOG 'Creating new profile for user: %', NEW.email;
      INSERT INTO public.users_profile (
        user_id,
        email,
        nickname,
        status,
        organization_id,
        created_at,
        updated_at
      ) VALUES (
        NEW.id,
        NEW.email,
        COALESCE(NEW.raw_user_meta_data->>'name', split_part(NEW.email, '@', 1)),
        'active',
        (NEW.raw_user_meta_data->>'organization_id')::uuid,
        NOW(),
        NOW()
      );
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 创建触发器
DROP TRIGGER IF EXISTS sync_user_metadata_trigger ON auth.users;
CREATE TRIGGER sync_user_metadata_trigger
  AFTER UPDATE ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION sync_user_metadata_to_profile();

-- 创建一个函数来手动同步现有用户的数据
CREATE OR REPLACE FUNCTION manual_sync_user_metadata()
RETURNS void AS $$
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
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 执行一次手动同步（可选）
-- SELECT manual_sync_user_metadata();

-- 创建一个辅助函数来检查用户注册状态
CREATE OR REPLACE FUNCTION check_user_registration_status(user_email text)
RETURNS TABLE(
  auth_user_id uuid,
  profile_user_id uuid,
  email_confirmed boolean,
  profile_status text,
  organization_id uuid,
  nickname text
) AS $$
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
$$ LANGUAGE plpgsql SECURITY DEFINER; 