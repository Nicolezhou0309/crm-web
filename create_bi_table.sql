-- =============================================
-- 创建BI透视表配置表
-- 在Supabase SQL编辑器中执行此脚本
-- =============================================

-- 创建BI透视表配置表
CREATE TABLE IF NOT EXISTS public.bi_pivot_configs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text,
  config jsonb NOT NULL, -- 完整的透视表配置
  data_source text NOT NULL, -- 数据源表名
  created_by text, -- 创建者ID（字符串类型，避免外键约束）
  is_public boolean DEFAULT false, -- 是否公开
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- 添加注释
COMMENT ON TABLE public.bi_pivot_configs IS 'BI透视表配置表';
COMMENT ON COLUMN public.bi_pivot_configs.config IS 'JSON格式的透视表配置，包含行维度、列维度、值字段等';
COMMENT ON COLUMN public.bi_pivot_configs.data_source IS '数据源表名，如joined_data、leads等';

-- 创建索引
CREATE INDEX IF NOT EXISTS idx_bi_pivot_configs_created_by ON public.bi_pivot_configs(created_by);
CREATE INDEX IF NOT EXISTS idx_bi_pivot_configs_created_at ON public.bi_pivot_configs(created_at);
CREATE INDEX IF NOT EXISTS idx_bi_pivot_configs_is_public ON public.bi_pivot_configs(is_public);

-- 创建更新时间戳触发器
CREATE OR REPLACE FUNCTION update_bi_pivot_configs_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_update_bi_pivot_configs
BEFORE UPDATE ON public.bi_pivot_configs
FOR EACH ROW
EXECUTE FUNCTION update_bi_pivot_configs_timestamp();

-- 启用RLS（可选）
ALTER TABLE public.bi_pivot_configs ENABLE ROW LEVEL SECURITY;

-- 创建RLS策略（可选）
CREATE POLICY "Users can access their own or public pivot configs" 
ON public.bi_pivot_configs FOR ALL 
USING (
  created_by = auth.uid()::text OR 
  is_public = true
);

-- 完成提示
SELECT 'BI透视表配置表创建成功！' as message; 