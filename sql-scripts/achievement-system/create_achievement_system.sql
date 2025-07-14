-- =============================================
-- 成就系统数据库结构
-- 创建时间: 2024年12月
-- =============================================

BEGIN;

-- 1. 成就定义表
CREATE TABLE IF NOT EXISTS achievements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text UNIQUE NOT NULL, -- 成就代码，如 'first_deal', 'conversion_master'
  name text NOT NULL, -- 成就名称
  description text NOT NULL, -- 成就描述
  category text NOT NULL CHECK (category IN ('milestone', 'skill', 'social', 'special')), -- 成就分类
  icon text NOT NULL, -- 成就图标（emoji、图标代码或图片路径）
  icon_type text DEFAULT 'emoji' CHECK (icon_type IN ('emoji', 'svg', 'png', 'jpg', 'webp')), -- 图标类型
  icon_url text, -- 图片URL（当icon_type为图片时使用）
  color text DEFAULT '#1890ff', -- 成就颜色
  points_reward integer DEFAULT 0, -- 积分奖励
  avatar_frame_id uuid, -- 关联的头像框ID
  badge_id uuid, -- 关联的勋章ID
  requirements jsonb NOT NULL, -- 成就要求（JSON格式）
  is_active boolean DEFAULT true,
  is_hidden boolean DEFAULT false, -- 是否隐藏（特殊成就）
  sort_order integer DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- 2. 用户成就记录表
CREATE TABLE IF NOT EXISTS user_achievements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id bigint NOT NULL REFERENCES users_profile(id) ON DELETE CASCADE,
  achievement_id uuid NOT NULL REFERENCES achievements(id) ON DELETE CASCADE,
  progress integer DEFAULT 0, -- 当前进度
  target integer DEFAULT 1, -- 目标值
  is_completed boolean DEFAULT false,
  completed_at timestamptz,
  points_earned integer DEFAULT 0, -- 实际获得的积分
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(user_id, achievement_id)
);

-- 3. 头像框表
CREATE TABLE IF NOT EXISTS avatar_frames (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text,
  frame_type text NOT NULL CHECK (frame_type IN ('border', 'background', 'overlay')),
  frame_data jsonb NOT NULL, -- 头像框样式数据
  rarity text DEFAULT 'common' CHECK (rarity IN ('common', 'rare', 'epic', 'legendary')),
  is_active boolean DEFAULT true,
  sort_order integer DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

-- 4. 勋章表
CREATE TABLE IF NOT EXISTS badges (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text,
  icon text NOT NULL, -- 勋章图标
  icon_type text DEFAULT 'emoji' CHECK (icon_type IN ('emoji', 'svg', 'png', 'jpg', 'webp')), -- 图标类型
  icon_url text, -- 图片URL（当icon_type为图片时使用）
  color text DEFAULT '#1890ff',
  rarity text DEFAULT 'common' CHECK (rarity IN ('common', 'rare', 'epic', 'legendary')),
  is_active boolean DEFAULT true,
  sort_order integer DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

-- 5. 用户头像框表
CREATE TABLE IF NOT EXISTS user_avatar_frames (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id bigint NOT NULL REFERENCES users_profile(id) ON DELETE CASCADE,
  frame_id uuid NOT NULL REFERENCES avatar_frames(id) ON DELETE CASCADE,
  is_equipped boolean DEFAULT false, -- 是否正在使用
  unlocked_at timestamptz DEFAULT now(),
  created_at timestamptz DEFAULT now(),
  UNIQUE(user_id, frame_id)
);

-- 6. 用户勋章表
CREATE TABLE IF NOT EXISTS user_badges (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id bigint NOT NULL REFERENCES users_profile(id) ON DELETE CASCADE,
  badge_id uuid NOT NULL REFERENCES badges(id) ON DELETE CASCADE,
  is_equipped boolean DEFAULT false, -- 是否正在佩戴
  unlocked_at timestamptz DEFAULT now(),
  created_at timestamptz DEFAULT now(),
  UNIQUE(user_id, badge_id)
);

-- 7. 成就进度记录表（用于追踪进度变化）
CREATE TABLE IF NOT EXISTS achievement_progress_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id bigint NOT NULL REFERENCES users_profile(id) ON DELETE CASCADE,
  achievement_id uuid NOT NULL REFERENCES achievements(id) ON DELETE CASCADE,
  old_progress integer NOT NULL,
  new_progress integer NOT NULL,
  progress_change integer NOT NULL,
  trigger_source text NOT NULL, -- 触发来源
  trigger_data jsonb, -- 触发数据
  created_at timestamptz DEFAULT now()
);

-- 8. 创建索引
CREATE INDEX IF NOT EXISTS idx_achievements_category ON achievements(category, is_active);
CREATE INDEX IF NOT EXISTS idx_achievements_code ON achievements(code);
CREATE INDEX IF NOT EXISTS idx_user_achievements_user_id ON user_achievements(user_id);
CREATE INDEX IF NOT EXISTS idx_user_achievements_completed ON user_achievements(is_completed);
CREATE INDEX IF NOT EXISTS idx_user_avatar_frames_user_id ON user_avatar_frames(user_id);
CREATE INDEX IF NOT EXISTS idx_user_badges_user_id ON user_badges(user_id);
CREATE INDEX IF NOT EXISTS idx_achievement_progress_logs_user_achievement ON achievement_progress_logs(user_id, achievement_id);

-- 9. 启用RLS
ALTER TABLE achievements ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_achievements ENABLE ROW LEVEL SECURITY;
ALTER TABLE avatar_frames ENABLE ROW LEVEL SECURITY;
ALTER TABLE badges ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_avatar_frames ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_badges ENABLE ROW LEVEL SECURITY;
ALTER TABLE achievement_progress_logs ENABLE ROW LEVEL SECURITY;

-- 11. 创建核心函数

-- 获取用户成就列表
CREATE OR REPLACE FUNCTION get_user_achievements(p_user_id bigint)
RETURNS TABLE (
  achievement_id uuid,
  code text,
  name text,
  description text,
  category text,
  icon text,
  icon_type text,
  icon_url text,
  color text,
  points_reward integer,
  avatar_frame_id uuid,
  badge_id uuid,
  progress integer,
  target integer,
  is_completed boolean,
  completed_at timestamptz,
  points_earned integer,
  progress_percentage numeric
) LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  RETURN QUERY
  SELECT 
    a.id as achievement_id,
    a.code,
    a.name,
    a.description,
    a.category,
    a.icon,
    a.icon_type,
    a.icon_url,
    a.color,
    a.points_reward,
    a.avatar_frame_id,
    a.badge_id,
    COALESCE(ua.progress, 0) as progress,
    COALESCE(ua.target, 1) as target,
    COALESCE(ua.is_completed, false) as is_completed,
    ua.completed_at,
    COALESCE(ua.points_earned, 0) as points_earned,
    CASE 
      WHEN ua.target > 0 THEN 
        ROUND((COALESCE(ua.progress, 0)::numeric / ua.target::numeric) * 100, 1)
      ELSE 0 
    END as progress_percentage
  FROM achievements a
  LEFT JOIN user_achievements ua ON a.id = ua.achievement_id AND ua.user_id = p_user_id
  WHERE a.is_active = true
  ORDER BY a.sort_order, a.name;
END;
$$;

-- 更新成就进度
CREATE OR REPLACE FUNCTION update_achievement_progress(
  p_user_id bigint,
  p_achievement_code text,
  p_progress_change integer,
  p_trigger_source text,
  p_trigger_data jsonb DEFAULT NULL
)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_achievement_id uuid;
  v_current_progress integer;
  v_target integer;
  v_new_progress integer;
  v_is_completed boolean;
  v_points_reward integer;
  v_avatar_frame_id uuid;
  v_badge_id uuid;
  v_result jsonb;
BEGIN
  -- 获取成就信息
  SELECT id, points_reward, avatar_frame_id, badge_id
  INTO v_achievement_id, v_points_reward, v_avatar_frame_id, v_badge_id
  FROM achievements 
  WHERE code = p_achievement_code AND is_active = true;
  
  IF v_achievement_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Achievement not found');
  END IF;
  
  -- 获取当前进度
  SELECT COALESCE(progress, 0), COALESCE(target, 1), is_completed
  INTO v_current_progress, v_target, v_is_completed
  FROM user_achievements 
  WHERE user_id = p_user_id AND achievement_id = v_achievement_id;
  
  -- 如果已完成，不再更新
  IF v_is_completed THEN
    RETURN jsonb_build_object('success', true, 'message', 'Achievement already completed');
  END IF;
  
  v_new_progress := LEAST(v_current_progress + p_progress_change, v_target);
  v_is_completed := (v_new_progress >= v_target);
  
  -- 插入或更新用户成就记录
  INSERT INTO user_achievements (
    user_id, achievement_id, progress, target, is_completed, 
    completed_at, points_earned
  ) VALUES (
    p_user_id, v_achievement_id, v_new_progress, v_target, v_is_completed,
    CASE WHEN v_is_completed THEN now() ELSE NULL END,
    CASE WHEN v_is_completed THEN v_points_reward ELSE 0 END
  )
  ON CONFLICT (user_id, achievement_id) DO UPDATE SET
    progress = v_new_progress,
    is_completed = v_is_completed,
    completed_at = CASE WHEN v_is_completed AND user_achievements.completed_at IS NULL THEN now() ELSE user_achievements.completed_at END,
    points_earned = CASE WHEN v_is_completed AND user_achievements.points_earned = 0 THEN v_points_reward ELSE user_achievements.points_earned END,
    updated_at = now();
  
  -- 记录进度变化
  INSERT INTO achievement_progress_logs (
    user_id, achievement_id, old_progress, new_progress, 
    progress_change, trigger_source, trigger_data
  ) VALUES (
    p_user_id, v_achievement_id, v_current_progress, v_new_progress,
    p_progress_change, p_trigger_source, p_trigger_data
  );
  
  -- 如果成就完成，解锁相关奖励
  IF v_is_completed THEN
    -- 解锁头像框
    IF v_avatar_frame_id IS NOT NULL THEN
      INSERT INTO user_avatar_frames (user_id, frame_id)
      VALUES (p_user_id, v_avatar_frame_id)
      ON CONFLICT (user_id, frame_id) DO NOTHING;
    END IF;
    
    -- 解锁勋章
    IF v_badge_id IS NOT NULL THEN
      INSERT INTO user_badges (user_id, badge_id)
      VALUES (p_user_id, v_badge_id)
      ON CONFLICT (user_id, badge_id) DO NOTHING;
    END IF;
    
    -- 发放积分奖励
    IF v_points_reward > 0 THEN
      PERFORM award_points(p_user_id, 'ACHIEVEMENT', v_achievement_id, '成就奖励：' || p_achievement_code);
    END IF;
  END IF;
  
  v_result := jsonb_build_object(
    'success', true,
    'achievement_id', v_achievement_id,
    'old_progress', v_current_progress,
    'new_progress', v_new_progress,
    'is_completed', v_is_completed,
    'points_reward', CASE WHEN v_is_completed THEN v_points_reward ELSE 0 END
  );
  
  RETURN v_result;
END;
$$;

-- 获取用户头像框
CREATE OR REPLACE FUNCTION get_user_avatar_frames(p_user_id bigint)
RETURNS TABLE (
  frame_id uuid,
  name text,
  description text,
  frame_type text,
  frame_data jsonb,
  rarity text,
  is_equipped boolean,
  unlocked_at timestamptz
) LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  RETURN QUERY
  SELECT 
    af.id as frame_id,
    af.name,
    af.description,
    af.frame_type,
    af.frame_data,
    af.rarity,
    uaf.is_equipped,
    uaf.unlocked_at
  FROM avatar_frames af
  INNER JOIN user_avatar_frames uaf ON af.id = uaf.frame_id
  WHERE uaf.user_id = p_user_id AND af.is_active = true
  ORDER BY af.sort_order, af.name;
END;
$$;

-- 获取用户勋章
CREATE OR REPLACE FUNCTION get_user_badges(p_user_id bigint)
RETURNS TABLE (
  badge_id uuid,
  name text,
  description text,
  icon text,
  icon_type text,
  icon_url text,
  color text,
  rarity text,
  is_equipped boolean,
  unlocked_at timestamptz
) LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  RETURN QUERY
  SELECT 
    b.id as badge_id,
    b.name,
    b.description,
    b.icon,
    b.icon_type,
    b.icon_url,
    b.color,
    b.rarity,
    ub.is_equipped,
    ub.unlocked_at
  FROM badges b
  INNER JOIN user_badges ub ON b.id = ub.badge_id
  WHERE ub.user_id = p_user_id AND b.is_active = true
  ORDER BY b.sort_order, b.name;
END;
$$;

-- 12. 插入初始数据

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
INSERT INTO achievements (code, name, description, category, icon, icon_type, color, points_reward, avatar_frame_id, badge_id, requirements, sort_order) VALUES
-- 里程碑成就
('first_followup', '首次跟进', '完成第一个线索跟进', 'milestone', '📝', 'emoji', '#52c41a', 50, 
 (SELECT id FROM avatar_frames WHERE name = '青铜头像框'), 
 (SELECT id FROM badges WHERE name = '新手销售'),
 '{"followup_count": 1}', 1),

('followup_master', '跟进达人', '完成100个线索跟进', 'milestone', '📊', 'emoji', '#1890ff', 200,
 (SELECT id FROM avatar_frames WHERE name = '白银头像框'), NULL,
 '{"followup_count": 100}', 2),

('first_deal', '首次成交', '完成第一笔成交', 'milestone', '💎', 'emoji', '#fa8c16', 500,
 (SELECT id FROM avatar_frames WHERE name = '黄金头像框'),
 (SELECT id FROM badges WHERE name = '成交达人'),
 '{"deal_count": 1}', 3),

('deal_master', '成交大师', '完成50笔成交', 'milestone', '🏆', 'emoji', '#722ed1', 1000,
 (SELECT id FROM avatar_frames WHERE name = '钻石头像框'), NULL,
 '{"deal_count": 50}', 4),

-- 技能成就
('conversion_master', '转化大师', '转化率达到20%', 'skill', '📈', 'emoji', '#eb2f96', 300, NULL,
 (SELECT id FROM badges WHERE name = '转化大师'),
 '{"conversion_rate": 20}', 5),

('points_collector', '积分收集者', '累计获得1000积分', 'milestone', '💰', 'emoji', '#52c41a', 100, NULL, NULL,
 '{"total_points_earned": 1000}', 6),

-- 社交成就
('team_helper', '团队助手', '帮助同事10次', 'social', '🤝', 'emoji', '#1890ff', 150, NULL,
 (SELECT id FROM badges WHERE name = '团队领袖'),
 '{"help_count": 10}', 7),

-- 特殊成就
('daily_checkin', '连续签到', '连续签到30天', 'special', '📅', 'emoji', '#fa8c16', 200, NULL,
 (SELECT id FROM badges WHERE name = '连续签到'),
 '{"consecutive_checkins": 30}', 8);

-- 插入PNG图片成就示例
INSERT INTO achievements (code, name, description, category, icon, icon_type, icon_url, color, points_reward, requirements, sort_order) VALUES
('speed_dealer', '快速成交', '在24小时内完成成交', 'skill', 'speed-dealer.png', 'png', '/images/achievements/speed-dealer.png', '#fa8c16', 300, '{"deal_speed_hours": 24}', 9),
('perfect_deal', '完美成交', '成交金额超过100万', 'milestone', 'perfect-deal.png', 'png', '/images/achievements/perfect-deal.png', '#722ed1', 800, '{"deal_amount": 1000000}', 10),
('customer_service', '客户服务之星', '获得客户好评10次', 'social', 'customer-service.png', 'png', '/images/achievements/customer-service.png', '#52c41a', 200, '{"customer_ratings": 10}', 11),
('team_mentor', '团队导师', '帮助5名同事完成培训', 'social', 'team-mentor.png', 'png', '/images/achievements/team-mentor.png', '#1890ff', 400, '{"mentor_count": 5}', 12);

-- 插入PNG图片勋章示例
INSERT INTO badges (name, description, icon, icon_type, icon_url, color, rarity, sort_order) VALUES
('销售冠军', '月度销售冠军', 'sales-champion.png', 'png', '/images/badges/sales-champion.png', '#ffd700', 'legendary', 6),
('服务之星', '客户服务优秀', 'service-star.png', 'png', '/images/badges/service-star.png', '#52c41a', 'epic', 7),
('创新先锋', '提出创新方案', 'innovation-pioneer.png', 'png', '/images/badges/innovation-pioneer.png', '#1890ff', 'rare', 8),
('质量保证', '零投诉记录', 'quality-assurance.png', 'png', '/images/badges/quality-assurance.png', '#fa8c16', 'epic', 9);

COMMIT;

-- 部署完成提示
DO $$
BEGIN
  RAISE NOTICE '成就系统数据库结构创建完成！';
  RAISE NOTICE '包含：成就定义、用户成就、头像框、勋章等功能';
END $$; 