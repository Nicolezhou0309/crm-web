-- 跟进记录多条件过滤查询函数
-- 可直接在PostgreSQL数据库中执行
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
                           f.followupresult ILIKE ''%'' || $42 || ''%''))';
    
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

-- 使用示例：
-- SELECT * FROM filter_followups(
--   p_limit := 10,
--   p_offset := 0,
--   p_keyword := '租房',
--   p_leadtype := ARRAY['租房', '买房'],
--   p_followupstage := ARRAY['待接收', '跟进中']
-- ); 