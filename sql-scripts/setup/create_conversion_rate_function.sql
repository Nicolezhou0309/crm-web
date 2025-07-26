-- 删除现有函数（如果存在）
DROP FUNCTION IF EXISTS public.get_conversion_rate_stats(timestamp with time zone, timestamp with time zone, timestamp with time zone, timestamp with time zone);
DROP FUNCTION IF EXISTS public.get_conversion_rate_stats_with_actual_sales(timestamp with time zone, timestamp with time zone, timestamp with time zone, timestamp with time zone);

-- 创建带看转化率统计函数
CREATE OR REPLACE FUNCTION public.get_conversion_rate_stats(
  p_date_start timestamp with time zone DEFAULT NULL,
  p_date_end timestamp with time zone DEFAULT NULL,
  p_previous_date_start timestamp with time zone DEFAULT NULL,
  p_previous_date_end timestamp with time zone DEFAULT NULL
)
RETURNS TABLE(
  sales_id integer,
  sales_name text,
  showings_count integer,
  direct_deal_count integer,
  reserved_count integer,
  intention_count integer,
  considering_count integer,
  lost_count integer,
  unfilled_count integer,
  direct_rate numeric(5,2),
  conversion_rate numeric(5,2),
  previous_showings_count integer,
  previous_direct_deal_count integer,
  previous_reserved_count integer,
  previous_intention_count integer,
  previous_considering_count integer,
  previous_lost_count integer,
  previous_unfilled_count integer,
  previous_direct_rate numeric(5,2),
  previous_conversion_rate numeric(5,2)
)
LANGUAGE plpgsql
AS $function$
BEGIN
  RETURN QUERY
  WITH current_period_stats AS (
    SELECT 
      s.showingsales::integer as sales_id,
      up.nickname as sales_name,
      COUNT(*)::integer as showings_count,
      COUNT(CASE WHEN s.viewresult = '直签' THEN 1 END)::integer as direct_deal_count,
      COUNT(CASE WHEN s.viewresult = '预定' THEN 1 END)::integer as reserved_count,
      COUNT(CASE WHEN s.viewresult = '意向金' THEN 1 END)::integer as intention_count,
      COUNT(CASE WHEN s.viewresult = '考虑中' THEN 1 END)::integer as considering_count,
      COUNT(CASE WHEN s.viewresult = '已流失' THEN 1 END)::integer as lost_count,
      COUNT(CASE WHEN s.viewresult IS NULL OR s.viewresult = '' THEN 1 END)::integer as unfilled_count
    FROM showings s
    LEFT JOIN users_profile up ON s.showingsales = up.id
    WHERE s.showingsales IS NOT NULL
      AND (p_date_start IS NULL OR s.created_at >= p_date_start)
      AND (p_date_end IS NULL OR s.created_at <= p_date_end)
    GROUP BY s.showingsales, up.nickname
  ),
  previous_period_stats AS (
    SELECT 
      s.showingsales::integer as sales_id,
      up.nickname as sales_name,
      COUNT(*)::integer as showings_count,
      COUNT(CASE WHEN s.viewresult = '直签' THEN 1 END)::integer as direct_deal_count,
      COUNT(CASE WHEN s.viewresult = '预定' THEN 1 END)::integer as reserved_count,
      COUNT(CASE WHEN s.viewresult = '意向金' THEN 1 END)::integer as intention_count,
      COUNT(CASE WHEN s.viewresult = '考虑中' THEN 1 END)::integer as considering_count,
      COUNT(CASE WHEN s.viewresult = '已流失' THEN 1 END)::integer as lost_count,
      COUNT(CASE WHEN s.viewresult IS NULL OR s.viewresult = '' THEN 1 END)::integer as unfilled_count
    FROM showings s
    LEFT JOIN users_profile up ON s.showingsales = up.id
    WHERE s.showingsales IS NOT NULL
      AND (p_previous_date_start IS NULL OR s.created_at >= p_previous_date_start)
      AND (p_previous_date_end IS NULL OR s.created_at <= p_previous_date_end)
    GROUP BY s.showingsales, up.nickname
  )
  SELECT 
    c.sales_id,
    c.sales_name,
    c.showings_count,
    c.direct_deal_count,
    c.reserved_count,
    c.intention_count,
    c.considering_count,
    c.lost_count,
    c.unfilled_count,
    CASE 
      WHEN c.showings_count > 0 THEN 
        ROUND((c.direct_deal_count::numeric / c.showings_count::numeric) * 100, 2)
      ELSE 0 
    END as direct_rate,
    CASE 
      WHEN c.showings_count > 0 THEN 
        ROUND(((c.direct_deal_count + c.reserved_count)::numeric / c.showings_count::numeric) * 100, 2)
      ELSE 0 
    END as conversion_rate,
    COALESCE(p.showings_count, 0) as previous_showings_count,
    COALESCE(p.direct_deal_count, 0) as previous_direct_deal_count,
    COALESCE(p.reserved_count, 0) as previous_reserved_count,
    COALESCE(p.intention_count, 0) as previous_intention_count,
    COALESCE(p.considering_count, 0) as previous_considering_count,
    COALESCE(p.lost_count, 0) as previous_lost_count,
    COALESCE(p.unfilled_count, 0) as previous_unfilled_count,
    CASE 
      WHEN p.showings_count > 0 THEN 
        ROUND((p.direct_deal_count::numeric / p.showings_count::numeric) * 100, 2)
      ELSE 0 
    END as previous_direct_rate,
    CASE 
      WHEN p.showings_count > 0 THEN 
        ROUND(((p.direct_deal_count + p.reserved_count)::numeric / p.showings_count::numeric) * 100, 2)
      ELSE 0 
    END as previous_conversion_rate
  FROM current_period_stats c
  LEFT JOIN previous_period_stats p ON c.sales_id = p.sales_id
  ORDER BY c.showings_count DESC;
END;
$function$;

-- 创建带看转化率统计函数（包含实际销售分组）
CREATE OR REPLACE FUNCTION public.get_conversion_rate_stats_with_actual_sales(
  p_date_start timestamp with time zone DEFAULT NULL,
  p_date_end timestamp with time zone DEFAULT NULL,
  p_previous_date_start timestamp with time zone DEFAULT NULL,
  p_previous_date_end timestamp with time zone DEFAULT NULL
)
RETURNS TABLE(
  sales_id integer,
  sales_name text,
  actual_sales_id integer,
  actual_sales_name text,
  showings_count integer,
  direct_deal_count integer,
  reserved_count integer,
  intention_count integer,
  considering_count integer,
  lost_count integer,
  unfilled_count integer,
  direct_rate numeric(5,2),
  conversion_rate numeric(5,2),
  is_actual_sales boolean,
  previous_showings_count integer,
  previous_direct_deal_count integer,
  previous_reserved_count integer,
  previous_intention_count integer,
  previous_considering_count integer,
  previous_lost_count integer,
  previous_unfilled_count integer,
  previous_direct_rate numeric(5,2),
  previous_conversion_rate numeric(5,2)
)
LANGUAGE plpgsql
AS $function$
BEGIN
  RETURN QUERY
  WITH current_period_stats AS (
    SELECT 
      s.showingsales::integer as sales_id,
      up_showings.nickname as sales_name,
      s.trueshowingsales::integer as actual_sales_id,
      up_actual.nickname as actual_sales_name,
      COUNT(*)::integer as showings_count,
      COUNT(CASE WHEN s.viewresult = '直签' THEN 1 END)::integer as direct_deal_count,
      COUNT(CASE WHEN s.viewresult = '预定' THEN 1 END)::integer as reserved_count,
      COUNT(CASE WHEN s.viewresult = '意向金' THEN 1 END)::integer as intention_count,
      COUNT(CASE WHEN s.viewresult = '考虑中' THEN 1 END)::integer as considering_count,
      COUNT(CASE WHEN s.viewresult = '已流失' THEN 1 END)::integer as lost_count,
      COUNT(CASE WHEN s.viewresult IS NULL OR s.viewresult = '' THEN 1 END)::integer as unfilled_count
    FROM showings s
    LEFT JOIN users_profile up_showings ON s.showingsales = up_showings.id
    LEFT JOIN users_profile up_actual ON s.trueshowingsales = up_actual.id
    WHERE s.showingsales IS NOT NULL
      AND (p_date_start IS NULL OR s.created_at >= p_date_start)
      AND (p_date_end IS NULL OR s.created_at <= p_date_end)
    GROUP BY s.showingsales, up_showings.nickname, s.trueshowingsales, up_actual.nickname
  ),
  previous_period_stats AS (
    SELECT 
      s.showingsales::integer as sales_id,
      up_showings.nickname as sales_name,
      s.trueshowingsales::integer as actual_sales_id,
      up_actual.nickname as actual_sales_name,
      COUNT(*)::integer as showings_count,
      COUNT(CASE WHEN s.viewresult = '直签' THEN 1 END)::integer as direct_deal_count,
      COUNT(CASE WHEN s.viewresult = '预定' THEN 1 END)::integer as reserved_count,
      COUNT(CASE WHEN s.viewresult = '意向金' THEN 1 END)::integer as intention_count,
      COUNT(CASE WHEN s.viewresult = '考虑中' THEN 1 END)::integer as considering_count,
      COUNT(CASE WHEN s.viewresult = '已流失' THEN 1 END)::integer as lost_count,
      COUNT(CASE WHEN s.viewresult IS NULL OR s.viewresult = '' THEN 1 END)::integer as unfilled_count
    FROM showings s
    LEFT JOIN users_profile up_showings ON s.showingsales = up_showings.id
    LEFT JOIN users_profile up_actual ON s.trueshowingsales = up_actual.id
    WHERE s.showingsales IS NOT NULL
      AND (p_previous_date_start IS NULL OR s.created_at >= p_previous_date_start)
      AND (p_previous_date_end IS NULL OR s.created_at <= p_previous_date_end)
    GROUP BY s.showingsales, up_showings.nickname, s.trueshowingsales, up_actual.nickname
  )
  SELECT 
    c.sales_id,
    c.sales_name,
    c.actual_sales_id,
    c.actual_sales_name,
    c.showings_count,
    c.direct_deal_count,
    c.reserved_count,
    c.intention_count,
    c.considering_count,
    c.lost_count,
    c.unfilled_count,
    CASE 
      WHEN c.showings_count > 0 THEN 
        ROUND((c.direct_deal_count::numeric / c.showings_count::numeric) * 100, 2)
      ELSE 0 
    END as direct_rate,
    CASE 
      WHEN c.showings_count > 0 THEN 
        ROUND(((c.direct_deal_count + c.reserved_count)::numeric / c.showings_count::numeric) * 100, 2)
      ELSE 0 
    END as conversion_rate,
    (c.actual_sales_id IS NOT NULL) as is_actual_sales,
    COALESCE(p.showings_count, 0) as previous_showings_count,
    COALESCE(p.direct_deal_count, 0) as previous_direct_deal_count,
    COALESCE(p.reserved_count, 0) as previous_reserved_count,
    COALESCE(p.intention_count, 0) as previous_intention_count,
    COALESCE(p.considering_count, 0) as previous_considering_count,
    COALESCE(p.lost_count, 0) as previous_lost_count,
    COALESCE(p.unfilled_count, 0) as previous_unfilled_count,
    CASE 
      WHEN p.showings_count > 0 THEN 
        ROUND((p.direct_deal_count::numeric / p.showings_count::numeric) * 100, 2)
      ELSE 0 
    END as previous_direct_rate,
    CASE 
      WHEN p.showings_count > 0 THEN 
        ROUND(((p.direct_deal_count + p.reserved_count)::numeric / p.showings_count::numeric) * 100, 2)
      ELSE 0 
    END as previous_conversion_rate
  FROM current_period_stats c
  LEFT JOIN previous_period_stats p ON 
    c.sales_id = p.sales_id AND 
    c.actual_sales_id = p.actual_sales_id
  ORDER BY c.sales_id, c.showings_count DESC;
END;
$function$; 