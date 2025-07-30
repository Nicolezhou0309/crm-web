-- 检查积分重复扣除问题
-- 执行时间: 2025年1月15日

-- 1. 检查最近的积分流水记录
SELECT 
    id,
    user_id,
    points_change,
    balance_after,
    transaction_type,
    source_type,
    source_id,
    description,
    created_at
FROM public.user_points_transactions 
WHERE user_id = 1
ORDER BY created_at DESC 
LIMIT 20;

-- 2. 检查最近的兑换记录
SELECT 
    id,
    user_id,
    exchange_type,
    target_id,
    points_used,
    description,
    created_at
FROM public.points_exchange_records 
WHERE user_id = 1
ORDER BY created_at DESC 
LIMIT 10;

-- 3. 检查用户积分钱包当前状态
SELECT 
    user_id,
    total_points,
    created_at,
    updated_at
FROM public.user_points_wallet 
WHERE user_id = 1;

-- 4. 检查是否有重复的积分扣除记录（同一分钟内）
SELECT 
    user_id,
    points_change,
    transaction_type,
    source_type,
    source_id,
    description,
    created_at,
    COUNT(*) as duplicate_count
FROM public.user_points_transactions 
WHERE user_id = 1
  AND transaction_type = 'DEDUCT'
  AND created_at >= NOW() - INTERVAL '1 hour'
GROUP BY 
    user_id,
    points_change,
    transaction_type,
    source_type,
    source_id,
    description,
    created_at
HAVING COUNT(*) > 1
ORDER BY created_at DESC;

-- 5. 检查带看卡商品信息
SELECT 
    id,
    name,
    category,
    points_cost,
    is_active
FROM public.exchange_goods 
WHERE category = 'direct_card' OR name LIKE '%带看%'
ORDER BY created_at DESC; 