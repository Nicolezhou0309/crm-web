-- 检查评分数据情况
-- 查看当前数据库中的评分数据分布

-- 1. 查看评分状态分布
SELECT 
  scoring_status,
  COUNT(*) as count,
  ROUND(COUNT(*) * 100.0 / SUM(COUNT(*)) OVER(), 2) as percentage
FROM live_stream_schedules 
GROUP BY scoring_status
ORDER BY count DESC;

-- 2. 查看评分分数分布
SELECT 
  CASE 
    WHEN average_score IS NULL THEN '无评分'
    WHEN average_score < 6 THEN '低分(0-6)'
    WHEN average_score < 8 THEN '中等(6-8)'
    WHEN average_score < 9 THEN '高分(8-9)'
    ELSE '优秀(9-10)'
  END as score_range,
  COUNT(*) as count,
  ROUND(COUNT(*) * 100.0 / SUM(COUNT(*)) OVER(), 2) as percentage
FROM live_stream_schedules 
GROUP BY 
  CASE 
    WHEN average_score IS NULL THEN '无评分'
    WHEN average_score < 6 THEN '低分(0-6)'
    WHEN average_score < 8 THEN '中等(6-8)'
    WHEN average_score < 9 THEN '高分(8-9)'
    ELSE '优秀(9-10)'
  END
ORDER BY 
  CASE score_range
    WHEN '无评分' THEN 1
    WHEN '低分(0-6)' THEN 2
    WHEN '中等(6-8)' THEN 3
    WHEN '高分(8-9)' THEN 4
    WHEN '优秀(9-10)' THEN 5
  END;

-- 3. 查看最近的10条记录
SELECT 
  id,
  date,
  time_slot_id,
  status,
  scoring_status,
  average_score,
  scored_by,
  scored_at,
  created_at
FROM live_stream_schedules 
ORDER BY created_at DESC 
LIMIT 10;

-- 4. 查看有评分的记录
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
WHERE average_score IS NOT NULL
ORDER BY average_score DESC
LIMIT 10;

-- 5. 查看评分状态为已评分的记录
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
WHERE scoring_status = 'scored'
ORDER BY scored_at DESC
LIMIT 10; 