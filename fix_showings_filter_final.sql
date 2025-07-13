-- 修正版 showings filter 函数，确保字段类型完全一致
CREATE OR REPLACE FUNCTION filter_showings(
  p_leadid TEXT DEFAULT NULL,
  p_community TEXT[] DEFAULT NULL,
  p_showingsales BIGINT[] DEFAULT NULL,
  p_trueshowingsales BIGINT[] DEFAULT NULL,
  p_interviewsales BIGINT[] DEFAULT NULL,
  p_viewresult TEXT[] DEFAULT NULL,
  p_budget_min INTEGER DEFAULT NULL,
  p_budget_max INTEGER DEFAULT NULL,
  p_renttime_min INTEGER DEFAULT NULL,
  p_renttime_max INTEGER DEFAULT NULL,
  p_scheduletime_start TIMESTAMP WITH TIME ZONE DEFAULT NULL,
  p_scheduletime_end TIMESTAMP WITH TIME ZONE DEFAULT NULL,
  p_arrivaltime_start TIMESTAMP WITH TIME ZONE DEFAULT NULL,
  p_arrivaltime_end TIMESTAMP WITH TIME ZONE DEFAULT NULL,
  p_moveintime_start TIMESTAMP WITH TIME ZONE DEFAULT NULL,
  p_moveintime_end TIMESTAMP WITH TIME ZONE DEFAULT NULL,
  p_created_at_start TIMESTAMP WITH TIME ZONE DEFAULT NULL,
  p_created_at_end TIMESTAMP WITH TIME ZONE DEFAULT NULL,
  p_order_by TEXT DEFAULT 'created_at',
  p_ascending BOOLEAN DEFAULT FALSE,
  p_limit INTEGER DEFAULT 10,
  p_offset INTEGER DEFAULT 0
)
RETURNS TABLE (
  id UUID,
  leadid TEXT,
  scheduletime TIMESTAMP WITH TIME ZONE,
  community TEXT,
  arrivaltime TIMESTAMP WITH TIME ZONE,
  showingsales BIGINT,
  trueshowingsales BIGINT,
  viewresult TEXT,
  budget INTEGER,
  moveintime TIMESTAMP WITH TIME ZONE,
  remark TEXT,
  renttime INTEGER,
  created_at TIMESTAMP WITH TIME ZONE,
  updated_at TIMESTAMP WITH TIME ZONE,
  showingsales_nickname TEXT,
  trueshowingsales_nickname TEXT,
  interviewsales_nickname TEXT,
  lead_phone TEXT,
  lead_wechat TEXT,
  lead_source TEXT,
  lead_status TEXT,
  lead_type TEXT
) AS $$
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
    COALESCE(sp.nickname::TEXT, '') as showingsales_nickname,
    COALESCE(tsp.nickname::TEXT, '') as trueshowingsales_nickname,
    COALESCE(isp.nickname::TEXT, '') as interviewsales_nickname,
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
  ORDER BY 
    CASE 
      WHEN p_order_by = 'leadid' THEN s.leadid
      WHEN p_order_by = 'community' THEN s.community::TEXT
      WHEN p_order_by = 'viewresult' THEN s.viewresult
      WHEN p_order_by = 'budget' THEN s.budget::TEXT
      WHEN p_order_by = 'renttime' THEN s.renttime::TEXT
      WHEN p_order_by = 'scheduletime' THEN s.scheduletime::TEXT
      WHEN p_order_by = 'arrivaltime' THEN s.arrivaltime::TEXT
      WHEN p_order_by = 'moveintime' THEN s.moveintime::TEXT
      WHEN p_order_by = 'updated_at' THEN s.updated_at::TEXT
      ELSE s.created_at::TEXT
    END ASC NULLS LAST,
    CASE 
      WHEN p_order_by = 'leadid' THEN s.leadid
      WHEN p_order_by = 'community' THEN s.community::TEXT
      WHEN p_order_by = 'viewresult' THEN s.viewresult
      WHEN p_order_by = 'budget' THEN s.budget::TEXT
      WHEN p_order_by = 'renttime' THEN s.renttime::TEXT
      WHEN p_order_by = 'scheduletime' THEN s.scheduletime::TEXT
      WHEN p_order_by = 'arrivaltime' THEN s.arrivaltime::TEXT
      WHEN p_order_by = 'moveintime' THEN s.moveintime::TEXT
      WHEN p_order_by = 'updated_at' THEN s.updated_at::TEXT
      ELSE s.created_at::TEXT
    END DESC NULLS LAST
  LIMIT p_limit OFFSET p_offset;
END;
$$ LANGUAGE plpgsql;

-- 修正版获取带看记录总数的函数
CREATE OR REPLACE FUNCTION get_showings_count(
  p_leadid TEXT DEFAULT NULL,
  p_community TEXT[] DEFAULT NULL,
  p_showingsales BIGINT[] DEFAULT NULL,
  p_trueshowingsales BIGINT[] DEFAULT NULL,
  p_interviewsales BIGINT[] DEFAULT NULL,
  p_viewresult TEXT[] DEFAULT NULL,
  p_budget_min INTEGER DEFAULT NULL,
  p_budget_max INTEGER DEFAULT NULL,
  p_renttime_min INTEGER DEFAULT NULL,
  p_renttime_max INTEGER DEFAULT NULL,
  p_scheduletime_start TIMESTAMP WITH TIME ZONE DEFAULT NULL,
  p_scheduletime_end TIMESTAMP WITH TIME ZONE DEFAULT NULL,
  p_arrivaltime_start TIMESTAMP WITH TIME ZONE DEFAULT NULL,
  p_arrivaltime_end TIMESTAMP WITH TIME ZONE DEFAULT NULL,
  p_moveintime_start TIMESTAMP WITH TIME ZONE DEFAULT NULL,
  p_moveintime_end TIMESTAMP WITH TIME ZONE DEFAULT NULL,
  p_created_at_start TIMESTAMP WITH TIME ZONE DEFAULT NULL,
  p_created_at_end TIMESTAMP WITH TIME ZONE DEFAULT NULL
)
RETURNS INTEGER AS $$
DECLARE
  v_count INTEGER;
BEGIN
  SELECT COUNT(*)
  INTO v_count
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
    AND (p_created_at_end IS NULL OR s.created_at <= p_created_at_end);
  
  RETURN v_count;
END;
$$ LANGUAGE plpgsql;

-- 修正版获取带看结果枚举的函数
CREATE OR REPLACE FUNCTION get_showings_viewresult_options()
RETURNS TEXT[] AS $$
DECLARE
  v_results TEXT[];
BEGIN
  SELECT ARRAY_AGG(DISTINCT viewresult ORDER BY viewresult)
  INTO v_results
  FROM showings
  WHERE viewresult IS NOT NULL;
  
  RETURN COALESCE(v_results, ARRAY[]::TEXT[]);
END;
$$ LANGUAGE plpgsql;
