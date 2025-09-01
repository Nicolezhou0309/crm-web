-- 修复后的 filter_followups 函数
-- 解决参数顺序和数量不匹配问题

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
    p_userrating text[] DEFAULT NULL::text[],
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
    v_moveintime_not_null boolean;
BEGIN
    -- 处理入住时间非空条件
    v_moveintime_not_null := FALSE;
    IF p_moveintime_not_null IS NOT NULL AND array_length(p_moveintime_not_null, 1) > 0 THEN
        v_moveintime_not_null := p_moveintime_not_null[1];
    END IF;
    
    -- 获取总数
    SELECT COUNT(*) INTO v_total_count 
    FROM public.followups f 
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
    ) s ON f.leadid = s.leadid
    WHERE (p_created_at_end IS NULL OR f.created_at <= p_created_at_end)
      AND (p_created_at_start IS NULL OR f.created_at >= p_created_at_start)
      AND (p_customerprofile IS NULL OR (ARRAY_LENGTH(p_customerprofile, 1) > 0 AND (f.customerprofile = ANY(p_customerprofile) OR (ARRAY_LENGTH(p_customerprofile, 1) = 1 AND p_customerprofile[1] IS NULL AND f.customerprofile IS NULL))))
      AND (p_followupresult IS NULL OR (ARRAY_LENGTH(p_followupresult, 1) > 0 AND (f.followupresult = ANY(p_followupresult) OR (ARRAY_LENGTH(p_followupresult, 1) = 1 AND p_followupresult[1] IS NULL AND f.followupresult IS NULL))))
      AND (p_followupstage IS NULL OR (ARRAY_LENGTH(p_followupstage, 1) > 0 AND (f.followupstage = ANY(p_followupstage) OR (ARRAY_LENGTH(p_followupstage, 1) = 1 AND p_followupstage[1] IS NULL AND f.followupstage IS NULL))))
      AND (p_interviewsales_user_id IS NULL OR (ARRAY_LENGTH(p_interviewsales_user_id, 1) > 0 AND (f.interviewsales_user_id = ANY(p_interviewsales_user_id) OR (ARRAY_LENGTH(p_interviewsales_user_id, 1) = 1 AND p_interviewsales_user_id[1] IS NULL AND f.interviewsales_user_id IS NULL))))
      AND (p_leadid IS NULL OR (ARRAY_LENGTH(p_leadid, 1) > 0 AND f.leadid = ANY(p_leadid)))
      AND (p_leadtype IS NULL OR (ARRAY_LENGTH(p_leadtype, 1) > 0 AND (f.leadtype = ANY(p_leadtype) OR (ARRAY_LENGTH(p_leadtype, 1) = 1 AND p_leadtype[1] IS NULL AND f.leadtype IS NULL))))
      AND (p_majorcategory IS NULL OR (ARRAY_LENGTH(p_majorcategory, 1) > 0 AND (f.majorcategory = ANY(p_majorcategory) OR (ARRAY_LENGTH(p_majorcategory, 1) = 1 AND p_majorcategory[1] IS NULL AND f.majorcategory IS NULL))))
      AND (p_moveintime_end IS NULL OR f.moveintime <= p_moveintime_end)
      AND (p_moveintime_start IS NULL OR f.moveintime >= p_moveintime_start)
      AND (v_moveintime_not_null IS NULL OR (CASE WHEN v_moveintime_not_null THEN f.moveintime IS NOT NULL ELSE TRUE END))
      AND (p_remark IS NULL OR l.remark ILIKE '%' || p_remark || '%' OR (p_remark = '' AND (l.remark IS NULL OR l.remark = '')))
      AND (p_scheduledcommunity IS NULL OR (ARRAY_LENGTH(p_scheduledcommunity, 1) > 0 AND (f.scheduledcommunity = ANY(p_scheduledcommunity) OR (ARRAY_LENGTH(p_scheduledcommunity, 1) = 1 AND p_scheduledcommunity[1] IS NULL AND f.scheduledcommunity IS NULL))))
      AND (p_showingsales_user IS NULL OR (ARRAY_LENGTH(p_showingsales_user, 1) > 0 AND (s.showingsales = ANY(p_showingsales_user) OR (ARRAY_LENGTH(p_showingsales_user, 1) = 1 AND p_showingsales_user[1] IS NULL AND s.showingsales IS NULL))))
      AND (p_source IS NULL OR (ARRAY_LENGTH(p_source, 1) > 0 AND (l.source = ANY(p_source) OR (ARRAY_LENGTH(p_source, 1) = 1 AND p_source[1] IS NULL AND l.source IS NULL))))
      AND (p_userbudget IS NULL OR (ARRAY_LENGTH(p_userbudget, 1) > 0 AND (f.userbudget = ANY(p_userbudget) OR (ARRAY_LENGTH(p_userbudget, 1) = 1 AND p_userbudget[1] IS NULL AND f.userbudget IS NULL))))
      AND (p_userbudget_min IS NULL OR (CASE WHEN f.userbudget ~ '^[0-9]+$' THEN CAST(f.userbudget AS numeric) ELSE NULL END) >= p_userbudget_min)
      AND (p_userbudget_max IS NULL OR (CASE WHEN f.userbudget ~ '^[0-9]+$' THEN CAST(f.userbudget AS numeric) ELSE NULL END) <= p_userbudget_max)
      AND (p_userrating IS NULL OR (ARRAY_LENGTH(p_userrating, 1) > 0 AND (EXISTS(SELECT 1 FROM unnest(p_userrating) AS t(enum_value) WHERE t.enum_value::userrating = f.userrating) OR (ARRAY_LENGTH(p_userrating, 1) = 1 AND p_userrating[1] IS NULL AND f.userrating IS NULL))))
      AND (p_wechat IS NULL OR (ARRAY_LENGTH(p_wechat, 1) > 0 AND (l.wechat = ANY(p_wechat) OR (ARRAY_LENGTH(p_wechat, 1) = 1 AND p_wechat[1] IS NULL AND l.wechat IS NULL))))
      AND (p_worklocation IS NULL OR (ARRAY_LENGTH(p_worklocation, 1) > 0 AND (f.worklocation = ANY(p_worklocation) OR (ARRAY_LENGTH(p_worklocation, 1) = 1 AND p_worklocation[1] IS NULL AND f.worklocation IS NULL))))
      AND (p_phone IS NULL OR (ARRAY_LENGTH(p_phone, 1) > 0 AND (l.phone = ANY(p_phone) OR (ARRAY_LENGTH(p_phone, 1) = 1 AND p_phone[1] IS NULL AND l.phone IS NULL))))
      AND (p_qq IS NULL OR (ARRAY_LENGTH(p_qq, 1) > 0 AND (l.qq = ANY(p_qq) OR (ARRAY_LENGTH(p_qq, 1) = 1 AND p_qq[1] IS NULL AND l.qq IS NULL))))
      AND (p_location IS NULL OR (ARRAY_LENGTH(p_location, 1) > 0 AND (l.location = ANY(p_location) OR (ARRAY_LENGTH(p_location, 1) = 1 AND p_location[1] IS NULL AND l.location IS NULL))))
      AND (p_budget IS NULL OR (ARRAY_LENGTH(p_budget, 1) > 0 AND (l.budget = ANY(p_budget) OR (ARRAY_LENGTH(p_budget, 1) = 1 AND p_budget[1] IS NULL AND l.budget IS NULL))))
      AND (p_douyinid IS NULL OR (ARRAY_LENGTH(p_douyinid, 1) > 0 AND (l.douyinid = ANY(p_douyinid) OR (ARRAY_LENGTH(p_douyinid, 1) = 1 AND p_douyinid[1] IS NULL AND l.douyinid IS NULL))))
      AND (p_douyin_accountname IS NULL OR (ARRAY_LENGTH(p_douyin_accountname, 1) > 0 AND (l.douyin_accountname = ANY(p_douyin_accountname) OR (ARRAY_LENGTH(p_douyin_accountname, 1) = 1 AND p_douyin_accountname[1] IS NULL AND l.douyin_accountname IS NULL))))
      AND (p_staffname IS NULL OR (ARRAY_LENGTH(p_staffname, 1) > 0 AND (l.staffname = ANY(p_staffname) OR (ARRAY_LENGTH(p_staffname, 1) = 1 AND p_staffname[1] IS NULL AND l.staffname IS NULL))))
      AND (p_redbookid IS NULL OR (ARRAY_LENGTH(p_redbookid, 1) > 0 AND (l.redbookid = ANY(p_redbookid) OR (ARRAY_LENGTH(p_redbookid, 1) = 1 AND p_redbookid[1] IS NULL AND l.redbookid IS NULL))))
      AND (p_area IS NULL OR (ARRAY_LENGTH(p_area, 1) > 0 AND (l.area = ANY(p_area) OR (ARRAY_LENGTH(p_area, 1) = 1 AND p_area[1] IS NULL AND l.area IS NULL))))
      AND (p_notelink IS NULL OR (ARRAY_LENGTH(p_notelink, 1) > 0 AND (l.notelink = ANY(p_notelink) OR (ARRAY_LENGTH(p_notelink, 1) = 1 AND p_notelink[1] IS NULL AND l.notelink IS NULL))))
      AND (p_campaignid IS NULL OR (ARRAY_LENGTH(p_campaignid, 1) > 0 AND (l.campaignid = ANY(p_campaignid) OR (ARRAY_LENGTH(p_campaignid, 1) = 1 AND p_campaignid[1] IS NULL AND l.campaignid IS NULL))))
      AND (p_campaignname IS NULL OR (ARRAY_LENGTH(p_campaignname, 1) > 0 AND (l.campaignname = ANY(p_campaignname) OR (ARRAY_LENGTH(p_campaignname, 1) = 1 AND p_campaignname[1] IS NULL AND l.campaignname IS NULL))))
      AND (p_unitid IS NULL OR (ARRAY_LENGTH(p_unitid, 1) > 0 AND (l.unitid = ANY(p_unitid) OR (ARRAY_LENGTH(p_unitid, 1) = 1 AND p_unitid[1] IS NULL AND l.unitid IS NULL))))
      AND (p_unitname IS NULL OR (ARRAY_LENGTH(p_unitname, 1) > 0 AND (l.unitname = ANY(p_unitname) OR (ARRAY_LENGTH(p_unitname, 1) = 1 AND p_unitname[1] IS NULL AND l.unitname IS NULL))))
      AND (p_creativedid IS NULL OR (ARRAY_LENGTH(p_creativedid, 1) > 0 AND (l.creativedid = ANY(p_creativedid) OR (ARRAY_LENGTH(p_creativedid, 1) = 1 AND p_creativedid[1] IS NULL AND l.creativedid IS NULL))))
      AND (p_creativename IS NULL OR (ARRAY_LENGTH(p_creativename, 1) > 0 AND (l.creativename = ANY(p_creativename) OR (ARRAY_LENGTH(p_creativename, 1) = 1 AND p_creativename[1] IS NULL AND l.creativename IS NULL))))
      AND (p_traffictype IS NULL OR (ARRAY_LENGTH(p_traffictype, 1) > 0 AND (l.traffictype = ANY(p_traffictype) OR (ARRAY_LENGTH(p_traffictype, 1) = 1 AND p_traffictype[1] IS NULL AND l.traffictype IS NULL))))
      AND (p_interactiontype IS NULL OR (ARRAY_LENGTH(p_interactiontype, 1) > 0 AND (l.interactiontype = ANY(p_interactiontype) OR (ARRAY_LENGTH(p_interactiontype, 1) = 1 AND p_interactiontype[1] IS NULL AND l.interactiontype IS NULL))))
      AND (p_douyinleadid IS NULL OR (ARRAY_LENGTH(p_douyinleadid, 1) > 0 AND (l.douyinleadid = ANY(p_douyinleadid) OR (ARRAY_LENGTH(p_douyinleadid, 1) = 1 AND p_douyinleadid[1] IS NULL AND l.douyinleadid IS NULL))))
      AND (p_leadstatus IS NULL OR (ARRAY_LENGTH(p_leadstatus, 1) > 0 AND (l.leadstatus = ANY(p_leadstatus) OR (ARRAY_LENGTH(p_leadstatus, 1) = 1 AND p_leadstatus[1] IS NULL AND l.leadstatus IS NULL))))
      AND (p_keyword IS NULL OR (f.leadid::text ILIKE '%' || p_keyword || '%' OR f.leadtype ILIKE '%' || p_keyword || '%' OR up_interview.nickname ILIKE '%' || p_keyword || '%' OR s.showingsales_name ILIKE '%' || p_keyword || '%' OR f.worklocation ILIKE '%' || p_keyword || '%' OR f.userbudget ILIKE '%' || p_keyword || '%' OR f.majorcategory ILIKE '%' || p_keyword || '%' OR f.followupresult ILIKE '%' || p_keyword || '%' OR l.phone ILIKE '%' || p_keyword || '%' OR l.wechat ILIKE '%' || p_keyword || '%' OR f.extended_data::text ILIKE '%' || p_keyword || '%'));
    
    -- 返回查询结果
    RETURN QUERY
    SELECT 
        f.id, f.leadid, l.id as lead_uuid, f.leadtype, f.followupstage, 
        f.followupstage::text as followupstage_name, f.customerprofile, f.customerprofile::text as customerprofile_name, 
        f.worklocation, f.worklocation as worklocation_id, f.userbudget, f.userbudget as userbudget_id, 
        f.moveintime, f.scheduletime, f.created_at, f.updated_at, 
        f.userrating, f.userrating::text as userrating_name, f.majorcategory, f.majorcategory as majorcategory_id, 
        f.followupresult, f.followupresult as followupresult_id, f.scheduledcommunity, 
        f.scheduledcommunity::text as scheduledcommunity_name, l.phone, l.wechat, l.source, l.source::text as source_name, 
        l.remark, f.interviewsales_user_id, up_interview.nickname as interviewsales_user_name, 
        s.showingsales as showingsales_user_id, s.showingsales_name as showingsales_user_name, l.qq, l.location, 
        l.budget, l.douyinid, l.douyin_accountname, l.staffname, l.redbookid, 
        l.area, l.notelink, l.campaignid, l.campaignname, l.unitid, l.unitname, 
        l.creativedid, l.creativename, l.traffictype, l.interactiontype, 
        l.douyinleadid, l.leadstatus, f.invalid, f.extended_data, v_total_count::bigint as total_count
    FROM public.followups f 
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
    ) s ON f.leadid = s.leadid
    WHERE (p_created_at_end IS NULL OR f.created_at <= p_created_at_end)
      AND (p_created_at_start IS NULL OR f.created_at >= p_created_at_start)
      AND (p_customerprofile IS NULL OR (ARRAY_LENGTH(p_customerprofile, 1) > 0 AND (f.customerprofile = ANY(p_customerprofile) OR (ARRAY_LENGTH(p_customerprofile, 1) = 1 AND p_customerprofile[1] IS NULL AND f.customerprofile IS NULL))))
      AND (p_followupresult IS NULL OR (ARRAY_LENGTH(p_followupresult, 1) > 0 AND (f.followupresult = ANY(p_followupresult) OR (ARRAY_LENGTH(p_followupresult, 1) = 1 AND p_followupresult[1] IS NULL AND f.followupresult IS NULL))))
      AND (p_followupstage IS NULL OR (ARRAY_LENGTH(p_followupstage, 1) > 0 AND (f.followupstage = ANY(p_followupstage) OR (ARRAY_LENGTH(p_followupstage, 1) = 1 AND p_followupstage[1] IS NULL AND f.followupstage IS NULL))))
      AND (p_interviewsales_user_id IS NULL OR (ARRAY_LENGTH(p_interviewsales_user_id, 1) > 0 AND (f.interviewsales_user_id = ANY(p_interviewsales_user_id) OR (ARRAY_LENGTH(p_interviewsales_user_id, 1) = 1 AND p_interviewsales_user_id[1] IS NULL AND f.interviewsales_user_id IS NULL))))
      AND (p_leadid IS NULL OR (ARRAY_LENGTH(p_leadid, 1) > 0 AND f.leadid = ANY(p_leadid)))
      AND (p_leadtype IS NULL OR (ARRAY_LENGTH(p_leadtype, 1) > 0 AND (f.leadtype = ANY(p_leadtype) OR (ARRAY_LENGTH(p_leadtype, 1) = 1 AND p_leadtype[1] IS NULL AND f.leadtype IS NULL))))
      AND (p_majorcategory IS NULL OR (ARRAY_LENGTH(p_majorcategory, 1) > 0 AND (f.majorcategory = ANY(p_majorcategory) OR (ARRAY_LENGTH(p_majorcategory, 1) = 1 AND p_majorcategory[1] IS NULL AND f.majorcategory IS NULL))))
      AND (p_moveintime_end IS NULL OR f.moveintime <= p_moveintime_end)
      AND (p_moveintime_start IS NULL OR f.moveintime >= p_moveintime_start)
      AND (v_moveintime_not_null IS NULL OR (CASE WHEN v_moveintime_not_null THEN f.moveintime IS NOT NULL ELSE TRUE END))
      AND (p_remark IS NULL OR l.remark ILIKE '%' || p_remark || '%' OR (p_remark = '' AND (l.remark IS NULL OR l.remark = '')))
      AND (p_scheduledcommunity IS NULL OR (ARRAY_LENGTH(p_scheduledcommunity, 1) > 0 AND (f.scheduledcommunity = ANY(p_scheduledcommunity) OR (ARRAY_LENGTH(p_scheduledcommunity, 1) = 1 AND p_scheduledcommunity[1] IS NULL AND f.scheduledcommunity IS NULL))))
      AND (p_showingsales_user IS NULL OR (ARRAY_LENGTH(p_showingsales_user, 1) > 0 AND (s.showingsales = ANY(p_showingsales_user) OR (ARRAY_LENGTH(p_showingsales_user, 1) = 1 AND p_showingsales_user[1] IS NULL AND s.showingsales IS NULL))))
      AND (p_source IS NULL OR (ARRAY_LENGTH(p_source, 1) > 0 AND (l.source = ANY(p_source) OR (ARRAY_LENGTH(p_source, 1) = 1 AND p_source[1] IS NULL AND l.source IS NULL))))
      AND (p_userbudget IS NULL OR (ARRAY_LENGTH(p_userbudget, 1) > 0 AND (f.userbudget = ANY(p_userbudget) OR (ARRAY_LENGTH(p_userbudget, 1) = 1 AND p_userbudget[1] IS NULL AND f.userbudget IS NULL))))
      AND (p_userbudget_min IS NULL OR (CASE WHEN f.userbudget ~ '^[0-9]+$' THEN CAST(f.userbudget AS numeric) ELSE NULL END) >= p_userbudget_min)
      AND (p_userbudget_max IS NULL OR (CASE WHEN f.userbudget ~ '^[0-9]+$' THEN CAST(f.userbudget AS numeric) ELSE NULL END) <= p_userbudget_max)
      AND (p_userrating IS NULL OR (ARRAY_LENGTH(p_userrating, 1) > 0 AND (EXISTS(SELECT 1 FROM unnest(p_userrating) AS t(enum_value) WHERE t.enum_value::userrating = f.userrating) OR (ARRAY_LENGTH(p_userrating, 1) = 1 AND p_userrating[1] IS NULL AND f.userrating IS NULL))))
      AND (p_wechat IS NULL OR (ARRAY_LENGTH(p_wechat, 1) > 0 AND (l.wechat = ANY(p_wechat) OR (ARRAY_LENGTH(p_wechat, 1) = 1 AND p_wechat[1] IS NULL AND l.wechat IS NULL))))
      AND (p_worklocation IS NULL OR (ARRAY_LENGTH(p_worklocation, 1) > 0 AND (f.worklocation = ANY(p_worklocation) OR (ARRAY_LENGTH(p_worklocation, 1) = 1 AND p_worklocation[1] IS NULL AND f.worklocation IS NULL))))
      AND (p_phone IS NULL OR (ARRAY_LENGTH(p_phone, 1) > 0 AND (l.phone = ANY(p_phone) OR (ARRAY_LENGTH(p_phone, 1) = 1 AND p_phone[1] IS NULL AND l.phone IS NULL))))
      AND (p_qq IS NULL OR (ARRAY_LENGTH(p_qq, 1) > 0 AND (l.qq = ANY(p_qq) OR (ARRAY_LENGTH(p_qq, 1) = 1 AND p_qq[1] IS NULL AND l.qq IS NULL))))
      AND (p_location IS NULL OR (ARRAY_LENGTH(p_location, 1) > 0 AND (l.location = ANY(p_location) OR (ARRAY_LENGTH(p_location, 1) = 1 AND p_location[1] IS NULL AND l.location IS NULL))))
      AND (p_budget IS NULL OR (ARRAY_LENGTH(p_budget, 1) > 0 AND (l.budget = ANY(p_budget) OR (ARRAY_LENGTH(p_budget, 1) = 1 AND p_budget[1] IS NULL AND l.budget IS NULL))))
      AND (p_douyinid IS NULL OR (ARRAY_LENGTH(p_douyinid, 1) > 0 AND (l.douyinid = ANY(p_douyinid) OR (ARRAY_LENGTH(p_douyinid, 1) = 1 AND p_douyinid[1] IS NULL AND l.douyinid IS NULL))))
      AND (p_douyin_accountname IS NULL OR (ARRAY_LENGTH(p_douyin_accountname, 1) > 0 AND (l.douyin_accountname = ANY(p_douyin_accountname) OR (ARRAY_LENGTH(p_douyin_accountname, 1) = 1 AND p_douyin_accountname[1] IS NULL AND l.douyin_accountname IS NULL))))
      AND (p_staffname IS NULL OR (ARRAY_LENGTH(p_staffname, 1) > 0 AND (l.staffname = ANY(p_staffname) OR (ARRAY_LENGTH(p_staffname, 1) = 1 AND p_staffname[1] IS NULL AND l.staffname IS NULL))))
      AND (p_redbookid IS NULL OR (ARRAY_LENGTH(p_redbookid, 1) > 0 AND (l.redbookid = ANY(p_redbookid) OR (ARRAY_LENGTH(p_redbookid, 1) = 1 AND p_redbookid[1] IS NULL AND l.redbookid IS NULL))))
      AND (p_area IS NULL OR (ARRAY_LENGTH(p_area, 1) > 0 AND (l.area = ANY(p_area) OR (ARRAY_LENGTH(p_area, 1) = 1 AND p_area[1] IS NULL AND l.area IS NULL))))
      AND (p_notelink IS NULL OR (ARRAY_LENGTH(p_notelink, 1) > 0 AND (l.notelink = ANY(p_notelink) OR (ARRAY_LENGTH(p_notelink, 1) = 1 AND p_notelink[1] IS NULL AND l.notelink IS NULL))))
      AND (p_campaignid IS NULL OR (ARRAY_LENGTH(p_campaignid, 1) > 0 AND (l.campaignid = ANY(p_campaignid) OR (ARRAY_LENGTH(p_campaignid, 1) = 1 AND p_campaignid[1] IS NULL AND l.campaignid IS NULL))))
      AND (p_campaignname IS NULL OR (ARRAY_LENGTH(p_campaignname, 1) > 0 AND (l.campaignname = ANY(p_campaignname) OR (ARRAY_LENGTH(p_campaignname, 1) = 1 AND p_campaignname[1] IS NULL AND l.campaignname IS NULL))))
      AND (p_unitid IS NULL OR (ARRAY_LENGTH(p_unitid, 1) > 0 AND (l.unitid = ANY(p_unitid) OR (ARRAY_LENGTH(p_unitid, 1) = 1 AND p_unitid[1] IS NULL AND l.unitid IS NULL))))
      AND (p_unitname IS NULL OR (ARRAY_LENGTH(p_unitname, 1) > 0 AND (l.unitname = ANY(p_unitname) OR (ARRAY_LENGTH(p_unitname, 1) = 1 AND p_unitname[1] IS NULL AND l.unitname IS NULL))))
      AND (p_creativedid IS NULL OR (ARRAY_LENGTH(p_creativedid, 1) > 0 AND (l.creativedid = ANY(p_creativedid) OR (ARRAY_LENGTH(p_creativedid, 1) = 1 AND p_creativedid[1] IS NULL AND l.creativedid IS NULL))))
      AND (p_creativename IS NULL OR (ARRAY_LENGTH(p_creativename, 1) > 0 AND (l.creativename = ANY(p_creativename) OR (ARRAY_LENGTH(p_creativename, 1) = 1 AND p_creativename[1] IS NULL AND l.creativename IS NULL))))
      AND (p_traffictype IS NULL OR (ARRAY_LENGTH(p_traffictype, 1) > 0 AND (l.traffictype = ANY(p_traffictype) OR (ARRAY_LENGTH(p_traffictype, 1) = 1 AND p_traffictype[1] IS NULL AND l.traffictype IS NULL))))
      AND (p_interactiontype IS NULL OR (ARRAY_LENGTH(p_interactiontype, 1) > 0 AND (l.interactiontype = ANY(p_interactiontype) OR (ARRAY_LENGTH(p_interactiontype, 1) = 1 AND p_interactiontype[1] IS NULL AND l.interactiontype IS NULL))))
      AND (p_douyinleadid IS NULL OR (ARRAY_LENGTH(p_douyinleadid, 1) > 0 AND (l.douyinleadid = ANY(p_douyinleadid) OR (ARRAY_LENGTH(p_douyinleadid, 1) = 1 AND p_douyinleadid[1] IS NULL AND l.douyinleadid IS NULL))))
      AND (p_leadstatus IS NULL OR (ARRAY_LENGTH(p_leadstatus, 1) > 0 AND (l.leadstatus = ANY(p_leadstatus) OR (ARRAY_LENGTH(p_leadstatus, 1) = 1 AND p_leadstatus[1] IS NULL AND l.leadstatus IS NULL))))
      AND (p_keyword IS NULL OR (f.leadid::text ILIKE '%' || p_keyword || '%' OR f.leadtype ILIKE '%' || p_keyword || '%' OR up_interview.nickname ILIKE '%' || p_keyword || '%' OR s.showingsales_name ILIKE '%' || p_keyword || '%' OR f.worklocation ILIKE '%' || p_keyword || '%' OR f.userbudget ILIKE '%' || p_keyword || '%' OR f.majorcategory ILIKE '%' || p_keyword || '%' OR f.followupresult ILIKE '%' || p_keyword || '%' OR l.phone ILIKE '%' || p_keyword || '%' OR l.wechat ILIKE '%' || p_keyword || '%' OR f.extended_data::text ILIKE '%' || p_keyword || '%'))
    ORDER BY f.created_at DESC 
    LIMIT COALESCE(p_limit, 50)
    OFFSET COALESCE(p_offset, 0);
END;
$function$;
