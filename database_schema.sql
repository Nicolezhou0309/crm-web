-- 修改organizations表，添加admin字段
ALTER TABLE public.organizations 
ADD COLUMN IF NOT EXISTS admin UUID REFERENCES auth.users(id);

-- 为admin字段创建索引
CREATE INDEX IF NOT EXISTS idx_organizations_admin ON public.organizations(admin);

-- 更新RLS策略，支持admin字段
DROP POLICY IF EXISTS "organizations_select_policy" ON public.organizations;
DROP POLICY IF EXISTS "organizations_insert_policy" ON public.organizations;
DROP POLICY IF EXISTS "organizations_update_policy" ON public.organizations;
DROP POLICY IF EXISTS "organizations_delete_policy" ON public.organizations;

-- 重新创建RLS策略
CREATE POLICY "organizations_select_policy" ON public.organizations
  FOR SELECT USING (true); -- 所有人都可以查看部门

CREATE POLICY "organizations_insert_policy" ON public.organizations
  FOR INSERT WITH CHECK (
    -- 只有超级管理员可以创建部门
    (auth.jwt() ->> 'role')::text = 'service_role'
  );

CREATE POLICY "organizations_update_policy" ON public.organizations
  FOR UPDATE USING (
    -- 超级管理员或部门管理员可以更新部门
    (auth.jwt() ->> 'role')::text = 'service_role' OR
    admin = auth.uid() -- 部门管理员可以更新自己管理的部门
  );

CREATE POLICY "organizations_delete_policy" ON public.organizations
  FOR DELETE USING (
    -- 只有超级管理员可以删除部门
    (auth.jwt() ->> 'role')::text = 'service_role'
  );

-- 更新users_profile表的RLS策略
DROP POLICY IF EXISTS "users_profile_insert_policy" ON public.users_profile;
DROP POLICY IF EXISTS "users_profile_update_policy" ON public.users_profile;

CREATE POLICY "users_profile_insert_policy" ON public.users_profile
  FOR INSERT WITH CHECK (
    -- 超级管理员或部门管理员可以添加成员
    (auth.jwt() ->> 'role')::text = 'service_role' OR
    EXISTS (
      SELECT 1 FROM public.organizations o
      WHERE o.admin = auth.uid() AND o.id = organization_id
    )
  );

CREATE POLICY "users_profile_update_policy" ON public.users_profile
  FOR UPDATE USING (
    -- 超级管理员或部门管理员可以更新成员信息
    (auth.jwt() ->> 'role')::text = 'service_role' OR
    EXISTS (
      SELECT 1 FROM public.organizations o
      WHERE o.admin = auth.uid() AND o.id = organization_id
    )
  );

-- 创建函数：检查用户是否为部门管理员
CREATE OR REPLACE FUNCTION is_organization_admin(org_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.organizations
    WHERE id = org_id AND admin = auth.uid()
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 创建函数：获取用户管理的所有部门ID
CREATE OR REPLACE FUNCTION get_user_admin_organizations()
RETURNS UUID[] AS $$
BEGIN
  RETURN ARRAY(
    SELECT id FROM public.organizations
    WHERE admin = auth.uid()
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 创建函数：检查用户是否为超级管理员
CREATE OR REPLACE FUNCTION is_super_admin()
RETURNS BOOLEAN AS $$
BEGIN
  RETURN (auth.jwt() ->> 'role')::text = 'service_role';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION public.group_count_filter_followups(
    p_leadid text[] DEFAULT NULL,
    p_leadtype text[] DEFAULT NULL,
    p_interviewsales_user_id bigint[] DEFAULT NULL,
    p_followupstage text[] DEFAULT NULL,
    p_customerprofile text[] DEFAULT NULL,
    p_worklocation text[] DEFAULT NULL,
    p_userbudget text[] DEFAULT NULL,
    p_moveintime_start timestamptz DEFAULT NULL,
    p_moveintime_end timestamptz DEFAULT NULL,
    p_userrating text[] DEFAULT NULL,
    p_majorcategory text[] DEFAULT NULL,
    p_subcategory text[] DEFAULT NULL,
    p_followupresult text[] DEFAULT NULL,
    p_scheduletime_start timestamptz DEFAULT NULL,
    p_scheduletime_end timestamptz DEFAULT NULL,
    p_scheduledcommunity text[] DEFAULT NULL,
    p_keyword text DEFAULT NULL,
    p_wechat text[] DEFAULT NULL,
    p_source text[] DEFAULT NULL,
    p_created_at_start timestamptz DEFAULT NULL,
    p_created_at_end timestamptz DEFAULT NULL,
    p_remark text DEFAULT NULL,
    p_showingsales_user bigint[] DEFAULT NULL,
    p_phone text[] DEFAULT NULL,
    p_groupby_field text DEFAULT NULL
)
RETURNS TABLE (
    group_value text,
    count bigint
)
LANGUAGE plpgsql
AS $$
DECLARE
    query_text text;
    where_conditions text := '';
    group_by_clause text;
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
                                                     f.followupresult ILIKE ''%'' || $17 || ''%'')';
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
    
    -- 添加手机号过滤条件
    IF p_phone IS NOT NULL THEN
        where_conditions := where_conditions || ' AND l.phone = ANY($24)';
    END IF;
    
    -- Remove the leading ' AND ' if there are conditions
    IF length(where_conditions) > 0 THEN
        where_conditions := ' WHERE ' || substring(where_conditions from 6);
    END IF;
    
    -- 修改GROUP BY子句，处理interviewsales和showingsales字段
    CASE p_groupby_field
        WHEN 'leadtype' THEN
            group_by_clause := 'f.leadtype';
        WHEN 'interviewsales' THEN
            group_by_clause := 'up.nickname'; -- 使用users_profile.nickname
        WHEN 'interviewsales_user_id' THEN
            group_by_clause := 'f.interviewsales_user_id';
        WHEN 'followupstage' THEN
            group_by_clause := 'f.followupstage';
        WHEN 'customerprofile' THEN
            group_by_clause := 'f.customerprofile';
        WHEN 'worklocation' THEN
            group_by_clause := 'f.worklocation';
        WHEN 'userbudget' THEN
            group_by_clause := 'f.userbudget';
        WHEN 'userrating' THEN
            group_by_clause := 'f.userrating';
        WHEN 'majorcategory' THEN
            group_by_clause := 'f.majorcategory';
        WHEN 'subcategory' THEN
            group_by_clause := 'f.subcategory';
        WHEN 'followupresult' THEN
            group_by_clause := 'f.followupresult';
        WHEN 'scheduledcommunity' THEN
            group_by_clause := 'f.scheduledcommunity';
        WHEN 'source' THEN
            group_by_clause := 'l.source';
        WHEN 'created_at' THEN
            group_by_clause := 'DATE(f.created_at)';
        WHEN 'showingsales' THEN
            group_by_clause := 'up_showing.nickname'; -- 使用users_profile.nickname
        ELSE
            -- 检查是否是interviewsales_user或showingsales_user相关字段
            IF p_groupby_field = 'interviewsales_user' THEN
                group_by_clause := 'up.nickname';
            ELSIF p_groupby_field = 'showingsales_user' THEN
                group_by_clause := 'up_showing.nickname';
            ELSE
                group_by_clause := 'f.' || p_groupby_field;
            END IF;
    END CASE;
    
    -- 构建并执行动态查询
    query_text := 'SELECT ' || group_by_clause || '::text as group_value, COUNT(*)::bigint as count 
                  FROM public.followups f ' || 
                  join_clause || ' ' || 
                  where_conditions || 
                  ' GROUP BY ' || group_by_clause || 
                  ' ORDER BY ' || 
                  CASE WHEN p_groupby_field = 'created_at' THEN 'group_value' ELSE 'count DESC' END;
    
    RETURN QUERY EXECUTE query_text
    USING p_leadid, p_leadtype, p_interviewsales_user_id, p_followupstage, p_customerprofile,
          p_worklocation, p_userbudget, p_moveintime_start, p_moveintime_end, p_userrating,
          p_majorcategory, p_subcategory, p_followupresult, p_scheduletime_start, p_scheduletime_end,
          p_scheduledcommunity, p_keyword, p_wechat, p_source,
          p_created_at_start, p_created_at_end, p_remark, p_showingsales_user, p_phone;
END;
$$;

-- 跟进记录筛选函数（优化NULL值处理）
CREATE OR REPLACE FUNCTION filter_followups(
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
    p_worklocation text[] DEFAULT NULL::text[]
)
RETURNS TABLE(
    -- ... 返回字段保持不变 ...
) AS $$
DECLARE
    v_total_count bigint;
    v_query text;
    v_count_query text;
    v_where_clause text;
    v_join_clause text;
BEGIN
    -- JOIN子句保持不变
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

    -- 修改WHERE子句中的NULL值比较
    v_where_clause := '
    WHERE 1=1
    AND CASE 
        WHEN $7 IS NULL THEN true
        WHEN ARRAY_LENGTH($7, 1) IS NULL THEN true
        WHEN array_position($7, NULL) IS NOT NULL AND f.leadid IS NULL THEN true
        WHEN f.leadid = ANY($7) THEN true
        ELSE false
    END
    AND CASE 
        WHEN $8 IS NULL THEN true
        WHEN ARRAY_LENGTH($8, 1) IS NULL THEN true
        WHEN array_position($8, NULL) IS NOT NULL AND f.leadtype IS NULL THEN true
        WHEN f.leadtype = ANY($8) THEN true
        ELSE false
    END
    AND CASE 
        WHEN $5 IS NULL THEN true
        WHEN ARRAY_LENGTH($5, 1) IS NULL THEN true
        WHEN array_position($5, NULL) IS NOT NULL AND f.followupstage IS NULL THEN true
        WHEN f.followupstage = ANY($5) THEN true
        ELSE false
    END
    AND CASE 
        WHEN $3 IS NULL THEN true
        WHEN ARRAY_LENGTH($3, 1) IS NULL THEN true
        WHEN array_position($3, NULL) IS NOT NULL AND f.customerprofile IS NULL THEN true
        WHEN f.customerprofile = ANY($3) THEN true
        ELSE false
    END
    AND CASE 
        WHEN $21 IS NULL THEN true
        WHEN ARRAY_LENGTH($21, 1) IS NULL THEN true
        WHEN array_position($21, NULL) IS NOT NULL AND f.worklocation IS NULL THEN true
        WHEN f.worklocation = ANY($21) THEN true
        ELSE false
    END
    AND CASE 
        WHEN $18 IS NULL THEN true
        WHEN ARRAY_LENGTH($18, 1) IS NULL THEN true
        WHEN array_position($18, NULL) IS NOT NULL AND f.userbudget IS NULL THEN true
        WHEN f.userbudget = ANY($18) THEN true
        ELSE false
    END
    AND CASE 
        WHEN $19 IS NULL THEN true
        WHEN ARRAY_LENGTH($19, 1) IS NULL THEN true
        WHEN array_position($19, NULL) IS NOT NULL AND f.userrating IS NULL THEN true
        WHEN f.userrating = ANY($19) THEN true
        ELSE false
    END
    AND CASE 
        WHEN $10 IS NULL THEN true
        WHEN ARRAY_LENGTH($10, 1) IS NULL THEN true
        WHEN array_position($10, NULL) IS NOT NULL AND f.majorcategory IS NULL THEN true
        WHEN f.majorcategory = ANY($10) THEN true
        ELSE false
    END
    AND CASE 
        WHEN $4 IS NULL THEN true
        WHEN ARRAY_LENGTH($4, 1) IS NULL THEN true
        WHEN array_position($4, NULL) IS NOT NULL AND f.followupresult IS NULL THEN true
        WHEN f.followupresult = ANY($4) THEN true
        ELSE false
    END
    AND CASE 
        WHEN $15 IS NULL THEN true
        WHEN ARRAY_LENGTH($15, 1) IS NULL THEN true
        WHEN array_position($15, NULL) IS NOT NULL AND f.scheduledcommunity IS NULL THEN true
        WHEN f.scheduledcommunity = ANY($15) THEN true
        ELSE false
    END
    AND CASE 
        WHEN $20 IS NULL THEN true
        WHEN ARRAY_LENGTH($20, 1) IS NULL THEN true
        WHEN array_position($20, NULL) IS NOT NULL AND l.wechat IS NULL THEN true
        WHEN l.wechat = ANY($20) THEN true
        ELSE false
    END
    AND CASE 
        WHEN $17 IS NULL THEN true
        WHEN ARRAY_LENGTH($17, 1) IS NULL THEN true
        WHEN array_position($17, NULL) IS NOT NULL AND l.source IS NULL THEN true
        WHEN l.source = ANY($17) THEN true
        ELSE false
    END
    AND CASE 
        WHEN $6 IS NULL THEN true
        WHEN ARRAY_LENGTH($6, 1) IS NULL THEN true
        WHEN array_position($6, NULL) IS NOT NULL AND f.interviewsales_user_id IS NULL THEN true
        WHEN f.interviewsales_user_id = ANY($6) THEN true
        ELSE false
    END
    AND CASE 
        WHEN $16 IS NULL THEN true
        WHEN ARRAY_LENGTH($16, 1) IS NULL THEN true
        WHEN array_position($16, NULL) IS NOT NULL AND s.showingsales IS NULL THEN true
        WHEN s.showingsales = ANY($16) THEN true
        ELSE false
    END
    AND ($2 IS NULL OR f.created_at >= $2)
    AND ($1 IS NULL OR f.created_at <= $1)
    AND ($12 IS NULL OR f.moveintime >= $12)
    AND ($11 IS NULL OR f.moveintime <= $11)
    AND CASE 
        WHEN $14 IS NULL THEN true
        WHEN $14 = '''' AND l.remark IS NULL THEN true
        WHEN l.remark ILIKE ''%'' || $14 || ''%'' THEN true
        ELSE false
    END';

    -- 其余代码保持不变
    v_count_query := 'SELECT COUNT(*) FROM public.followups f ' || v_join_clause || v_where_clause;
    EXECUTE v_count_query INTO v_total_count USING 
        p_created_at_end, p_created_at_start, p_customerprofile, p_followupresult, p_followupstage,
        p_interviewsales_user_id, p_leadid, p_leadtype, p_limit, p_majorcategory, p_moveintime_end,
        p_moveintime_start, p_offset, p_remark, p_scheduledcommunity, p_showingsales_user,
        p_source, p_userbudget, p_userrating, p_wechat, p_worklocation;

    -- 构建主查询
    v_query := 'SELECT
        -- ... 字段定义保持不变 ...
    FROM public.followups f ' || v_join_clause || v_where_clause;
    
    -- 添加分页和排序
    IF p_limit IS NOT NULL THEN
        v_query := v_query || ' ORDER BY f.created_at DESC LIMIT ' || p_limit;
    ELSE
        v_query := v_query || ' ORDER BY f.created_at DESC';
    END IF;
    
    v_query := v_query || ' OFFSET ' || p_offset;
    
    -- 执行查询并返回结果
    RETURN QUERY EXECUTE v_query USING 
        p_created_at_end, p_created_at_start, p_customerprofile, p_followupresult, p_followupstage,
        p_interviewsales_user_id, p_leadid, p_leadtype, p_limit, p_majorcategory, p_moveintime_end,
        p_moveintime_start, p_offset, p_remark, p_scheduledcommunity, p_showingsales_user,
        p_source, p_userbudget, p_userrating, p_wechat, p_worklocation;
END;
$$ LANGUAGE plpgsql;

-- 分组统计函数（修复枚举类型NULL值处理）
CREATE OR REPLACE FUNCTION group_count_filter_followups(
    p_created_at_end timestamp with time zone DEFAULT NULL::timestamp with time zone,
    p_created_at_start timestamp with time zone DEFAULT NULL::timestamp with time zone,
    p_customerprofile customerprofile[] DEFAULT NULL::customerprofile[],
    p_followupresult text[] DEFAULT NULL::text[],
    p_followupstage followupstage[] DEFAULT NULL::followupstage[],
    p_groupby_field text DEFAULT NULL::text,
    p_interviewsales_user_id bigint[] DEFAULT NULL::bigint[],
    p_leadid text[] DEFAULT NULL::text[],
    p_leadtype text[] DEFAULT NULL::text[],
    p_majorcategory text[] DEFAULT NULL::text[],
    p_moveintime_end timestamp with time zone DEFAULT NULL::timestamp with time zone,
    p_moveintime_start timestamp with time zone DEFAULT NULL::timestamp with time zone,
    p_remark text DEFAULT NULL::text,
    p_scheduledcommunity community[] DEFAULT NULL::community[],
    p_showingsales_user bigint[] DEFAULT NULL::bigint[],
    p_source source[] DEFAULT NULL::source[],
    p_userbudget text[] DEFAULT NULL::text[],
    p_userrating userrating[] DEFAULT NULL::userrating[],
    p_wechat text[] DEFAULT NULL::text[],
    p_worklocation text[] DEFAULT NULL::text[]
)
RETURNS TABLE(
    group_id text,
    group_value text,
    count bigint
) AS $$
DECLARE
    v_query text;
    v_where_clause text;
    v_join_clause text;
    v_group_by_expr text;
BEGIN
    -- JOIN子句保持不变
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

    -- 修改WHERE子句中的NULL值比较
    v_where_clause := '
    WHERE 1=1
    AND CASE 
        WHEN $8 IS NULL THEN true
        WHEN ARRAY_LENGTH($8, 1) IS NULL THEN true
        WHEN array_position($8, NULL) IS NOT NULL AND f.leadid IS NULL THEN true
        WHEN f.leadid = ANY($8) THEN true
        ELSE false
    END
    AND CASE 
        WHEN $9 IS NULL THEN true
        WHEN ARRAY_LENGTH($9, 1) IS NULL THEN true
        WHEN array_position($9, NULL) IS NOT NULL AND f.leadtype IS NULL THEN true
        WHEN f.leadtype = ANY($9) THEN true
        ELSE false
    END
    AND CASE 
        WHEN $5 IS NULL THEN true
        WHEN ARRAY_LENGTH($5, 1) IS NULL THEN true
        WHEN array_position($5, NULL) IS NOT NULL AND f.followupstage IS NULL THEN true
        WHEN f.followupstage = ANY($5) THEN true
        ELSE false
    END
    AND CASE 
        WHEN $3 IS NULL THEN true
        WHEN ARRAY_LENGTH($3, 1) IS NULL THEN true
        WHEN array_position($3, NULL) IS NOT NULL AND f.customerprofile IS NULL THEN true
        WHEN f.customerprofile = ANY($3) THEN true
        ELSE false
    END
    AND CASE 
        WHEN $20 IS NULL THEN true
        WHEN ARRAY_LENGTH($20, 1) IS NULL THEN true
        WHEN array_position($20, NULL) IS NOT NULL AND f.worklocation IS NULL THEN true
        WHEN f.worklocation = ANY($20) THEN true
        ELSE false
    END
    AND CASE 
        WHEN $17 IS NULL THEN true
        WHEN ARRAY_LENGTH($17, 1) IS NULL THEN true
        WHEN array_position($17, NULL) IS NOT NULL AND f.userbudget IS NULL THEN true
        WHEN f.userbudget = ANY($17) THEN true
        ELSE false
    END
    AND CASE 
        WHEN $18 IS NULL THEN true
        WHEN ARRAY_LENGTH($18, 1) IS NULL THEN true
        WHEN array_position($18, NULL) IS NOT NULL AND f.userrating IS NULL THEN true
        WHEN f.userrating = ANY($18) THEN true
        ELSE false
    END
    AND CASE 
        WHEN $10 IS NULL THEN true
        WHEN ARRAY_LENGTH($10, 1) IS NULL THEN true
        WHEN array_position($10, NULL) IS NOT NULL AND f.majorcategory IS NULL THEN true
        WHEN f.majorcategory = ANY($10) THEN true
        ELSE false
    END
    AND CASE 
        WHEN $4 IS NULL THEN true
        WHEN ARRAY_LENGTH($4, 1) IS NULL THEN true
        WHEN array_position($4, NULL) IS NOT NULL AND f.followupresult IS NULL THEN true
        WHEN f.followupresult = ANY($4) THEN true
        ELSE false
    END
    AND CASE 
        WHEN $14 IS NULL THEN true
        WHEN ARRAY_LENGTH($14, 1) IS NULL THEN true
        WHEN array_position($14, NULL) IS NOT NULL AND f.scheduledcommunity IS NULL THEN true
        WHEN f.scheduledcommunity = ANY($14) THEN true
        ELSE false
    END
    AND CASE 
        WHEN $19 IS NULL THEN true
        WHEN ARRAY_LENGTH($19, 1) IS NULL THEN true
        WHEN array_position($19, NULL) IS NOT NULL AND l.wechat IS NULL THEN true
        WHEN l.wechat = ANY($19) THEN true
        ELSE false
    END
    AND CASE 
        WHEN $16 IS NULL THEN true
        WHEN ARRAY_LENGTH($16, 1) IS NULL THEN true
        WHEN array_position($16, NULL) IS NOT NULL AND l.source IS NULL THEN true
        WHEN l.source = ANY($16) THEN true
        ELSE false
    END
    AND CASE 
        WHEN $7 IS NULL THEN true
        WHEN ARRAY_LENGTH($7, 1) IS NULL THEN true
        WHEN array_position($7, NULL) IS NOT NULL AND f.interviewsales_user_id IS NULL THEN true
        WHEN f.interviewsales_user_id = ANY($7) THEN true
        ELSE false
    END
    AND CASE 
        WHEN $15 IS NULL THEN true
        WHEN ARRAY_LENGTH($15, 1) IS NULL THEN true
        WHEN array_position($15, NULL) IS NOT NULL AND s.showingsales IS NULL THEN true
        WHEN s.showingsales = ANY($15) THEN true
        ELSE false
    END
    AND ($2 IS NULL OR f.created_at >= $2)
    AND ($1 IS NULL OR f.created_at <= $1)
    AND ($12 IS NULL OR f.moveintime >= $12)
    AND ($11 IS NULL OR f.moveintime <= $11)
    AND CASE 
        WHEN $13 IS NULL THEN true
        WHEN $13 = '''' AND l.remark IS NULL THEN true
        WHEN l.remark ILIKE ''%'' || $13 || ''%'' THEN true
        ELSE false
    END';

    -- 根据分组字段构造GROUP BY表达式
    CASE p_groupby_field
        WHEN 'created_at' THEN
            v_group_by_expr := 'DATE(f.created_at)::text';
        WHEN 'interviewsales_user_id' THEN
            v_group_by_expr := 'f.interviewsales_user_id::text, COALESCE(up_interview.nickname, ''未分配'')';
        WHEN 'showingsales_user_id' THEN
            v_group_by_expr := 's.showingsales::text, COALESCE(s.showingsales_name, ''未分配'')';
        WHEN 'followupstage' THEN
            v_group_by_expr := 'f.followupstage::text';
        WHEN 'customerprofile' THEN
            v_group_by_expr := 'f.customerprofile::text';
        WHEN 'source' THEN
            v_group_by_expr := 'l.source::text';
        WHEN 'scheduledcommunity' THEN
            v_group_by_expr := 'f.scheduledcommunity::text';
        WHEN 'userrating' THEN
            v_group_by_expr := 'f.userrating::text';
        ELSE
            RAISE EXCEPTION 'Invalid groupby field: %', p_groupby_field;
    END CASE;

    -- 构造完整查询
    v_query := '
    WITH grouped_data AS (
        SELECT
            ' || v_group_by_expr || ' as group_value,
            COUNT(*) as count
        FROM public.followups f
        ' || v_join_clause || '
        ' || v_where_clause || '
        GROUP BY ' || v_group_by_expr || '
    )
    SELECT
        CASE
            WHEN group_value IS NULL OR group_value = '''' THEN ''null''
            ELSE group_value
        END as group_id,
        CASE
            WHEN group_value IS NULL OR group_value = '''' THEN ''未分配''
            ELSE group_value
        END as group_value,
        count
    FROM grouped_data
    ORDER BY count DESC';

    -- 执行查询并返回结果
    RETURN QUERY EXECUTE v_query USING 
        p_created_at_end, p_created_at_start, p_customerprofile, p_followupresult, p_followupstage,
        p_groupby_field, p_interviewsales_user_id, p_leadid, p_leadtype, p_majorcategory,
        p_moveintime_end, p_moveintime_start, p_remark, p_scheduledcommunity, p_showingsales_user,
        p_source, p_userbudget, p_userrating, p_wechat, p_worklocation;
END;
$$ LANGUAGE plpgsql; 