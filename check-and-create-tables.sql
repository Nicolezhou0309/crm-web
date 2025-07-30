-- 检查并创建兑换商品系统所需的表

-- 1. 检查exchange_goods表是否存在
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'exchange_goods') THEN
        CREATE TABLE public.exchange_goods (
          id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
          name text NOT NULL,
          description text,
          category text NOT NULL CHECK (category IN ('LEAD', 'GIFT', 'PRIVILEGE', 'ACHIEVEMENT')),
          points_cost integer NOT NULL CHECK (points_cost > 0),
          icon text,
          icon_type text DEFAULT 'emoji' CHECK (icon_type IN ('emoji', 'svg', 'png', 'jpg', 'webp')),
          icon_url text,
          color text DEFAULT '#1890ff',
          is_active boolean DEFAULT true,
          is_featured boolean DEFAULT false,
          sort_order integer DEFAULT 0,
          exchange_limit integer DEFAULT NULL,
          daily_limit integer DEFAULT NULL,
          created_at timestamptz DEFAULT now(),
          updated_at timestamptz DEFAULT now()
        );
        RAISE NOTICE 'Created exchange_goods table';
    ELSE
        RAISE NOTICE 'exchange_goods table already exists';
    END IF;
END $$;

-- 2. 检查points_exchange_records表是否存在
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'points_exchange_records') THEN
        CREATE TABLE public.points_exchange_records (
          id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
          user_id bigint NOT NULL,
          exchange_type text NOT NULL,
          target_id uuid REFERENCES exchange_goods(id),
          points_used integer NOT NULL CHECK (points_used > 0),
          exchange_time timestamptz DEFAULT now(),
          status text DEFAULT 'SUCCESS' CHECK (status IN ('SUCCESS', 'PENDING', 'FAILED')),
          description text,
          created_at timestamptz DEFAULT now(),
          updated_at timestamptz DEFAULT now()
        );
        RAISE NOTICE 'Created points_exchange_records table';
    ELSE
        RAISE NOTICE 'points_exchange_records table already exists';
    END IF;
END $$;

-- 3. 检查user_exchange_limits表是否存在
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'user_exchange_limits') THEN
        CREATE TABLE public.user_exchange_limits (
          id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
          user_id bigint NOT NULL,
          goods_id uuid NOT NULL REFERENCES exchange_goods(id) ON DELETE CASCADE,
          exchange_date date NOT NULL,
          exchange_count integer DEFAULT 0,
          created_at timestamptz DEFAULT now(),
          updated_at timestamptz DEFAULT now(),
          UNIQUE(user_id, goods_id, exchange_date)
        );
        RAISE NOTICE 'Created user_exchange_limits table';
    ELSE
        RAISE NOTICE 'user_exchange_limits table already exists';
    END IF;
END $$;

-- 4. 检查user_points_transactions表是否存在
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'user_points_transactions') THEN
        CREATE TABLE public.user_points_transactions (
          id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
          user_id bigint NOT NULL,
          points_change integer NOT NULL,
          balance_after integer NOT NULL,
          transaction_type text NOT NULL,
          source_type text,
          source_id text,
          description text,
          created_at timestamptz DEFAULT now()
        );
        RAISE NOTICE 'Created user_points_transactions table';
    ELSE
        RAISE NOTICE 'user_points_transactions table already exists';
    END IF;
END $$;

-- 5. 创建索引
CREATE INDEX IF NOT EXISTS idx_exchange_goods_active ON public.exchange_goods(is_active, sort_order);
CREATE INDEX IF NOT EXISTS idx_exchange_goods_category ON public.exchange_goods(category);
CREATE INDEX IF NOT EXISTS idx_points_exchange_records_user ON public.points_exchange_records(user_id, exchange_time);
CREATE INDEX IF NOT EXISTS idx_user_exchange_limits_user_goods ON public.user_exchange_limits(user_id, goods_id);

-- 6. 插入示例商品数据（如果表为空）
INSERT INTO public.exchange_goods (
  name, description, category, points_cost, icon, color, is_featured, sort_order
) 
SELECT * FROM (VALUES 
  ('兑换线索', '使用积分兑换高质量线索', 'LEAD', 30, '👥', '#1890ff', true, 1),
  ('兑换礼品', '使用积分兑换精美礼品', 'GIFT', 50, '🎁', '#722ed1', true, 2),
  ('兑换特权', '使用积分兑换特殊权限', 'PRIVILEGE', 100, '👑', '#fa8c16', false, 3),
  ('兑换成就', '使用积分兑换特殊成就', 'ACHIEVEMENT', 80, '🏆', '#52c41a', false, 4)
) AS v(name, description, category, points_cost, icon, color, is_featured, sort_order)
WHERE NOT EXISTS (SELECT 1 FROM public.exchange_goods LIMIT 1);

-- 7. 创建get_exchange_goods函数（如果不存在）
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