-- 完整部署所有直播数据筛选函数
-- 确保所有函数都正确创建

-- 1. 创建基础筛选函数
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

-- 2. 创建优化版本筛选函数
CREATE OR REPLACE FUNCTION get_filtered_live_stream_schedules_with_users(
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
  participant_names TEXT[],
  participant_emails TEXT[],
  location TEXT,
  notes TEXT,
  status TEXT,
  created_by BIGINT,
  created_by_name TEXT,
  created_by_email TEXT,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ,
  editing_by BIGINT,
  editing_by_name TEXT,
  editing_by_email TEXT,
  editing_at TIMESTAMPTZ,
  editing_expires_at TIMESTAMPTZ,
  lock_type TEXT,
  lock_reason TEXT,
  lock_end_time TIMESTAMPTZ,
  average_score NUMERIC(3,1),
  scoring_data JSONB,
  scoring_status TEXT,
  scored_by BIGINT,
  scored_by_name TEXT,
  scored_by_email TEXT,
  scored_at TIMESTAMPTZ,
  total_count BIGINT
) AS $$
DECLARE
  v_query TEXT;
  v_where_conditions TEXT[] := ARRAY[]::TEXT[];
  v_offset INTEGER;
  v_limit INTEGER;
BEGIN
  -- 构建基础查询，使用JOIN获取用户信息
  v_query := '
    SELECT 
      lss.*,
      COUNT(*) OVER() as total_count,
      -- 参与人员信息
      ARRAY_AGG(DISTINCT up_participant.nickname) FILTER (WHERE up_participant.id IS NOT NULL) as participant_names,
      ARRAY_AGG(DISTINCT up_participant.email) FILTER (WHERE up_participant.id IS NOT NULL) as participant_emails,
      -- 创建人员信息
      up_created.nickname as created_by_name,
      up_created.email as created_by_email,
      -- 编辑人员信息
      up_editing.nickname as editing_by_name,
      up_editing.email as editing_by_email,
      -- 评分人员信息
      up_scored.nickname as scored_by_name,
      up_scored.email as scored_by_email
    FROM live_stream_schedules lss
    -- 参与人员JOIN
    LEFT JOIN LATERAL (
      SELECT unnest(lss.participant_ids) as participant_id
    ) participant_ids ON true
    LEFT JOIN users_profile up_participant ON up_participant.id = participant_ids.participant_id
    -- 创建人员JOIN
    LEFT JOIN users_profile up_created ON up_created.id = lss.created_by
    -- 编辑人员JOIN
    LEFT JOIN users_profile up_editing ON up_editing.id = lss.editing_by
    -- 评分人员JOIN
    LEFT JOIN users_profile up_scored ON up_scored.id = lss.scored_by
    WHERE 1=1';
  
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
    v_where_conditions := array_append(v_where_conditions, '(
      up_participant.nickname ILIKE ANY(' || quote_literal(p_participants) || ') OR
      up_participant.email ILIKE ANY(' || quote_literal(p_participants) || ')
    )');
  END IF;
  
  -- 添加WHERE条件
  IF array_length(v_where_conditions, 1) > 0 THEN
    v_query := v_query || ' AND ' || array_to_string(v_where_conditions, ' AND ');
  END IF;
  
  -- 分组和排序
  v_query := v_query || ' GROUP BY lss.id, up_created.nickname, up_created.email, up_editing.nickname, up_editing.email, up_scored.nickname, up_scored.email';
  v_query := v_query || ' ORDER BY lss.date DESC, lss.time_slot_id';
  
  -- 分页
  v_offset := (p_page - 1) * p_page_size;
  v_limit := p_page_size;
  v_query := v_query || ' LIMIT ' || v_limit || ' OFFSET ' || v_offset;
  
  -- 执行查询
  RETURN QUERY EXECUTE v_query;
END;
$$ LANGUAGE plpgsql;

-- 3. 创建索引以优化筛选性能
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

-- 4. 验证函数是否创建成功
SELECT 'Functions created successfully' as status;

-- 5. 显示所有相关函数
SELECT routine_name, routine_type 
FROM information_schema.routines 
WHERE routine_schema = 'public' 
AND routine_name LIKE '%live_stream%'
ORDER BY routine_name; 