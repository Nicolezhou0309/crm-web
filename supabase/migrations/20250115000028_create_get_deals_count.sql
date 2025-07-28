-- 创建get_deals_count函数，用于获取成交记录总数（支持分页）

CREATE OR REPLACE FUNCTION public.get_deals_count(
  p_id uuid[] DEFAULT NULL::uuid[],
  p_leadid text[] DEFAULT NULL::text[],
  p_contractdate_start date DEFAULT NULL::date,
  p_contractdate_end date DEFAULT NULL::date,
  p_community text[] DEFAULT NULL::text[],
  p_contractnumber text[] DEFAULT NULL::text[],
  p_roomnumber text[] DEFAULT NULL::text[],
  p_created_at_start timestamp with time zone DEFAULT NULL::timestamp with time zone,
  p_created_at_end timestamp with time zone DEFAULT NULL::timestamp with time zone,
  p_source text[] DEFAULT NULL::text[]
)
RETURNS integer
LANGUAGE plpgsql
AS $$
DECLARE
  count_result integer;
BEGIN
  SELECT COUNT(*)
  INTO count_result
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
    AND (d.invalid IS NULL OR d.invalid = false);
  
  RETURN count_result;
END;
$$;

COMMENT ON FUNCTION public.get_deals_count IS '获取成交记录总数，支持多字段筛选，用于分页'; 