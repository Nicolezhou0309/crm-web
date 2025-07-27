-- =============================================
-- 修复联合分析函数的类型不匹配问题
-- 修复时间: 2025年1月15日
-- 目的: 修复 showing_budget 字段的类型不匹配问题
-- =============================================

-- 先删除现有函数
DROP FUNCTION IF EXISTS public.filter_all_analysis_multi(text[], text[], text[], text[], text[], text[], text[], text[], bigint[], bigint[], integer, integer, timestamp with time zone, timestamp with time zone, timestamp with time zone, timestamp with time zone, date, date, text[], text[], text[], integer, integer);

-- 重新创建联合分析函数，修复类型不匹配问题
CREATE OR REPLACE FUNCTION public.filter_all_analysis_multi(
  p_leadid text[] DEFAULT NULL,
  p_phone text[] DEFAULT NULL,
  p_wechat text[] DEFAULT NULL,
  p_source text[] DEFAULT NULL,
  p_leadtype text[] DEFAULT NULL,
  p_leadstatus text[] DEFAULT NULL,
  p_community text[] DEFAULT NULL,
  p_viewresult text[] DEFAULT NULL,
  p_showingsales bigint[] DEFAULT NULL,
  p_trueshowingsales bigint[] DEFAULT NULL,
  p_budget_min integer DEFAULT NULL,
  p_budget_max integer DEFAULT NULL,
  p_scheduletime_start timestamp with time zone DEFAULT NULL,
  p_scheduletime_end timestamp with time zone DEFAULT NULL,
  p_arrivaltime_start timestamp with time zone DEFAULT NULL,
  p_arrivaltime_end timestamp with time zone DEFAULT NULL,
  p_contractdate_start date DEFAULT NULL,
  p_contractdate_end date DEFAULT NULL,
  p_contractnumber text[] DEFAULT NULL,
  p_roomnumber text[] DEFAULT NULL,
  p_deal_community text[] DEFAULT NULL,
  p_limit integer DEFAULT 1000,
  p_offset integer DEFAULT 0
)
RETURNS TABLE (
  -- Followups（主表）
  followup_id uuid,
  leadid text,
  followupstage text,
  customerprofile text,
  worklocation text,
  userbudget text,
  moveintime timestamp with time zone,
  userrating text,
  majorcategory text,
  followupresult text,
  scheduledcommunity text,
  interviewsales_user_id bigint,
  interviewsales_user_name text,
  followup_created_at timestamp with time zone,
  -- Leads（通过 followups.leadid 关联）
  phone text,
  wechat text,
  qq text,
  location text,
  budget text,
  remark text,
  source text,
  staffname text,
  area text,
  leadtype text,
  leadstatus text,
  lead_created_at timestamp with time zone,
  -- Showings（通过 followups.leadid 关联，只取最新一条）
  showing_id uuid,
  showing_community text,
  viewresult text,
  arrivaltime timestamp with time zone,
  showingsales_user_name text,
  trueshowingsales_nickname text,
  showing_budget integer,
  showing_moveintime timestamp with time zone,
  showing_remark text,
  renttime text,
  showing_scheduletime timestamp with time zone,
  showing_created_at timestamp with time zone,
  -- Deals（通过 followups.leadid 关联，只取最新一条）
  deal_id uuid,
  contractdate date,
  deal_community text,
  contractnumber text,
  roomnumber text,
  deal_created_at timestamp with time zone
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    -- Followups（主表）
    f.id as followup_id,
    f.leadid,
    f.followupstage::text,
    f.customerprofile::text,
    f.worklocation,
    f.userbudget,
    f.moveintime,
    f.userrating::text,
    f.majorcategory,
    f.followupresult,
    f.scheduledcommunity::text,
    f.interviewsales_user_id,
    up_interview.nickname as interviewsales_user_name,
    f.created_at as followup_created_at,
    -- Leads（通过 followups.leadid 关联）
    l.phone,
    l.wechat,
    l.qq,
    l.location,
    l.budget,
    l.remark,
    l.source::text,
    l.staffname,
    l.area,
    l.leadtype,
    l.leadstatus,
    l.created_at as lead_created_at,
    -- Showings（通过 followups.leadid 关联，只取最新一条）
    s.id as showing_id,
    s.community::text as showing_community,
    s.viewresult,
    s.arrivaltime,
    up_showing.nickname as showingsales_user_name,
    up_trueshowing.nickname as trueshowingsales_nickname,
    s.budget as showing_budget,
    s.moveintime as showing_moveintime,
    s.remark as showing_remark,
    s.renttime,
    s.scheduletime as showing_scheduletime,
    s.created_at as showing_created_at,
    -- Deals（通过 followups.leadid 关联，只取最新一条）
    d.id as deal_id,
    d.contractdate,
    d.community::text as deal_community,
    d.contractnumber,
    d.roomnumber,
    d.created_at as deal_created_at
  FROM followups f
  -- 关联 leads 表（通过 followups.leadid）
  LEFT JOIN leads l ON f.leadid = l.leadid
  -- 关联约访销售信息
  LEFT JOIN users_profile up_interview ON f.interviewsales_user_id = up_interview.id
  -- 关联 showings 表（只取最新一条）
  LEFT JOIN LATERAL (
    SELECT s.*
    FROM showings s
    WHERE s.leadid = f.leadid
    ORDER BY s.created_at DESC
    LIMIT 1
  ) s ON TRUE
  LEFT JOIN users_profile up_showing ON s.showingsales = up_showing.id
  LEFT JOIN users_profile up_trueshowing ON s.trueshowingsales = up_trueshowing.id
  -- 关联 deals 表（只取最新一条）
  LEFT JOIN LATERAL (
    SELECT d.*
    FROM deals d
    WHERE d.leadid = f.leadid
    ORDER BY d.created_at DESC
    LIMIT 1
  ) d ON TRUE
  WHERE
    -- 多选支持：leadid数组匹配
    (p_leadid IS NULL OR f.leadid = ANY(p_leadid))
    -- 多选支持：phone数组匹配
    AND (p_phone IS NULL OR l.phone = ANY(p_phone))
    -- 多选支持：wechat数组匹配
    AND (p_wechat IS NULL OR l.wechat = ANY(p_wechat))
    -- 多选支持：source数组匹配
    AND (p_source IS NULL OR l.source::text = ANY(p_source))
    -- 多选支持：leadtype数组匹配
    AND (p_leadtype IS NULL OR l.leadtype = ANY(p_leadtype))
    -- 多选支持：leadstatus数组匹配
    AND (p_leadstatus IS NULL OR l.leadstatus = ANY(p_leadstatus))
    -- 多选支持：community数组匹配（同时匹配showings和deals的community）
    AND (p_community IS NULL OR 
         s.community::text = ANY(p_community) OR 
         d.community::text = ANY(p_community))
    -- 多选支持：viewresult数组匹配
    AND (p_viewresult IS NULL OR s.viewresult = ANY(p_viewresult))
    -- 多选支持：showingsales数组匹配
    AND (p_showingsales IS NULL OR s.showingsales = ANY(p_showingsales))
    -- 多选支持：trueshowingsales数组匹配
    AND (p_trueshowingsales IS NULL OR s.trueshowingsales = ANY(p_trueshowingsales))
    -- 预算范围筛选
    AND (p_budget_min IS NULL OR s.budget >= p_budget_min)
    AND (p_budget_max IS NULL OR s.budget <= p_budget_max)
    -- 预约时间范围筛选
    AND (p_scheduletime_start IS NULL OR s.scheduletime >= p_scheduletime_start)
    AND (p_scheduletime_end IS NULL OR s.scheduletime <= p_scheduletime_end)
    -- 到达时间范围筛选
    AND (p_arrivaltime_start IS NULL OR s.arrivaltime >= p_arrivaltime_start)
    AND (p_arrivaltime_end IS NULL OR s.arrivaltime <= p_arrivaltime_end)
    -- 成交日期范围保持不变
    AND (p_contractdate_start IS NULL OR d.contractdate >= p_contractdate_start)
    AND (p_contractdate_end IS NULL OR d.contractdate <= p_contractdate_end)
    -- 多选支持：contractnumber数组匹配
    AND (p_contractnumber IS NULL OR d.contractnumber = ANY(p_contractnumber))
    -- 多选支持：roomnumber数组匹配
    AND (p_roomnumber IS NULL OR d.roomnumber = ANY(p_roomnumber))
    -- 多选支持：deal_community数组匹配（专门针对deals的社区筛选）
    AND (p_deal_community IS NULL OR d.community::text = ANY(p_deal_community))
    -- 过滤无效记录：只返回有效记录（invalid IS NULL OR invalid = false）
    AND (f.invalid IS NULL OR f.invalid = false)
    AND (s.invalid IS NULL OR s.invalid = false)
    AND (d.invalid IS NULL OR d.invalid = false)
  ORDER BY f.created_at DESC
  LIMIT p_limit OFFSET p_offset;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION public.filter_all_analysis_multi IS '支持多选的四表联合分析函数，以followups为主表，支持透视表分析，自动过滤无效记录 - 修复类型不匹配版本'; 