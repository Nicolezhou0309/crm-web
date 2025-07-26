-- =============================
-- 审批流后端排序方案（修复版）
-- =============================

-- 1. 创建优化的索引
CREATE INDEX IF NOT EXISTS idx_approval_instances_created_at_desc ON public.approval_instances(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_approval_instances_status_created_at ON public.approval_instances(status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_approval_instances_target_id ON public.approval_instances(target_id);
CREATE INDEX IF NOT EXISTS idx_approval_instances_flow_id ON public.approval_instances(flow_id);
CREATE INDEX IF NOT EXISTS idx_approval_instances_created_by ON public.approval_instances(created_by);

-- 审批节点索引
CREATE INDEX IF NOT EXISTS idx_approval_steps_instance_id_status ON public.approval_steps(instance_id, status);
CREATE INDEX IF NOT EXISTS idx_approval_steps_action_time ON public.approval_steps(action_time DESC);
CREATE INDEX IF NOT EXISTS idx_approval_steps_approver_id_status ON public.approval_steps(approver_id, status);

-- 2. 删除旧函数（如果存在）
DROP FUNCTION IF EXISTS get_approval_instances_with_sorting(
  INTEGER, INTEGER, TEXT, TEXT, TEXT[], TEXT, TEXT, TEXT, TIMESTAMPTZ, TIMESTAMPTZ
);
DROP FUNCTION IF EXISTS get_approval_instances_count(
  TEXT[], TEXT, TEXT, TEXT, TIMESTAMPTZ, TIMESTAMPTZ
);
DROP FUNCTION IF EXISTS get_approval_statistics();
DROP FUNCTION IF EXISTS get_user_approval_statistics(BIGINT);
DROP FUNCTION IF EXISTS get_approval_performance_metrics();
DROP FUNCTION IF EXISTS cleanup_old_approval_data(INTEGER);

-- 3. 创建审批实例视图（包含计算字段）
CREATE OR REPLACE VIEW approval_instances_with_metadata AS
SELECT 
  ai.id,
  ai.flow_id,
  ai.target_table,
  ai.target_id,
  ai.status,
  ai.current_step,
  ai.created_by,
  ai.created_at,
  ai.updated_at,
  -- 审批流信息
  af.name as flow_name,
  af.type as flow_type,
  -- 发起人信息
  up.nickname as creator_nickname,
  -- 计算字段：最新审批时间
  (
    SELECT MAX(action_time) 
    FROM approval_steps 
    WHERE instance_id = ai.id AND action_time IS NOT NULL
  ) as latest_action_time,
  -- 计算字段：审批时长（分钟）
  CASE 
    WHEN ai.status = 'pending' THEN NULL
    ELSE EXTRACT(EPOCH FROM (
      SELECT MAX(action_time) 
      FROM approval_steps 
      WHERE instance_id = ai.id AND action_time IS NOT NULL
    ) - ai.created_at) / 60
  END as approval_duration_minutes,
  -- 计算字段：待审批步骤数
  (
    SELECT COUNT(*) 
    FROM approval_steps 
    WHERE instance_id = ai.id AND status = 'pending'
  ) as pending_steps_count,
  -- 计算字段：总步骤数
  (
    SELECT COUNT(*) 
    FROM approval_steps 
    WHERE instance_id = ai.id
  ) as total_steps_count
FROM approval_instances ai
LEFT JOIN approval_flows af ON ai.flow_id = af.id
LEFT JOIN users_profile up ON ai.created_by = up.id;

-- 4. 创建后端排序和筛选函数（修复版）
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
  v_sort_clause TEXT;
BEGIN
  -- 计算偏移量
  v_offset := (p_page - 1) * p_page_size;
  
  -- 验证排序字段
  IF p_sort_field NOT IN ('created_at', 'updated_at', 'flow_name', 'target_id', 'status', 'approval_duration_minutes', 'latest_action_time', 'creator_nickname') THEN
    p_sort_field := 'created_at';
  END IF;
  
  -- 验证排序顺序
  IF p_sort_order NOT IN ('ASC', 'DESC') THEN
    p_sort_order := 'DESC';
  END IF;
  
  -- 构建排序子句
  v_sort_clause := p_sort_field || ' ' || p_sort_order;
  
  -- 返回分页数据（使用静态SQL而不是动态SQL）
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
    v.pending_steps_count,
    v.total_steps_count
  FROM approval_instances_with_metadata v
  WHERE (p_status_filter IS NULL OR v.status = ANY(p_status_filter))
    AND (p_target_id_filter IS NULL OR v.target_id ILIKE '%' || p_target_id_filter || '%')
    AND (p_flow_name_filter IS NULL OR v.flow_name ILIKE '%' || p_flow_name_filter || '%')
    AND (p_creator_name_filter IS NULL OR v.creator_nickname ILIKE '%' || p_creator_name_filter || '%')
    AND (p_date_from IS NULL OR v.created_at >= p_date_from)
    AND (p_date_to IS NULL OR v.created_at <= p_date_to)
  ORDER BY 
    CASE 
      WHEN p_sort_field = 'created_at' AND p_sort_order = 'ASC' THEN v.created_at
      WHEN p_sort_field = 'created_at' AND p_sort_order = 'DESC' THEN v.created_at
      WHEN p_sort_field = 'updated_at' AND p_sort_order = 'ASC' THEN v.updated_at
      WHEN p_sort_field = 'updated_at' AND p_sort_order = 'DESC' THEN v.updated_at
      WHEN p_sort_field = 'flow_name' AND p_sort_order = 'ASC' THEN v.flow_name
      WHEN p_sort_field = 'flow_name' AND p_sort_order = 'DESC' THEN v.flow_name
      WHEN p_sort_field = 'target_id' AND p_sort_order = 'ASC' THEN v.target_id
      WHEN p_sort_field = 'target_id' AND p_sort_order = 'DESC' THEN v.target_id
      WHEN p_sort_field = 'status' AND p_sort_order = 'ASC' THEN v.status
      WHEN p_sort_field = 'status' AND p_sort_order = 'DESC' THEN v.status
      WHEN p_sort_field = 'approval_duration_minutes' AND p_sort_order = 'ASC' THEN v.approval_duration_minutes::text
      WHEN p_sort_field = 'approval_duration_minutes' AND p_sort_order = 'DESC' THEN v.approval_duration_minutes::text
      WHEN p_sort_field = 'latest_action_time' AND p_sort_order = 'ASC' THEN v.latest_action_time::text
      WHEN p_sort_field = 'latest_action_time' AND p_sort_order = 'DESC' THEN v.latest_action_time::text
      WHEN p_sort_field = 'creator_nickname' AND p_sort_order = 'ASC' THEN v.creator_nickname
      WHEN p_sort_field = 'creator_nickname' AND p_sort_order = 'DESC' THEN v.creator_nickname
      ELSE v.created_at
    END
  LIMIT p_page_size OFFSET v_offset;
END;
$$ LANGUAGE plpgsql;

-- 5. 创建获取总数的函数
CREATE OR REPLACE FUNCTION get_approval_instances_count(
  p_status_filter TEXT[] DEFAULT NULL,
  p_target_id_filter TEXT DEFAULT NULL,
  p_flow_name_filter TEXT DEFAULT NULL,
  p_creator_name_filter TEXT DEFAULT NULL,
  p_date_from TIMESTAMPTZ DEFAULT NULL,
  p_date_to TIMESTAMPTZ DEFAULT NULL
)
RETURNS BIGINT AS $$
DECLARE
  v_count BIGINT;
BEGIN
  SELECT COUNT(*) INTO v_count
  FROM approval_instances_with_metadata v
  WHERE (p_status_filter IS NULL OR v.status = ANY(p_status_filter))
    AND (p_target_id_filter IS NULL OR v.target_id ILIKE '%' || p_target_id_filter || '%')
    AND (p_flow_name_filter IS NULL OR v.flow_name ILIKE '%' || p_flow_name_filter || '%')
    AND (p_creator_name_filter IS NULL OR v.creator_nickname ILIKE '%' || p_creator_name_filter || '%')
    AND (p_date_from IS NULL OR v.created_at >= p_date_from)
    AND (p_date_to IS NULL OR v.created_at <= p_date_to);
  
  RETURN v_count;
END;
$$ LANGUAGE plpgsql;

-- 6. 创建快速统计函数
CREATE OR REPLACE FUNCTION get_approval_statistics()
RETURNS TABLE(
  total_instances BIGINT,
  pending_instances BIGINT,
  approved_instances BIGINT,
  rejected_instances BIGINT,
  avg_approval_duration_minutes NUMERIC
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    COUNT(*) as total_instances,
    COUNT(*) FILTER (WHERE status = 'pending') as pending_instances,
    COUNT(*) FILTER (WHERE status = 'approved') as approved_instances,
    COUNT(*) FILTER (WHERE status = 'rejected') as rejected_instances,
    AVG(approval_duration_minutes) FILTER (WHERE approval_duration_minutes IS NOT NULL) as avg_approval_duration_minutes
  FROM approval_instances_with_metadata;
END;
$$ LANGUAGE plpgsql;

-- 7. 创建用户审批统计函数
CREATE OR REPLACE FUNCTION get_user_approval_statistics(p_user_id BIGINT)
RETURNS TABLE(
  total_pending BIGINT,
  total_approved BIGINT,
  total_rejected BIGINT,
  avg_response_time_minutes NUMERIC
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    COUNT(*) FILTER (WHERE status = 'pending') as total_pending,
    COUNT(*) FILTER (WHERE status = 'approved') as total_approved,
    COUNT(*) FILTER (WHERE status = 'rejected') as total_rejected,
    AVG(EXTRACT(EPOCH FROM (action_time - created_at)) / 60) FILTER (WHERE action_time IS NOT NULL) as avg_response_time_minutes
  FROM approval_steps s
  JOIN approval_instances i ON s.instance_id = i.id
  WHERE s.approver_id = p_user_id;
END;
$$ LANGUAGE plpgsql;

-- 8. 创建性能监控函数
CREATE OR REPLACE FUNCTION get_approval_performance_metrics()
RETURNS TABLE(
  metric_name TEXT,
  metric_value NUMERIC,
  description TEXT
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    'avg_approval_duration_hours'::TEXT,
    AVG(approval_duration_minutes) / 60,
    '平均审批时长（小时）'
  FROM approval_instances_with_metadata
  WHERE approval_duration_minutes IS NOT NULL
  
  UNION ALL
  
  SELECT 
    'pending_instances_ratio'::TEXT,
    (COUNT(*) FILTER (WHERE status = 'pending')::NUMERIC / COUNT(*)) * 100,
    '待审批实例占比（%）'
  FROM approval_instances_with_metadata
  
  UNION ALL
  
  SELECT 
    'avg_steps_per_instance'::TEXT,
    AVG(total_steps_count),
    '平均每个实例的步骤数'
  FROM approval_instances_with_metadata
  WHERE total_steps_count > 0;
END;
$$ LANGUAGE plpgsql;

-- 9. 创建自动清理函数（可选）
CREATE OR REPLACE FUNCTION cleanup_old_approval_data(p_days_old INTEGER DEFAULT 365)
RETURNS INTEGER AS $$
DECLARE
  v_deleted_count INTEGER;
BEGIN
  -- 删除超过指定天数的已完成审批实例
  DELETE FROM approval_instances 
  WHERE status IN ('approved', 'rejected') 
    AND created_at < NOW() - INTERVAL '1 day' * p_days_old;
  
  GET DIAGNOSTICS v_deleted_count = ROW_COUNT;
  
  RETURN v_deleted_count;
END;
$$ LANGUAGE plpgsql;

-- 10. 使用示例和说明
COMMENT ON FUNCTION get_approval_instances_with_sorting IS '获取审批实例列表，支持分页、排序和筛选';
COMMENT ON FUNCTION get_approval_instances_count IS '获取审批实例总数';
COMMENT ON FUNCTION get_approval_statistics IS '获取审批统计信息';
COMMENT ON FUNCTION get_user_approval_statistics IS '获取用户审批统计信息';
COMMENT ON FUNCTION get_approval_performance_metrics IS '获取审批性能指标';
COMMENT ON FUNCTION cleanup_old_approval_data IS '清理旧的审批数据';
