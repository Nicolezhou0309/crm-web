-- 检查ID 84记录的详细评分数据
SELECT 
  id,
  date,
  time_slot_id,
  average_score,
  scoring_status,
  scored_by,
  scored_at,
  scoring_data,
  created_at,
  updated_at
FROM live_stream_schedules 
WHERE id = 84;

-- 检查所有有评分的记录
SELECT 
  id,
  date,
  time_slot_id,
  average_score,
  scoring_status,
  scored_by,
  scored_at,
  created_at
FROM live_stream_schedules 
WHERE average_score IS NOT NULL
ORDER BY average_score DESC;

-- 检查最近的评分记录
SELECT 
  id,
  date,
  time_slot_id,
  average_score,
  scoring_status,
  scored_by,
  scored_at
FROM live_stream_schedules 
WHERE scored_at IS NOT NULL
ORDER BY scored_at DESC
LIMIT 10; 