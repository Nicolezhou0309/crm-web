-- 优化版 deals filter 函数，支持多字段筛选（多选）
CREATE OR REPLACE FUNCTION filter_deals(
  p_id uuid[] DEFAULT NULL,
  p_leadid text[] DEFAULT NULL,
  p_contractdate_start date DEFAULT NULL,
  p_contractdate_end date DEFAULT NULL,
  p_community text[] DEFAULT NULL,
  p_contractnumber text[] DEFAULT NULL,
  p_roomnumber text[] DEFAULT NULL,
  p_created_at_start timestamp with time zone DEFAULT NULL,
  p_created_at_end timestamp with time zone DEFAULT NULL,
  p_source text[] DEFAULT NULL,
  p_order_by text DEFAULT 'created_at',
  p_ascending boolean DEFAULT false,
  p_limit integer DEFAULT 10,
  p_offset integer DEFAULT 0
)
RETURNS TABLE (
  id uuid,
  leadid text,
  contractdate date,
  community text,
  contractnumber text,
  roomnumber text,
  created_at timestamp with time zone,
  updated_at timestamp with time zone,
  lead_phone text,
  lead_wechat text,
  lead_source text,
  lead_status text,
  lead_type text
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    d.id,
    d.leadid,
    d.contractdate,
    d.community::text,
    d.contractnumber,
    d.roomnumber,
    d.created_at,
    d.updated_at,
    COALESCE(l.phone::text, '') as lead_phone,
    COALESCE(l.wechat::text, '') as lead_wechat,
    COALESCE(l.source::text, '') as lead_source,
    COALESCE(l.leadstatus::text, '') as lead_status,
    COALESCE(l.leadtype::text, '') as lead_type
  FROM deals d
  LEFT JOIN leads l ON d.leadid = l.leadid
  WHERE 
    (p_id IS NULL OR d.id = ANY(p_id))
    AND (p_leadid IS NULL OR d.leadid = ANY(p_leadid))
    AND (p_contractdate_start IS NULL OR d.contractdate >= p_contractdate_start)
    AND (p_contractdate_end IS NULL OR d.contractdate <= p_contractdate_end)
    AND (p_community IS NULL OR d.community::text = ANY(p_community))
    AND (p_contractnumber IS NULL OR d.contractnumber = ANY(p_contractnumber))
    AND (p_roomnumber IS NULL OR d.roomnumber = ANY(p_roomnumber))
    AND (p_created_at_start IS NULL OR d.created_at >= p_created_at_start)
    AND (p_created_at_end IS NULL OR d.created_at <= p_created_at_end)
    AND (p_source IS NULL OR l.source::text = ANY(p_source))
  ORDER BY 
    CASE 
      WHEN p_order_by = 'leadid' THEN d.leadid
      WHEN p_order_by = 'community' THEN d.community::text
      WHEN p_order_by = 'contractnumber' THEN d.contractnumber
      WHEN p_order_by = 'roomnumber' THEN d.roomnumber
      WHEN p_order_by = 'contractdate' THEN d.contractdate::text
      WHEN p_order_by = 'created_at' THEN d.created_at::text
      WHEN p_order_by = 'updated_at' THEN d.updated_at::text
      ELSE d.created_at::text
    END ASC NULLS LAST,
    CASE 
      WHEN p_order_by = 'leadid' THEN d.leadid
      WHEN p_order_by = 'community' THEN d.community::text
      WHEN p_order_by = 'contractnumber' THEN d.contractnumber
      WHEN p_order_by = 'roomnumber' THEN d.roomnumber
      WHEN p_order_by = 'contractdate' THEN d.contractdate::text
      WHEN p_order_by = 'created_at' THEN d.created_at::text
      WHEN p_order_by = 'updated_at' THEN d.updated_at::text
      ELSE d.created_at::text
    END DESC NULLS LAST
  LIMIT p_limit OFFSET p_offset;
END;
$$ LANGUAGE plpgsql;

-- 获取成交记录总数的函数
CREATE OR REPLACE FUNCTION get_deals_count(
  p_id uuid[] DEFAULT NULL,
  p_leadid text[] DEFAULT NULL,
  p_contractdate_start date DEFAULT NULL,
  p_contractdate_end date DEFAULT NULL,
  p_community text[] DEFAULT NULL,
  p_contractnumber text[] DEFAULT NULL,
  p_roomnumber text[] DEFAULT NULL,
  p_created_at_start timestamp with time zone DEFAULT NULL,
  p_created_at_end timestamp with time zone DEFAULT NULL,
  p_source text[] DEFAULT NULL
)
RETURNS integer AS $$
DECLARE
  v_count integer;
BEGIN
  SELECT COUNT(*)
  INTO v_count
  FROM deals d
  LEFT JOIN leads l ON d.leadid = l.leadid
  WHERE 
    (p_id IS NULL OR d.id = ANY(p_id))
    AND (p_leadid IS NULL OR d.leadid = ANY(p_leadid))
    AND (p_contractdate_start IS NULL OR d.contractdate >= p_contractdate_start)
    AND (p_contractdate_end IS NULL OR d.contractdate <= p_contractdate_end)
    AND (p_community IS NULL OR d.community::text = ANY(p_community))
    AND (p_contractnumber IS NULL OR d.contractnumber = ANY(p_contractnumber))
    AND (p_roomnumber IS NULL OR d.roomnumber = ANY(p_roomnumber))
    AND (p_created_at_start IS NULL OR d.created_at >= p_created_at_start)
    AND (p_created_at_end IS NULL OR d.created_at <= p_created_at_end)
    AND (p_source IS NULL OR l.source::text = ANY(p_source));
  
  RETURN v_count;
END;
$$ LANGUAGE plpgsql;

-- 获取成交记录社区枚举的函数
CREATE OR REPLACE FUNCTION get_deals_community_options()
RETURNS text[] AS $$
DECLARE
  v_communities text[];
BEGIN
  SELECT ARRAY_AGG(DISTINCT community::text ORDER BY community::text)
  INTO v_communities
  FROM deals
  WHERE community IS NOT NULL;
  
  RETURN COALESCE(v_communities, ARRAY[]::text[]);
END;
$$ LANGUAGE plpgsql;

-- 获取成交记录来源枚举的函数
CREATE OR REPLACE FUNCTION get_deals_source_options()
RETURNS text[] AS $$
DECLARE
  v_sources text[];
BEGIN
  SELECT ARRAY_AGG(DISTINCT l.source::text ORDER BY l.source::text)
  INTO v_sources
  FROM deals d
  LEFT JOIN leads l ON d.leadid = l.leadid
  WHERE l.source IS NOT NULL;
  
  RETURN COALESCE(v_sources, ARRAY[]::text[]);
END;
$$ LANGUAGE plpgsql;

-- 获取成交记录合同编号枚举的函数
CREATE OR REPLACE FUNCTION get_deals_contractnumber_options()
RETURNS text[] AS $$
DECLARE
  v_contractnumbers text[];
BEGIN
  SELECT ARRAY_AGG(DISTINCT contractnumber ORDER BY contractnumber)
  INTO v_contractnumbers
  FROM deals
  WHERE contractnumber IS NOT NULL;
  
  RETURN COALESCE(v_contractnumbers, ARRAY[]::text[]);
END;
$$ LANGUAGE plpgsql;

-- 获取成交记录房间编号枚举的函数
CREATE OR REPLACE FUNCTION get_deals_roomnumber_options()
RETURNS text[] AS $$
DECLARE
  v_roomnumbers text[];
BEGIN
  SELECT ARRAY_AGG(DISTINCT roomnumber ORDER BY roomnumber)
  INTO v_roomnumbers
  FROM deals
  WHERE roomnumber IS NOT NULL;
  
  RETURN COALESCE(v_roomnumbers, ARRAY[]::text[]);
END;
$$ LANGUAGE plpgsql; 