-- 更新 filter_showings 函数，添加 invalid 字段
DROP FUNCTION IF EXISTS public.filter_showings(
  text, text[], bigint[], bigint[], bigint[], text[], integer, integer, integer, integer,
  timestamp with time zone, timestamp with time zone, timestamp with time zone, timestamp with time zone,
  timestamp with time zone, timestamp with time zone, timestamp with time zone, timestamp with time zone,
  text, boolean, integer, integer, boolean
);

CREATE OR REPLACE FUNCTION public.filter_showings(
  p_leadid text DEFAULT NULL::text,
  p_community text[] DEFAULT NULL::text[],
  p_showingsales bigint[] DEFAULT NULL::bigint[],
  p_trueshowingsales bigint[] DEFAULT NULL::bigint[],
  p_interviewsales bigint[] DEFAULT NULL::bigint[],
  p_viewresult text[] DEFAULT NULL::text[],
  p_budget_min integer DEFAULT NULL::integer,
  p_budget_max integer DEFAULT NULL::integer,
  p_renttime_min integer DEFAULT NULL::integer,
  p_renttime_max integer DEFAULT NULL::integer,
  p_scheduletime_start timestamp with time zone DEFAULT NULL::timestamp with time zone,
  p_scheduletime_end timestamp with time zone DEFAULT NULL::timestamp with time zone,
  p_arrivaltime_start timestamp with time zone DEFAULT NULL::timestamp with time zone,
  p_arrivaltime_end timestamp with time zone DEFAULT NULL::timestamp with time zone,
  p_moveintime_start timestamp with time zone DEFAULT NULL::timestamp with time zone,
  p_moveintime_end timestamp with time zone DEFAULT NULL::timestamp with time zone,
  p_created_at_start timestamp with time zone DEFAULT NULL::timestamp with time zone,
  p_created_at_end timestamp with time zone DEFAULT NULL::timestamp with time zone,
  p_order_by text DEFAULT 'created_at'::text,
  p_ascending boolean DEFAULT false,
  p_limit integer DEFAULT 10,
  p_offset integer DEFAULT 0,
  p_incomplete boolean DEFAULT false
)
RETURNS TABLE(
  id uuid,
  leadid text,
  scheduletime timestamp with time zone,
  community text,
  arrivaltime timestamp with time zone,
  showingsales bigint,
  trueshowingsales bigint,
  viewresult text,
  budget integer,
  moveintime timestamp with time zone,
  remark text,
  renttime integer,
  created_at timestamp with time zone,
  updated_at timestamp with time zone,
  invalid boolean,
  showingsales_nickname text,
  trueshowingsales_nickname text,
  interviewsales_nickname text,
  interviewsales_user_id bigint,
  lead_phone text,
  lead_wechat text,
  lead_source text,
  lead_status text,
  lead_type text
)
LANGUAGE plpgsql
AS $function$
BEGIN
  RETURN QUERY
  SELECT 
    s.id,
    s.leadid,
    s.scheduletime,
    s.community::TEXT,
    s.arrivaltime,
    s.showingsales,
    s.trueshowingsales,
    s.viewresult,
    s.budget,
    s.moveintime,
    s.remark,
    s.renttime,
    s.created_at,
    s.updated_at,
    COALESCE(s.invalid, false) as invalid,
    COALESCE(sp.nickname::TEXT, '') as showingsales_nickname,
    COALESCE(tsp.nickname::TEXT, '') as trueshowingsales_nickname,
    COALESCE(isp.nickname::TEXT, '') as interviewsales_nickname,
    f.interviewsales_user_id as interviewsales_user_id,
    COALESCE(l.phone::TEXT, '') as lead_phone,
    COALESCE(l.wechat::TEXT, '') as lead_wechat,
    COALESCE(l.source::TEXT, '') as lead_source,
    COALESCE(l.leadstatus::TEXT, '') as lead_status,
    COALESCE(l.leadtype::TEXT, '') as lead_type
  FROM showings s
  LEFT JOIN users_profile sp ON s.showingsales = sp.id
  LEFT JOIN users_profile tsp ON s.trueshowingsales = tsp.id
  LEFT JOIN followups f ON s.leadid = f.leadid
  LEFT JOIN users_profile isp ON f.interviewsales_user_id = isp.id
  LEFT JOIN leads l ON s.leadid = l.leadid
  WHERE 
    (p_leadid IS NULL OR s.leadid = p_leadid)
    AND (p_community IS NULL OR s.community::TEXT = ANY(p_community))
    AND (p_showingsales IS NULL OR s.showingsales = ANY(p_showingsales))
    AND (p_trueshowingsales IS NULL OR s.trueshowingsales = ANY(p_trueshowingsales))
    AND (p_interviewsales IS NULL OR f.interviewsales_user_id = ANY(p_interviewsales))
    AND (p_viewresult IS NULL OR s.viewresult = ANY(p_viewresult))
    AND (p_budget_min IS NULL OR s.budget >= p_budget_min)
    AND (p_budget_max IS NULL OR s.budget <= p_budget_max)
    AND (p_renttime_min IS NULL OR s.renttime >= p_renttime_min)
    AND (p_renttime_max IS NULL OR s.renttime <= p_renttime_max)
    AND (p_scheduletime_start IS NULL OR s.scheduletime >= p_scheduletime_start)
    AND (p_scheduletime_end IS NULL OR s.scheduletime <= p_scheduletime_end)
    AND (p_arrivaltime_start IS NULL OR s.arrivaltime >= p_arrivaltime_start)
    AND (p_arrivaltime_end IS NULL OR s.arrivaltime <= p_arrivaltime_end)
    AND (p_moveintime_start IS NULL OR s.moveintime >= p_moveintime_start)
    AND (p_moveintime_end IS NULL OR s.moveintime <= p_moveintime_end)
    AND (p_created_at_start IS NULL OR s.created_at >= p_created_at_start)
    AND (p_created_at_end IS NULL OR s.created_at <= p_created_at_end)
    AND (
      NOT p_incomplete OR 
      (s.viewresult IS NULL OR s.viewresult = '')
    )
  ORDER BY 
    CASE WHEN p_ascending THEN 
      CASE p_order_by
        WHEN 'leadid' THEN s.leadid
        WHEN 'community' THEN s.community::TEXT
        WHEN 'scheduletime' THEN s.scheduletime::TEXT
        WHEN 'arrivaltime' THEN s.arrivaltime::TEXT
        WHEN 'viewresult' THEN s.viewresult
        WHEN 'budget' THEN s.budget::TEXT
        WHEN 'moveintime' THEN s.moveintime::TEXT
        WHEN 'renttime' THEN s.renttime::TEXT
        WHEN 'created_at' THEN s.created_at::TEXT
        WHEN 'updated_at' THEN s.updated_at::TEXT
        ELSE s.created_at::TEXT
      END
    END ASC,
    CASE WHEN NOT p_ascending THEN 
      CASE p_order_by
        WHEN 'leadid' THEN s.leadid
        WHEN 'community' THEN s.community::TEXT
        WHEN 'scheduletime' THEN s.scheduletime::TEXT
        WHEN 'arrivaltime' THEN s.arrivaltime::TEXT
        WHEN 'viewresult' THEN s.viewresult
        WHEN 'budget' THEN s.budget::TEXT
        WHEN 'moveintime' THEN s.moveintime::TEXT
        WHEN 'renttime' THEN s.renttime::TEXT
        WHEN 'created_at' THEN s.created_at::TEXT
        WHEN 'updated_at' THEN s.updated_at::TEXT
        ELSE s.created_at::TEXT
      END
    END DESC
  LIMIT p_limit OFFSET p_offset;
END;
$function$;
