-- 测试直播报名&评分数据插入脚本
-- 用于测试 live_stream_schedules 表的功能

-- 插入测试用户（如果不存在）
INSERT INTO users_profile (user_id, nickname, email, avatar_url, department_id, role, is_active, created_at, updated_at)
VALUES 
  ('test-user-1', '测试用户1', 'test1@example.com', null, 1, 'manager', true, now(), now()),
  ('test-user-2', '测试用户2', 'test2@example.com', null, 1, 'manager', true, now(), now()),
  ('test-user-3', '测试用户3', 'test3@example.com', null, 1, 'manager', true, now(), now())
ON CONFLICT (user_id) DO NOTHING;

-- 获取用户ID
DO $$
DECLARE
  user1_id bigint;
  user2_id bigint;
  user3_id bigint;
BEGIN
  SELECT id INTO user1_id FROM users_profile WHERE user_id = 'test-user-1';
  SELECT id INTO user2_id FROM users_profile WHERE user_id = 'test-user-2';
  SELECT id INTO user3_id FROM users_profile WHERE user_id = 'test-user-3';

  -- 插入本周的直播安排
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
    -- 今天上午，已报名，未评分
    (CURRENT_DATE, 'morning-10-12', ARRAY[user1_id, user2_id], '线上直播', '户型A', 'booked', user1_id, null, 'not_scored', null, null, null),
    
    -- 今天下午，已完成，已评分
    (CURRENT_DATE, 'afternoon-14-16', ARRAY[user2_id, user3_id], '线上直播', '户型B', 'completed', user2_id, 8.5, 'scored', user1_id, now(), '{"dimension1": 8, "dimension2": 9}'),
    
    -- 明天上午，可报名
    (CURRENT_DATE + INTERVAL '1 day', 'morning-10-12', '{}', '线上直播', '户型C', 'available', user3_id, null, 'not_scored', null, null, null),
    
    -- 明天下午，已锁定
    (CURRENT_DATE + INTERVAL '1 day', 'afternoon-14-16', ARRAY[user1_id], '线上直播', '户型D', 'locked', user1_id, null, 'not_scored', null, null, null),
    
    -- 后天上午，评分中
    (CURRENT_DATE + INTERVAL '2 days', 'morning-10-12', ARRAY[user2_id, user3_id], '线上直播', '户型E', 'completed', user2_id, null, 'scoring_in_progress', null, null, null),
    
    -- 后天下午，已确认
    (CURRENT_DATE + INTERVAL '2 days', 'afternoon-14-16', ARRAY[user1_id, user2_id], '线上直播', '户型F', 'completed', user1_id, 9.2, 'approved', user3_id, now(), '{"dimension1": 9, "dimension2": 9.5}'),
    
    -- 大后天上午，已取消
    (CURRENT_DATE + INTERVAL '3 days', 'morning-10-12', ARRAY[user3_id], '线上直播', '户型G', 'cancelled', user3_id, null, 'not_scored', null, null, null),
    
    -- 大后天下午，编辑中
    (CURRENT_DATE + INTERVAL '3 days', 'afternoon-14-16', ARRAY[user1_id, user2_id, user3_id], '线上直播', '户型H', 'editing', user1_id, null, 'not_scored', null, null, null)
  ON CONFLICT (date, time_slot_id) DO NOTHING;

  RAISE NOTICE '测试数据插入完成';
END $$; 