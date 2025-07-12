-- =============================================
-- 积分系统最终版部署脚本
-- 包含表结构、索引、触发器、函数（修正版）、初始数据
-- =============================================

BEGIN;

-- 1. 删除旧触发器和函数
DROP TRIGGER IF EXISTS trigger_update_user_points_wallet ON user_points_transactions;
DROP FUNCTION IF EXISTS update_user_points_wallet();
DROP FUNCTION IF EXISTS award_points(BIGINT, VARCHAR, BIGINT, TEXT);
DROP FUNCTION IF EXISTS exchange_points(BIGINT, VARCHAR, BIGINT, INTEGER, TEXT);
DROP FUNCTION IF EXISTS get_user_points_info(BIGINT);

-- 2. 删除旧表
DROP TABLE IF EXISTS points_exchange_records CASCADE;
DROP TABLE IF EXISTS user_points_transactions CASCADE;
DROP TABLE IF EXISTS user_points_wallet CASCADE;
DROP TABLE IF EXISTS points_rules CASCADE;
DROP TABLE IF EXISTS points_transfer_records CASCADE;
DROP TABLE IF EXISTS points_activities CASCADE;

-- 3. 创建表结构
CREATE TABLE user_points_wallet (
  id SERIAL PRIMARY KEY,
  user_id BIGINT NOT NULL,  -- 使用BIGINT，对应users_profile.id
  total_points INTEGER DEFAULT 0,
  total_earned_points INTEGER DEFAULT 0,
  total_consumed_points INTEGER DEFAULT 0,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(user_id)
);

CREATE TABLE user_points_transactions (
  id SERIAL PRIMARY KEY,
  user_id BIGINT NOT NULL,  -- 使用BIGINT
  points_change INTEGER NOT NULL,
  balance_after INTEGER NOT NULL,
  transaction_type VARCHAR(50) NOT NULL,  -- EARN/EXCHANGE/DEDUCT
  source_type VARCHAR(50) NOT NULL,       -- FOLLOWUP/DEAL/SIGNIN/EXCHANGE_LEAD
  source_id BIGINT,                       -- 使用BIGINT
  description TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  created_by BIGINT                       -- 使用BIGINT
);

CREATE TABLE points_rules (
  id SERIAL PRIMARY KEY,
  rule_name VARCHAR(100) NOT NULL,
  rule_type VARCHAR(50) NOT NULL,         -- EARN/EXCHANGE/DEDUCT
  source_type VARCHAR(50) NOT NULL,       -- 行为类型
  points_value INTEGER NOT NULL,          -- 积分值
  is_active BOOLEAN DEFAULT true,
  start_time TIMESTAMP,
  end_time TIMESTAMP,
  max_times_per_day INTEGER,              -- 每日限制
  max_times_total INTEGER,                -- 总限制
  conditions JSONB,                       -- 扩展条件
  description TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  created_by BIGINT                       -- 使用BIGINT
);

CREATE TABLE points_exchange_records (
  id SERIAL PRIMARY KEY,
  user_id BIGINT NOT NULL,               -- 使用BIGINT
  exchange_type VARCHAR(50) NOT NULL,     -- LEAD/GIFT
  target_id BIGINT NOT NULL,             -- 使用BIGINT
  points_used INTEGER NOT NULL,
  exchange_time TIMESTAMP DEFAULT NOW(),
  status VARCHAR(20) DEFAULT 'SUCCESS',
  created_at TIMESTAMP DEFAULT NOW()
);

-- 4. 创建索引
CREATE INDEX IF NOT EXISTS idx_user_points_wallet_user_id ON user_points_wallet(user_id);
CREATE INDEX IF NOT EXISTS idx_user_points_transactions_user_id ON user_points_transactions(user_id);
CREATE INDEX IF NOT EXISTS idx_user_points_transactions_created_at ON user_points_transactions(created_at);
CREATE INDEX IF NOT EXISTS idx_user_points_transactions_transaction_type ON user_points_transactions(transaction_type);
CREATE INDEX IF NOT EXISTS idx_user_points_transactions_source_type ON user_points_transactions(source_type);
CREATE INDEX IF NOT EXISTS idx_points_rules_source_type ON points_rules(source_type);
CREATE INDEX IF NOT EXISTS idx_points_rules_is_active ON points_rules(is_active);
CREATE INDEX IF NOT EXISTS idx_points_exchange_records_user_id ON points_exchange_records(user_id);
CREATE INDEX IF NOT EXISTS idx_points_exchange_records_exchange_time ON points_exchange_records(exchange_time);

-- 5. 创建触发器函数和触发器
CREATE OR REPLACE FUNCTION update_user_points_wallet()
RETURNS TRIGGER AS $$
BEGIN
  -- 插入或更新积分钱包
  INSERT INTO user_points_wallet (user_id, total_points, total_earned_points, total_consumed_points, updated_at)
  VALUES (
    NEW.user_id,
    COALESCE((SELECT total_points FROM user_points_wallet WHERE user_id = NEW.user_id), 0) + NEW.points_change,
    CASE 
      WHEN NEW.points_change > 0 THEN COALESCE((SELECT total_earned_points FROM user_points_wallet WHERE user_id = NEW.user_id), 0) + NEW.points_change
      ELSE COALESCE((SELECT total_earned_points FROM user_points_wallet WHERE user_id = NEW.user_id), 0)
    END,
    CASE 
      WHEN NEW.points_change < 0 THEN COALESCE((SELECT total_consumed_points FROM user_points_wallet WHERE user_id = NEW.user_id), 0) + ABS(NEW.points_change)
      ELSE COALESCE((SELECT total_consumed_points FROM user_points_wallet WHERE user_id = NEW.user_id), 0)
    END,
    NOW()
  )
  ON CONFLICT (user_id) DO UPDATE SET
    total_points = user_points_wallet.total_points + NEW.points_change,
    total_earned_points = CASE 
      WHEN NEW.points_change > 0 THEN user_points_wallet.total_earned_points + NEW.points_change
      ELSE user_points_wallet.total_earned_points
    END,
    total_consumed_points = CASE 
      WHEN NEW.points_change < 0 THEN user_points_wallet.total_consumed_points + ABS(NEW.points_change)
      ELSE user_points_wallet.total_consumed_points
    END,
    updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_user_points_wallet
  AFTER INSERT ON user_points_transactions
  FOR EACH ROW
  EXECUTE FUNCTION update_user_points_wallet();

-- 6. 创建业务函数（修复版：只插入流水，钱包余额由触发器维护）
CREATE OR REPLACE FUNCTION award_points(
  p_user_id BIGINT,
  p_source_type VARCHAR(50),
  p_source_id BIGINT DEFAULT NULL,
  p_description TEXT DEFAULT NULL
)
RETURNS JSONB AS $$
DECLARE
  v_rule_id INTEGER;
  v_points_value INTEGER;
  v_current_balance INTEGER;
  v_new_balance INTEGER;
  v_result JSONB;
  v_today_count INTEGER;
  v_total_count INTEGER;
BEGIN
  -- 1. 查找适用的积分规则
  SELECT id, points_value
  INTO v_rule_id, v_points_value
  FROM points_rules 
  WHERE source_type = p_source_type 
    AND is_active = true
    AND (start_time IS NULL OR start_time <= NOW())
    AND (end_time IS NULL OR end_time >= NOW())
  LIMIT 1;
  
  -- 2. 检查规则是否存在
  IF v_rule_id IS NULL THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'No active rule found for source type: ' || p_source_type
    );
  END IF;
  
  -- 3. 检查每日限制
  IF EXISTS (SELECT 1 FROM points_rules WHERE id = v_rule_id AND max_times_per_day IS NOT NULL) THEN
    SELECT COUNT(*)
    INTO v_today_count
    FROM user_points_transactions
    WHERE user_id = p_user_id 
      AND source_type = p_source_type
      AND created_at >= CURRENT_DATE;
    
    IF v_today_count >= (SELECT max_times_per_day FROM points_rules WHERE id = v_rule_id) THEN
      RETURN jsonb_build_object(
        'success', false,
        'error', 'Daily limit reached for source type: ' || p_source_type
      );
    END IF;
  END IF;
  
  -- 4. 检查总限制
  IF EXISTS (SELECT 1 FROM points_rules WHERE id = v_rule_id AND max_times_total IS NOT NULL) THEN
    SELECT COUNT(*)
    INTO v_total_count
    FROM user_points_transactions
    WHERE user_id = p_user_id 
      AND source_type = p_source_type;
    
    IF v_total_count >= (SELECT max_times_total FROM points_rules WHERE id = v_rule_id) THEN
      RETURN jsonb_build_object(
        'success', false,
        'error', 'Total limit reached for source type: ' || p_source_type
      );
    END IF;
  END IF;
  
  -- 5. 获取当前积分余额
  SELECT total_points INTO v_current_balance
  FROM user_points_wallet
  WHERE user_id = p_user_id;
  v_current_balance := COALESCE(v_current_balance, 0);
  v_new_balance := v_current_balance + v_points_value;
  
  -- 6. 只插入积分流水记录，钱包余额由触发器维护
  INSERT INTO user_points_transactions (
    user_id, points_change, balance_after, 
    transaction_type, source_type, source_id, description
  ) VALUES (
    p_user_id, v_points_value, v_new_balance,
    'EARN', p_source_type, p_source_id,
    COALESCE(p_description, '自动发放积分')
  );
  
  -- 7. 返回结果
  v_result := jsonb_build_object(
    'success', true,
    'points_awarded', v_points_value,
    'new_balance', v_new_balance,
    'rule_id', v_rule_id,
    'description', COALESCE(p_description, '自动发放积分')
  );
  
  RETURN v_result;
  
EXCEPTION
  WHEN OTHERS THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Failed to award points: ' || SQLERRM
    );
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION exchange_points(
  p_user_id BIGINT,
  p_exchange_type VARCHAR(50),
  p_target_id BIGINT,
  p_points_required INTEGER,
  p_description TEXT DEFAULT NULL
)
RETURNS JSONB AS $$
DECLARE
  v_current_balance INTEGER;
  v_new_balance INTEGER;
  v_result JSONB;
BEGIN
  -- 1. 检查用户积分余额
  SELECT total_points INTO v_current_balance
  FROM user_points_wallet
  WHERE user_id = p_user_id;
  
  IF v_current_balance IS NULL OR v_current_balance < p_points_required THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Insufficient points. Required: ' || p_points_required || ', Available: ' || COALESCE(v_current_balance, 0)
    );
  END IF;
  
  v_new_balance := v_current_balance - p_points_required;
  
  -- 2. 插入兑换记录
  INSERT INTO points_exchange_records (
    user_id, exchange_type, target_id, points_used
  ) VALUES (
    p_user_id, p_exchange_type, p_target_id, p_points_required
  );
  
  -- 3. 只插入积分流水记录，钱包余额由触发器维护
  INSERT INTO user_points_transactions (
    user_id, points_change, balance_after,
    transaction_type, source_type, source_id, description
  ) VALUES (
    p_user_id, -p_points_required, v_new_balance,
    'EXCHANGE', p_exchange_type, p_target_id,
    COALESCE(p_description, '积分兑换')
  );
  
  -- 4. 返回结果
  v_result := jsonb_build_object(
    'success', true,
    'points_used', p_points_required,
    'new_balance', v_new_balance,
    'exchange_id', currval('points_exchange_records_id_seq'),
    'description', COALESCE(p_description, '积分兑换')
  );
  
  RETURN v_result;
  
EXCEPTION
  WHEN OTHERS THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Failed to exchange points: ' || SQLERRM
    );
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION get_user_points_info(
  p_user_id BIGINT
)
RETURNS JSONB AS $$
DECLARE
  v_wallet_info JSONB;
  v_recent_transactions JSONB;
  v_result JSONB;
BEGIN
  -- 获取钱包信息
  SELECT jsonb_build_object(
    'total_points', total_points,
    'total_earned_points', total_earned_points,
    'total_consumed_points', total_consumed_points,
    'updated_at', updated_at
  )
  INTO v_wallet_info
  FROM user_points_wallet
  WHERE user_id = p_user_id;

  -- 获取最近交易记录（修复 ORDER BY 问题）
  SELECT jsonb_agg(
    jsonb_build_object(
      'id', t.id,
      'points_change', t.points_change,
      'balance_after', t.balance_after,
      'transaction_type', t.transaction_type,
      'source_type', t.source_type,
      'description', t.description,
      'created_at', t.created_at
    ) ORDER BY t.created_at DESC
  )
  INTO v_recent_transactions
  FROM (
    SELECT 
      id,
      points_change,
      balance_after,
      transaction_type,
      source_type,
      description,
      created_at
    FROM user_points_transactions
    WHERE user_id = p_user_id
    ORDER BY created_at DESC
    LIMIT 10
  ) t;

  v_result := jsonb_build_object(
    'wallet', COALESCE(v_wallet_info, '{}'::jsonb),
    'recent_transactions', COALESCE(v_recent_transactions, '[]'::jsonb)
  );

  RETURN v_result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 7. 初始化基础积分规则
INSERT INTO points_rules (rule_name, rule_type, source_type, points_value, description) VALUES
('完成跟进表', 'EARN', 'FOLLOWUP', 50, '完成跟进表推进到邀约到店阶段'),
('成交订单', 'EARN', 'DEAL', 100, '成功成交订单'),
('每日签到', 'EARN', 'SIGNIN', 5, '每日签到获得积分'),
('参与直播', 'EARN', 'ACTIVITY', 20, '参与直播活动'),
('答题活动', 'EARN', 'ACTIVITY', 10, '参与答题活动'),
('兑换线索', 'EXCHANGE', 'EXCHANGE_LEAD', -30, '用积分兑换线索'),
('违规扣分', 'DEDUCT', 'PENALTY', -20, '违规行为扣分')
ON CONFLICT DO NOTHING;

COMMIT;

-- 部署完成提示
DO $$
BEGIN
  RAISE NOTICE '积分系统最终版部署完成！';
END $$; 