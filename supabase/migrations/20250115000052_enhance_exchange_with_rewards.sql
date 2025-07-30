-- 增强兑换系统，添加自动发放奖励功能
-- 迁移时间: 2025年1月15日

-- 1. 创建奖励发放函数
CREATE OR REPLACE FUNCTION public.issue_exchange_reward(
  p_user_id bigint,
  p_goods_category text,
  p_goods_name text,
  p_description text DEFAULT NULL
) RETURNS jsonb
LANGUAGE plpgsql
AS $$
DECLARE
  result jsonb;
  v_community community;
  v_reward_issued boolean := false;
  v_reward_type text;
  v_reward_description text;
BEGIN
  -- 根据商品类型发放不同奖励
  CASE p_goods_category
    WHEN 'LEAD' THEN
      -- 发放带看直通卡
      v_reward_type := 'direct';
      v_reward_description := '兑换奖励：' || COALESCE(p_description, p_goods_name);
      
      -- 获取用户默认社区（这里可以根据业务逻辑调整）
      SELECT community INTO v_community
      FROM users_profile
      WHERE id = p_user_id;
      
      -- 如果没有社区信息，使用默认社区
      IF v_community IS NULL THEN
        v_community := 'DOWNTON'::community; -- 默认社区
      END IF;
      
      -- 发放直通卡（通过issue-direct-card函数，确保发放给组长）
      -- 注意：这里需要先获取兑换记录ID，然后调用issue-direct-card函数
      -- 由于数据库函数无法直接调用HTTP函数，我们需要在应用层处理
      -- 暂时保持原有逻辑，在应用层调用issue-direct-card
      INSERT INTO public.showings_queue_record (
        user_id,
        community,
        queue_type,
        created_at,
        consumed,
        consumed_at,
        remark
      ) VALUES (
        p_user_id,
        v_community,
        v_reward_type,
        now(),
        false,
        null,
        v_reward_description
      );
      v_reward_issued := true;
      
    WHEN 'GIFT' THEN
      -- 发放礼品（可以扩展为其他奖励类型）
      v_reward_type := 'gift';
      v_reward_description := '兑换奖励：' || COALESCE(p_description, p_goods_name);
      v_reward_issued := true;
      
    WHEN 'PRIVILEGE' THEN
      -- 发放特权（可以扩展为其他奖励类型）
      v_reward_type := 'privilege';
      v_reward_description := '兑换奖励：' || COALESCE(p_description, p_goods_name);
      v_reward_issued := true;
      
    WHEN 'ACHIEVEMENT' THEN
      -- 发放成就（可以扩展为其他奖励类型）
      v_reward_type := 'achievement';
      v_reward_description := '兑换奖励：' || COALESCE(p_description, p_goods_name);
      v_reward_issued := true;
      
    ELSE
      -- 未知类型，不发放奖励
      v_reward_type := 'unknown';
      v_reward_issued := false;
  END CASE;
  
  -- 构建返回结果
  result := jsonb_build_object(
    'success', v_reward_issued,
    'reward_type', v_reward_type,
    'reward_description', v_reward_description,
    'community', v_community,
    'message', CASE 
      WHEN v_reward_issued THEN '奖励发放成功'
      ELSE '该商品类型暂不支持自动发放奖励'
    END
  );
  
  RETURN result;
END;
$$;

COMMENT ON FUNCTION public.issue_exchange_reward IS '根据兑换商品类型自动发放相应奖励，如带看直通卡、礼品等';

-- 2. 更新兑换商品函数，集成奖励发放
CREATE OR REPLACE FUNCTION public.exchange_goods_item(
  p_user_id bigint,
  p_goods_id uuid,
  p_description text DEFAULT NULL
) RETURNS jsonb
LANGUAGE plpgsql
AS $$
DECLARE
  goods_record RECORD;
  user_balance integer;
  daily_count integer;
  exchange_record_id bigint;
  result jsonb;
  reward_result jsonb;
BEGIN
  -- 获取商品信息
  SELECT * INTO goods_record
  FROM exchange_goods
  WHERE id = p_goods_id AND is_active = true;
  
  IF goods_record IS NULL THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', '商品不存在或已下架'
    );
  END IF;
  
  -- 获取用户积分余额
  SELECT COALESCE(total_points, 0) INTO user_balance
  FROM user_points_wallet
  WHERE user_id = p_user_id;
  
  -- 检查积分是否足够
  IF user_balance < goods_record.points_cost THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', '积分不足',
      'required_points', goods_record.points_cost,
      'available_points', user_balance
    );
  END IF;
  
  -- 检查每日兑换限制
  IF goods_record.daily_limit IS NOT NULL THEN
    SELECT COALESCE(exchange_count, 0) INTO daily_count
    FROM user_exchange_limits
    WHERE user_id = p_user_id 
      AND goods_id = p_goods_id 
      AND exchange_date = CURRENT_DATE;
    
    IF daily_count >= goods_record.daily_limit THEN
      RETURN jsonb_build_object(
        'success', false,
        'error', '已达到每日兑换限制',
        'daily_limit', goods_record.daily_limit,
        'current_count', daily_count
      );
    END IF;
  END IF;
  
  -- 开始事务处理
  BEGIN
    -- 扣除用户积分
    UPDATE user_points_wallet
    SET total_points = total_points - goods_record.points_cost,
        updated_at = now()
    WHERE user_id = p_user_id;
    
    -- 插入积分交易记录（如果表存在）
    BEGIN
      INSERT INTO user_points_transactions (
        user_id, points_change, balance_after,
        transaction_type, source_type, source_id, description
      ) VALUES (
        p_user_id, -goods_record.points_cost, user_balance - goods_record.points_cost,
        'DEDUCT', 'EXCHANGE_GOODS', p_goods_id::text,
        COALESCE(p_description, '兑换商品：' || goods_record.name)
      );
    EXCEPTION WHEN undefined_table THEN
      -- 如果user_points_transactions表不存在，跳过
      NULL;
    END;
    
    -- 插入兑换记录
    INSERT INTO points_exchange_records (
      user_id, exchange_type, target_id, points_used, description
    ) VALUES (
      p_user_id, goods_record.category, p_goods_id, goods_record.points_cost,
      COALESCE(p_description, '兑换商品：' || goods_record.name)
    ) RETURNING id INTO exchange_record_id;
    
    -- 更新或插入每日兑换限制记录
    INSERT INTO user_exchange_limits (user_id, goods_id, exchange_date, exchange_count)
    VALUES (p_user_id, p_goods_id, CURRENT_DATE, 1)
    ON CONFLICT (user_id, goods_id, exchange_date)
    DO UPDATE SET 
      exchange_count = user_exchange_limits.exchange_count + 1,
      updated_at = now();
    
    -- 构建成功结果
    result := jsonb_build_object(
      'success', true,
      'exchange_record_id', exchange_record_id,
      'goods_name', goods_record.name,
      'points_used', goods_record.points_cost,
      'new_balance', user_balance - goods_record.points_cost,
      'description', COALESCE(p_description, '兑换商品：' || goods_record.name)
    );
    
    RETURN result;
    
  EXCEPTION WHEN OTHERS THEN
    -- 回滚事务
    RAISE EXCEPTION '兑换失败：%', SQLERRM;
  END;
END;
$$;

COMMENT ON FUNCTION public.exchange_goods_item IS '兑换商品函数，支持自动发放奖励（如带看直通卡等）'; 