-- =============================================
-- filter_all_analysis 函数备份
-- 创建时间: 2025年1月15日
-- 说明: 四表联合分析函数，以followups为主表
-- =============================================

-- 删除原函数（如果存在）
DROP FUNCTION IF EXISTS public.filter_all_analysis(
  text, text, text, date, date, integer, integer
);

-- 创建四表联合分析函数
CREATE OR REPLACE FUNCTION public.filter_all_analysis(
  p_leadid text DEFAULT NULL,
  p_phone text DEFAULT NULL,
  p_community text DEFAULT NULL,
  p_contractdate_start date DEFAULT NULL,
  p_contractdate_end date DEFAULT NULL,
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
  showing_budget text,
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
    (p_leadid IS NULL OR f.leadid = p_leadid)
    AND (p_phone IS NULL OR l.phone = p_phone)
    AND (p_community IS NULL OR s.community::text = p_community OR d.community::text = p_community)
    AND (p_contractdate_start IS NULL OR d.contractdate >= p_contractdate_start)
    AND (p_contractdate_end IS NULL OR d.contractdate <= p_contractdate_end)
  ORDER BY f.created_at DESC
  LIMIT p_limit OFFSET p_offset;
END;
$$ LANGUAGE plpgsql;

-- 添加函数注释
COMMENT ON FUNCTION public.filter_all_analysis IS '四表联合分析函数，以followups为主表，支持透视表分析';

-- =============================================
-- 测试查询示例
-- =============================================

-- 测试1: 查询所有数据（限制10条）
-- SELECT * FROM filter_all_analysis() LIMIT 10;

-- 测试2: 按线索ID查询
-- SELECT * FROM filter_all_analysis('25J00001') LIMIT 5;

-- 测试3: 按社区查询
-- SELECT * FROM filter_all_analysis(NULL, NULL, '浦江') LIMIT 5;

-- 测试4: 按签约日期范围查询
-- SELECT * FROM filter_all_analysis(NULL, NULL, NULL, '2024-01-01', '2024-12-31') LIMIT 5;

-- =============================================
-- 字段说明
-- =============================================

/*
主要字段分类：

1. Followups表字段（主表）：
   - followup_id, leadid, followupstage, customerprofile
   - worklocation, userbudget, moveintime, userrating
   - majorcategory, followupresult, scheduledcommunity
   - interviewsales_user_id, interviewsales_user_name
   - followup_created_at

2. Leads表字段（通过leadid关联）：
   - phone, wechat, qq, location, budget, remark
   - source, staffname, area, leadtype, leadstatus
   - lead_created_at

3. Showings表字段（最新一条）：
   - showing_id, showing_community, viewresult, arrivaltime
   - showingsales_user_name, trueshowingsales_nickname
   - showing_budget, showing_moveintime, showing_remark
   - renttime, showing_scheduletime, showing_created_at

4. Deals表字段（最新一条）：
   - deal_id, contractdate, deal_community, contractnumber
   - roomnumber, deal_created_at

注意事项：
- 所有enum类型字段都转换为text类型
- showings和deals只取每个leadid的最新一条记录
- 字段名都有明确的前缀，避免冲突
*/ 