-- =============================================
-- 多行表头透视表分析函数
-- 支持类似Excel的多行表头效果
-- =============================================

CREATE OR REPLACE FUNCTION execute_multi_level_pivot_analysis(
  p_data_source text DEFAULT 'joined_data',
  p_row_fields text[] DEFAULT NULL,
  p_column_fields text[] DEFAULT NULL,
  p_value_fields jsonb DEFAULT NULL,
  p_filters jsonb DEFAULT NULL,
  p_show_totals boolean DEFAULT true
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
  v_header_structure jsonb;
BEGIN
  -- 设置基础SQL
  CASE p_data_source
    WHEN 'joined_data' THEN
      v_base_sql := 'SELECT * FROM filter_all_analysis_multi()';
    ELSE
      v_base_sql := 'SELECT * FROM filter_all_analysis_multi()';
  END CASE;

  -- 构建行字段SQL
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

  -- 构建列字段SQL（支持多层级）
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

  -- 构建筛选条件SQL
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
        WHEN 'not_equals' THEN
          v_filter_sql := v_filter_sql || quote_ident(v_field) || ' != ' || quote_literal(p_filters->i->>'value');
        WHEN 'contains' THEN
          v_filter_sql := v_filter_sql || quote_ident(v_field) || ' ILIKE ' || quote_literal('%' || COALESCE(p_filters->i->>'value', '') || '%');
        WHEN 'not_contains' THEN
          v_filter_sql := v_filter_sql || quote_ident(v_field) || ' NOT ILIKE ' || quote_literal('%' || COALESCE(p_filters->i->>'value', '') || '%');
        WHEN 'greater_than' THEN
          v_filter_sql := v_filter_sql || quote_ident(v_field) || ' > ' || quote_literal(p_filters->i->>'value');
        WHEN 'less_than' THEN
          v_filter_sql := v_filter_sql || quote_ident(v_field) || ' < ' || quote_literal(p_filters->i->>'value');
        WHEN 'between' THEN
          v_filter_sql := v_filter_sql || quote_ident(v_field) || ' BETWEEN ' || 
                         quote_literal(p_filters->i->>'value') || ' AND ' || 
                         quote_literal(p_filters->i->>'value2');
        WHEN 'date_between' THEN
          v_filter_sql := v_filter_sql || quote_ident(v_field) || ' BETWEEN ' || 
                         quote_literal(p_filters->i->>'value') || ' AND ' || 
                         quote_literal(p_filters->i->>'value2');
        WHEN 'is_null' THEN
          v_filter_sql := v_filter_sql || quote_ident(v_field) || ' IS NULL';
        WHEN 'is_not_null' THEN
          v_filter_sql := v_filter_sql || quote_ident(v_field) || ' IS NOT NULL';
        WHEN 'in' THEN
          v_filter_sql := v_filter_sql || quote_ident(v_field) || ' = ANY(' || quote_literal(p_filters->i->'value') || '::text[])';
        WHEN 'like' THEN
          v_filter_sql := v_filter_sql || quote_ident(v_field) || ' LIKE ' || quote_literal('%' || COALESCE(p_filters->i->>'value', '') || '%');
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
  
  -- 添加分组
  IF v_row_fields_sql != '' OR v_column_fields_sql != '' THEN
    v_result_sql := v_result_sql || ' GROUP BY ';
    
    IF v_row_fields_sql != '' AND v_column_fields_sql != '' THEN
      v_result_sql := v_result_sql || v_row_fields_sql || ', ' || v_column_fields_sql;
    ELSIF v_row_fields_sql != '' THEN
      v_result_sql := v_result_sql || v_row_fields_sql;
    ELSE
      v_result_sql := v_result_sql || v_column_fields_sql;
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

  -- 构建表头结构信息
  v_header_structure := jsonb_build_object(
    'row_fields', p_row_fields,
    'column_fields', p_column_fields,
    'value_fields', p_value_fields,
    'has_multi_level_headers', CASE 
      WHEN p_column_fields IS NOT NULL AND array_length(p_column_fields, 1) > 1 THEN true
      ELSE false
    END
  );

  -- 执行查询
  BEGIN
    EXECUTE 'SELECT COUNT(*) FROM (' || v_result_sql || ') t' INTO v_count;
    
    IF v_count > 0 THEN
      EXECUTE 'SELECT jsonb_build_object(
        ''sql'', $1,
        ''result'', to_jsonb(array_agg(row_to_json(t))),
        ''total_rows'', $2,
        ''header_structure'', $3,
        ''show_totals'', $4
      ) FROM (' || v_result_sql || ') t' INTO v_result USING v_result_sql, v_count, v_header_structure, p_show_totals;
    ELSE
      v_result := jsonb_build_object(
        'sql', v_result_sql,
        'result', '[]'::jsonb,
        'total_rows', 0,
        'header_structure', v_header_structure,
        'show_totals', p_show_totals
      );
    END IF;
  EXCEPTION
    WHEN OTHERS THEN
      v_result := jsonb_build_object(
        'error', SQLERRM,
        'sql', v_result_sql,
        'result', '[]'::jsonb,
        'header_structure', v_header_structure
      );
  END;

  RETURN v_result;
END;
$$ LANGUAGE plpgsql;

-- 添加函数注释
COMMENT ON FUNCTION execute_multi_level_pivot_analysis IS '多行表头透视表分析函数，支持类似Excel的多行表头效果';

-- =============================================
-- 使用示例
-- =============================================

/*
-- 示例1：多行表头（日期+来源）
SELECT execute_multi_level_pivot_analysis(
  'joined_data',
  ARRAY['source'],  -- 行字段：来源
  ARRAY['lead_created_at', 'source'],  -- 列字段：日期+来源（多层级）
  '[{"field": "leadid", "aggregation": "count", "alias": "lead_count"}]'::jsonb,
  NULL
);

-- 示例2：多行表头（年份+月份+来源）
SELECT execute_multi_level_pivot_analysis(
  'joined_data',
  ARRAY['source'],  -- 行字段：来源
  ARRAY['EXTRACT(YEAR FROM lead_created_at)', 'EXTRACT(MONTH FROM lead_created_at)', 'source'],  -- 列字段：年+月+来源
  '[{"field": "leadid", "aggregation": "count", "alias": "lead_count"}]'::jsonb,
  NULL
);
*/ 