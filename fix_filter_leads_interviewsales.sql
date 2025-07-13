-- 修复 filter_leads 函数，添加分配管家信息
-- 问题：线索列表页面分配管家字段无数据
-- 原因：filter_leads函数只查询leads表，没有关联followups表获取分配管家信息

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