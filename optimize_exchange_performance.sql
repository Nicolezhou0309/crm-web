-- 优化兑换带看卡性能的索引
-- 执行时间: 2025年1月

-- 1. 为兑换记录表添加索引
CREATE INDEX IF NOT EXISTS idx_points_exchange_records_user_id 
ON points_exchange_records(user_id);

CREATE INDEX IF NOT EXISTS idx_points_exchange_records_exchange_type 
ON points_exchange_records(exchange_type);

CREATE INDEX IF NOT EXISTS idx_points_exchange_records_user_type 
ON points_exchange_records(user_id, exchange_type);

-- 2. 为用户档案表添加索引
CREATE INDEX IF NOT EXISTS idx_users_profile_organization_id 
ON users_profile(organization_id);

CREATE INDEX IF NOT EXISTS idx_users_profile_user_id 
ON users_profile(user_id);

-- 3. 为组织表添加索引
CREATE INDEX IF NOT EXISTS idx_organizations_admin 
ON organizations(admin);

-- 4. 为社区关键词表添加索引
CREATE INDEX IF NOT EXISTS idx_community_keywords_keyword 
ON community_keywords USING gin(keyword);

CREATE INDEX IF NOT EXISTS idx_community_keywords_priority 
ON community_keywords(priority);

-- 5. 为带看队列记录表添加索引
CREATE INDEX IF NOT EXISTS idx_showings_queue_record_user_community 
ON showings_queue_record(user_id, community);

CREATE INDEX IF NOT EXISTS idx_showings_queue_record_queue_type 
ON showings_queue_record(queue_type);

-- 6. 添加复合索引以优化常见查询
CREATE INDEX IF NOT EXISTS idx_showings_queue_record_user_community_type 
ON showings_queue_record(user_id, community, queue_type); 