-- 修复返回类型不匹配问题
CREATE OR REPLACE FUNCTION get_approval_instances_with_sorting(
  p_page INTEGER DEFAULT 1,
  p_page_size INTEGER DEFAULT 10,
  p_sort_field TEXT DEFAULT 'created_at',
  p_sort_order TEXT DEFAULT 'DESC',
  p_status_filter TEXT[] DEFAULT NULL,
  p_target_id_filter TEXT DEFAULT NULL,
  p_flow_name_filter TEXT DEFAULT NULL,
  p_creator_name_filter TEXT DEFAULT NULL,
  p_date_from TIMESTAMPTZ DEFAULT NULL,
  p_date_to TIMESTAMPTZ DEFAULT NULL
)
RETURNS TABLE(
  id UUID,
  flow_id UUID,
  target_table TEXT,
  target_id TEXT,
  status TEXT,
  current_step INTEGER,
  created_by BIGINT,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ,
  flow_name TEXT,
  flow_type TEXT,
  creator_nickname TEXT,
  latest_action_time TIMESTAMPTZ,
  approval_duration_minutes NUMERIC,
  pending_steps_count INTEGER,
  total_steps_count INTEGER
) AS $$
DECLARE
  v_offset INTEGER;
BEGIN
  -- 计算偏移量
  v_offset := (p_page - 1) * p_page_size;
  
  -- 返回分页数据（修复返回类型）
  RETURN QUERY
  SELECT 
    v.id,
    v.flow_id,
    v.target_table,
    v.target_id,
    v.status,
    v.current_step,
    v.created_by,
    v.created_at,
    v.updated_at,
    v.flow_name,
    v.flow_type,
    v.creator_nickname,
    v.latest_action_time,
    v.approval_duration_minutes,
    v.pending_steps_count::INTEGER,
    v.total_steps_count::INTEGER
  FROM approval_instances_with_metadata v
  WHERE (p_status_filter IS NULL OR v.status = ANY(p_status_filter))
    AND (p_target_id_filter IS NULL OR v.target_id ILIKE '%' || p_target_id_filter || '%')
    AND (p_flow_name_filter IS NULL OR v.flow_name ILIKE '%' || p_flow_name_filter || '%')
    AND (p_creator_name_filter IS NULL OR v.creator_nickname ILIKE '%' || p_creator_name_filter || '%')
    AND (p_date_from IS NULL OR v.created_at >= p_date_from)
    AND (p_date_to IS NULL OR v.created_at <= p_date_to)
  ORDER BY 
    CASE WHEN p_sort_field = 'created_at' AND p_sort_order = 'ASC' THEN v.created_at END ASC,
    CASE WHEN p_sort_field = 'created_at' AND p_sort_order = 'DESC' THEN v.created_at END DESC,
    CASE WHEN p_sort_field = 'updated_at' AND p_sort_order = 'ASC' THEN v.updated_at END ASC,
    CASE WHEN p_sort_field = 'updated_at' AND p_sort_order = 'DESC' THEN v.updated_at END DESC,
    CASE WHEN p_sort_field = 'flow_name' AND p_sort_order = 'ASC' THEN v.flow_name END ASC,
    CASE WHEN p_sort_field = 'flow_name' AND p_sort_order = 'DESC' THEN v.flow_name END DESC,
    CASE WHEN p_sort_field = 'target_id' AND p_sort_order = 'ASC' THEN v.target_id END ASC,
    CASE WHEN p_sort_field = 'target_id' AND p_sort_order = 'DESC' THEN v.target_id END DESC,
    CASE WHEN p_sort_field = 'status' AND p_sort_order = 'ASC' THEN v.status END ASC,
    CASE WHEN p_sort_field = 'status' AND p_sort_order = 'DESC' THEN v.status END DESC,
    CASE WHEN p_sort_field = 'approval_duration_minutes' AND p_sort_order = 'ASC' THEN v.approval_duration_minutes END ASC,
    CASE WHEN p_sort_field = 'approval_duration_minutes' AND p_sort_order = 'DESC' THEN v.approval_duration_minutes END DESC,
    CASE WHEN p_sort_field = 'latest_action_time' AND p_sort_order = 'ASC' THEN v.latest_action_time END ASC,
    CASE WHEN p_sort_field = 'latest_action_time' AND p_sort_order = 'DESC' THEN v.latest_action_time END DESC,
    CASE WHEN p_sort_field = 'creator_nickname' AND p_sort_order = 'ASC' THEN v.creator_nickname END ASC,
    CASE WHEN p_sort_field = 'creator_nickname' AND p_sort_order = 'DESC' THEN v.creator_nickname END DESC,
    v.created_at DESC
  LIMIT p_page_size OFFSET v_offset;
END;
$$ LANGUAGE plpgsql;
