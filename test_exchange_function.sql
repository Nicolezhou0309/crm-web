-- 测试脚本：检查 exchange_goods_item 函数
-- 执行时间: 2025年1月15日

-- 1. 检查函数是否存在
SELECT 
    proname as function_name,
    prosrc as function_source
FROM pg_proc 
WHERE proname = 'exchange_goods_item';

-- 2. 检查函数定义
SELECT 
    p.proname,
    pg_get_functiondef(p.oid) as function_definition
FROM pg_proc p
JOIN pg_namespace n ON p.pronamespace = n.oid
WHERE p.proname = 'exchange_goods_item'
AND n.nspname = 'public';

-- 3. 检查是否有重复定义
SELECT 
    proname,
    COUNT(*) as definition_count
FROM pg_proc 
WHERE proname = 'exchange_goods_item'
GROUP BY proname;

-- 4. 检查最近的兑换记录
SELECT 
    id,
    user_id,
    exchange_type,
    points_used,
    description,
    created_at
FROM points_exchange_records 
WHERE user_id = 1
ORDER BY created_at DESC
LIMIT 10;

-- 5. 检查积分变化记录
SELECT 
    id,
    user_id,
    points_change,
    balance_after,
    transaction_type,
    description,
    created_at
FROM user_points_transactions 
WHERE user_id = 1
ORDER BY created_at DESC
LIMIT 10; 