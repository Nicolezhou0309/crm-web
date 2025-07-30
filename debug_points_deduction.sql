-- 调试积分扣除问题
-- 执行时间: 2025年1月15日

-- 1. 检查最近的积分流水记录（按时间排序）
SELECT 
    id,
    user_id,
    points_change,
    balance_after,
    transaction_type,
    source_type,
    source_id,
    description,
    created_at,
    EXTRACT(EPOCH FROM created_at) as timestamp_epoch
FROM public.user_points_transactions 
WHERE user_id = 1
  AND created_at >= NOW() - INTERVAL '30 minutes'
ORDER BY created_at DESC;

-- 2. 检查最近的兑换记录
SELECT 
    id,
    user_id,
    exchange_type,
    target_id,
    points_used,
    description,
    created_at,
    EXTRACT(EPOCH FROM created_at) as timestamp_epoch
FROM public.points_exchange_records 
WHERE user_id = 1
  AND created_at >= NOW() - INTERVAL '30 minutes'
ORDER BY created_at DESC;

-- 3. 检查用户积分钱包历史变化
SELECT 
    user_id,
    total_points,
    created_at,
    updated_at,
    EXTRACT(EPOCH FROM updated_at) as timestamp_epoch
FROM public.user_points_wallet 
WHERE user_id = 1;

-- 4. 检查是否有重复的兑换操作
SELECT 
    user_id,
    exchange_type,
    points_used,
    description,
    created_at,
    COUNT(*) as duplicate_count
FROM public.points_exchange_records 
WHERE user_id = 1
  AND created_at >= NOW() - INTERVAL '30 minutes'
GROUP BY 
    user_id,
    exchange_type,
    points_used,
    description,
    created_at
HAVING COUNT(*) > 1
ORDER BY created_at DESC;

-- 5. 检查积分变化的时间线
WITH points_timeline AS (
  SELECT 
    created_at,
    points_change,
    balance_after,
    description,
    'transaction' as source
  FROM public.user_points_transactions 
  WHERE user_id = 1
    AND created_at >= NOW() - INTERVAL '30 minutes'
  
  UNION ALL
  
  SELECT 
    created_at,
    -points_used as points_change,
    NULL as balance_after,
    description,
    'exchange' as source
  FROM public.points_exchange_records 
  WHERE user_id = 1
    AND created_at >= NOW() - INTERVAL '30 minutes'
)
SELECT 
  created_at,
  points_change,
  balance_after,
  description,
  source
FROM points_timeline
ORDER BY created_at DESC; 