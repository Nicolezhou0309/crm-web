-- 修正filter_deals函数，面试销售姓名字段改为users_profile.nickname

DROP FUNCTION IF EXISTS public.filter_deals(
  uuid[], text[], date, date, text[], text[], text[], text[], timestamp with time zone, timestamp with time zone, text[], text, boolean, integer, integer
);

CREATE OR REPLACE FUNCTION public.filter_deals(
  p_id uuid[] DEFAULT NULL::uuid[],
  p_leadid text[] DEFAULT NULL::text[],
  p_contractdate_start date DEFAULT NULL::date,
  p_contractdate_end date DEFAULT NULL::date,
  p_community text[] DEFAULT NULL::text[],
  p_contractnumber text[] DEFAULT NULL::text[],
  p_roomnumber text[] DEFAULT NULL::text[],
  p_created_at_start timestamp with time zone DEFAULT NULL::timestamp with time zone,
  p_created_at_end timestamp with time zone DEFAULT NULL::timestamp with time zone,
  p_source text[] DEFAULT NULL::text[],
  p_order_by text DEFAULT 'created_at'::text,
  p_ascending boolean DEFAULT false,
  p_limit integer DEFAULT 10,
  p_offset integer DEFAULT 0
)
RETURNS TABLE(
  id uuid,
  leadid text,
  contractdate date,
  community community,
  contractnumber text,
  roomnumber text,
  created_at timestamp with time zone,
  source source,
  lead_phone text,
  lead_wechat text,
  lead_source text,
  invalid boolean,
  interviewsales text,
  channel text
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT
    d.id,
    d.leadid,
    d.contractdate,
    d.community,
    d.contractnumber,
    d.roomnumber,
    d.created_at,
    l.source,
    l.phone as lead_phone,
    l.wechat as lead_wechat,
    l.source as lead_source,
    d.invalid,
    u.nickname as interviewsales,
    l.source as channel
  FROM deals d
  LEFT JOIN leads l ON d.leadid = l.leadid
  LEFT JOIN followups f ON d.leadid = f.leadid
  LEFT JOIN users_profile u ON f.interviewsales_user_id = u.id
  WHERE
    (p_id IS NULL OR d.id = ANY(p_id))
    AND (p_leadid IS NULL OR d.leadid = ANY(p_leadid))
    AND (p_contractdate_start IS NULL OR d.contractdate >= p_contractdate_start)
    AND (p_contractdate_end IS NULL OR d.contractdate <= p_contractdate_end)
    AND (p_community IS NULL OR d.community = ANY(ARRAY(SELECT unnest(p_community)::community)))
    AND (p_contractnumber IS NULL OR d.contractnumber = ANY(p_contractnumber))
    AND (p_roomnumber IS NULL OR d.roomnumber = ANY(p_roomnumber))
    AND (p_created_at_start IS NULL OR d.created_at >= p_created_at_start)
    AND (p_created_at_end IS NULL OR d.created_at <= p_created_at_end)
    AND (p_source IS NULL OR l.source = ANY(ARRAY(SELECT unnest(p_source)::source)))
    AND (d.invalid IS NULL OR d.invalid = false)
  ORDER BY 
    CASE WHEN p_ascending THEN 
      CASE p_order_by
        WHEN 'leadid' THEN d.leadid
        WHEN 'contractdate' THEN d.contractdate::TEXT
        WHEN 'community' THEN d.community::TEXT
        WHEN 'contractnumber' THEN d.contractnumber
        WHEN 'roomnumber' THEN d.roomnumber
        WHEN 'created_at' THEN d.created_at::TEXT
        WHEN 'lead_phone' THEN l.phone
        WHEN 'lead_wechat' THEN l.wechat
        WHEN 'lead_source' THEN l.source::TEXT
        WHEN 'interviewsales' THEN u.nickname
        WHEN 'channel' THEN l.source::TEXT
        ELSE d.created_at::TEXT
      END
    END ASC,
    CASE WHEN NOT p_ascending THEN 
      CASE p_order_by
        WHEN 'leadid' THEN d.leadid
        WHEN 'contractdate' THEN d.contractdate::TEXT
        WHEN 'community' THEN d.community::TEXT
        WHEN 'contractnumber' THEN d.contractnumber
        WHEN 'roomnumber' THEN d.roomnumber
        WHEN 'created_at' THEN d.created_at::TEXT
        WHEN 'lead_phone' THEN l.phone
        WHEN 'lead_wechat' THEN l.wechat
        WHEN 'lead_source' THEN l.source::TEXT
        WHEN 'interviewsales' THEN u.nickname
        WHEN 'channel' THEN l.source::TEXT
        ELSE d.created_at::TEXT
      END
    END DESC
  LIMIT p_limit OFFSET p_offset;
END;
$$; 