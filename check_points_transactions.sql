-- 查询最近的积分流水记录
SELECT 
    id,
    user_id,
    points_change,
    points_balance,
    transaction_type,
    description,
    created_at,
    related_record_id
FROM public.user_points_transactions 
ORDER BY created_at DESC 
LIMIT 20;

-- 查询特定用户的积分流水
SELECT 
    id,
    user_id,
    points_change,
    points_balance,
    transaction_type,
    description,
    created_at,
    related_record_id
FROM public.user_points_transactions 
WHERE user_id = '1'
ORDER BY created_at DESC 
LIMIT 10;

-- 查询兑换记录
SELECT 
    id,
    user_id,
    goods_id,
    exchange_type,
    points_cost,
    created_at
FROM public.points_exchange_records 
ORDER BY created_at DESC 
LIMIT 10; 