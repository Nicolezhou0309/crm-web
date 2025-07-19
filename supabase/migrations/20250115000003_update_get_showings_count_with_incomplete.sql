-- 先删除旧的 get_showings_count 函数
DROP FUNCTION IF EXISTS public.get_showings_count(
  text, text[], bigint[], bigint[], bigint[], text[], integer, integer, integer, integer,
  timestamp with time zone, timestamp with time zone, timestamp with time zone, timestamp with time zone,
  timestamp with time zone, timestamp with time zone, timestamp with time zone, timestamp with time zone
);

-- 创建支持"未填写工单"筛选的新 get_showings_count 函数
CREATE OR REPLACE FUNCTION public.get_showings_count(
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
  p_incomplete boolean DEFAULT false   -- 新增参数
)
RETURNS integer
LANGUAGE plpgsql
AS $function$
DECLARE
  count_result integer;
BEGIN
  SELECT COUNT(*)
  INTO count_result
  FROM showings s
  LEFT JOIN followups f ON s.leadid = f.leadid
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
    -- 新增未填写工单筛选
    AND (NOT p_incomplete OR s.viewresult IS NULL OR s.viewresult = '');
  
  RETURN count_result;
END;
$function$; 