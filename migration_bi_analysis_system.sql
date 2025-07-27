-- =============================================
-- BI数据分析系统完整迁移脚本
-- 创建时间: 2025年1月
-- 功能: 创建BI透视表配置表和相关函数
-- =============================================

BEGIN;

-- =============================================
-- 1. 创建BI透视表配置表
-- =============================================

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

-- =============================================
-- 2. 创建更新时间戳触发器
-- =============================================

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

-- =============================================
-- 3. 启用RLS行级安全策略
-- =============================================

ALTER TABLE public.bi_pivot_configs ENABLE ROW LEVEL SECURITY;

-- 创建RLS策略：用户只能访问自己创建的或公开的配置
CREATE POLICY "Users can access their own or public pivot configs" 
ON public.bi_pivot_configs FOR ALL 
USING (
  created_by = auth.uid()::text OR 
  is_public = true
);

-- =============================================
-- 4. 创建透视表执行函数
-- =============================================

CREATE OR REPLACE FUNCTION execute_pivot_analysis(
  p_data_source text DEFAULT 'filter_followups',
  p_row_fields text[] DEFAULT '{}',
  p_column_fields text[] DEFAULT '{}',
  p_value_fields jsonb DEFAULT '[]',
  p_filters jsonb DEFAULT '{}'
)
RETURNS jsonb
LANGUAGE plpgsql
AS $$
DECLARE
  v_sql text;
  v_result jsonb;
  v_row_field text;
  v_col_field text;
  v_value_field jsonb;
  v_select_fields text := '';
  v_group_by text := '';
  v_where_clause text := '';
  v_aggregation text := '';
  v_join_clause text := '';
BEGIN
  -- 根据数据源构建不同的查询
  CASE p_data_source
    WHEN 'joined_data' THEN
      -- 使用现有的filter_followups函数，它已经处理了一对多关系
      v_sql := 'SELECT * FROM filter_followups()';
      
    WHEN 'leads' THEN
      v_sql := 'SELECT * FROM leads';
      
    WHEN 'showings_with_leads' THEN
      -- 带看数据与线索关联（处理一对多）
      v_sql := '
        SELECT 
          s.*,
          l.phone, l.wechat, l.source, l.leadtype, l.leadstatus, l.area,
          f.interviewsales_user_id,
          up_interview.nickname as interviewsales_user_name,
          up_showing.nickname as showingsales_user_name,
          up_true.nickname as trueshowingsales_user_name
        FROM showings s
        LEFT JOIN leads l ON s.leadid = l.leadid
        LEFT JOIN followups f ON s.leadid = f.leadid
        LEFT JOIN users_profile up_interview ON f.interviewsales_user_id = up_interview.id
        LEFT JOIN users_profile up_showing ON s.showingsales = up_showing.id
        LEFT JOIN users_profile up_true ON s.trueshowingsales = up_true.id
      ';
      
    WHEN 'deals_with_leads' THEN
      -- 成交数据与线索关联（处理一对多）
      v_sql := '
        SELECT 
          d.*,
          l.phone, l.wechat, l.source, l.leadtype, l.leadstatus, l.area,
          f.interviewsales_user_id,
          up_interview.nickname as interviewsales_user_name
        FROM deals d
        LEFT JOIN leads l ON d.leadid = l.leadid
        LEFT JOIN followups f ON d.leadid = f.leadid
        LEFT JOIN users_profile up_interview ON f.interviewsales_user_id = up_interview.id
      ';
      
    ELSE
      v_sql := 'SELECT * FROM ' || p_data_source;
  END CASE;
  
  -- 构建SELECT字段
  IF array_length(p_row_fields, 1) > 0 THEN
    v_select_fields := v_select_fields || string_agg(quote_ident(field), ', ') || ', ';
  END IF;
  
  IF array_length(p_column_fields, 1) > 0 THEN
    v_select_fields := v_select_fields || string_agg(quote_ident(field), ', ') || ', ';
  END IF;
  
  -- 构建聚合字段
  FOR v_value_field IN SELECT * FROM jsonb_array_elements(p_value_fields)
  LOOP
    v_aggregation := v_aggregation || 
      CASE (v_value_field->>'aggregation')
        WHEN 'sum' THEN 'SUM(' || quote_ident(v_value_field->>'field') || ')'
        WHEN 'count' THEN 'COUNT(' || quote_ident(v_value_field->>'field') || ')'
        WHEN 'avg' THEN 'AVG(' || quote_ident(v_value_field->>'field') || ')'
        WHEN 'max' THEN 'MAX(' || quote_ident(v_value_field->>'field') || ')'
        WHEN 'min' THEN 'MIN(' || quote_ident(v_value_field->>'field') || ')'
        WHEN 'count_distinct' THEN 'COUNT(DISTINCT ' || quote_ident(v_value_field->>'field') || ')'
        ELSE 'COUNT(*)'
      END || ' as ' || quote_ident(v_value_field->>'field') || '_' || (v_value_field->>'aggregation') || ', ';
  END LOOP;
  
  -- 移除最后的逗号
  IF length(v_aggregation) > 0 THEN
    v_aggregation := trim(trailing ', ' from v_aggregation);
  END IF;
  
  -- 构建GROUP BY
  IF array_length(p_row_fields, 1) > 0 OR array_length(p_column_fields, 1) > 0 THEN
    v_group_by := 'GROUP BY ' || 
      string_agg(quote_ident(field), ', ') || 
      CASE 
        WHEN array_length(p_column_fields, 1) > 0 THEN ', ' || string_agg(quote_ident(field), ', ')
        ELSE ''
      END;
  END IF;
  
  -- 构建WHERE子句（简化版）
  IF p_filters != '{}' THEN
    v_where_clause := 'WHERE 1=1'; -- 简化处理，实际可以根据filters构建复杂条件
  END IF;
  
  -- 构建完整SQL
  v_sql := 'SELECT ' || 
    CASE 
      WHEN length(v_select_fields) > 0 THEN trim(trailing ', ' from v_select_fields) || ', '
      ELSE ''
    END ||
    v_aggregation ||
    ' FROM (' || v_sql || ') t ' ||
    v_where_clause || ' ' ||
    v_group_by;
  
  -- 执行查询并返回结果
  BEGIN
    EXECUTE 'SELECT jsonb_build_object(
      ''sql'', $1,
      ''result'', to_jsonb(t.*)
    ) FROM (' || v_sql || ') t' INTO v_result USING v_sql;
    
    RETURN v_result;
  EXCEPTION
    WHEN OTHERS THEN
      RETURN jsonb_build_object(
        'error', SQLERRM,
        'sql', v_sql,
        'result', '[]'::jsonb
      );
  END;
END;
$$;

COMMENT ON FUNCTION execute_pivot_analysis IS '执行透视表分析，支持动态SQL构建';

-- =============================================
-- 5. 创建BI统计函数
-- =============================================

CREATE OR REPLACE FUNCTION get_bi_statistics()
RETURNS TABLE(
  total_pivot_configs bigint,
  public_configs bigint,
  total_users bigint,
  recent_activity bigint
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    COUNT(*) as total_pivot_configs,
    COUNT(*) FILTER (WHERE is_public = true) as public_configs,
    COUNT(DISTINCT created_by) as total_users,
    COUNT(*) FILTER (WHERE created_at >= now() - interval '7 days') as recent_activity
  FROM bi_pivot_configs;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION get_bi_statistics IS '获取BI系统统计信息';

-- =============================================
-- 6. 创建透视表配置管理函数
-- =============================================

-- 保存透视表配置
CREATE OR REPLACE FUNCTION save_pivot_config(
  p_name text,
  p_description text DEFAULT NULL,
  p_config jsonb,
  p_data_source text DEFAULT 'joined_data',
  p_is_public boolean DEFAULT false
)
RETURNS uuid
LANGUAGE plpgsql
AS $$
DECLARE
  v_config_id uuid;
  v_user_id text;
BEGIN
  -- 获取当前用户ID
  v_user_id := auth.uid()::text;
  
  -- 插入配置
  INSERT INTO bi_pivot_configs (
    name, description, config, data_source, created_by, is_public
  ) VALUES (
    p_name, p_description, p_config, p_data_source, v_user_id, p_is_public
  ) RETURNING id INTO v_config_id;
  
  RETURN v_config_id;
END;
$$;

COMMENT ON FUNCTION save_pivot_config IS '保存透视表配置';

-- 获取用户的透视表配置
CREATE OR REPLACE FUNCTION get_user_pivot_configs(
  p_user_id text DEFAULT NULL
)
RETURNS TABLE(
  id uuid,
  name text,
  description text,
  config jsonb,
  data_source text,
  created_by text,
  is_public boolean,
  created_at timestamptz,
  updated_at timestamptz
)
LANGUAGE plpgsql
AS $$
BEGIN
  IF p_user_id IS NULL THEN
    p_user_id := auth.uid()::text;
  END IF;
  
  RETURN QUERY
  SELECT 
    pc.id,
    pc.name,
    pc.description,
    pc.config,
    pc.data_source,
    pc.created_by,
    pc.is_public,
    pc.created_at,
    pc.updated_at
  FROM bi_pivot_configs pc
  WHERE pc.created_by = p_user_id OR pc.is_public = true
  ORDER BY pc.created_at DESC;
END;
$$;

COMMENT ON FUNCTION get_user_pivot_configs IS '获取用户的透视表配置';

-- 删除透视表配置
CREATE OR REPLACE FUNCTION delete_pivot_config(
  p_config_id uuid
)
RETURNS boolean
LANGUAGE plpgsql
AS $$
DECLARE
  v_user_id text;
  v_deleted_count integer;
BEGIN
  -- 获取当前用户ID
  v_user_id := auth.uid()::text;
  
  -- 删除配置（只能删除自己的）
  DELETE FROM bi_pivot_configs 
  WHERE id = p_config_id AND created_by = v_user_id;
  
  GET DIAGNOSTICS v_deleted_count = ROW_COUNT;
  
  RETURN v_deleted_count > 0;
END;
$$;

COMMENT ON FUNCTION delete_pivot_config IS '删除透视表配置';

-- =============================================
-- 7. 创建数据源查询函数
-- =============================================

-- 获取可用的数据源
CREATE OR REPLACE FUNCTION get_available_data_sources()
RETURNS TABLE(
  source_name text,
  source_description text,
  table_name text,
  record_count bigint
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    'joined_data'::text as source_name,
    '关联数据（leads + followups + showings + deals）'::text as source_description,
    'filter_followups()'::text as table_name,
    (SELECT COUNT(*) FROM filter_followups()) as record_count
  UNION ALL
  SELECT 
    'leads'::text as source_name,
    '线索数据'::text as source_description,
    'leads'::text as table_name,
    (SELECT COUNT(*) FROM leads) as record_count
  UNION ALL
  SELECT 
    'showings_with_leads'::text as source_name,
    '带看数据（含线索信息，处理一对多）'::text as source_description,
    'showings + leads关联'::text as table_name,
    (SELECT COUNT(*) FROM showings) as record_count
  UNION ALL
  SELECT 
    'deals_with_leads'::text as source_name,
    '成交数据（含线索信息，处理一对多）'::text as source_description,
    'deals + leads关联'::text as table_name,
    (SELECT COUNT(*) FROM deals) as record_count;
END;
$$;

COMMENT ON FUNCTION get_available_data_sources IS '获取可用的数据源列表';

-- =============================================
-- 8. 创建字段信息查询函数
-- =============================================

-- 获取数据源的字段信息
CREATE OR REPLACE FUNCTION get_data_source_fields(
  p_source_name text DEFAULT 'joined_data'
)
RETURNS TABLE(
  field_name text,
  field_label text,
  field_type text,
  table_name text,
  is_dimension boolean,
  is_measure boolean
)
LANGUAGE plpgsql
AS $$
BEGIN
  CASE p_source_name
    WHEN 'joined_data' THEN
      RETURN QUERY
      SELECT 
        column_name::text as field_name,
        CASE column_name
          -- Leads表字段
          WHEN 'leadid' THEN '线索编号'
          WHEN 'phone' THEN '手机号'
          WHEN 'wechat' THEN '微信号'
          WHEN 'qq' THEN 'QQ号'
          WHEN 'location' THEN '位置'
          WHEN 'budget' THEN '预算'
          WHEN 'remark' THEN '备注'
          WHEN 'source' THEN '渠道'
          WHEN 'douyinid' THEN '抖音ID'
          WHEN 'douyin_accountname' THEN '抖音账号'
          WHEN 'staffname' THEN '员工姓名'
          WHEN 'redbookid' THEN '小红书ID'
          WHEN 'area' THEN '线索来源区域'
          WHEN 'notelink' THEN '笔记链接'
          WHEN 'campaignid' THEN '广告计划ID'
          WHEN 'campaignname' THEN '广告计划名称'
          WHEN 'unitid' THEN '广告单元ID'
          WHEN 'unitname' THEN '广告单元名称'
          WHEN 'creativedid' THEN '创意ID'
          WHEN 'creativename' THEN '创意名称'
          WHEN 'leadtype' THEN '线索类型'
          WHEN 'traffictype' THEN '流量类型'
          WHEN 'interactiontype' THEN '互动类型'
          WHEN 'douyinleadid' THEN '抖音线索ID'
          WHEN 'leadstatus' THEN '线索状态'
          WHEN 'created_at' THEN '线索创建时间'
          WHEN 'updata_at' THEN '线索更新时间'
          
          -- Followups表字段
          WHEN 'followupstage' THEN '跟进阶段'
          WHEN 'customerprofile' THEN '客户画像'
          WHEN 'worklocation' THEN '工作地点'
          WHEN 'userbudget' THEN '用户预算'
          WHEN 'moveintime' THEN '入住时间'
          WHEN 'userrating' THEN '来访意向'
          WHEN 'majorcategory' THEN '跟进结果'
          WHEN 'followupresult' THEN '跟进结果详情'
          WHEN 'scheduletime' THEN '预约时间'
          WHEN 'scheduledcommunity' THEN '意向社区'
          WHEN 'interviewsales_user_name' THEN '约访销售'
          WHEN 'interviewsales_user_id' THEN '约访销售ID'
          
          -- Showings表字段（处理一对多关系）
          WHEN 'viewresult' THEN '看房结果'
          WHEN 'community' THEN '到访社区'
          WHEN 'arrivaltime' THEN '到达时间'
          WHEN 'showingsales_user_name' THEN '分配带看销售'
          WHEN 'trueshowingsales_user_name' THEN '实际带看销售'
          WHEN 'showing_budget' THEN '看房预算'
          WHEN 'showing_moveintime' THEN '看房入住时间'
          WHEN 'showing_remark' THEN '看房备注'
          WHEN 'renttime' THEN '租期'
          WHEN 'scheduletime' THEN '预约时间'
          WHEN 'showing_created_at' THEN '看房创建时间'
          WHEN 'showing_updated_at' THEN '看房更新时间'
          
          -- Deals表字段（处理一对多关系）
          WHEN 'contractdate' THEN '签约日期'
          WHEN 'deal_community' THEN '成交社区'
          WHEN 'contractnumber' THEN '合同编号'
          WHEN 'roomnumber' THEN '房间号'
          WHEN 'deal_created_at' THEN '成交创建时间'
          WHEN 'deal_updated_at' THEN '成交更新时间'
          WHEN 'channel' THEN '成交渠道'
          WHEN 'interviewsales' THEN '约访销售'
          
          -- 统计字段（用于聚合）
          WHEN 'showings_count' THEN '带看次数'
          WHEN 'deals_count' THEN '成交次数'
          WHEN 'total_budget' THEN '总预算'
          WHEN 'avg_budget' THEN '平均预算'
          WHEN 'conversion_rate' THEN '转化率'
          
          ELSE column_name
        END as field_label,
        data_type::text as field_type,
        'joined_data'::text as table_name,
        CASE 
          WHEN data_type IN ('text', 'character varying', 'timestamp', 'date') THEN true
          ELSE false
        END as is_dimension,
        CASE 
          WHEN data_type IN ('integer', 'bigint', 'numeric', 'decimal') THEN true
          ELSE false
        END as is_measure
      FROM information_schema.columns 
      WHERE table_name = 'filter_followups' 
      AND table_schema = 'public';
    ELSE
      -- 其他数据源的处理
      RETURN QUERY SELECT 
        column_name::text as field_name,
        column_name::text as field_label,
        data_type::text as field_type,
        p_source_name::text as table_name,
        CASE 
          WHEN data_type IN ('text', 'character varying', 'timestamp', 'date') THEN true
          ELSE false
        END as is_dimension,
        CASE 
          WHEN data_type IN ('integer', 'bigint', 'numeric', 'decimal') THEN true
          ELSE false
        END as is_measure
      FROM information_schema.columns 
      WHERE table_name = p_source_name 
      AND table_schema = 'public';
  END CASE;
END;
$$;

COMMENT ON FUNCTION get_data_source_fields IS '获取数据源的字段信息';

-- =============================================
-- 9. 创建示例数据（可选）
-- =============================================

-- 插入一些示例配置（如果需要）
-- INSERT INTO bi_pivot_configs (name, description, config, data_source, created_by, is_public) VALUES
-- ('销售业绩分析', '分析各销售人员的业绩情况', '{"rowFields":["interviewsales_user_name"],"columnFields":["followupstage"],"valueFields":[{"field":"leadid","aggregation":"count"}]}', 'joined_data', 'system', true),
-- ('渠道效果分析', '分析各渠道的转化效果', '{"rowFields":["source"],"columnFields":["viewresult"],"valueFields":[{"field":"leadid","aggregation":"count"}]}', 'joined_data', 'system', true);

-- =============================================
-- 10. 完成提示
-- =============================================

SELECT 'BI数据分析系统迁移完成！' as message;

COMMIT; 