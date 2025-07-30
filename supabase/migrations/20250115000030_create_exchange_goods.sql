-- =============================================
-- 兑换商品系统数据库表结构
-- 创建时间: 2025年1月
-- =============================================

BEGIN;

-- 1. 兑换商品表
CREATE TABLE IF NOT EXISTS public.exchange_goods (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL, -- 商品名称
  description text, -- 商品描述
  category text NOT NULL CHECK (category IN ('LEAD', 'GIFT', 'PRIVILEGE', 'ACHIEVEMENT')), -- 商品分类
  points_cost integer NOT NULL CHECK (points_cost > 0), -- 所需积分
  icon text, -- 商品图标
  icon_type text DEFAULT 'emoji' CHECK (icon_type IN ('emoji', 'svg', 'png', 'jpg', 'webp')), -- 图标类型
  icon_url text, -- 图片URL（当icon_type为图片时使用）
  color text DEFAULT '#1890ff', -- 商品颜色
  is_active boolean DEFAULT true, -- 是否激活
  is_featured boolean DEFAULT false, -- 是否推荐
  sort_order integer DEFAULT 0, -- 排序
  exchange_limit integer DEFAULT NULL, -- 兑换限制（NULL表示无限制）
  daily_limit integer DEFAULT NULL, -- 每日兑换限制
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- 2. 用户兑换记录表（扩展现有表）
CREATE TABLE IF NOT EXISTS public.points_exchange_records (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id bigint NOT NULL REFERENCES users_profile(id) ON DELETE CASCADE,
  exchange_type text NOT NULL, -- 兑换类型（对应商品分类）
  target_id uuid REFERENCES exchange_goods(id), -- 关联商品ID
  points_used integer NOT NULL CHECK (points_used > 0), -- 消耗积分
  exchange_time timestamptz DEFAULT now(), -- 兑换时间
  status text DEFAULT 'SUCCESS' CHECK (status IN ('SUCCESS', 'PENDING', 'FAILED')), -- 兑换状态
  description text, -- 兑换描述
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- 3. 用户兑换限制记录表
CREATE TABLE IF NOT EXISTS public.user_exchange_limits (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id bigint NOT NULL REFERENCES users_profile(id) ON DELETE CASCADE,
  goods_id uuid NOT NULL REFERENCES exchange_goods(id) ON DELETE CASCADE,
  exchange_date date NOT NULL, -- 兑换日期
  exchange_count integer DEFAULT 0, -- 当日兑换次数
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(user_id, goods_id, exchange_date)
);

-- 4. 创建索引
CREATE INDEX IF NOT EXISTS idx_exchange_goods_active ON public.exchange_goods(is_active, sort_order);
CREATE INDEX IF NOT EXISTS idx_exchange_goods_category ON public.exchange_goods(category);
CREATE INDEX IF NOT EXISTS idx_exchange_goods_featured ON public.exchange_goods(is_featured) WHERE is_featured = true;

CREATE INDEX IF NOT EXISTS idx_points_exchange_records_user ON public.points_exchange_records(user_id, exchange_time);
CREATE INDEX IF NOT EXISTS idx_points_exchange_records_type ON public.points_exchange_records(exchange_type);
CREATE INDEX IF NOT EXISTS idx_points_exchange_records_status ON public.points_exchange_records(status);

CREATE INDEX IF NOT EXISTS idx_user_exchange_limits_user_goods ON public.user_exchange_limits(user_id, goods_id);
CREATE INDEX IF NOT EXISTS idx_user_exchange_limits_date ON public.user_exchange_limits(exchange_date);

-- 5. 创建更新时间戳触发器
CREATE OR REPLACE FUNCTION update_exchange_goods_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_update_exchange_goods
BEFORE UPDATE ON public.exchange_goods
FOR EACH ROW
EXECUTE FUNCTION update_exchange_goods_timestamp();

-- 6. 启用RLS行级安全策略
ALTER TABLE public.exchange_goods ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.points_exchange_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_exchange_limits ENABLE ROW LEVEL SECURITY;

-- 7. RLS策略：兑换商品表
CREATE POLICY "Users can view active exchange goods" 
ON public.exchange_goods FOR SELECT TO public
USING (is_active = true);

CREATE POLICY "Admins can manage exchange goods" 
ON public.exchange_goods FOR ALL TO public
USING (has_permission('points', 'manage'));

-- 8. RLS策略：兑换记录表
CREATE POLICY "Users can view their own exchange records" 
ON public.points_exchange_records FOR SELECT TO public
USING (
  user_id = (SELECT id FROM users_profile WHERE user_id = auth.uid())
  OR has_permission('points', 'manage')
);

CREATE POLICY "Users can insert their own exchange records" 
ON public.points_exchange_records FOR INSERT TO public
WITH CHECK (
  user_id = (SELECT id FROM users_profile WHERE user_id = auth.uid())
);

-- 9. RLS策略：兑换限制表
CREATE POLICY "Users can view their own exchange limits" 
ON public.user_exchange_limits FOR SELECT TO public
USING (
  user_id = (SELECT id FROM users_profile WHERE user_id = auth.uid())
  OR has_permission('points', 'manage')
);

CREATE POLICY "Users can update their own exchange limits" 
ON public.user_exchange_limits FOR UPDATE TO public
USING (
  user_id = (SELECT id FROM users_profile WHERE user_id = auth.uid())
);

CREATE POLICY "Users can insert their own exchange limits" 
ON public.user_exchange_limits FOR INSERT TO public
WITH CHECK (
  user_id = (SELECT id FROM users_profile WHERE user_id = auth.uid())
);

-- 10. 创建获取兑换商品的函数
CREATE OR REPLACE FUNCTION public.get_exchange_goods(
  p_category text DEFAULT NULL,
  p_user_id bigint DEFAULT NULL
) RETURNS TABLE(
  id uuid,
  name text,
  description text,
  category text,
  points_cost integer,
  icon text,
  icon_type text,
  icon_url text,
  color text,
  is_active boolean,
  is_featured boolean,
  sort_order integer,
  exchange_limit integer,
  daily_limit integer,
  can_exchange boolean,
  remaining_daily_limit integer
) LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    eg.id,
    eg.name,
    eg.description,
    eg.category,
    eg.points_cost,
    eg.icon,
    eg.icon_type,
    eg.icon_url,
    eg.color,
    eg.is_active,
    eg.is_featured,
    eg.sort_order,
    eg.exchange_limit,
    eg.daily_limit,
    -- 检查是否可以兑换
    CASE 
      WHEN p_user_id IS NULL THEN true
      WHEN eg.daily_limit IS NOT NULL THEN
        COALESCE(uel.exchange_count, 0) < eg.daily_limit
      ELSE true
    END as can_exchange,
    -- 剩余每日兑换次数
    CASE 
      WHEN eg.daily_limit IS NULL THEN NULL
      ELSE GREATEST(0, eg.daily_limit - COALESCE(uel.exchange_count, 0))
    END as remaining_daily_limit
  FROM exchange_goods eg
  LEFT JOIN user_exchange_limits uel ON 
    uel.user_id = p_user_id AND 
    uel.goods_id = eg.id AND 
    uel.exchange_date = CURRENT_DATE
  WHERE eg.is_active = true
    AND (p_category IS NULL OR eg.category = p_category)
  ORDER BY eg.sort_order ASC, eg.created_at ASC;
END;
$$;

-- 11. 创建兑换商品的函数
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
  exchange_record_id uuid;
  result jsonb;
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
    
    -- 插入积分交易记录
    INSERT INTO user_points_transactions (
      user_id, points_change, balance_after,
      transaction_type, source_type, source_id, description
    ) VALUES (
      p_user_id, -goods_record.points_cost, user_balance - goods_record.points_cost,
      'DEDUCT', 'EXCHANGE_GOODS', p_goods_id::text,
      COALESCE(p_description, '兑换商品：' || goods_record.name)
    );
    
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

-- 12. 插入示例数据
INSERT INTO public.exchange_goods (
  name, description, category, points_cost, icon, color, is_featured, sort_order
) VALUES 
  ('兑换线索', '使用积分兑换高质量线索', 'LEAD', 30, '👥', '#1890ff', true, 1),
  ('兑换礼品', '使用积分兑换精美礼品', 'GIFT', 50, '🎁', '#722ed1', true, 2),
  ('兑换特权', '使用积分兑换特殊权限', 'PRIVILEGE', 100, '👑', '#fa8c16', false, 3),
  ('兑换成就', '使用积分兑换特殊成就', 'ACHIEVEMENT', 80, '🏆', '#52c41a', false, 4);

COMMIT; 