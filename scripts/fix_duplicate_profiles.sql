-- =====================================================
-- 修复重复Profile记录问题
-- =====================================================

-- 1. 查看重复记录情况
SELECT 
    user_id, 
    COUNT(*) as duplicate_count,
    array_agg(id ORDER BY created_at) as profile_ids,
    array_agg(created_at ORDER BY created_at) as created_times
FROM users_profile 
GROUP BY user_id 
HAVING COUNT(*) > 1
ORDER BY duplicate_count DESC;

-- 2. 删除重复记录，保留最新的一个
WITH ranked_profiles AS (
    SELECT 
        id,
        user_id,
        ROW_NUMBER() OVER (PARTITION BY user_id ORDER BY created_at DESC) as rn
    FROM users_profile
)
DELETE FROM users_profile 
WHERE id IN (
    SELECT id FROM ranked_profiles WHERE rn > 1
);

-- 3. 添加唯一约束防止未来重复
ALTER TABLE users_profile 
ADD CONSTRAINT users_profile_user_id_unique UNIQUE (user_id);

-- 4. 验证修复结果
SELECT 
    user_id, 
    COUNT(*) as count
FROM users_profile 
GROUP BY user_id 
HAVING COUNT(*) > 1;
