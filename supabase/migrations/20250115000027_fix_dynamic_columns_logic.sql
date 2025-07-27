-- =============================================
-- 修复透视表函数的动态列逻辑
-- 修复时间: 2025年1月15日
-- 问题: 动态列应该在值字段中生成，而不是在筛选条件中生成
-- =============================================

-- 重新创建多层级透视表函数，修复动态列逻辑
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
  v_filter_value text;
  v_filter_values text[];
  v_dynamic_columns text := '';
  v_has_multi_value_filter boolean := false;
  v_filter_field text;
  v_filter_operator text;
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

  -- 构建值字段SQL（支持动态列生成）
  v_value_fields_sql := '';
  IF p_value_fields IS NOT NULL THEN
    FOR i IN 0..jsonb_array_length(p_value_fields) - 1 LOOP
      v_field := p_value_fields->i->>'field';
      v_aggregation := p_value_fields->i->>'aggregation';
      
      IF i > 0 THEN
        v_value_fields_sql := v_value_fields_sql || ', ';
      END IF;
      
      -- 检查值字段是否包含多值（逗号分隔）
      IF v_field LIKE '%,%' THEN
        -- 分割多个值，为每个值生成单独的聚合列
        v_filter_values := string_to_array(v_field, ',');
        FOR j IN 1..array_length(v_filter_values, 1) LOOP
          IF j > 1 THEN
            v_value_fields_sql := v_value_fields_sql || ', ';
          END IF;
          
          CASE v_aggregation
            WHEN 'sum' THEN
              v_alias := trim(v_filter_values[j]) || '_sum';
              v_value_fields_sql := v_value_fields_sql || 'SUM(CASE WHEN ' || quote_ident(v_field) || ' ILIKE ' || 
                                   quote_literal('%' || trim(v_filter_values[j]) || '%') || ' THEN 1 ELSE 0 END) as ' || quote_ident(v_alias);
            WHEN 'count' THEN
              v_alias := trim(v_filter_values[j]) || '_count';
              v_value_fields_sql := v_value_fields_sql || 'COUNT(CASE WHEN ' || quote_ident(v_field) || ' ILIKE ' || 
                                   quote_literal('%' || trim(v_filter_values[j]) || '%') || ' THEN 1 END) as ' || quote_ident(v_alias);
            WHEN 'count_distinct' THEN
              v_alias := trim(v_filter_values[j]) || '_count_distinct';
              v_value_fields_sql := v_value_fields_sql || 'COUNT(DISTINCT CASE WHEN ' || quote_ident(v_field) || ' ILIKE ' || 
                                   quote_literal('%' || trim(v_filter_values[j]) || '%') || ' THEN ' || quote_ident(v_field) || ' END) as ' || quote_ident(v_alias);
            WHEN 'avg' THEN
              v_alias := trim(v_filter_values[j]) || '_avg';
              v_value_fields_sql := v_value_fields_sql || 'AVG(CASE WHEN ' || quote_ident(v_field) || ' ILIKE ' || 
                                   quote_literal('%' || trim(v_filter_values[j]) || '%') || ' THEN 1 ELSE 0 END) as ' || quote_ident(v_alias);
            WHEN 'max' THEN
              v_alias := trim(v_filter_values[j]) || '_max';
              v_value_fields_sql := v_value_fields_sql || 'MAX(CASE WHEN ' || quote_ident(v_field) || ' ILIKE ' || 
                                   quote_literal('%' || trim(v_filter_values[j]) || '%') || ' THEN 1 ELSE 0 END) as ' || quote_ident(v_alias);
            WHEN 'min' THEN
              v_alias := trim(v_filter_values[j]) || '_min';
              v_value_fields_sql := v_value_fields_sql || 'MIN(CASE WHEN ' || quote_ident(v_field) || ' ILIKE ' || 
                                   quote_literal('%' || trim(v_filter_values[j]) || '%') || ' THEN 1 ELSE 0 END) as ' || quote_ident(v_alias);
            ELSE
              v_alias := trim(v_filter_values[j]) || '_count';
              v_value_fields_sql := v_value_fields_sql || 'COUNT(CASE WHEN ' || quote_ident(v_field) || ' ILIKE ' || 
                                   quote_literal('%' || trim(v_filter_values[j]) || '%') || ' THEN 1 END) as ' || quote_ident(v_alias);
          END CASE;
        END LOOP;
      ELSE
        -- 单个值字段，使用标准聚合
        CASE v_aggregation
          WHEN 'sum' THEN
            v_alias := v_field || '_sum';
            v_value_fields_sql := v_value_fields_sql || 'SUM(' || quote_ident(v_field) || ') as ' || quote_ident(v_alias);
          WHEN 'count' THEN
            v_alias := v_field || '_count';
            v_value_fields_sql := v_value_fields_sql || 'COUNT(' || quote_ident(v_field) || ') as ' || quote_ident(v_alias);
          WHEN 'count_distinct' THEN
            v_alias := v_field || '_count_distinct';
            v_value_fields_sql := v_value_fields_sql || 'COUNT(DISTINCT ' || quote_ident(v_field) || ') as ' || quote_ident(v_alias);
          WHEN 'avg' THEN
            v_alias := v_field || '_avg';
            v_value_fields_sql := v_value_fields_sql || 'AVG(' || quote_ident(v_field) || ') as ' || quote_ident(v_alias);
          WHEN 'max' THEN
            v_alias := v_field || '_max';
            v_value_fields_sql := v_value_fields_sql || 'MAX(' || quote_ident(v_field) || ') as ' || quote_ident(v_alias);
          WHEN 'min' THEN
            v_alias := v_field || '_min';
            v_value_fields_sql := v_value_fields_sql || 'MIN(' || quote_ident(v_field) || ') as ' || quote_ident(v_alias);
          ELSE
            v_alias := v_field || '_count';
            v_value_fields_sql := v_value_fields_sql || 'COUNT(' || quote_ident(v_field) || ') as ' || quote_ident(v_alias);
        END CASE;
      END IF;
    END LOOP;
  END IF;

  -- 构建筛选条件SQL（不生成动态列）
  v_filter_sql := '';
  IF p_filters IS NOT NULL THEN
    FOR i IN 0..jsonb_array_length(p_filters) - 1 LOOP
      v_field := p_filters->i->>'field';
      v_aggregation := p_filters->i->>'operator';
      v_filter_value := p_filters->i->>'value';
      
      IF i > 0 THEN
        v_filter_sql := v_filter_sql || ' AND ';
      END IF;
      
      CASE v_aggregation
        WHEN 'equals' THEN
          v_filter_sql := v_filter_sql || quote_ident(v_field) || ' = ' || quote_literal(v_filter_value);
        WHEN 'not_equals' THEN
          v_filter_sql := v_filter_sql || quote_ident(v_field) || ' != ' || quote_literal(v_filter_value);
        WHEN 'contains' THEN
          -- 支持多值筛选：检查是否包含逗号分隔的多个值
          IF v_filter_value LIKE '%,%' THEN
            -- 分割多个值
            v_filter_values := string_to_array(v_filter_value, ',');
            v_filter_sql := v_filter_sql || '(';
            FOR j IN 1..array_length(v_filter_values, 1) LOOP
              IF j > 1 THEN
                v_filter_sql := v_filter_sql || ' OR ';
              END IF;
              v_filter_sql := v_filter_sql || quote_ident(v_field) || ' ILIKE ' || 
                             quote_literal('%' || trim(v_filter_values[j]) || '%');
            END LOOP;
            v_filter_sql := v_filter_sql || ')';
          ELSE
            -- 单个值
            v_filter_sql := v_filter_sql || quote_ident(v_field) || ' ILIKE ' || 
                           quote_literal('%' || v_filter_value || '%');
          END IF;
        WHEN 'not_contains' THEN
          v_filter_sql := v_filter_sql || quote_ident(v_field) || ' NOT ILIKE ' || 
                         quote_literal('%' || v_filter_value || '%');
        WHEN 'greater_than' THEN
          v_filter_sql := v_filter_sql || quote_ident(v_field) || ' > ' || quote_literal(v_filter_value);
        WHEN 'less_than' THEN
          v_filter_sql := v_filter_sql || quote_ident(v_field) || ' < ' || quote_literal(v_filter_value);
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
        ELSE
          v_filter_sql := v_filter_sql || quote_ident(v_field) || ' = ' || quote_literal(v_filter_value);
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
        'result', '[]'::jsonb
      );
  END;

  RETURN v_result;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION execute_multi_level_pivot_analysis IS '多行表头透视表分析函数，支持类似Excel的多行表头效果 - 修复动态列逻辑版本'; 