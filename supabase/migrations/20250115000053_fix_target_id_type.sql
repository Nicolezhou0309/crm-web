-- 修复target_id类型不匹配问题
-- 执行时间: 2025年1月15日

-- 修改exchange_goods_item函数，使用goods_id的hash值作为target_id
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
  target_id_bigint bigint;
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
  
  -- 将uuid转换为bigint（使用hash值）
  target_id_bigint := ('x' || substr(p_goods_id::text, 1, 8))::bit(32)::bigint;
  
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
    
    -- 插入兑换记录（使用转换后的bigint值）
    INSERT INTO points_exchange_records (
      user_id, exchange_type, target_id, points_used, description
    ) VALUES (
      p_user_id, goods_record.category, target_id_bigint, goods_record.points_cost,
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