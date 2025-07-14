-- 检查现有成就数据
SELECT * FROM achievements ORDER BY id;

-- 检查成就进度记录
SELECT * FROM user_achievements ORDER BY user_id, achievement_id;

-- 检查头像框数据
SELECT * FROM avatar_frames ORDER BY id;

-- 检查勋章数据
SELECT * FROM medals ORDER BY id;

-- 检查用户头像框关联
SELECT * FROM user_avatar_frames ORDER BY user_id, frame_id;

-- 检查用户勋章关联
SELECT * FROM user_medals ORDER BY user_id, medal_id; 