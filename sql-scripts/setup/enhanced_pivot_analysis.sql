-- =============================================
-- 增强版透视表分析函数
-- 支持多值处理和父子关系
-- =============================================

CREATE OR REPLACE FUNCTION execute_enhanced_pivot_analysis(
  p_data_source text DEFAULT 'joined_data',
  p_row_fields text[] DEFAULT NULL,
  p_column_fields text[] DEFAULT NULL,
  p_value_fields jsonb DEFAULT NULL,
  p_filters jsonb DEFAULT NULL,
  p_show_totals boolean DEFAULT true,
  p_show_subtotals boolean DEFAULT true
)
RETURNS jsonb AS $$
DECLARE
  v_base_sql text;
  v_result_sql text;
  v_row_fields_sql text;
  v_column_fields_sql text;
  v_value_fields_sql text;
  v_filter_sql text;
  v_result jsonb;
  v_count integer;
  v_field text;
  v_aggregation text;
  v_alias text;
BEGIN
  -- 设置基础SQL
  CASE p_data_source
    WHEN 'joined_data' THEN
      v_base_sql := 'SELECT * FROM filter_all_analysis_multi()';
    ELSE
      v_base_sql := 'SELECT * FROM filter_all_analysis_multi()';
  END CASE;

  -- 构建行字段SQL（支持父子关系）
  v_row_fields_sql := '';
  IF p_row_fields IS NOT NULL AND array_length(p_row_fields, 1) > 0 THEN
    FOR i IN 1..array_length(p_row_fields, 1) LOOP
      v_field := p_row_fields[i];
      IF i > 1 THEN
        v_row_fields_sql := v_row_fields_sql || ', ';
      END IF;
      v_row_fields_sql := v_row_fields_sql || quote_ident(v_field);
    END LOOP;
  END IF;

  -- 构建列字段SQL（支持父子关系）
  v_column_fields_sql := '';
  IF p_column_fields IS NOT NULL AND array_length(p_column_fields, 1) > 0 THEN
    FOR i IN 1..array_length(p_column_fields, 1) LOOP
      v_field := p_column_fields[i];
      IF i > 1 THEN
        v_column_fields_sql := v_column_fields_sql || ', ';
      END IF;
      v_column_fields_sql := v_column_fields_sql || quote_ident(v_field);
    END LOOP;
  END IF;

  -- 构建值字段SQL
  v_value_fields_sql := '';
  IF p_value_fields IS NOT NULL THEN
    FOR i IN 0..jsonb_array_length(p_value_fields) - 1 LOOP
      v_field := p_value_fields->i->>'field';
      v_aggregation := p_value_fields->i->>'aggregation';
      v_alias := p_value_fields->i->>'alias';
      
      IF v_alias IS NULL THEN
        v_alias := v_field || '_' || v_aggregation;
      END IF;
      
      IF i > 0 THEN
        v_value_fields_sql := v_value_fields_sql || ', ';
      END IF;
      
      CASE v_aggregation
        WHEN 'count' THEN
          v_value_fields_sql := v_value_fields_sql || 'COUNT(' || quote_ident(v_field) || ') as ' || quote_ident(v_alias);
        WHEN 'sum' THEN
          v_value_fields_sql := v_value_fields_sql || 'SUM(' || quote_ident(v_field) || ') as ' || quote_ident(v_alias);
        WHEN 'avg' THEN
          v_value_fields_sql := v_value_fields_sql || 'AVG(' || quote_ident(v_field) || ') as ' || quote_ident(v_alias);
        WHEN 'min' THEN
          v_value_fields_sql := v_value_fields_sql || 'MIN(' || quote_ident(v_field) || ') as ' || quote_ident(v_alias);
        WHEN 'max' THEN
          v_value_fields_sql := v_value_fields_sql || 'MAX(' || quote_ident(v_field) || ') as ' || quote_ident(v_alias);
        ELSE
          v_value_fields_sql := v_value_fields_sql || 'COUNT(' || quote_ident(v_field) || ') as ' || quote_ident(v_alias);
      END CASE;
    END LOOP;
  END IF;

  -- 构建筛选条件SQL（支持多值处理）
  v_filter_sql := '';
  IF p_filters IS NOT NULL THEN
    FOR i IN 0..jsonb_array_length(p_filters) - 1 LOOP
      v_field := p_filters->i->>'field';
      v_aggregation := p_filters->i->>'operator';
      
      IF i > 0 THEN
        v_filter_sql := v_filter_sql || ' AND ';
      END IF;
      
      CASE v_aggregation
        WHEN 'equals' THEN
          v_filter_sql := v_filter_sql || quote_ident(v_field) || ' = ' || quote_literal(p_filters->i->>'value');
        WHEN 'in' THEN
          -- 多值处理：每个值单独显示
          v_filter_sql := v_filter_sql || quote_ident(v_field) || ' = ANY(' || quote_literal(p_filters->i->'value') || '::text[])';
        WHEN 'between' THEN
          v_filter_sql := v_filter_sql || quote_ident(v_field) || ' BETWEEN ' || 
                         quote_literal(p_filters->i->'value'->0) || ' AND ' || 
                         quote_literal(p_filters->i->'value'->1);
        WHEN 'like' THEN
          v_filter_sql := v_filter_sql || quote_ident(v_field) || ' LIKE ' || quote_literal('%' || p_filters->i->>'value' || '%');
        ELSE
          v_filter_sql := v_filter_sql || quote_ident(v_field) || ' = ' || quote_literal(p_filters->i->>'value');
      END CASE;
    END LOOP;
  END IF;

  -- 构建完整的SQL查询
  v_result_sql := 'SELECT ';
  
  -- 添加行字段
  IF v_row_fields_sql != '' THEN
    v_result_sql := v_result_sql || v_row_fields_sql;
  END IF;
  
  -- 添加列字段
  IF v_column_fields_sql != '' THEN
    IF v_row_fields_sql != '' THEN
      v_result_sql := v_result_sql || ', ';
    END IF;
    v_result_sql := v_result_sql || v_column_fields_sql;
  END IF;
  
  -- 添加值字段
  IF v_value_fields_sql != '' THEN
    IF v_row_fields_sql != '' OR v_column_fields_sql != '' THEN
      v_result_sql := v_result_sql || ', ';
    END IF;
    v_result_sql := v_result_sql || v_value_fields_sql;
  END IF;
  
  v_result_sql := v_result_sql || ' FROM (' || v_base_sql || ') t';
  
  -- 添加筛选条件
  IF v_filter_sql != '' THEN
    v_result_sql := v_result_sql || ' WHERE ' || v_filter_sql;
  END IF;
  
  -- 添加分组（支持父子关系）
  IF v_row_fields_sql != '' OR v_column_fields_sql != '' THEN
    v_result_sql := v_result_sql || ' GROUP BY ';
    
    IF v_row_fields_sql != '' AND v_column_fields_sql != '' THEN
      v_result_sql := v_result_sql || v_row_fields_sql || ', ' || v_column_fields_sql;
    ELSIF v_row_fields_sql != '' THEN
      v_result_sql := v_result_sql || v_row_fields_sql;
    ELSE
      v_result_sql := v_result_sql || v_column_fields_sql;
    END IF;
    
    -- 添加小计和总计（类似Excel透视表）
    IF p_show_subtotals THEN
      v_result_sql := v_result_sql || ' WITH ROLLUP';
    END IF;
  END IF;
  
  -- 添加排序
  IF v_row_fields_sql != '' OR v_column_fields_sql != '' THEN
    v_result_sql := v_result_sql || ' ORDER BY ';
    
    IF v_row_fields_sql != '' AND v_column_fields_sql != '' THEN
      v_result_sql := v_result_sql || v_row_fields_sql || ', ' || v_column_fields_sql;
    ELSIF v_row_fields_sql != '' THEN
      v_result_sql := v_result_sql || v_row_fields_sql;
    ELSE
      v_result_sql := v_result_sql || v_column_fields_sql;
    END IF;
  END IF;

  -- 执行查询
  BEGIN
    EXECUTE 'SELECT COUNT(*) FROM (' || v_result_sql || ') t' INTO v_count;
    
    IF v_count > 0 THEN
      EXECUTE 'SELECT jsonb_build_object(
        ''sql'', $1,
        ''result'', to_jsonb(array_agg(row_to_json(t))),
        ''total_rows'', $2,
        ''show_totals'', $3,
        ''show_subtotals'', $4
      ) FROM (' || v_result_sql || ') t' INTO v_result USING v_result_sql, v_count, p_show_totals, p_show_subtotals;
    ELSE
      v_result := jsonb_build_object(
        'sql', v_result_sql,
        'result', '[]'::jsonb,
        'total_rows', 0,
        'show_totals', p_show_totals,
        'show_subtotals', p_show_subtotals
      );
    END IF;
  EXCEPTION
    WHEN OTHERS THEN
      v_result := jsonb_build_object(
        'error', SQLERRM,
        'sql', v_result_sql,
        'result', '[]'::jsonb
      );
  END;

  RETURN v_result;
END;
$$ LANGUAGE plpgsql;

-- 添加函数注释
COMMENT ON FUNCTION execute_enhanced_pivot_analysis IS '增强版透视表分析函数，支持多值处理和父子关系，类似Excel数据透视表';

-- =============================================
-- 使用示例
-- =============================================

/*
-- 示例1：多值处理（每个来源单独显示）
SELECT execute_enhanced_pivot_analysis(
  'joined_data',
  ARRAY['source'],
  NULL,
  '[{"field": "leadid", "aggregation": "count", "alias": "lead_count"}]'::jsonb,
  '[{"field": "source", "operator": "in", "value": ["抖音", "微信", "小红书"]}]'::jsonb
);

-- 示例2：父子关系（按省份->城市->社区）
SELECT execute_enhanced_pivot_analysis(
  'joined_data',
  ARRAY['province', 'city', 'community'],
  NULL,
  '[{"field": "leadid", "aggregation": "count", "alias": "lead_count"}]'::jsonb,
  NULL,
  true,  -- 显示总计
  true   -- 显示小计
);

-- 示例3：时间维度父子关系
SELECT execute_enhanced_pivot_analysis(
  'joined_data',
  ARRAY['EXTRACT(YEAR FROM created_at)', 'EXTRACT(MONTH FROM created_at)'],
  ARRAY['source'],
  '[{"field": "leadid", "aggregation": "count", "alias": "lead_count"}]'::jsonb,
  NULL
);
*/ 