-- 插入测试评分数据
-- 为现有的直播安排添加评分数据

-- 1. 更新一些记录为已评分状态
UPDATE live_stream_schedules 
SET 
  scoring_status = 'scored',
  average_score = 8.5,
  scored_by = 1,
  scored_at = NOW() - INTERVAL '2 days'
WHERE id IN (
  SELECT id FROM live_stream_schedules 
  ORDER BY created_at DESC 
  LIMIT 3
);

-- 2. 更新一些记录为评分中状态
UPDATE live_stream_schedules 
SET 
  scoring_status = 'scoring_in_progress',
  average_score = NULL,
  scored_by = NULL,
  scored_at = NULL
WHERE id IN (
  SELECT id FROM live_stream_schedules 
  ORDER BY created_at DESC 
  LIMIT 2 OFFSET 3
);

-- 3. 更新一些记录为已确认状态
UPDATE live_stream_schedules 
SET 
  scoring_status = 'approved',
  average_score = 9.2,
  scored_by = 1,
  scored_at = NOW() - INTERVAL '1 day'
WHERE id IN (
  SELECT id FROM live_stream_schedules 
  ORDER BY created_at DESC 
  LIMIT 2 OFFSET 5
);

-- 4. 添加一些不同评分范围的测试数据
UPDATE live_stream_schedules 
SET 
  scoring_status = 'scored',
  average_score = 6.8,
  scored_by = 1,
  scored_at = NOW() - INTERVAL '3 days'
WHERE id IN (
  SELECT id FROM live_stream_schedules 
  ORDER BY created_at DESC 
  LIMIT 1 OFFSET 7
);

UPDATE live_stream_schedules 
SET 
  scoring_status = 'scored',
  average_score = 9.8,
  scored_by = 1,
  scored_at = NOW() - INTERVAL '4 days'
WHERE id IN (
  SELECT id FROM live_stream_schedules 
  ORDER BY created_at DESC 
  LIMIT 1 OFFSET 8
);

-- 5. 显示更新结果
SELECT 
  id,
  date,
  time_slot_id,
  status,
  scoring_status,
  average_score,
  scored_by,
  scored_at
FROM live_stream_schedules 
ORDER BY created_at DESC 
LIMIT 10; 