-- 插入测试直播数据
-- 这个脚本可以直接在 Supabase SQL Editor 中运行

-- 首先获取用户ID
DO $$
DECLARE
  user1_id bigint;
  user2_id bigint;
  user3_id bigint;
BEGIN
  -- 获取前3个用户的ID
  SELECT id INTO user1_id FROM users_profile LIMIT 1 OFFSET 0;
  SELECT id INTO user2_id FROM users_profile LIMIT 1 OFFSET 1;
  SELECT id INTO user3_id FROM users_profile LIMIT 1 OFFSET 2;
  
  -- 插入测试数据
  INSERT INTO live_stream_schedules (
    date, 
    time_slot_id, 
    participant_ids, 
    location, 
    notes, 
    status, 
    created_by, 
    average_score, 
    scoring_status,
    scored_by,
    scored_at,
    scoring_data
  ) VALUES 
    -- 2025-01-15 上午，已报名，未评分
    ('2025-01-15', 'morning-10-12', ARRAY[user1_id, user2_id], '线上直播', '户型A', 'booked', user1_id, null, 'not_scored', null, null, null),
    
    -- 2025-01-15 下午，已完成，已评分
    ('2025-01-15', 'afternoon-14-16', ARRAY[user2_id, user3_id], '线上直播', '户型B', 'completed', user2_id, 8.5, 'scored', user1_id, now(), '{"dimension1": 8, "dimension2": 9}'),
    
    -- 2025-01-16 上午，可报名
    ('2025-01-16', 'morning-10-12', '{}', '线上直播', '户型C', 'available', user3_id, null, 'not_scored', null, null, null),
    
    -- 2025-01-16 下午，已锁定
    ('2025-01-16', 'afternoon-14-16', ARRAY[user1_id], '线上直播', '户型D', 'locked', user1_id, null, 'not_scored', null, null, null),
    
    -- 2025-01-17 上午，评分中
    ('2025-01-17', 'morning-10-12', ARRAY[user2_id, user3_id], '线上直播', '户型E', 'completed', user2_id, null, 'scoring_in_progress', null, null, null),
    
    -- 2025-01-17 下午，已确认
    ('2025-01-17', 'afternoon-14-16', ARRAY[user1_id, user2_id], '线上直播', '户型F', 'completed', user1_id, 9.2, 'approved', user3_id, now(), '{"dimension1": 9, "dimension2": 9.5}'),
    
    -- 2025-01-18 上午，已取消
    ('2025-01-18', 'morning-10-12', ARRAY[user3_id], '线上直播', '户型G', 'cancelled', user3_id, null, 'not_scored', null, null, null),
    
    -- 2025-01-18 下午，编辑中
    ('2025-01-18', 'afternoon-14-16', ARRAY[user1_id, user2_id, user3_id], '线上直播', '户型H', 'editing', user1_id, null, 'not_scored', null, null, null)
  ON CONFLICT (date, time_slot_id) DO NOTHING;

  RAISE NOTICE '测试数据插入完成，使用了用户ID: %, %, %', user1_id, user2_id, user3_id;
END $$; 