-- 插入基础头像框
INSERT INTO avatar_frames (name, description, frame_type, frame_data, rarity, sort_order) VALUES
('默认头像框', '系统默认头像框', 'border', '{"border": "2px solid #e0e0e0", "borderRadius": "50%"}', 'common', 0),
('青铜头像框', '青铜成就头像框', 'border', '{"border": "3px solid #cd7f32", "borderRadius": "50%", "boxShadow": "0 0 10px #cd7f32"}', 'common', 1),
('白银头像框', '白银成就头像框', 'border', '{"border": "3px solid #c0c0c0", "borderRadius": "50%", "boxShadow": "0 0 15px #c0c0c0"}', 'rare', 2),
('黄金头像框', '黄金成就头像框', 'border', '{"border": "3px solid #ffd700", "borderRadius": "50%", "boxShadow": "0 0 20px #ffd700"}', 'epic', 3),
('钻石头像框', '钻石成就头像框', 'border', '{"border": "3px solid #b9f2ff", "borderRadius": "50%", "boxShadow": "0 0 25px #b9f2ff"}', 'legendary', 4);

-- 插入基础勋章
INSERT INTO badges (name, description, icon, icon_type, color, rarity, sort_order) VALUES
('新手销售', '完成第一个跟进', '🎯', 'emoji', '#52c41a', 'common', 1),
('成交达人', '完成第一笔成交', '💎', 'emoji', '#1890ff', 'rare', 2),
('转化大师', '转化率达到20%', '🏆', 'emoji', '#fa8c16', 'epic', 3),
('团队领袖', '帮助同事10次', '👑', 'emoji', '#722ed1', 'legendary', 4),
('连续签到', '连续签到30天', '📅', 'emoji', '#eb2f96', 'rare', 5);

-- 插入基础成就
INSERT INTO achievements (code, name, description, category, icon, icon_type, color, points_reward, requirements, sort_order) VALUES
('first_followup', '首次跟进', '完成第一个线索跟进', 'milestone', '📝', 'emoji', '#52c41a', 50, '{"followup_count": 1}', 1),
('followup_master', '跟进达人', '完成100个线索跟进', 'milestone', '📊', 'emoji', '#1890ff', 200, '{"followup_count": 100}', 2),
('first_deal', '首次成交', '完成第一笔成交', 'milestone', '💎', 'emoji', '#fa8c16', 500, '{"deal_count": 1}', 3),
('deal_master', '成交大师', '完成50笔成交', 'milestone', '🏆', 'emoji', '#722ed1', 1000, '{"deal_count": 50}', 4),
('conversion_master', '转化大师', '转化率达到20%', 'skill', '📈', 'emoji', '#eb2f96', 300, '{"conversion_rate": 20}', 5),
('points_collector', '积分收集者', '累计获得1000积分', 'milestone', '💰', 'emoji', '#52c41a', 100, '{"total_points_earned": 1000}', 6),
('team_helper', '团队助手', '帮助同事10次', 'social', '🤝', 'emoji', '#1890ff', 150, '{"help_count": 10}', 7),
('daily_checkin', '连续签到', '连续签到30天', 'special', '📅', 'emoji', '#fa8c16', 200, '{"consecutive_checkins": 30}', 8);

-- 验证插入结果
SELECT 'achievements' as table_name, COUNT(*) as count FROM achievements
UNION ALL
SELECT 'badges' as table_name, COUNT(*) as count FROM badges
UNION ALL
SELECT 'avatar_frames' as table_name, COUNT(*) as count FROM avatar_frames; 