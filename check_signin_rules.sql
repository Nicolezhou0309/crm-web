-- =============================================
-- 检查签到规则和记录
-- 用于诊断签到积分问题
-- =============================================

-- 1. 检查签到规则配置
SELECT 
  id,
  rule_name,
  rule_type,
  source_type,
  points_value,
  is_active,
  description
FROM points_rules 
WHERE source_type = 'SIGNIN'
ORDER BY id;

-- 2. 检查最近的签到记录（最近10条）
SELECT 
  id,
  user_id,
  points_change,
  balance_after,
  transaction_type,
  source_type,
  description,
  created_at
FROM user_points_transactions 
WHERE source_type = 'SIGNIN' 
ORDER BY created_at DESC 
LIMIT 10;

-- 3. 检查用户积分钱包状态
SELECT 
  user_id,
  total_points,
  total_earned_points,
  total_consumed_points,
  updated_at
FROM user_points_wallet 
ORDER BY updated_at DESC 
LIMIT 5;

-- 4. 统计今日签到次数
SELECT 
  COUNT(*) as today_signin_count,
  SUM(points_change) as today_signin_points
FROM user_points_transactions 
WHERE source_type = 'SIGNIN' 
  AND created_at >= CURRENT_DATE;

-- 5. 检查是否有重复的签到规则
SELECT 
  source_type,
  COUNT(*) as rule_count,
  array_agg(points_value) as points_values
FROM points_rules 
WHERE source_type = 'SIGNIN'
GROUP BY source_type
HAVING COUNT(*) > 1; 