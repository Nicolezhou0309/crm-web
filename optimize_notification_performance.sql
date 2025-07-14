-- 通知系统性能优化脚本
-- 创建时间: 2024年12月

BEGIN;

-- =============================================
-- 1. 优化索引
-- =============================================

-- 删除旧索引（如果存在）
DROP INDEX IF EXISTS idx_notifications_user_status;
DROP INDEX IF EXISTS idx_notifications_created_at;
DROP INDEX IF EXISTS idx_announcements_active_time;
DROP INDEX IF EXISTS idx_announcements_priority;

-- 创建复合索引，提升查询性能
CREATE INDEX CONCURRENTLY idx_notifications_user_status_created 
ON notifications (user_id, status, created_at DESC);

CREATE INDEX CONCURRENTLY idx_notifications_user_type_status 
ON notifications (user_id, type, status);

CREATE INDEX CONCURRENTLY idx_notifications_status_priority 
ON notifications (status, priority DESC, created_at DESC);

-- 公告表优化索引
CREATE INDEX CONCURRENTLY idx_announcements_active_priority_time 
ON announcements (is_active, priority DESC, start_time DESC, end_time NULLS LAST);

CREATE INDEX CONCURRENTLY idx_announcements_type_active 
ON announcements (type, is_active, start_time, end_time);

-- 公告阅读记录表索引
CREATE INDEX CONCURRENTLY idx_announcement_reads_user_announcement 
ON announcement_reads (user_id, announcement_id);

-- =============================================
-- 2. 优化数据库函数
-- =============================================

-- 优化获取用户通知函数 - 添加分页和缓存
CREATE OR REPLACE FUNCTION get_user_notifications_optimized(
  p_user_id bigint,
  p_limit integer DEFAULT 50,
  p_offset integer DEFAULT 0,
  p_status text DEFAULT NULL
)
RETURNS TABLE (
  id uuid,
  user_id bigint,
  type text,
  title text,
  content text,
  metadata jsonb,
  status text,
  priority integer,
  expires_at timestamptz,
  created_at timestamptz,
  read_at timestamptz,
  handled_at timestamptz,
  total_count bigint
) LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_total_count bigint;
  v_query text;
  v_where_conditions text := 'WHERE n.user_id = $1';
  v_params text[] := ARRAY[p_user_id::text];
  v_param_count integer := 1;
BEGIN
  -- 构建动态查询
  IF p_status IS NOT NULL THEN
    v_param_count := v_param_count + 1;
    v_where_conditions := v_where_conditions || ' AND n.status = $' || v_param_count;
    v_params := array_append(v_params, p_status);
  END IF;

  -- 获取总数
  v_query := 'SELECT COUNT(*) FROM notifications n ' || v_where_conditions;
  EXECUTE v_query INTO v_total_count USING p_user_id, p_status;

  -- 返回分页数据
  RETURN QUERY EXECUTE 
    'SELECT 
      n.id,
      n.user_id,
      n.type,
      n.title,
      n.content,
      n.metadata,
      n.status,
      n.priority,
      n.expires_at,
      n.created_at,
      n.read_at,
      n.handled_at,
      $1 as total_count
    FROM notifications n 
    ' || v_where_conditions || '
    ORDER BY n.created_at DESC
    LIMIT $' || (v_param_count + 1) || ' OFFSET $' || (v_param_count + 2)
    USING v_total_count, p_limit, p_offset;
END;
$$;

-- 优化获取用户公告函数
CREATE OR REPLACE FUNCTION get_user_announcements_optimized(p_user_id bigint)
RETURNS TABLE (
  id uuid,
  title text,
  content text,
  type text,
  priority integer,
  target_roles text[],
  target_organizations uuid[],
  is_active boolean,
  start_time timestamptz,
  end_time timestamptz,
  created_by bigint,
  created_at timestamptz,
  is_read boolean
) LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  RETURN QUERY
  SELECT 
    a.id,
    a.title,
    a.content,
    a.type,
    a.priority,
    a.target_roles,
    a.target_organizations,
    a.is_active,
    a.start_time,
    a.end_time,
    a.created_by,
    a.created_at,
    ar.id IS NOT NULL as is_read
  FROM announcements a
  LEFT JOIN announcement_reads ar ON a.id = ar.announcement_id AND ar.user_id = p_user_id
  WHERE a.is_active = true 
    AND a.start_time <= now() 
    AND (a.end_time IS NULL OR a.end_time > now())
  ORDER BY a.priority DESC, a.created_at DESC
  LIMIT 100; -- 限制返回数量，提升性能
END;
$$;

-- 优化标记通知为已读函数
CREATE OR REPLACE FUNCTION mark_notification_read_optimized(p_notification_id uuid, p_user_id bigint)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_affected_rows integer;
BEGIN
  UPDATE notifications 
  SET status = 'read', read_at = now()
  WHERE id = p_notification_id AND user_id = p_user_id;
  
  GET DIAGNOSTICS v_affected_rows = ROW_COUNT;
  RETURN v_affected_rows > 0;
END;
$$;

-- 优化标记通知为已处理函数
CREATE OR REPLACE FUNCTION mark_notification_handled_optimized(p_notification_id uuid, p_user_id bigint)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_affected_rows integer;
BEGIN
  UPDATE notifications 
  SET status = 'handled', handled_at = now()
  WHERE id = p_notification_id AND user_id = p_user_id;
  
  GET DIAGNOSTICS v_affected_rows = ROW_COUNT;
  RETURN v_affected_rows > 0;
END;
$$;

-- 优化获取通知统计函数
CREATE OR REPLACE FUNCTION get_notification_stats_optimized(p_user_id bigint)
RETURNS TABLE (
  total bigint,
  unread bigint,
  read bigint,
  handled bigint
) LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  RETURN QUERY
  SELECT 
    COUNT(*)::bigint as total,
    COUNT(*) FILTER (WHERE status = 'unread')::bigint as unread,
    COUNT(*) FILTER (WHERE status = 'read')::bigint as read,
    COUNT(*) FILTER (WHERE status = 'handled')::bigint as handled
  FROM notifications
  WHERE user_id = p_user_id;
END;
$$;

-- =============================================
-- 3. 创建缓存表
-- =============================================

-- 创建通知缓存表
CREATE TABLE IF NOT EXISTS notification_cache (
  user_id bigint PRIMARY KEY,
  cache_data jsonb NOT NULL,
  last_updated timestamptz DEFAULT now(),
  cache_version integer DEFAULT 1
);

-- 创建缓存更新触发器
CREATE OR REPLACE FUNCTION update_notification_cache()
RETURNS TRIGGER AS $$
BEGIN
  -- 删除相关用户的缓存
  DELETE FROM notification_cache WHERE user_id = NEW.user_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 创建触发器
DROP TRIGGER IF EXISTS trigger_update_notification_cache ON notifications;
CREATE TRIGGER trigger_update_notification_cache
  AFTER INSERT OR UPDATE OR DELETE ON notifications
  FOR EACH ROW
  EXECUTE FUNCTION update_notification_cache();

-- =============================================
-- 4. 创建性能监控函数
-- =============================================

-- 获取通知系统性能统计
CREATE OR REPLACE FUNCTION get_notification_performance_stats()
RETURNS TABLE (
  metric_name text,
  metric_value numeric,
  description text
) LANGUAGE plpgsql AS $$
BEGIN
  RETURN QUERY
  SELECT 
    'total_notifications'::text,
    COUNT(*)::numeric,
    '总通知数量'::text
  FROM notifications
  UNION ALL
  SELECT 
    'unread_notifications'::text,
    COUNT(*)::numeric,
    '未读通知数量'::text
  FROM notifications WHERE status = 'unread'
  UNION ALL
  SELECT 
    'total_announcements'::text,
    COUNT(*)::numeric,
    '总公告数量'::text
  FROM announcements
  UNION ALL
  SELECT 
    'active_announcements'::text,
    COUNT(*)::numeric,
    '活跃公告数量'::text
  FROM announcements WHERE is_active = true
  UNION ALL
  SELECT 
    'avg_notifications_per_user'::text,
    ROUND(AVG(user_count), 2),
    '平均每用户通知数量'::text
  FROM (
    SELECT user_id, COUNT(*) as user_count 
    FROM notifications 
    GROUP BY user_id
  ) user_stats;
END;
$$;

-- =============================================
-- 5. 创建清理函数
-- =============================================

-- 清理过期通知
CREATE OR REPLACE FUNCTION cleanup_expired_notifications()
RETURNS integer LANGUAGE plpgsql AS $$
DECLARE
  v_deleted_count integer;
BEGIN
  DELETE FROM notifications 
  WHERE expires_at IS NOT NULL AND expires_at < now();
  
  GET DIAGNOSTICS v_deleted_count = ROW_COUNT;
  RETURN v_deleted_count;
END;
$$;

-- 清理过期公告
CREATE OR REPLACE FUNCTION cleanup_expired_announcements()
RETURNS integer LANGUAGE plpgsql AS $$
DECLARE
  v_deleted_count integer;
BEGIN
  DELETE FROM announcements 
  WHERE end_time IS NOT NULL AND end_time < now();
  
  GET DIAGNOSTICS v_deleted_count = ROW_COUNT;
  RETURN v_deleted_count;
END;
$$;

-- 清理缓存
CREATE OR REPLACE FUNCTION cleanup_old_cache()
RETURNS integer LANGUAGE plpgsql AS $$
DECLARE
  v_deleted_count integer;
BEGIN
  DELETE FROM notification_cache 
  WHERE last_updated < now() - interval '1 hour';
  
  GET DIAGNOSTICS v_deleted_count = ROW_COUNT;
  RETURN v_deleted_count;
END;
$$;

-- =============================================
-- 6. 创建定时任务（如果使用pg_cron扩展）
-- =============================================

-- 注意：需要安装pg_cron扩展才能使用以下语句
-- 清理过期通知（每天凌晨2点执行）
-- SELECT cron.schedule('cleanup-expired-notifications', '0 2 * * *', 'SELECT cleanup_expired_notifications();');

-- 清理过期公告（每天凌晨3点执行）
-- SELECT cron.schedule('cleanup-expired-announcements', '0 3 * * *', 'SELECT cleanup_expired_announcements();');

-- 清理缓存（每小时执行）
-- SELECT cron.schedule('cleanup-old-cache', '0 * * * *', 'SELECT cleanup_old_cache();');

-- =============================================
-- 7. 创建性能测试函数
-- =============================================

-- 测试通知查询性能
CREATE OR REPLACE FUNCTION test_notification_performance(p_user_id bigint)
RETURNS TABLE (
  test_name text,
  execution_time_ms numeric,
  result_count bigint
) LANGUAGE plpgsql AS $$
DECLARE
  v_start_time timestamp;
  v_end_time timestamp;
  v_result_count bigint;
  v_execution_time_ms numeric;
BEGIN
  -- 测试1: 获取用户通知
  v_start_time := clock_timestamp();
  SELECT COUNT(*) INTO v_result_count FROM get_user_notifications_optimized(p_user_id);
  v_end_time := clock_timestamp();
  v_execution_time_ms := EXTRACT(EPOCH FROM (v_end_time - v_start_time)) * 1000;
  
  RETURN QUERY SELECT 
    'get_user_notifications'::text,
    v_execution_time_ms,
    v_result_count;
  
  -- 测试2: 获取通知统计
  v_start_time := clock_timestamp();
  SELECT COUNT(*) INTO v_result_count FROM get_notification_stats_optimized(p_user_id);
  v_end_time := clock_timestamp();
  v_execution_time_ms := EXTRACT(EPOCH FROM (v_end_time - v_start_time)) * 1000;
  
  RETURN QUERY SELECT 
    'get_notification_stats'::text,
    v_execution_time_ms,
    v_result_count;
  
  -- 测试3: 获取用户公告
  v_start_time := clock_timestamp();
  SELECT COUNT(*) INTO v_result_count FROM get_user_announcements_optimized(p_user_id);
  v_end_time := clock_timestamp();
  v_execution_time_ms := EXTRACT(EPOCH FROM (v_end_time - v_start_time)) * 1000;
  
  RETURN QUERY SELECT 
    'get_user_announcements'::text,
    v_execution_time_ms,
    v_result_count;
END;
$$;

COMMIT;

-- =============================================
-- 8. 验证优化结果
-- =============================================

-- 查看新创建的索引
SELECT 
  schemaname,
  tablename,
  indexname,
  indexdef
FROM pg_indexes 
WHERE tablename IN ('notifications', 'announcements', 'announcement_reads')
ORDER BY tablename, indexname;

-- 查看新创建的函数
SELECT 
  routine_name,
  routine_type,
  data_type
FROM information_schema.routines 
WHERE routine_name LIKE '%optimized%'
ORDER BY routine_name;

-- 测试性能（替换为实际的用户ID）
-- SELECT * FROM test_notification_performance(1);

-- 查看性能统计
-- SELECT * FROM get_notification_performance_stats(); 