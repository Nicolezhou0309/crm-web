-- 创建直播数据筛选函数
-- 支持多字段筛选、评分范围筛选、人员筛选、日期范围筛选等

-- 创建筛选函数
CREATE OR REPLACE FUNCTION get_filtered_live_stream_schedules(
  p_date_range_start DATE DEFAULT NULL,
  p_date_range_end DATE DEFAULT NULL,
  p_time_slots TEXT[] DEFAULT NULL,
  p_statuses TEXT[] DEFAULT NULL,
  p_scoring_statuses TEXT[] DEFAULT NULL,
  p_score_min NUMERIC DEFAULT NULL,
  p_score_max NUMERIC DEFAULT NULL,
  p_lock_types TEXT[] DEFAULT NULL,
  p_participants TEXT[] DEFAULT NULL,
  p_scored_by BIGINT[] DEFAULT NULL,
  p_created_by BIGINT[] DEFAULT NULL,
  p_editing_by BIGINT[] DEFAULT NULL,
  p_locations TEXT[] DEFAULT NULL,
  p_page INTEGER DEFAULT 1,
  p_page_size INTEGER DEFAULT 10
)
RETURNS TABLE (
  id BIGINT,
  date DATE,
  time_slot_id TEXT,
  participant_ids BIGINT[],
  location TEXT,
  notes TEXT,
  status TEXT,
  created_by BIGINT,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ,
  editing_by BIGINT,
  editing_at TIMESTAMPTZ,
  editing_expires_at TIMESTAMPTZ,
  lock_type TEXT,
  lock_reason TEXT,
  lock_end_time TIMESTAMPTZ,
  average_score NUMERIC(3,1),
  scoring_data JSONB,
  scoring_status TEXT,
  scored_by BIGINT,
  scored_at TIMESTAMPTZ,
  total_count BIGINT
) AS $$
DECLARE
  v_query TEXT;
  v_where_conditions TEXT[] := ARRAY[]::TEXT[];
  v_offset INTEGER;
  v_limit INTEGER;
BEGIN
  -- 构建基础查询
  v_query := 'SELECT lss.*, COUNT(*) OVER() as total_count FROM live_stream_schedules lss WHERE 1=1';
  
  -- 日期范围筛选
  IF p_date_range_start IS NOT NULL THEN
    v_where_conditions := array_append(v_where_conditions, 'lss.date >= ' || quote_literal(p_date_range_start));
  END IF;
  
  IF p_date_range_end IS NOT NULL THEN
    v_where_conditions := array_append(v_where_conditions, 'lss.date <= ' || quote_literal(p_date_range_end));
  END IF;
  
  -- 时间段多选筛选
  IF p_time_slots IS NOT NULL AND array_length(p_time_slots, 1) > 0 THEN
    v_where_conditions := array_append(v_where_conditions, 'lss.time_slot_id = ANY(' || quote_literal(p_time_slots) || ')');
  END IF;
  
  -- 状态多选筛选
  IF p_statuses IS NOT NULL AND array_length(p_statuses, 1) > 0 THEN
    v_where_conditions := array_append(v_where_conditions, 'lss.status = ANY(' || quote_literal(p_statuses) || ')');
  END IF;
  
  -- 评分状态多选筛选
  IF p_scoring_statuses IS NOT NULL AND array_length(p_scoring_statuses, 1) > 0 THEN
    v_where_conditions := array_append(v_where_conditions, 'lss.scoring_status = ANY(' || quote_literal(p_scoring_statuses) || ')');
  END IF;
  
  -- 评分范围筛选
  IF p_score_min IS NOT NULL THEN
    v_where_conditions := array_append(v_where_conditions, 'lss.average_score >= ' || p_score_min);
  END IF;
  
  IF p_score_max IS NOT NULL THEN
    v_where_conditions := array_append(v_where_conditions, 'lss.average_score <= ' || p_score_max);
  END IF;
  
  -- 锁定类型多选筛选
  IF p_lock_types IS NOT NULL AND array_length(p_lock_types, 1) > 0 THEN
    v_where_conditions := array_append(v_where_conditions, 'lss.lock_type = ANY(' || quote_literal(p_lock_types) || ')');
  END IF;
  
  -- 评分人员筛选
  IF p_scored_by IS NOT NULL AND array_length(p_scored_by, 1) > 0 THEN
    v_where_conditions := array_append(v_where_conditions, 'lss.scored_by = ANY(' || quote_literal(p_scored_by) || ')');
  END IF;
  
  -- 创建人员筛选
  IF p_created_by IS NOT NULL AND array_length(p_created_by, 1) > 0 THEN
    v_where_conditions := array_append(v_where_conditions, 'lss.created_by = ANY(' || quote_literal(p_created_by) || ')');
  END IF;
  
  -- 编辑人员筛选
  IF p_editing_by IS NOT NULL AND array_length(p_editing_by, 1) > 0 THEN
    v_where_conditions := array_append(v_where_conditions, 'lss.editing_by = ANY(' || quote_literal(p_editing_by) || ')');
  END IF;
  
  -- 地点筛选
  IF p_locations IS NOT NULL AND array_length(p_locations, 1) > 0 THEN
    v_where_conditions := array_append(v_where_conditions, 'lss.location = ANY(' || quote_literal(p_locations) || ')');
  END IF;
  
  -- 参与人员筛选（支持模糊搜索）
  IF p_participants IS NOT NULL AND array_length(p_participants, 1) > 0 THEN
    -- 先查询匹配的用户ID
    v_query := v_query || ' AND EXISTS (
      SELECT 1 FROM users_profile up 
      WHERE up.id = ANY(lss.participant_ids)
      AND (';
    
    FOR i IN 1..array_length(p_participants, 1) LOOP
      IF i > 1 THEN
        v_query := v_query || ' OR ';
      END IF;
      v_query := v_query || '(up.nickname ILIKE ' || quote_literal('%' || p_participants[i] || '%') || 
                 ' OR up.email ILIKE ' || quote_literal('%' || p_participants[i] || '%') || ')';
    END LOOP;
    
    v_query := v_query || ')
    )';
  END IF;
  
  -- 添加WHERE条件
  IF array_length(v_where_conditions, 1) > 0 THEN
    v_query := v_query || ' AND ' || array_to_string(v_where_conditions, ' AND ');
  END IF;
  
  -- 排序
  v_query := v_query || ' ORDER BY lss.date DESC, lss.time_slot_id';
  
  -- 分页
  v_offset := (p_page - 1) * p_page_size;
  v_limit := p_page_size;
  v_query := v_query || ' LIMIT ' || v_limit || ' OFFSET ' || v_offset;
  
  -- 执行查询
  RETURN QUERY EXECUTE v_query;
END;
$$ LANGUAGE plpgsql;

-- 创建索引以优化筛选性能
CREATE INDEX IF NOT EXISTS idx_live_stream_schedules_composite_filter 
ON live_stream_schedules (date, time_slot_id, status, scoring_status, average_score, lock_type);

-- 创建参与人员搜索索引
CREATE INDEX IF NOT EXISTS idx_live_stream_schedules_participant_search 
ON live_stream_schedules USING GIN (participant_ids);

-- 创建评分时间索引
CREATE INDEX IF NOT EXISTS idx_live_stream_schedules_scored_at 
ON live_stream_schedules (scored_at);

-- 创建地点索引
CREATE INDEX IF NOT EXISTS idx_live_stream_schedules_location 
ON live_stream_schedules (location);

-- 示例使用：
-- SELECT * FROM get_filtered_live_stream_schedules(
--   p_date_range_start := '2024-01-01',
--   p_date_range_end := '2024-12-31',
--   p_time_slots := ARRAY['morning-10-12', 'afternoon-14-16'],
--   p_statuses := ARRAY['completed', 'scored'],
--   p_score_min := 7.0,
--   p_score_max := 10.0,
--   p_page := 1,
--   p_page_size := 20
-- ); 