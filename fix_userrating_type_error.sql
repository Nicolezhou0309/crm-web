-- 修复 filter_followups 函数中 userrating 类型转换问题
-- 问题：WHERE 子句中 f.userrating::text = ANY($22) 导致类型不匹配
-- 解决方案：在WHERE子句中正确处理类型转换，将传入的text[]转换为userrating[]进行比较

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
    p_moveintime_not_null boolean[] DEFAULT NULL::boolean[],
    p_offset integer DEFAULT 0,
    p_remark text DEFAULT NULL::text,
    p_scheduledcommunity community[] DEFAULT NULL::community[],
    p_showingsales_user bigint[] DEFAULT NULL::bigint[],
    p_source source[] DEFAULT NULL::source[],
    p_userbudget text[] DEFAULT NULL::text[],
    p_userbudget_min numeric DEFAULT NULL::numeric,
    p_userbudget_max numeric DEFAULT NULL::numeric,
    p_userrating text[] DEFAULT NULL::text[], -- 改为text[]以匹配前端传递的类型
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
    id uuid, leadid text, lead_uuid uuid, leadtype text, followupstage followupstage, 
    followupstage_name text, customerprofile customerprofile, customerprofile_name text, 
    worklocation text, worklocation_id text, userbudget text, userbudget_id text, 
    moveintime timestamp with time zone, scheduletime timestamp with time zone, 
    created_at timestamp with time zone, updated_at timestamp with time zone, 
    userrating userrating, userrating_name text, majorcategory text, majorcategory_id text, 
    followupresult text, followupresult_id text, scheduledcommunity community, 
    scheduledcommunity_name text, phone text, wechat text, source source, source_name text, 
    remark text, interviewsales_user_id bigint, interviewsales_user_name text, 
    showingsales_user_id bigint, showingsales_user_name text, qq text, location text, 
    budget text, douyinid text, douyin_accountname text, staffname text, redbookid text, 
    area text, notelink text, campaignid text, campaignname text, unitid text, unitname text, 
    creativedid text, creativename text, traffictype text, interactiontype text, 
    douyinleadid text, leadstatus text, invalid boolean, extended_data jsonb, total_count bigint
)
LANGUAGE plpgsql
AS $function$
DECLARE
    v_total_count bigint;
    v_query text;
    v_count_query text;
    v_where_clause text;
    v_join_clause text;
    v_moveintime_not_null boolean;

BEGIN
    -- 🆕 处理入住时间非空条件
    v_moveintime_not_null := FALSE;
    IF p_moveintime_not_null IS NOT NULL AND array_length(p_moveintime_not_null, 1) > 0 THEN
        v_moveintime_not_null := p_moveintime_not_null[1];
    END IF;
    

    
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
    
    -- 构建WHERE子句 - 修复userrating类型转换问题
    v_where_clause := '
    WHERE ($7 IS NULL OR f.leadid = ANY($7))
      AND ($8 IS NULL OR f.leadtype = ANY($8) OR (ARRAY_LENGTH($8, 1) = 1 AND $8[1] IS NULL AND f.leadtype IS NULL))
      AND ($5 IS NULL OR f.followupstage = ANY($5) OR (ARRAY_LENGTH($5, 1) = 1 AND $5[1] IS NULL AND f.followupstage IS NULL))
      AND ($3 IS NULL OR f.customerprofile = ANY($3) OR (ARRAY_LENGTH($3, 1) = 1 AND $3[1] IS NULL AND f.customerprofile IS NULL))
      AND ($23 IS NULL OR f.worklocation = ANY($23) OR (ARRAY_LENGTH($23, 1) = 1 AND $23[1] IS NULL AND f.worklocation IS NULL))
      AND ($19 IS NULL OR f.userbudget = ANY($19) OR (ARRAY_LENGTH($19, 1) = 1 AND $19[1] IS NULL AND f.userbudget IS NULL))
      AND ($20 IS NULL OR (CASE WHEN f.userbudget ~ ''^[0-9]+$'' THEN CAST(f.userbudget AS numeric) ELSE NULL END) >= $20)
      AND ($21 IS NULL OR (CASE WHEN f.userbudget ~ ''^[0-9]+$'' THEN CAST(f.userbudget AS numeric) ELSE NULL END) <= $21)
      AND ($12 IS NULL OR f.moveintime >= $12)
      AND ($11 IS NULL OR f.moveintime <= $11)
      AND ($13 IS NULL OR f.moveintime IS NOT NULL)
      AND ($22 IS NULL OR EXISTS(SELECT 1 FROM unnest($22) AS t(enum_value) WHERE t.enum_value::userrating = f.userrating) OR (ARRAY_LENGTH($22, 1) = 1 AND $22[1] IS NULL AND f.userrating IS NULL))
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
      AND ($16 IS NULL OR f.scheduledcommunity = ANY($16) OR (ARRAY_LENGTH($16, 1) = 1 AND $16[1] IS NULL AND f.scheduledcommunity IS NULL))
      AND ($18 IS NULL OR l.source = ANY($18) OR (ARRAY_LENGTH($18, 1) = 1 AND $18[1] IS NULL AND l.source IS NULL))
      AND ($22 IS NULL OR l.wechat = ANY($22) OR (ARRAY_LENGTH($22, 1) = 1 AND $22[1] IS NULL AND l.wechat IS NULL))
      AND ($2 IS NULL OR f.created_at >= $2)
      AND ($1 IS NULL OR f.created_at <= $1)
      AND ($15 IS NULL OR l.remark ILIKE ''%'' || $15 || ''%'' OR ($15 = '''' AND (l.remark IS NULL OR l.remark = '''')))
      AND ($6 IS NULL OR f.interviewsales_user_id = ANY($6) OR (ARRAY_LENGTH($6, 1) = 1 AND $6[1] IS NULL AND f.interviewsales_user_id IS NULL))
      AND ($17 IS NULL OR s.showingsales = ANY($17) OR (ARRAY_LENGTH($17, 1) = 1 AND $17[1] IS NULL AND s.showingsales IS NULL))
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
      AND ($45 IS NULL OR (f.leadid::text ILIKE ''%'' || $45 || ''%'' OR 
                           f.leadtype ILIKE ''%'' || $45 || ''%'' OR 
                           up_interview.nickname ILIKE ''%'' || $45 || ''%'' OR 
                           s.showingsales_name ILIKE ''%'' || $45 || ''%'' OR
                           f.worklocation ILIKE ''%'' || $45 || ''%'' OR 
                           f.userbudget ILIKE ''%'' || $45 || ''%'' OR 
                           f.majorcategory ILIKE ''%'' || $45 || ''%'' OR 
                           f.followupresult ILIKE ''%'' || $45 || ''%'' OR
                           l.phone ILIKE ''%'' || $45 || ''%'' OR
                           l.wechat ILIKE ''%'' || $45 || ''%'' OR
                           f.extended_data::text ILIKE ''%'' || $45 || ''%''))';
    
    -- 🆕 添加调试日志
    RAISE NOTICE 'Debug: p_worklocation = %, type = %', p_worklocation, pg_typeof(p_worklocation);
    
    -- Count total records - 使用正确的参数顺序
    v_count_query := 'SELECT COUNT(*) FROM public.followups f ' || v_join_clause || v_where_clause;
    EXECUTE v_count_query INTO v_total_count USING 
        p_created_at_end, p_created_at_start, p_customerprofile, p_followupresult, p_followupstage,
        p_interviewsales_user_id, p_leadid, p_leadtype, p_limit, p_majorcategory, p_moveintime_end,
        p_moveintime_start, v_moveintime_not_null, p_offset, p_remark, p_scheduledcommunity, p_showingsales_user,
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
        f.extended_data,
        ' || v_total_count || '::bigint as total_count
    FROM public.followups f ' || v_join_clause || v_where_clause;
    
    -- Add pagination and sorting
    IF p_limit IS NOT NULL THEN
        v_query := v_query || ' ORDER BY f.created_at DESC LIMIT ' || p_limit;
    ELSE
        v_query := v_query || ' ORDER BY f.created_at DESC';
    END IF;
    v_query := v_query || ' OFFSET ' || p_offset;
    
    -- Execute query and return results - 使用正确的参数顺序
    RETURN QUERY EXECUTE v_query USING 
        p_created_at_end, p_created_at_start, p_customerprofile, p_followupresult, p_followupstage,
        p_interviewsales_user_id, p_leadid, p_leadtype, p_limit, p_majorcategory, p_moveintime_end,
        p_moveintime_start, v_moveintime_not_null, p_offset, p_remark, p_scheduledcommunity, p_showingsales_user,
        p_source, p_userbudget, p_userbudget_min, p_userbudget_max, p_userrating, p_wechat, p_worklocation,
        p_phone, p_qq, p_location, p_budget, p_douyinid, p_douyin_accountname, p_staffname,
        p_redbookid, p_area, p_notelink, p_campaignid, p_campaignname, p_unitid, p_unitname,
        p_creativedid, p_creativename, p_traffictype, p_interactiontype, p_douyinleadid, p_leadstatus, p_keyword;
END;
$function$;
