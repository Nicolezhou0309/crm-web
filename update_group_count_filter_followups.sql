-- 更新 group_count_filter_followups 函数，添加 p_phone 参数支持
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
  p_phone text[] DEFAULT NULL::text[],
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
          p_majorcategory, p_subcategory, p_followupresult, p_scheduletime_start, p_scheduletime_end,
          p_scheduledcommunity, p_keyword, p_wechat, p_phone, p_source,
          p_created_at_start, p_created_at_end, p_remark, p_showingsales_user;
END;
$$; 