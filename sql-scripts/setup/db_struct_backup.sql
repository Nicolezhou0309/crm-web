-- 用户档案一致性检查触发器函数备份
CREATE OR REPLACE FUNCTION public.check_profile_consistency()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
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

-- 组织（部门）表结构及索引备份
CREATE TABLE IF NOT EXISTS public.organizations (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  name text NOT NULL,
  parent_id uuid NULL,
  description text NULL,
  admin uuid NULL,
  CONSTRAINT organizations_pkey PRIMARY KEY (id),
  CONSTRAINT organizations_admin_fkey FOREIGN KEY (admin) REFERENCES auth.users (id),
  CONSTRAINT organizations_parent_id_fkey FOREIGN KEY (parent_id) REFERENCES organizations (id)
) TABLESPACE pg_default;

CREATE INDEX IF NOT EXISTS idx_organizations_admin ON public.organizations USING btree (admin) TABLESPACE pg_default;

-- 用户档案表结构及触发器备份
CREATE TABLE IF NOT EXISTS public.users_profile (
  id bigserial PRIMARY KEY,
  user_id uuid NULL,
  organization_id uuid NULL,
  nickname text NULL,
  email text NULL,
  status text NULL,
  updated_at timestamp with time zone NULL DEFAULT (now() AT TIME ZONE 'UTC'::text),
  CONSTRAINT users_profile_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES organizations (id) ON UPDATE CASCADE ON DELETE SET NULL,
  CONSTRAINT users_profile_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users (id) ON UPDATE CASCADE ON DELETE CASCADE
) TABLESPACE pg_default;

-- 用户状态变更时冻结用户触发器函数备份
CREATE OR REPLACE FUNCTION public.freeze_user_on_status_left()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
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

-- 角色表结构备份
CREATE TABLE IF NOT EXISTS public.roles (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text NULL,
  created_at timestamp with time zone NULL DEFAULT now(),
  updated_at timestamp with time zone NULL DEFAULT now(),
  CONSTRAINT roles_pkey PRIMARY KEY (id),
  CONSTRAINT roles_name_key UNIQUE (name)
) TABLESPACE pg_default;


-- 用户角色关联表结构备份
CREATE TABLE IF NOT EXISTS public.user_roles (
  user_id uuid NOT NULL,
  role_id uuid NOT NULL,
  created_at timestamp with time zone NULL DEFAULT now(),
  CONSTRAINT user_roles_pkey PRIMARY KEY (user_id, role_id),
  CONSTRAINT user_roles_role_id_fkey FOREIGN KEY (role_id) REFERENCES roles (id) ON DELETE CASCADE,
  CONSTRAINT user_roles_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users (id) ON DELETE CASCADE
) TABLESPACE pg_default;

-- 线索插入前检查和生成leadid的触发器函数备份
CREATE OR REPLACE FUNCTION public.before_insert_lead()
RETURNS trigger
LANGUAGE plpgsql
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
-- 触发器定义
CREATE TRIGGER ensure_profile_consistency
BEFORE INSERT OR UPDATE ON users_profile
FOR EACH ROW EXECUTE FUNCTION check_profile_consistency();

CREATE TRIGGER freeze_user_on_status_left_trigger
AFTER UPDATE OF status ON users_profile
FOR EACH ROW WHEN (new.status = 'left'::text)
EXECUTE FUNCTION freeze_user_on_status_left();

-- 线索表结构及触发器备份
CREATE TABLE IF NOT EXISTS public.leads (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  leadid text NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT (now() AT TIME ZONE 'UTC'::text),
  updata_at timestamp with time zone NOT NULL DEFAULT (now() AT TIME ZONE 'UTC'::text),
  phone text NULL,
  wechat text NULL,
  qq text NULL,
  location text NULL,
  budget text NULL,
  remark text NULL,
  source public.source NULL,
  douyinid text NULL,
  douyin_accountname text NULL,
  staffname text NULL,
  redbookid text NULL,
  area text NULL,
  notelink text NULL,
  campaignid text NULL,
  campaignname text NULL,
  unitid text NULL,
  unitname text NULL,
  creativedid text NULL,
  creativename text NULL,
  leadtype text NULL,
  traffictype text NULL,
  interactiontype text NULL,
  douyinleadid text NULL,
  leadstatus text NULL,
  CONSTRAINT leads_pkey PRIMARY KEY (id),
  CONSTRAINT leads_id_key UNIQUE (id),
  CONSTRAINT leads_leadid_key UNIQUE (leadid)
) TABLESPACE pg_default;
-- 跟进记录表结构备份
CREATE TABLE IF NOT EXISTS public.followups (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  leadid text NOT NULL,
  leadtype text NULL,
  followupstage public.followupstage NULL DEFAULT '待接收'::followupstage,
  customerprofile public.customerprofile NULL,
  worklocation text NULL,
  userbudget text NULL,
  moveintime timestamp with time zone NULL DEFAULT (now() AT TIME ZONE 'UTC'::text),
  userrating public.userrating NULL,
  majorcategory text NULL,
  subcategory text NULL,
  followupresult text NULL,
  scheduletime timestamp with time zone NULL DEFAULT (now() AT TIME ZONE 'UTC'::text),
  scheduledcommunity public.community NULL,
  created_at timestamp with time zone NULL DEFAULT (now() AT TIME ZONE 'UTC'::text),
  updated_at timestamp with time zone NULL DEFAULT (now() AT TIME ZONE 'UTC'::text),
  interviewsales_user_id bigint NULL,
  CONSTRAINT followups_pkey PRIMARY KEY (id),
  CONSTRAINT followups_leadid_key UNIQUE (leadid),
  CONSTRAINT followups_interviewsales_user_id_fkey FOREIGN KEY (interviewsales_user_id) REFERENCES users_profile (id),
  CONSTRAINT followups_leadid_fkey FOREIGN KEY (leadid) REFERENCES leads (leadid) ON UPDATE CASCADE
) TABLESPACE pg_default;

-- 带看记录表结构备份
CREATE TABLE IF NOT EXISTS public.showings (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  leadid text NOT NULL,
  scheduletime timestamp with time zone NULL,
  community public.community NULL,
  arrivaltime timestamp with time zone NULL,
  showingsales bigint NULL,
  trueshowingsales bigint NULL,
  viewresult text NOT NULL,
  budget integer NOT NULL,
  moveintime timestamp with time zone NOT NULL,
  remark text NOT NULL,
  renttime integer NOT NULL,
  created_at timestamp with time zone NULL DEFAULT (now() AT TIME ZONE 'UTC'::text),
  updated_at timestamp with time zone NULL DEFAULT (now() AT TIME ZONE 'UTC'::text),
  CONSTRAINT showings_pkey PRIMARY KEY (id),
  CONSTRAINT showings_leadid_key UNIQUE (leadid),
  CONSTRAINT showings_leadid_fkey FOREIGN KEY (leadid) REFERENCES followups (leadid) ON UPDATE CASCADE,
  CONSTRAINT showings_showingsales_fkey FOREIGN KEY (showingsales) REFERENCES users_profile (id),
  CONSTRAINT showings_trueshowingsales_fkey FOREIGN KEY (trueshowingsales) REFERENCES users_profile (id)
) TABLESPACE pg_default;

-- 权限表结构备份
CREATE TABLE IF NOT EXISTS public.permissions (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text NULL,
  resource text NOT NULL,
  action text NOT NULL,
  created_at timestamp with time zone NULL DEFAULT now(),
  updated_at timestamp with time zone NULL DEFAULT now(),
  CONSTRAINT permissions_pkey PRIMARY KEY (id),
  CONSTRAINT permissions_name_key UNIQUE (name),
  CONSTRAINT permissions_resource_action_key UNIQUE (resource, action)
) TABLESPACE pg_default;



-- 角色权限关联表结构备份
CREATE TABLE IF NOT EXISTS public.role_permissions (
  role_id uuid NOT NULL,
  permission_id uuid NOT NULL,
  created_at timestamp with time zone NULL DEFAULT now(),
  CONSTRAINT role_permissions_pkey PRIMARY KEY (role_id, permission_id),
  CONSTRAINT role_permissions_permission_id_fkey FOREIGN KEY (permission_id) REFERENCES permissions (id) ON DELETE CASCADE,
  CONSTRAINT role_permissions_role_id_fkey FOREIGN KEY (role_id) REFERENCES roles (id) ON DELETE CASCADE
) TABLESPACE pg_default;

-- 线索插入后自动生成跟进记录的触发器函数备份
CREATE OR REPLACE FUNCTION public.after_insert_followup()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
    -- 只为非重复线索插入跟进
    IF NEW.leadstatus = '新建' THEN
        INSERT INTO public.followups (
            leadid,
            leadtype,
            followupstage,
            customerprofile,
            worklocation,
            userbudget,
            moveintime,
            userrating,
            majorcategory,
            subcategory,
            followupresult,
            scheduletime,
            scheduledcommunity,
            showingsales,
            created_at,
            updated_at
        )
        VALUES (
            NEW.leadid,
            NEW.leadtype,
            '待接收',
            NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL,
            NOW(), NOW()
        );
    END IF;
    RETURN NULL;
END;
$$;

-- 触发器定义
CREATE TRIGGER trg_after_insert_followup
AFTER INSERT ON leads FOR EACH ROW
EXECUTE FUNCTION after_insert_followup();

CREATE TRIGGER trg_before_insert_lead
BEFORE INSERT ON leads FOR EACH ROW
EXECUTE FUNCTION before_insert_lead();



-- 成交记录表结构备份
CREATE TABLE IF NOT EXISTS public.deals (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  leadid text NOT NULL,
  contractdate date NULL,
  community public.community NULL,
  contractnumber text NULL,
  roomnumber text NULL,
  created_at timestamp with time zone NULL DEFAULT (now() AT TIME ZONE 'UTC'::text),
  updated_at timestamp with time zone NULL DEFAULT (now() AT TIME ZONE 'UTC'::text),
  CONSTRAINT deals_pkey PRIMARY KEY (id),
  CONSTRAINT deals_leadid_key UNIQUE (leadid),
  CONSTRAINT deals_leadid_fkey FOREIGN KEY (leadid) REFERENCES followups (leadid) ON UPDATE CASCADE,
  CONSTRAINT deals_leadid_fkey1 FOREIGN KEY (leadid) REFERENCES leads (leadid)
) TABLESPACE pg_default;


-- 分配权限到角色的函数备份
CREATE OR REPLACE FUNCTION public.assign_permission_to_role(role_name text, resource_name text, action_name text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  role_id UUID;
  permission_id UUID;
BEGIN
  -- 检查调用者是否有权限
  IF NOT has_permission('role_permissions', 'manage') THEN
    RAISE EXCEPTION '没有权限分配权限';
  END IF;
  -- 获取角色 ID
  SELECT id INTO role_id FROM public.roles WHERE name = role_name;
  IF role_id IS NULL THEN
    RAISE EXCEPTION '角色不存在: %', role_name;
  END IF;
  -- 获取权限 ID
  SELECT id INTO permission_id FROM public.permissions WHERE resource = resource_name AND action = action_name;
  IF permission_id IS NULL THEN
    RAISE EXCEPTION '权限不存在: % %', resource_name, action_name;
  END IF;
  -- 分配权限
  INSERT INTO public.role_permissions (role_id, permission_id)
  VALUES (role_id, permission_id)
  ON CONFLICT (role_id, permission_id) DO NOTHING;
  RETURN TRUE;
END;
$$;

-- 分配角色到用户的函数备份
CREATE OR REPLACE FUNCTION public.assign_role_to_user(target_user_id uuid, role_name text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  role_id UUID;
BEGIN
  -- 检查调用者是否有权限
  IF NOT has_permission('user_roles', 'manage') THEN
    RAISE EXCEPTION '没有权限分配角色';
  END IF;
  -- 获取角色 ID
  SELECT id INTO role_id FROM public.roles WHERE name = role_name;
  IF role_id IS NULL THEN
    RAISE EXCEPTION '角色不存在: %', role_name;
  END IF;
  -- 分配角色
  INSERT INTO public.user_roles (user_id, role_id)
  VALUES (target_user_id, role_id)
  ON CONFLICT (user_id, role_id) DO NOTHING;
  RETURN TRUE;
END;
$$;

-- 从用户移除角色函数备份
CREATE OR REPLACE FUNCTION public.remove_role_from_user(target_user_id uuid, role_name text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
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



-- 检查用户注册状态的函数备份
CREATE OR REPLACE FUNCTION public.check_user_registration_status(user_email text)
RETURNS TABLE(
  auth_user_id uuid,
  profile_user_id uuid,
  email_confirmed boolean,
  profile_status text,
  organization_id uuid,
  nickname text
)
LANGUAGE plpgsql
SECURITY DEFINER
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

-- 成交记录多条件过滤查询函数备份
CREATE OR REPLACE FUNCTION public.filter_deals(
  p_id uuid[] DEFAULT NULL::uuid[],
  p_leadid text[] DEFAULT NULL::text[],
  p_contractdate_start date DEFAULT NULL::date,
  p_contractdate_end date DEFAULT NULL::date,
  p_interviewsales_user_id uuid[] DEFAULT NULL::uuid[],
  p_community text[] DEFAULT NULL::text[],
  p_contractnumber text[] DEFAULT NULL::text[],
  p_roomnumber text[] DEFAULT NULL::text[],
  p_created_at_start timestamp with time zone DEFAULT NULL::timestamp with time zone,
  p_created_at_end timestamp with time zone DEFAULT NULL::timestamp with time zone,
  p_source text[] DEFAULT NULL::text[]
)
RETURNS TABLE(
  id uuid,
  leadid text,
  contractdate date,
  interviewsales text,
  interviewsales_user_id uuid,
  community community,
  contractnumber text,
  roomnumber text,
  created_at timestamp with time zone,
  source source
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT
    d.id,
    d.leadid,
    d.contractdate,
    d.interviewsales,
    d.interviewsales_user_id,
    d.community,
    d.contractnumber,
    d.roomnumber,
    d.created_at,
    l.source
  FROM deals d
  LEFT JOIN leads l ON d.leadid = l.leadid
  WHERE
    (p_id IS NULL OR d.id = ANY(p_id))
    AND (p_leadid IS NULL OR d.leadid = ANY(p_leadid))
    AND (p_contractdate_start IS NULL OR d.contractdate >= p_contractdate_start)
    AND (p_contractdate_end IS NULL OR d.contractdate <= p_contractdate_end)
    AND (p_interviewsales_user_id IS NULL OR d.interviewsales_user_id = ANY(p_interviewsales_user_id))
    -- Removed showingsales condition
    AND (p_community IS NULL OR d.community = ANY(ARRAY(SELECT unnest(p_community)::community)))
    AND (p_contractnumber IS NULL OR d.contractnumber = ANY(p_contractnumber))
    AND (p_roomnumber IS NULL OR d.roomnumber = ANY(p_roomnumber))
    AND (p_created_at_start IS NULL OR d.created_at >= p_created_at_start)
    AND (p_created_at_end IS NULL OR d.created_at <= p_created_at_end)
    AND (p_source IS NULL OR l.source = ANY(ARRAY(SELECT unnest(p_source)::source)));
END;
$$;

-- 线索插入时自动生成跟进记录的触发器函数备份
CREATE OR REPLACE FUNCTION public.create_followup_on_lead_insert()
RETURNS trigger
LANGUAGE plpgsql
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
    -- 如果发现重复，更新 leadstatus 并返回，不插入 followups
    IF duplicate_count > 0 THEN
        NEW.leadstatus := '重复';
        RETURN NEW;  -- 不插入 followups，直接返回
    END IF;
    -- 插入 followup 记录
    INSERT INTO public.followups (
        leadid,
        leadtype,
        followupstage,
        customerprofile,
        worklocation,
        userbudget,
        moveintime,
        userrating,
        majorcategory,
        subcategory,
        followupresult,
        scheduletime,
        scheduledcommunity,
        showingsales,
        created_at,
        updated_at
    )
    VALUES (
        NEW.leadid,
        NEW.leadtype,
        '待接收',  -- Default value for followupstage
        NULL,  -- Default value for customerprofile
        NULL,  -- Default value for worklocation
        NULL,  -- Default value for userbudget
        NULL,  -- Default value for moveintime
        NULL,  -- Default value for userrating
        NULL,  -- Default value for majorcategory
        NULL,  -- Default value for subcategory
        NULL,  -- Default value for followupresult
        NULL,  -- Default value for scheduletime
        NULL,  -- Default value for scheduledcommunity
        NULL,  -- Default value for showingsales
        NOW(),  -- Set created_at to current timestamp
        NOW()   -- Set updated_at to current timestamp
    );
    RETURN NEW;
END;
$$;

-- 创建用户档案的触发器函数备份
CREATE OR REPLACE FUNCTION public.create_user_profile()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
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

-- 跟进记录多条件过滤查询函数备份
CREATE OR REPLACE FUNCTION public.filter_followups(
  p_created_at_end timestamp with time zone DEFAULT NULL::timestamp with time zone,
  p_created_at_start timestamp with time zone DEFAULT NULL::timestamp with time zone,
  p_customerprofile customerprofile[] DEFAULT NULL::customerprofile[],
  p_followupresult text[] DEFAULT NULL::text[],
  p_followupstage followupstage[] DEFAULT NULL::followupstage[],
  p_interviewsales_user_id bigint[] DEFAULT NULL::bigint[],
  p_leadid text[] DEFAULT NULL::text[],
  p_leadtype text[] DEFAULT NULL::text[],
  p_limit integer DEFAULT NULL::integer,
  p_majorcategory text[] DEFAULT NULL::text[],
  p_moveintime_end timestamp with time zone DEFAULT NULL::timestamp with time zone,
  p_moveintime_start timestamp with time zone DEFAULT NULL::timestamp with time zone,
  p_offset integer DEFAULT 0,
  p_remark text DEFAULT NULL::text,
  p_scheduledcommunity community[] DEFAULT NULL::community[],
  p_showingsales_user bigint[] DEFAULT NULL::bigint[],
  p_source source[] DEFAULT NULL::source[],
  p_userbudget text[] DEFAULT NULL::text[],
  p_userrating userrating[] DEFAULT NULL::userrating[],
  p_wechat text[] DEFAULT NULL::text[],
  p_worklocation text[] DEFAULT NULL::text[],
  p_phone text[] DEFAULT NULL::text[],
  p_qq text[] DEFAULT NULL::text[],
  p_location text[] DEFAULT NULL::text[],
  p_budget text[] DEFAULT NULL::text[],
  p_douyinid text[] DEFAULT NULL::text[],
  p_douyin_accountname text[] DEFAULT NULL::text[],
  p_staffname text[] DEFAULT NULL::text[],
  p_redbookid text[] DEFAULT NULL::text[],
  p_area text[] DEFAULT NULL::text[],
  p_notelink text[] DEFAULT NULL::text[],
  p_campaignid text[] DEFAULT NULL::text[],
  p_campaignname text[] DEFAULT NULL::text[],
  p_unitid text[] DEFAULT NULL::text[],
  p_unitname text[] DEFAULT NULL::text[],
  p_creativedid text[] DEFAULT NULL::text[],
  p_creativename text[] DEFAULT NULL::text[],
  p_traffictype text[] DEFAULT NULL::text[],
  p_interactiontype text[] DEFAULT NULL::text[],
  p_douyinleadid text[] DEFAULT NULL::text[],
  p_leadstatus text[] DEFAULT NULL::text[],
  p_keyword text DEFAULT NULL::text
)
RETURNS TABLE(
  id uuid,
  leadid text,
  lead_uuid uuid,
  leadtype text,
  followupstage followupstage,
  followupstage_name text,
  customerprofile customerprofile,
  customerprofile_name text,
  worklocation text,
  worklocation_id text,
  userbudget text,
  userbudget_id text,
  moveintime timestamp with time zone,
  scheduletime timestamp with time zone,
  created_at timestamp with time zone,
  updated_at timestamp with time zone,
  userrating userrating,
  userrating_name text,
  majorcategory text,
  majorcategory_id text,
  subcategory text,
  subcategory_id text,
  followupresult text,
  followupresult_id text,
  scheduledcommunity community,
  scheduledcommunity_name text,
  phone text,
  wechat text,
  source source,
  source_name text,
  remark text,
  interviewsales_user_id bigint,
  interviewsales_user_name text,
  showingsales_user_id bigint,
  showingsales_user_name text,
  qq text,
  location text,
  budget text,
  douyinid text,
  douyin_accountname text,
  staffname text,
  redbookid text,
  area text,
  notelink text,
  campaignid text,
  campaignname text,
  unitid text,
  unitname text,
  creativedid text,
  creativename text,
  traffictype text,
  interactiontype text,
  douyinleadid text,
  leadstatus text,
  total_count bigint
)
LANGUAGE plpgsql
AS $function$
DECLARE
    v_total_count bigint;
    v_query text;
    v_count_query text;
    v_where_clause text;
    v_join_clause text;
BEGIN
    -- 构建JOIN子句，优化表连接，确保所有表引用都有别名
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
        -- 如果一个leadid有多个showing记录，只取最新的一条
        WHERE s.id = (
            SELECT s2.id 
            FROM public.showings s2 
            WHERE s2.leadid = s.leadid 
            ORDER BY s2.created_at DESC 
            LIMIT 1
        )
    ) s ON f.leadid = s.leadid';
    -- 构建WHERE子句，确保所有列引用都有表名前缀，修复参数占位符
    v_where_clause := '
    WHERE ($7 IS NULL OR f.leadid = ANY($7))
      AND ($8 IS NULL OR f.leadtype = ANY($8) OR (ARRAY_LENGTH($8, 1) = 1 AND $8[1] IS NULL AND f.leadtype IS NULL))
      AND ($5 IS NULL OR f.followupstage = ANY($5) OR (ARRAY_LENGTH($5, 1) = 1 AND $5[1] IS NULL AND f.followupstage IS NULL))
      AND ($3 IS NULL OR f.customerprofile = ANY($3) OR (ARRAY_LENGTH($3, 1) = 1 AND $3[1] IS NULL AND f.customerprofile IS NULL))
      AND ($21 IS NULL OR f.worklocation = ANY($21) OR (ARRAY_LENGTH($21, 1) = 1 AND $21[1] IS NULL AND f.worklocation IS NULL))
      AND ($18 IS NULL OR f.userbudget = ANY($18) OR (ARRAY_LENGTH($18, 1) = 1 AND $18[1] IS NULL AND f.userbudget IS NULL))
      AND ($12 IS NULL OR f.moveintime >= $12 OR f.moveintime IS NULL)
      AND ($11 IS NULL OR f.moveintime <= $11 OR f.moveintime IS NULL)
      AND ($19 IS NULL OR f.userrating = ANY($19) OR (ARRAY_LENGTH($19, 1) = 1 AND $19[1] IS NULL AND f.userrating IS NULL))
      AND ($10 IS NULL OR f.majorcategory = ANY($10) OR (ARRAY_LENGTH($10, 1) = 1 AND $10[1] IS NULL AND f.majorcategory IS NULL))
      AND ($4 IS NULL OR f.followupresult = ANY($4) OR (ARRAY_LENGTH($4, 1) = 1 AND $4[1] IS NULL AND f.followupresult IS NULL))
      AND ($15 IS NULL OR f.scheduledcommunity = ANY($15) OR (ARRAY_LENGTH($15, 1) = 1 AND $15[1] IS NULL AND f.scheduledcommunity IS NULL))
      AND ($20 IS NULL OR l.wechat = ANY($20) OR (ARRAY_LENGTH($20, 1) = 1 AND $20[1] IS NULL AND l.wechat IS NULL))
      AND ($17 IS NULL OR l.source = ANY($17) OR (ARRAY_LENGTH($17, 1) = 1 AND $17[1] IS NULL AND l.source IS NULL))
      AND ($2 IS NULL OR f.created_at >= $2)
      AND ($1 IS NULL OR f.created_at <= $1)
      AND ($14 IS NULL OR l.remark ILIKE ''%'' || $14 || ''%'' OR ($14 = '''' AND (l.remark IS NULL OR l.remark = '''')))
      AND ($6 IS NULL OR f.interviewsales_user_id = ANY($6) OR (ARRAY_LENGTH($6, 1) = 1 AND $6[1] IS NULL AND f.interviewsales_user_id IS NULL))
      AND ($16 IS NULL OR s.showingsales = ANY($16) OR (ARRAY_LENGTH($16, 1) = 1 AND $16[1] IS NULL AND s.showingsales IS NULL))
      -- 新增的leads表字段过滤条件
      AND ($22 IS NULL OR l.phone = ANY($22) OR (ARRAY_LENGTH($22, 1) = 1 AND $22[1] IS NULL AND l.phone IS NULL))
      AND ($23 IS NULL OR l.qq = ANY($23) OR (ARRAY_LENGTH($23, 1) = 1 AND $23[1] IS NULL AND l.qq IS NULL))
      AND ($24 IS NULL OR l.location = ANY($24) OR (ARRAY_LENGTH($24, 1) = 1 AND $24[1] IS NULL AND l.location IS NULL))
      AND ($25 IS NULL OR l.budget = ANY($25) OR (ARRAY_LENGTH($25, 1) = 1 AND $25[1] IS NULL AND l.budget IS NULL))
      AND ($26 IS NULL OR l.douyinid = ANY($26) OR (ARRAY_LENGTH($26, 1) = 1 AND $26[1] IS NULL AND l.douyinid IS NULL))
      AND ($27 IS NULL OR l.douyin_accountname = ANY($27) OR (ARRAY_LENGTH($27, 1) = 1 AND $27[1] IS NULL AND l.douyin_accountname IS NULL))
      AND ($28 IS NULL OR l.staffname = ANY($28) OR (ARRAY_LENGTH($28, 1) = 1 AND $28[1] IS NULL AND l.staffname IS NULL))
      AND ($29 IS NULL OR l.redbookid = ANY($29) OR (ARRAY_LENGTH($29, 1) = 1 AND $29[1] IS NULL AND l.redbookid IS NULL))
      AND ($30 IS NULL OR l.area = ANY($30) OR (ARRAY_LENGTH($30, 1) = 1 AND $30[1] IS NULL AND l.area IS NULL))
      AND ($31 IS NULL OR l.notelink = ANY($31) OR (ARRAY_LENGTH($31, 1) = 1 AND $31[1] IS NULL AND l.notelink IS NULL))
      AND ($32 IS NULL OR l.campaignid = ANY($32) OR (ARRAY_LENGTH($32, 1) = 1 AND $32[1] IS NULL AND l.campaignid IS NULL))
      AND ($33 IS NULL OR l.campaignname = ANY($33) OR (ARRAY_LENGTH($33, 1) = 1 AND $33[1] IS NULL AND l.campaignname IS NULL))
      AND ($34 IS NULL OR l.unitid = ANY($34) OR (ARRAY_LENGTH($34, 1) = 1 AND $34[1] IS NULL AND l.unitid IS NULL))
      AND ($35 IS NULL OR l.unitname = ANY($35) OR (ARRAY_LENGTH($35, 1) = 1 AND $35[1] IS NULL AND l.unitname IS NULL))
      AND ($36 IS NULL OR l.creativedid = ANY($36) OR (ARRAY_LENGTH($36, 1) = 1 AND $36[1] IS NULL AND l.creativedid IS NULL))
      AND ($37 IS NULL OR l.creativename = ANY($37) OR (ARRAY_LENGTH($37, 1) = 1 AND $37[1] IS NULL AND l.creativename IS NULL))
      AND ($38 IS NULL OR l.traffictype = ANY($38) OR (ARRAY_LENGTH($38, 1) = 1 AND $38[1] IS NULL AND l.traffictype IS NULL))
      AND ($39 IS NULL OR l.interactiontype = ANY($39) OR (ARRAY_LENGTH($39, 1) = 1 AND $39[1] IS NULL AND l.interactiontype IS NULL))
      AND ($40 IS NULL OR l.douyinleadid = ANY($40) OR (ARRAY_LENGTH($40, 1) = 1 AND $40[1] IS NULL AND l.douyinleadid IS NULL))
      AND ($41 IS NULL OR l.leadstatus = ANY($41) OR (ARRAY_LENGTH($41, 1) = 1 AND $41[1] IS NULL AND l.leadstatus IS NULL))
      AND ($42 IS NULL OR (f.leadid::text ILIKE ''%'' || $42 || ''%'' OR 
                           f.leadtype ILIKE ''%'' || $42 || ''%'' OR 
                           up_interview.nickname ILIKE ''%'' || $42 || ''%'' OR 
                           s.showingsales_name ILIKE ''%'' || $42 || ''%'' OR
                           f.worklocation ILIKE ''%'' || $42 || ''%'' OR 
                           f.userbudget ILIKE ''%'' || $42 || ''%'' OR 
                           f.majorcategory ILIKE ''%'' || $42 || ''%'' OR 
                           f.subcategory ILIKE ''%'' || $42 || ''%'' OR 
                           f.followupresult ILIKE ''%'' || $42 || ''%'' OR
                           l.phone ILIKE ''%'' || $42 || ''%'' OR
                           l.wechat ILIKE ''%'' || $42 || ''%''))';
    -- Count total records
    v_count_query := 'SELECT COUNT(*) FROM public.followups f ' || v_join_clause || v_where_clause;
    EXECUTE v_count_query INTO v_total_count USING 
        p_created_at_end, p_created_at_start, p_customerprofile, p_followupresult, p_followupstage,
        p_interviewsales_user_id, p_leadid, p_leadtype, p_limit, p_majorcategory, p_moveintime_end,
        p_moveintime_start, p_offset, p_remark, p_scheduledcommunity, p_showingsales_user,
        p_source, p_userbudget, p_userrating, p_wechat, p_worklocation,
        -- 新增参数
        p_phone, p_qq, p_location, p_budget, p_douyinid, p_douyin_accountname, p_staffname,
        p_redbookid, p_area, p_notelink, p_campaignid, p_campaignname, p_unitid, p_unitname,
        p_creativedid, p_creativename, p_traffictype, p_interactiontype, p_douyinleadid, p_leadstatus, p_keyword;
    -- Build main query with all fields including ID and name pairs
    -- 确保所有列引用都有明确的表名前缀
    v_query := 'SELECT
        -- 基本信息字段
        f.id,
        f.leadid,
        l.id as lead_uuid,
        f.leadtype,
        -- 跟进阶段相关
        f.followupstage,
        f.followupstage::text as followupstage_name,
        -- 客户资料相关
        f.customerprofile,
        f.customerprofile::text as customerprofile_name,
        -- 工作地点和预算
        f.worklocation,
        f.worklocation as worklocation_id,
        f.userbudget,
        f.userbudget as userbudget_id,
        -- 时间相关字段
        f.moveintime,
        f.scheduletime,
        f.created_at,
        f.updated_at,
        -- 用户评级相关
        f.userrating,
        f.userrating::text as userrating_name,
        -- 分类相关
        f.majorcategory,
        f.majorcategory as majorcategory_id,
        f.subcategory,
        f.subcategory as subcategory_id,
        -- 跟进结果
        f.followupresult,
        f.followupresult as followupresult_id,
        -- 社区相关
        f.scheduledcommunity,
        f.scheduledcommunity::text as scheduledcommunity_name,
        -- 联系方式
        l.phone,
        l.wechat,
        -- 来源相关
        l.source,
        l.source::text as source_name,
        -- 备注
        l.remark,
        -- 销售人员相关
        f.interviewsales_user_id,
        up_interview.nickname as interviewsales_user_name,
        s.showingsales as showingsales_user_id,
        s.showingsales_name as showingsales_user_name,
        -- 新增返回字段
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
        -- 统计信息
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
        p_source, p_userbudget, p_userrating, p_wechat, p_worklocation,
        -- 新增参数
        p_phone, p_qq, p_location, p_budget, p_douyinid, p_douyin_accountname, p_staffname,
        p_redbookid, p_area, p_notelink, p_campaignid, p_campaignname, p_unitid, p_unitname,
        p_creativedid, p_creativename, p_traffictype, p_interactiontype, p_douyinleadid, p_leadstatus, p_keyword;
END;
$function$;

-- 线索记录多条件过滤查询函数备份
CREATE OR REPLACE FUNCTION public.filter_leads(
  p_leadid text DEFAULT NULL::text,
  p_created_at_start timestamp with time zone DEFAULT NULL::timestamp with time zone,
  p_created_at_end timestamp with time zone DEFAULT NULL::timestamp with time zone,
  p_updata_at_start timestamp with time zone DEFAULT NULL::timestamp with time zone,
  p_updata_at_end timestamp with time zone DEFAULT NULL::timestamp with time zone,
  p_phone text DEFAULT NULL::text,
  p_wechat text DEFAULT NULL::text,
  p_qq text DEFAULT NULL::text,
  p_location text DEFAULT NULL::text,
  p_budget text DEFAULT NULL::text,
  p_remark text DEFAULT NULL::text,
  p_source source DEFAULT NULL::source,
  p_douyinid text DEFAULT NULL::text,
  p_douyin_accountname text DEFAULT NULL::text,
  p_staffname text DEFAULT NULL::text,
  p_redbookid text DEFAULT NULL::text,
  p_area text DEFAULT NULL::text,
  p_notelink text DEFAULT NULL::text,
  p_campaignid text DEFAULT NULL::text,
  p_campaignname text DEFAULT NULL::text,
  p_unitid text DEFAULT NULL::text,
  p_unitname text DEFAULT NULL::text,
  p_creativedid text DEFAULT NULL::text,
  p_creativename text DEFAULT NULL::text,
  p_leadtype text DEFAULT NULL::text,
  p_traffictype text DEFAULT NULL::text,
  p_interactiontype text DEFAULT NULL::text,
  p_douyinleadid text DEFAULT NULL::text,
  p_leadstatus text DEFAULT NULL::text,
  p_keyword text DEFAULT NULL::text
)
RETURNS TABLE(
  id uuid,
  leadid text,
  created_at timestamp with time zone,
  updata_at timestamp with time zone,
  phone text,
  wechat text,
  qq text,
  location text,
  budget text,
  remark text,
  source source,
  douyinid text,
  douyin_accountname text,
  staffname text,
  redbookid text,
  area text,
  notelink text,
  campaignid text,
  campaignname text,
  unitid text,
  unitname text,
  creativedid text,
  creativename text,
  leadtype text,
  traffictype text,
  interactiontype text,
  douyinleadid text,
  leadstatus text,
  interviewsales text
)
LANGUAGE plpgsql
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



-- 生成线索ID函数备份
CREATE OR REPLACE FUNCTION public.gen_leadid()
RETURNS text
LANGUAGE plpgsql
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

-- 获取枚举类型值列表函数备份
CREATE OR REPLACE FUNCTION public.get_enum_values(enum_name text)
RETURNS text[]
LANGUAGE plpgsql
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

-- 获取管理员管理的所有组织ID（递归）函数备份
CREATE OR REPLACE FUNCTION public.get_managed_org_ids(admin_id uuid)
RETURNS TABLE(org_id uuid)
LANGUAGE plpgsql
SECURITY DEFINER
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

-- 获取当前用户管理的组织ID数组函数备份
CREATE OR REPLACE FUNCTION public.get_user_admin_organizations()
RETURNS uuid[]
LANGUAGE plpgsql
SET search_path TO ''
AS $$
BEGIN
  RETURN ARRAY(
    SELECT id 
    FROM public.organizations
    WHERE admin = (select auth.uid())
  );
END;
$$;

-- 获取用户权限列表函数备份
CREATE OR REPLACE FUNCTION public.get_user_permissions(p_user_id uuid)
RETURNS TABLE(permission_id uuid, permission_name text, permission_description text, resource text, action text)
LANGUAGE plpgsql
SET search_path TO ''
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

-- 获取用户角色列表函数备份
CREATE OR REPLACE FUNCTION public.get_user_roles(p_user_id uuid)
RETURNS TABLE(role_id uuid, role_name text, role_description text)
LANGUAGE plpgsql
SET search_path TO ''
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

-- 跟进记录分组统计函数备份
-- 修复 group_count_filter_followups 函数中的 source 字段处理
CREATE OR REPLACE FUNCTION public.group_count_filter_followups(
  p_groupby_field text,
  p_leadid text[] DEFAULT NULL::text[],
  p_leadtype text[] DEFAULT NULL::text[],
  p_interviewsales_user_id bigint[] DEFAULT NULL::bigint[],
  p_followupstage followupstage[] DEFAULT NULL::followupstage[],
  p_customerprofile customerprofile[] DEFAULT NULL::customerprofile[],
  p_worklocation text[] DEFAULT NULL::text[],
  p_userbudget text[] DEFAULT NULL::text[],
  p_moveintime_start timestamp with time zone DEFAULT NULL::timestamp with time zone,
  p_moveintime_end timestamp with time zone DEFAULT NULL::timestamp with time zone,
  p_userrating userrating[] DEFAULT NULL::userrating[],
  p_majorcategory text[] DEFAULT NULL::text[],
  p_subcategory text[] DEFAULT NULL::text[],
  p_followupresult text[] DEFAULT NULL::text[],
  p_scheduletime_start timestamp with time zone DEFAULT NULL::timestamp with time zone,
  p_scheduletime_end timestamp with time zone DEFAULT NULL::timestamp with time zone,
  p_scheduledcommunity community[] DEFAULT NULL::community[],
  p_keyword text DEFAULT NULL::text,
  p_wechat text[] DEFAULT NULL::text[],
  p_source source[] DEFAULT NULL::source[],
  p_created_at_start timestamp with time zone DEFAULT NULL::timestamp with time zone,
  p_created_at_end timestamp with time zone DEFAULT NULL::timestamp with time zone,
  p_remark text DEFAULT NULL::text,
  p_showingsales_user bigint[] DEFAULT NULL::bigint[]
)
RETURNS TABLE(group_id text, group_value text, count bigint)
LANGUAGE plpgsql
AS $$
DECLARE
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
    IF p_subcategory IS NOT NULL THEN
        where_conditions := where_conditions || ' AND f.subcategory = ANY($12)';
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
                                                     f.subcategory ILIKE ''%'' || $17 || ''%'' OR 
                                                     f.followupresult ILIKE ''%'' || $17 || ''%'' OR
                                                     l.phone ILIKE ''%'' || $17 || ''%'' OR
                                                     l.wechat ILIKE ''%'' || $17 || ''%'')';
    END IF;
    IF p_wechat IS NOT NULL THEN
        where_conditions := where_conditions || ' AND l.wechat = ANY($18)';
    END IF;
    IF p_source IS NOT NULL THEN
        where_conditions := where_conditions || ' AND l.source = ANY($19)';
    END IF;
    IF p_created_at_start IS NOT NULL THEN
        where_conditions := where_conditions || ' AND f.created_at >= $20';
    END IF;
    IF p_created_at_end IS NOT NULL THEN
        where_conditions := where_conditions || ' AND f.created_at <= $21';
    END IF;
    IF p_remark IS NOT NULL THEN
        where_conditions := where_conditions || ' AND l.remark ILIKE ''%'' || $22 || ''%''';
    END IF;
    
    -- 添加showingsales_user过滤条件
    IF p_showingsales_user IS NOT NULL THEN
        where_conditions := where_conditions || ' AND s.showingsales = ANY($23)';
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
        WHEN 'subcategory' THEN
            select_clause := 'f.subcategory::text as group_id, COALESCE(f.subcategory, ''未分组'')::text as group_value';
            group_by_clause := 'f.subcategory';
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
          p_majorcategory, p_subcategory, p_followupresult, p_scheduletime_start, p_scheduletime_end,
          p_scheduledcommunity, p_keyword, p_wechat, p_source,
          p_created_at_start, p_created_at_end, p_remark, p_showingsales_user;
END;
$$;

-- 检查用户权限函数备份
CREATE OR REPLACE FUNCTION public.has_permission(resource text, action text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
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

-- 检查用户角色函数备份
CREATE OR REPLACE FUNCTION public.has_role(role_name text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
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

-- 检查用户是否为组织管理员函数备份
CREATE OR REPLACE FUNCTION public.is_organization_admin(org_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SET search_path TO ''
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

-- 手动同步用户元数据函数备份
CREATE OR REPLACE FUNCTION public.manual_sync_user_metadata()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
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

-- 设置初始管理员函数备份
CREATE OR REPLACE FUNCTION public.set_initial_admin(admin_user_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
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

-- 同步用户元数据到profile触发器函数备份
CREATE OR REPLACE FUNCTION public.sync_user_metadata_to_profile()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
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

-- 同步用户profile数据触发器函数备份
CREATE OR REPLACE FUNCTION public.sync_user_profile_data()
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

-- 分配方法枚举类型备份
DO $$ BEGIN
    CREATE TYPE allocation_method AS ENUM ('round_robin', 'random', 'workload');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- 用户列表表结构备份
CREATE TABLE IF NOT EXISTS public.users_list (
  id bigint generated by default as identity not null,
  groupname text null,
  list bigint[] null,
  description text null,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone null default now(),
  allocation allocation_method null default 'round_robin',
  constraint users_list_pkey primary key (id)
) TABLESPACE pg_default;

-- 用户列表表索引备份
CREATE INDEX IF NOT EXISTS users_list_array_elements_idx ON public.users_list USING gin (list) TABLESPACE pg_default;

-- 验证用户ID数组的触发器函数备份
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

-- 用户列表表触发器备份
CREATE TRIGGER check_users_profile_ids_trigger 
BEFORE INSERT OR UPDATE ON users_list 
FOR EACH ROW
EXECUTE FUNCTION check_users_profile_ids();

-- ========================================
-- Edge Functions 备份
-- ========================================

-- get-users-by-ids Edge Function
-- 功能：根据用户ID列表获取用户信息
-- 文件：supabase/functions/get-users-by-ids/index.ts
/*
import { createClient } from 'jsr:@supabase/supabase-js@^2';

Deno.serve(async (req) => {
  try {
    // Parse request body
    const { user_ids } = await req.json();
    
    // Parameter validation
    if (!user_ids || !Array.isArray(user_ids) || user_ids.length === 0) {
      return new Response(JSON.stringify([]), {
        status: 200,
        headers: {
          'Content-Type': 'application/json'
        }
      });
    }
    
    // Initialize Supabase admin client with service role key
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL'), 
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
    );
    
    // Get all users (max 1000 at once, can be paginated)
    const { data, error } = await supabase.auth.admin.listUsers({
      page: 1,
      perPage: 1000
    });
    
    if (error) {
      return new Response(JSON.stringify({
        error: error.message
      }), {
        status: 400,
        headers: {
          'Content-Type': 'application/json'
        }
      });
    }
    
    // Filter users by the provided IDs and extract needed fields
    const filtered = data.users
      .filter((u) => user_ids.includes(u.id))
      .map((u) => ({
        id: u.id,
        email: u.email,
        name: u.user_metadata?.name || ''
      }));
    
    return new Response(JSON.stringify(filtered), {
      status: 200,
      headers: {
        'Content-Type': 'application/json'
      }
    });
  } catch (error) {
    return new Response(JSON.stringify({
      error: error.message
    }), {
      status: 500,
      headers: {
        'Content-Type': 'application/json'
      }
    });
  }
});
*/

-- manage-permissions Edge Function
-- 功能：权限管理API，支持角色和权限的创建、分配、查询
-- 文件：supabase/functions/manage-permissions/index.ts
/*
import { createClient } from 'jsr:@supabase/supabase-js@^2';

Deno.serve(async (req) => {
  try {
    // 只允许 POST 请求
    if (req.method !== 'POST') {
      return new Response(JSON.stringify({
        error: 'Method not allowed'
      }), {
        status: 405,
        headers: {
          'Content-Type': 'application/json'
        }
      });
    }
    
    // 获取授权头
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({
        error: 'Missing Authorization header'
      }), {
        status: 401,
        headers: {
          'Content-Type': 'application/json'
        }
      });
    }
    
    // 创建 Supabase 客户端
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL'), 
      Deno.env.get('SUPABASE_ANON_KEY'), 
      {
        global: {
          headers: {
            Authorization: authHeader
          }
        }
      }
    );
    
    // 解析请求体
    const { action, ...params } = await req.json();
    
    // 根据操作类型执行不同的操作
    switch(action) {
      case 'createRole':
        return await handleCreateRole(supabase, params);
      case 'createPermission':
        return await handleCreatePermission(supabase, params);
      case 'assignRoleToUser':
        return await handleAssignRoleToUser(supabase, params);
      case 'assignPermissionToRole':
        return await handleAssignPermissionToRole(supabase, params);
      case 'getUserRoles':
        return await handleGetUserRoles(supabase, params);
      case 'getUserPermissions':
        return await handleGetUserPermissions(supabase, params);
      default:
        return new Response(JSON.stringify({
          error: 'Invalid action'
        }), {
          status: 400,
          headers: {
            'Content-Type': 'application/json'
          }
        });
    }
  } catch (error) {
    return new Response(JSON.stringify({
      error: '处理请求时出错',
      details: error.message
    }), {
      status: 500,
      headers: {
        'Content-Type': 'application/json'
      }
    });
  }
});

// 创建角色
async function handleCreateRole(supabase, { name, description }) {
  if (!name) {
    return new Response(JSON.stringify({
      error: 'Missing role name'
    }), {
      status: 400,
      headers: {
        'Content-Type': 'application/json'
      }
    });
  }
  
  const { data, error } = await supabase
    .from('roles')
    .insert({ name, description })
    .select()
    .single();
    
  if (error) {
    return new Response(JSON.stringify({
      error: error.message
    }), {
      status: 500,
      headers: {
        'Content-Type': 'application/json'
      }
    });
  }
  
  return new Response(JSON.stringify({
    message: 'Role created successfully',
    role: data
  }), {
    status: 200,
    headers: {
      'Content-Type': 'application/json'
    }
  });
}

// 创建权限
async function handleCreatePermission(supabase, { name, resource, action, description }) {
  if (!name || !resource || !action) {
    return new Response(JSON.stringify({
      error: 'Missing required fields'
    }), {
      status: 400,
      headers: {
        'Content-Type': 'application/json'
      }
    });
  }
  
  const { data, error } = await supabase
    .from('permissions')
    .insert({ name, resource, action, description })
    .select()
    .single();
    
  if (error) {
    return new Response(JSON.stringify({
      error: error.message
    }), {
      status: 500,
      headers: {
        'Content-Type': 'application/json'
      }
    });
  }
  
  return new Response(JSON.stringify({
    message: 'Permission created successfully',
    permission: data
  }), {
    status: 200,
    headers: {
      'Content-Type': 'application/json'
    }
  });
}

// 为用户分配角色
async function handleAssignRoleToUser(supabase, { userId, roleName }) {
  if (!userId || !roleName) {
    return new Response(JSON.stringify({
      error: 'Missing required fields'
    }), {
      status: 400,
      headers: {
        'Content-Type': 'application/json'
      }
    });
  }
  
  const { data, error } = await supabase.rpc('assign_role_to_user', {
    target_user_id: userId,
    role_name: roleName
  });
  
  if (error) {
    return new Response(JSON.stringify({
      error: error.message
    }), {
      status: 500,
      headers: {
        'Content-Type': 'application/json'
      }
    });
  }
  
  return new Response(JSON.stringify({
    message: 'Role assigned successfully',
    success: data
  }), {
    status: 200,
    headers: {
      'Content-Type': 'application/json'
    }
  });
}

// 为角色分配权限
async function handleAssignPermissionToRole(supabase, { roleName, resource, action }) {
  if (!roleName || !resource || !action) {
    return new Response(JSON.stringify({
      error: 'Missing required fields'
    }), {
      status: 400,
      headers: {
        'Content-Type': 'application/json'
      }
    });
  }
  
  const { data, error } = await supabase.rpc('assign_permission_to_role', {
    role_name: roleName,
    resource_name: resource,
    action_name: action
  });
  
  if (error) {
    return new Response(JSON.stringify({
      error: error.message
    }), {
      status: 500,
      headers: {
        'Content-Type': 'application/json'
      }
    });
  }
  
  return new Response(JSON.stringify({
    message: 'Permission assigned successfully',
    success: data
  }), {
    status: 200,
    headers: {
      'Content-Type': 'application/json'
    }
  });
}

// 获取用户角色
async function handleGetUserRoles(supabase, { userId }) {
  if (!userId) {
    return new Response(JSON.stringify({
      error: 'Missing user ID'
    }), {
      status: 400,
      headers: {
        'Content-Type': 'application/json'
      }
    });
  }
  
  const { data, error } = await supabase
    .from('user_roles')
    .select(`
      role:roles (
        id,
        name,
        description
      )
    `)
    .eq('user_id', userId);
    
  if (error) {
    return new Response(JSON.stringify({
      error: error.message
    }), {
      status: 500,
      headers: {
        'Content-Type': 'application/json'
      }
    });
  }
  
  return new Response(JSON.stringify({
    roles: data.map((item) => item.role)
  }), {
    status: 200,
    headers: {
      'Content-Type': 'application/json'
    }
  });
}

// 获取用户权限
async function handleGetUserPermissions(supabase, { userId }) {
  if (!userId) {
    return new Response(JSON.stringify({
      error: 'Missing user ID'
    }), {
      status: 400,
      headers: {
        'Content-Type': 'application/json'
      }
    });
  }
  
  const { data, error } = await supabase
    .from('user_roles')
    .select(`
      role_permissions!role_id (
        permission:permission_id (
          id,
          name,
          resource,
          action,
          description
        )
      )
    `)
    .eq('user_id', userId);
    
  if (error) {
    return new Response(JSON.stringify({
      error: error.message
    }), {
      status: 500,
      headers: {
        'Content-Type': 'application/json'
      }
    });
  }
  
  // 提取权限并去重
  const permissions = [];
  const permissionIds = new Set();
  
  data.forEach((userRole) => {
    userRole.role_permissions.forEach((rp) => {
      if (rp.permission && !permissionIds.has(rp.permission.id)) {
        permissions.push(rp.permission);
        permissionIds.add(rp.permission.id);
      }
    });
  });
  
  return new Response(JSON.stringify({
    permissions
  }), {
    status: 200,
    headers: {
      'Content-Type': 'application/json'
    }
  });
}
*/

-- email-management Edge Function
-- 功能：邮箱管理API，支持发送验证邮件、重置邮箱、发送密码重置
-- 文件：supabase/functions/email-management/index.ts
/*
import { createClient } from 'jsr:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS'
};

// 递归获取所有可管理的部门ID（含自己和所有子部门）
async function getAllManageableOrgIds(adminClient, rootOrgId) {
  const result = [rootOrgId];
  
  async function findChildren(parentId) {
    const { data: children } = await adminClient
      .from('organizations')
      .select('id')
      .eq('parent_id', parentId);
      
    if (children && children.length > 0) {
      for (const child of children) {
        result.push(child.id);
        await findChildren(child.id);
      }
    }
  }
  
  await findChildren(rootOrgId);
  return result;
}

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', {
      headers: corsHeaders
    });
  }
  
  try {
    console.log('收到请求:', req.method, req.url);
    
    // 解析请求体
    const body = await req.json();
    console.log('请求体:', body);
    
    const { 
      action, 
      email: rawEmail, 
      newEmail: rawNewEmail, 
      userId, 
      organizationId // 组织ID（用于权限验证）
    } = body;
    
    // 清理邮箱地址，去除换行符和空格
    const email = rawEmail ? rawEmail.toString().trim().replace(/\n/g, '') : undefined;
    const newEmail = rawNewEmail ? rawNewEmail.toString().trim().replace(/\n/g, '') : undefined;
    
    console.log('解析参数:', {
      action,
      email,
      newEmail,
      userId,
      organizationId
    });
    
    // 验证必要参数
    if (!action) {
      console.log('缺少操作类型');
      return new Response(JSON.stringify({
        error: '缺少操作类型'
      }), {
        status: 400,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json'
        }
      });
    }
    
    // 获取Authorization header
    const authHeader = req.headers.get('Authorization');
    console.log('Authorization header:', authHeader ? 'Bearer ' + authHeader.substring(0, 20) + '...' : 'null');
    
    if (!authHeader) {
      console.log('缺少Authorization header');
      return new Response(JSON.stringify({
        error: '未授权',
        details: '缺少Authorization header'
      }), {
        status: 401,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json'
        }
      });
    }
    
    // 创建带有请求者身份的客户端
    console.log('Creating userClient with auth header');
    const userClient = createClient(
      Deno.env.get('SUPABASE_URL'), 
      Deno.env.get('SUPABASE_ANON_KEY'), 
      {
        global: {
          headers: {
            Authorization: authHeader
          }
        }
      }
    );
    
    // 创建服务端客户端（具有管理员权限）
    const adminClient = createClient(
      Deno.env.get('SUPABASE_URL'), 
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
    );
    
    // 验证请求者是否已登录
    console.log('验证用户身份...');
    const { data: requestUser, error: authError } = await userClient.auth.getUser();
    console.log('用户验证结果:', {
      user: requestUser?.user?.id,
      error: authError
    });
    
    if (authError || !requestUser?.user) {
      console.log('用户未授权:', authError);
      return new Response(JSON.stringify({
        error: '未授权',
        details: authError?.message || '无有效用户会话',
        authError: authError
      }), {
        status: 401,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json'
        }
      });
    }
    
    console.log('用户已授权:', requestUser.user.id);
    
    // 验证请求者是否有权限管理该组织
    if (organizationId) {
      console.log('验证组织权限:', organizationId);
      
      // 首先检查是否为超级管理员
      const { data: { session } } = await userClient.auth.getSession();
      const isSuperAdmin = session?.access_token ? 
        JSON.parse(atob(session.access_token.split('.')[1])).role === 'service_role' : false;
      
      if (isSuperAdmin) {
        console.log('用户是超级管理员，权限验证通过');
      } else {
        // 检查是否为直接管理员
        const { data: orgs, error: orgsError } = await userClient
          .from('organizations')
          .select('id')
          .eq('admin', requestUser.user.id)
          .eq('id', organizationId);
          
        console.log('组织权限检查结果:', {
          orgs,
          error: orgsError
        });
        
        if (orgsError) {
          console.log('验证权限失败:', orgsError);
          return new Response(JSON.stringify({
            error: '验证权限失败',
            details: orgsError
          }), {
            status: 500,
            headers: {
              ...corsHeaders,
              'Content-Type': 'application/json'
            }
          });
        }
        
        if (!orgs || orgs.length === 0) {
          console.log('用户不是直接管理员，检查递归权限...');
          
          // 递归检查是否通过父部门管理
          const checkRecursivePermission = async (orgId) => {
            const { data: org } = await userClient
              .from('organizations')
              .select('id, parent_id, admin')
              .eq('id', orgId)
              .single();
              
            if (!org) return false;
            
            // 如果当前部门的管理员是当前用户，返回true
            if (org.admin === requestUser.user.id) return true;
            
            // 如果有父部门，递归检查父部门
            if (org.parent_id) {
              return await checkRecursivePermission(org.parent_id);
            }
            
            return false;
          };
          
          const hasPermission = await checkRecursivePermission(organizationId);
          console.log('递归权限检查结果:', hasPermission);
          
          if (!hasPermission) {
            console.log('无权管理此组织');
            return new Response(JSON.stringify({
              error: '无权管理此组织'
            }), {
              status: 403,
              headers: {
                ...corsHeaders,
                'Content-Type': 'application/json'
              }
            });
          }
        }
      }
    }
    
    console.log('权限验证通过，开始执行操作:', action);
    
    // 验证操作特定的参数
    if (action === 'reset_email') {
      if (!newEmail) {
        console.log('[reset_email] 缺少新邮箱地址');
        return new Response(JSON.stringify({
          error: '缺少新邮箱地址'
        }), {
          status: 400,
          headers: {
            ...corsHeaders,
            'Content-Type': 'application/json'
          }
        });
      }
      
      if (!userId && !email) {
        console.log('[reset_email] 缺少用户ID或原邮箱地址');
        return new Response(JSON.stringify({
          error: '缺少用户ID或原邮箱地址'
        }), {
          status: 400,
          headers: {
            ...corsHeaders,
            'Content-Type': 'application/json'
          }
        });
      }
    }
    
    // 根据操作类型执行相应的操作
    let result;
    let targetUser = null;
    let targetEmail = null;
    
    switch(action) {
      case 'send_verification':
        console.log('[send_verification] 入口:', {
          userId,
          email,
          organizationId
        });
        
        try {
          if (!userId && !email) {
            console.log('[send_verification] 缺少用户ID或邮箱地址');
            return new Response(JSON.stringify({
              error: '缺少用户ID或邮箱地址'
            }), {
              status: 400,
              headers: {
                ...corsHeaders,
                'Content-Type': 'application/json'
              }
            });
          }
          
          if (userId) {
            // 已注册用户
            console.log('处理已注册用户:', userId);
            const { data: user, error: userError } = await adminClient.auth.admin.getUserById(userId);
            console.log('getUserById结果:', {
              user,
              userError
            });
            
            if (userError || !user) {
              return new Response(JSON.stringify({
                error: '用户不存在',
                details: userError
              }), {
                status: 404,
                headers: {
                  ...corsHeaders,
                  'Content-Type': 'application/json'
                }
              });
            }
            
            targetUser = user;
            targetEmail = user.user.email;
            
            // 验证用户是否属于指定组织
            if (organizationId) {
              const { data: profile, error: profileError } = await adminClient
                .from('users_profile')
                .select('organization_id')
                .eq('user_id', userId)
                .single();
                
              if (profileError) {
                return new Response(JSON.stringify({
                  error: '获取用户资料失败',
                  details: profileError
                }), {
                  status: 500,
                  headers: {
                    ...corsHeaders,
                    'Content-Type': 'application/json'
                  }
                });
              }
              
              if (profile.organization_id !== organizationId) {
                return new Response(JSON.stringify({
                  error: '用户不属于指定组织'
                }), {
                  status: 403,
                  headers: {
                    ...corsHeaders,
                    'Content-Type': 'application/json'
                  }
                });
              }
            }
            
            // 递归获取所有可管理的部门ID（含自己和所有子部门）
            const manageableOrgIds = await getAllManageableOrgIds(adminClient, organizationId);
            if (!manageableOrgIds.includes(user.organization_id)) {
              console.log(`[send_verification] 无权管理该成员所属组织`, {
                organizationId,
                memberOrg: user.organization_id
              });
              return new Response(JSON.stringify({
                error: '无权管理该成员所属组织'
              }), {
                status: 403,
                headers: {
                  ...corsHeaders,
                  'Content-Type': 'application/json'
                }
              });
            }
            
            // 发送验证邮件 - 使用inviteUser方法替代generateLink
            try {
              result = await adminClient.auth.admin.inviteUserByEmail(user.user.email, {
                data: {
                  organization_id: organizationId || null
                }
              });
              console.log('inviteUserByEmail结果:', result);
              
              if (result.error) {
                return new Response(JSON.stringify({
                  error: 'inviteUserByEmail失败',
                  details: result.error
                }), {
                  status: 500,
                  headers: {
                    ...corsHeaders,
                    'Content-Type': 'application/json'
                  }
                });
              }
            } catch (inviteError) {
              console.log('inviteUserByEmail异常:', inviteError);
              
              // 如果inviteUserByEmail失败，尝试使用generateLink
              try {
                result = await adminClient.auth.admin.generateLink({
                  type: 'signup',
                  email: user.user.email
                });
                console.log('generateLink结果:', result);
                
                if (result.error) {
                  return new Response(JSON.stringify({
                    error: 'generateLink失败',
                    details: result.error
                  }), {
                    status: 500,
                    headers: {
                      ...corsHeaders,
                      'Content-Type': 'application/json'
                    }
                  });
                }
              } catch (generateError) {
                console.log('generateLink异常:', generateError);
                return new Response(JSON.stringify({
                  error: '发送验证邮件失败',
                  details: generateError.message || String(generateError)
                }), {
                  status: 500,
                  headers: {
                    ...corsHeaders,
                    'Content-Type': 'application/json'
                  }
                });
              }
            }
            
            return new Response(JSON.stringify({
              success: true,
              message: '验证/邀请邮件已发送',
              data: result.data
            }), {
              status: 200,
              headers: {
                ...corsHeaders,
                'Content-Type': 'application/json'
              }
            });
          } else {
            // 查 profile
            const { data: profile } = await adminClient
              .from('users_profile')
              .select('*')
              .eq('email', email)
              .single();
              
            console.log('[send_verification] profile:', profile);
            
            if (!profile) {
              console.log('[send_verification] profile not found, email:', email);
              return new Response(JSON.stringify({
                error: '用户不存在或未注册，无法发送验证邮件'
              }), {
                status: 404,
                headers: {
                  ...corsHeaders,
                  'Content-Type': 'application/json'
                }
              });
            } else if (profile.status === 'invited') {
              console.log('[send_verification] status=invited, 发送注册邀请:', email);
              result = await adminClient.auth.admin.generateLink({
                type: 'signup',
                email,
                options: {
                  data: {
                    organization_id: organizationId || null
                  }
                }
              });
              console.log('[send_verification] generateLink结果:', result);
              
              return new Response(JSON.stringify({
                success: true,
                message: '验证邮件已重新发送',
                data: result.data
              }), {
                status: 200,
                headers: {
                  ...corsHeaders,
                  'Content-Type': 'application/json'
                }
              });
            } else if (profile.status === 'active') {
              console.log('[send_verification] status=active, 已注册已验证:', email);
              return new Response(JSON.stringify({
                error: '该用户已注册并验证，无需重复邀请'
              }), {
                status: 409,
                headers: {
                  ...corsHeaders,
                  'Content-Type': 'application/json'
                }
              });
            } else {
              console.log('[send_verification] 其它状态:', profile.status, email);
              return new Response(JSON.stringify({
                error: '当前用户状态不支持重新发送验证邮件'
              }), {
                status: 400,
                headers: {
                  ...corsHeaders,
                  'Content-Type': 'application/json'
                }
              });
            }
          }
        } catch (e) {
          console.log('[send_verification] 异常:', e);
          return new Response(JSON.stringify({
            error: 'send_verification分支异常',
            details: e.message || String(e)
          }), {
            status: 500,
            headers: {
              ...corsHeaders,
              'Content-Type': 'application/json'
            }
          });
        }
        break;
        
      case 'reset_email':
        console.log('[reset_email] 入口:', {
          userId,
          email,
          newEmail,
          organizationId
        });
        
        try {
          // 查 profile - 支持通过userId或email查找
          let profile;
          if (userId) {
            // 已注册用户，通过userId查找
            const { data: profileData } = await adminClient
              .from('users_profile')
              .select('*')
              .eq('user_id', userId)
              .single();
            profile = profileData;
          } else if (email) {
            // 未注册用户，通过email查找
            const { data: profileData } = await adminClient
              .from('users_profile')
              .select('*')
              .eq('email', email)
              .single();
            profile = profileData;
          }
          
          console.log('[reset_email] profile:', profile);
          
          if (!profile) {
            console.log('[reset_email] profile not found, userId:', userId, 'email:', email);
            return new Response(JSON.stringify({
              error: '用户不存在，无法重置邮箱'
            }), {
              status: 404,
              headers: {
                ...corsHeaders,
                'Content-Type': 'application/json'
              }
            });
          }
          
          // 递归校验组织管理权
          if (organizationId && profile.organization_id) {
            console.log('[reset_email] 开始权限验证:', {
              organizationId,
              memberOrg: profile.organization_id
            });
            
            // 检查是否为超级管理员
            const { data: { session } } = await userClient.auth.getSession();
            const isSuperAdmin = session?.access_token ? 
              JSON.parse(atob(session.access_token.split('.')[1])).role === 'service_role' : false;
              
            if (isSuperAdmin) {
              console.log('[reset_email] 超级管理员，权限验证通过');
            } else {
              const manageableOrgIds = await getAllManageableOrgIds(adminClient, organizationId);
              console.log('[reset_email] 可管理的组织ID列表:', manageableOrgIds);
              
              if (!manageableOrgIds.includes(profile.organization_id)) {
                console.log('[reset_email] 无权管理该成员所属组织', {
                  organizationId,
                  memberOrg: profile.organization_id,
                  manageableOrgIds
                });
                return new Response(JSON.stringify({
                  error: '无权管理该成员所属组织'
                }), {
                  status: 403,
                  headers: {
                    ...corsHeaders,
                    'Content-Type': 'application/json'
                  }
                });
              }
              console.log('[reset_email] 权限验证通过');
            }
          } else {
            console.log('[reset_email] 跳过权限验证 - organizationId或profile.organization_id为空');
          }
          
          if (profile.status === 'invited' && !profile.user_id) {
            // 未注册用户
            console.log('[reset_email] 未注册用户，直接修改user_profiles邮箱并发送注册邀请:', newEmail);
            await adminClient
              .from('users_profile')
              .update({ email: newEmail })
              .eq('id', profile.id);
              
            result = await adminClient.auth.admin.generateLink({
              type: 'signup',
              email: newEmail,
              options: {
                data: {
                  organization_id: organizationId || null
                }
              }
            });
            
            return new Response(JSON.stringify({
              success: true,
              message: '邮箱已重置并发送注册邀请',
              data: result.data
            }), {
              status: 200,
              headers: {
                ...corsHeaders,
                'Content-Type': 'application/json'
              }
            });
          } else if (profile.status === 'active' || profile.status === 'invited' && profile.user_id) {
            // 已注册用户
            console.log('[reset_email] status允许重置:', profile.status, profile.user_id, newEmail);
            result = await adminClient.auth.admin.updateUserById(profile.user_id, {
              email: newEmail,
              email_confirmed_at: null
            });
            
            await adminClient
              .from('users_profile')
              .update({ email: newEmail })
              .eq('user_id', profile.user_id);
              
            await adminClient.auth.admin.generateLink({
              type: 'signup',
              email: newEmail,
              options: {
                data: {
                  organization_id: organizationId || null
                }
              }
            });
            
            console.log('[reset_email] 邮箱已重置并发送验证邮件:', newEmail);
            return new Response(JSON.stringify({
              success: true,
              message: '邮箱已重置并发送验证邮件',
              data: result.data
            }), {
              status: 200,
              headers: {
                ...corsHeaders,
                'Content-Type': 'application/json'
              }
            });
          } else {
            // 其它情况
            console.log('[reset_email] 当前用户状态不支持重置邮箱:', profile.status, userId);
            return new Response(JSON.stringify({
              error: '当前用户状态不支持重置邮箱'
            }), {
              status: 400,
              headers: {
                ...corsHeaders,
                'Content-Type': 'application/json'
              }
            });
          }
        } catch (e) {
          console.log('[reset_email] 异常:', e);
          return new Response(JSON.stringify({
            error: 'reset_email分支异常',
            details: e.message || String(e)
          }), {
            status: 500,
            headers: {
              ...corsHeaders,
              'Content-Type': 'application/json'
            }
          });
        }
        break;
        
      case 'send_password_reset':
        console.log('[send_password_reset] 入口:', {
          userId,
          email,
          organizationId
        });
        
        try {
          // 查 profile
          const { data: profile } = await adminClient
            .from('users_profile')
            .select('*')
            .eq('user_id', userId)
            .single();
            
          console.log('[send_password_reset] profile:', profile);
          
          if (!profile) {
            console.log('[send_password_reset] profile not found, userId:', userId);
            return new Response(JSON.stringify({
              error: '用户不存在，无法发送密码重置'
            }), {
              status: 404,
              headers: {
                ...corsHeaders,
                'Content-Type': 'application/json'
              }
            });
          }
          
          // 递归校验组织管理权
          if (organizationId) {
            const manageableOrgIds = await getAllManageableOrgIds(adminClient, organizationId);
            if (!manageableOrgIds.includes(profile.organization_id)) {
              console.log('[send_password_reset] 无权管理该成员所属组织', {
                organizationId,
                memberOrg: profile.organization_id
              });
              return new Response(JSON.stringify({
                error: '无权管理该成员所属组织'
              }), {
                status: 403,
                headers: {
                  ...corsHeaders,
                  'Content-Type': 'application/json'
                }
              });
            }
          }
          
          // 发送密码重置链接
          result = await adminClient.auth.admin.generateLink({
            type: 'recovery',
            email: profile.email
          });
          
          console.log('[send_password_reset] 密码重置链接已发送:', profile.email);
          return new Response(JSON.stringify({
            success: true,
            message: '密码重置链接已发送',
            data: result.data
          }), {
            status: 200,
            headers: {
              ...corsHeaders,
              'Content-Type': 'application/json'
            }
          });
        } catch (e) {
          console.log('[send_password_reset] 异常:', e);
          return new Response(JSON.stringify({
            error: 'send_password_reset分支异常',
            details: e.message || String(e)
          }), {
            status: 500,
            headers: {
              ...corsHeaders,
              'Content-Type': 'application/json'
            }
          });
        }
        break;
        
      default:
        return new Response(JSON.stringify({
          error: '不支持的操作类型'
        }), {
          status: 400,
          headers: {
            ...corsHeaders,
            'Content-Type': 'application/json'
          }
        });
    }
  } catch (error) {
    return new Response(JSON.stringify({
      error: '处理请求时出错',
      details: error.message
    }), {
      status: 500,
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json'
      }
    });
  }
});
*/ 

-- invite-user Edge Function
-- 功能：邀请用户加入组织
-- 文件：supabase/functions/invite-user/index.ts
/*
import { createClient } from 'jsr:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS'
};

// 递归检查用户是否有权限管理组织
async function checkOrgPermission(client, orgId, userId) {
  const { data: org } = await client
    .from('organizations')
    .select('id, parent_id, admin')
    .eq('id', orgId)
    .single();
    
  if (!org) return false;
  
  // 如果当前部门的管理员是当前用户，返回true
  if (org.admin === userId) return true;
  
  // 如果有父部门，递归检查父部门
  if (org.parent_id) {
    return await checkOrgPermission(client, org.parent_id, userId);
  }
  
  return false;
}

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', {
      headers: corsHeaders
    });
  }
  
  try {
    console.log('收到邀请用户请求:', req.method, req.url);
    
    // 验证环境变量
    const FRONTEND_URL = Deno.env.get('FRONTEND_URL') || 'https://crm-web-two.vercel.app';
    const SUPABASE_URL = Deno.env.get('SUPABASE_URL');
    const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY');
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    
    console.log('环境变量检查:', {
      FRONTEND_URL,
      hasSupabaseUrl: !!SUPABASE_URL,
      hasAnonKey: !!SUPABASE_ANON_KEY,
      hasServiceKey: !!SUPABASE_SERVICE_ROLE_KEY
    });
    
    if (!SUPABASE_URL || !SUPABASE_ANON_KEY || !SUPABASE_SERVICE_ROLE_KEY) {
      console.error('缺少必要的环境变量');
      return new Response(JSON.stringify({
        error: '服务器配置错误，缺少必要的环境变量'
      }), {
        status: 500,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json'
        }
      });
    }
    
    // 解析请求体
    const body = await req.json();
    console.log('请求体:', body);
    
    const { 
      email, 
      name, 
      organizationId, 
      redirectTo // 邀请链接重定向地址（可选）
    } = body;
    
    // 验证必要参数
    if (!email) {
      console.log('缺少邮箱地址');
      return new Response(JSON.stringify({
        error: '缺少邮箱地址'
      }), {
        status: 400,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json'
        }
      });
    }
    
    if (!organizationId) {
      console.log('缺少部门ID');
      return new Response(JSON.stringify({
        error: '缺少部门ID'
      }), {
        status: 400,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json'
        }
      });
    }
    
    // 获取Authorization header
    const authHeader = req.headers.get('Authorization');
    console.log('Authorization header:', authHeader ? 'Bearer ' + authHeader.substring(0, 20) + '...' : 'null');
    
    if (!authHeader) {
      console.log('缺少Authorization header');
      return new Response(JSON.stringify({
        error: '未授权',
        details: '缺少Authorization header'
      }), {
        status: 401,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json'
        }
      });
    }
    
    // 创建带有请求者身份的客户端
    const userClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: {
        headers: {
          Authorization: authHeader
        }
      }
    });
    
    // 创建服务端客户端（具有管理员权限）
    const adminClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    
    // 验证请求者是否已登录
    console.log('验证用户身份...');
    const { data: requestUser, error: authError } = await userClient.auth.getUser();
    console.log('用户验证结果:', {
      user: requestUser?.user?.id,
      error: authError
    });
    
    if (authError || !requestUser?.user) {
      console.log('用户未授权:', authError);
      return new Response(JSON.stringify({
        error: '未授权',
        details: authError?.message || '无有效用户会话'
      }), {
        status: 401,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json'
        }
      });
    }
    
    console.log('用户已授权:', requestUser.user.id);
    
    // 验证请求者是否有权限管理该组织
    console.log('验证组织权限:', organizationId);
    
    // 检查是否为直接管理员或通过递归权限管理该部门
    const hasPermission = await checkOrgPermission(userClient, organizationId, requestUser.user.id);
    console.log('权限检查结果:', hasPermission);
    
    if (!hasPermission) {
      console.log('无权管理此组织');
      return new Response(JSON.stringify({
        error: '无权管理此组织'
      }), {
        status: 403,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json'
        }
      });
    }
    
    console.log('权限验证通过，开始邀请用户');
    
    // 检查邮箱是否已被使用
    const { data: existingProfile } = await adminClient
      .from('users_profile')
      .select('user_id, status, email, nickname')
      .eq('email', email)
      .maybeSingle();
      
    if (existingProfile) {
      if (existingProfile.user_id) {
        console.log('用户已注册:', email);
        return new Response(JSON.stringify({
          error: '该邮箱已被注册，无法重复邀请'
        }), {
          status: 409,
          headers: {
            ...corsHeaders,
            'Content-Type': 'application/json'
          }
        });
      } else if (existingProfile.status === 'invited' || existingProfile.status === 'pending') {
        console.log('用户已被邀请但未注册，插入新profile:', email);
        await adminClient
          .from('users_profile')
          .insert({
            email: email,
            nickname: name || existingProfile.nickname,
            organization_id: organizationId,
            status: 'pending'
          });
      }
    }
    
    // 设置重定向URL
    const redirectURL = redirectTo || `${FRONTEND_URL}/set-password`;
    console.log('使用重定向URL:', redirectURL);
    
    // 发送邀请邮件
    console.log('发送邀请邮件:', email);
    const { data: inviteData, error: inviteError } = await adminClient.auth.admin.inviteUserByEmail(email, {
      data: {
        organization_id: organizationId,
        name: name || email.split('@')[0]
      },
      redirectTo: redirectURL
    });
    
    if (inviteError) {
      console.error('发送邀请邮件失败:', inviteError);
      return new Response(JSON.stringify({
        error: '发送邀请邮件失败',
        details: inviteError.message
      }), {
        status: 500,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json'
        }
      });
    }
    
    console.log('邀请邮件发送成功:', inviteData);
    
    return new Response(JSON.stringify({
      success: true,
      message: '邀请邮件已发送',
      data: {
        email: email,
        organization_id: organizationId,
        invite_sent_at: new Date().toISOString(),
        redirect_url: redirectURL
      }
    }), {
      status: 200,
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json'
      }
    });
  } catch (error) {
    console.error('处理请求时出错:', error);
    return new Response(JSON.stringify({
      error: '处理请求时出错',
      details: error.message
    }), {
      status: 500,
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json'
      }
    });
  }
});
*/ 

-- 获取地铁站数据函数
CREATE OR REPLACE FUNCTION public.get_metrostations()
RETURNS TABLE(
  line text,
  name text
)
LANGUAGE plpgsql
AS $$
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
    ms.name;
END;
$$;