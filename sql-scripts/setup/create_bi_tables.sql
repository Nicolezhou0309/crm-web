-- =============================================
-- BI数据分析系统数据库表结构
-- 创建时间: 2025年1月
-- =============================================

BEGIN;

-- 1. BI透视表配置表
CREATE TABLE IF NOT EXISTS public.bi_pivot_configs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text,
  config jsonb NOT NULL, -- 完整的透视表配置
  data_source text NOT NULL, -- 数据源表名
  created_by bigint REFERENCES users_profile(id),
  is_public boolean DEFAULT false, -- 是否公开
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

COMMENT ON TABLE public.bi_pivot_configs IS 'BI透视表配置表';
COMMENT ON COLUMN public.bi_pivot_configs.config IS 'JSON格式的透视表配置，包含行维度、列维度、值字段等';
COMMENT ON COLUMN public.bi_pivot_configs.data_source IS '数据源表名，如joined_data、leads等';

-- 2. BI报表表
CREATE TABLE IF NOT EXISTS public.bi_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  type text NOT NULL CHECK (type IN ('pivot', 'chart', 'dashboard')),
  config jsonb NOT NULL,
  data_source text NOT NULL,
  created_by bigint REFERENCES users_profile(id),
  shared_with bigint[], -- 共享用户ID数组
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

COMMENT ON TABLE public.bi_reports IS 'BI报表表';
COMMENT ON COLUMN public.bi_reports.type IS '报表类型：pivot(透视表)、chart(图表)、dashboard(仪表板)';
COMMENT ON COLUMN public.bi_reports.config IS 'JSON格式的报表配置';
COMMENT ON COLUMN public.bi_reports.shared_with IS '共享用户ID数组，为空表示不共享';

-- 3. 启用RLS
ALTER TABLE public.bi_pivot_configs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bi_reports ENABLE ROW LEVEL SECURITY;

-- 4. RLS策略：用户只能访问自己创建的或公开的配置
CREATE POLICY "Users can access their own or public pivot configs" 
ON public.bi_pivot_configs FOR ALL 
USING (
  created_by = auth.uid()::bigint OR 
  is_public = true
);

CREATE POLICY "Users can access their own or shared reports" 
ON public.bi_reports FOR ALL 
USING (
  created_by = auth.uid()::bigint OR 
  auth.uid()::bigint = ANY(shared_with)
);

-- 5. 创建索引
CREATE INDEX IF NOT EXISTS idx_bi_pivot_configs_created_by ON public.bi_pivot_configs(created_by);
CREATE INDEX IF NOT EXISTS idx_bi_pivot_configs_created_at ON public.bi_pivot_configs(created_at);
CREATE INDEX IF NOT EXISTS idx_bi_pivot_configs_is_public ON public.bi_pivot_configs(is_public);

CREATE INDEX IF NOT EXISTS idx_bi_reports_created_by ON public.bi_reports(created_by);
CREATE INDEX IF NOT EXISTS idx_bi_reports_created_at ON public.bi_reports(created_at);
CREATE INDEX IF NOT EXISTS idx_bi_reports_type ON public.bi_reports(type);

-- 6. 创建更新时间戳触发器
CREATE OR REPLACE FUNCTION update_bi_tables_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_update_bi_pivot_configs
BEFORE UPDATE ON public.bi_pivot_configs
FOR EACH ROW
EXECUTE FUNCTION update_bi_tables_timestamp();

CREATE TRIGGER trg_update_bi_reports
BEFORE UPDATE ON public.bi_reports
FOR EACH ROW
EXECUTE FUNCTION update_bi_tables_timestamp();

-- 7. 创建透视表查询优化函数
CREATE OR REPLACE FUNCTION execute_pivot_query(
  p_table_name text,
  p_row_fields text[],
  p_column_fields text[],
  p_measure_fields jsonb,
  p_filters jsonb DEFAULT '{}'
)
RETURNS jsonb
LANGUAGE plpgsql
AS $$
DECLARE
  v_sql text;
  v_result jsonb;
BEGIN
  -- 这里可以实现动态SQL构建逻辑
  -- 目前返回空结果，后续可以扩展
  RETURN '{"headers": [], "rows": [], "totals": [], "summary": {"totalRows": 0, "totalColumns": 0, "totalValue": 0}}'::jsonb;
END;
$$;

COMMENT ON FUNCTION execute_pivot_query IS '执行透视表查询的函数，支持动态SQL构建';

-- 8. 创建BI统计函数
CREATE OR REPLACE FUNCTION get_bi_statistics()
RETURNS TABLE(
  total_pivot_configs bigint,
  total_reports bigint,
  public_configs bigint,
  shared_reports bigint
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    COUNT(*) FILTER (WHERE table_name = 'bi_pivot_configs') as total_pivot_configs,
    COUNT(*) FILTER (WHERE table_name = 'bi_reports') as total_reports,
    COUNT(*) FILTER (WHERE table_name = 'bi_pivot_configs' AND is_public = true) as public_configs,
    COUNT(*) FILTER (WHERE table_name = 'bi_reports' AND array_length(shared_with, 1) > 0) as shared_reports
  FROM (
    SELECT 'bi_pivot_configs' as table_name, is_public, NULL as shared_with FROM bi_pivot_configs
    UNION ALL
    SELECT 'bi_reports' as table_name, false as is_public, shared_with FROM bi_reports
  ) t;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION get_bi_statistics IS '获取BI系统统计信息';

COMMIT; 