-- =============================================
-- 修复透视表分析函数的筛选条件处理
-- 修复时间: 2025年1月15日
-- 问题: 筛选条件未应用到WHERE子句
-- =============================================

-- 删除原函数
DROP FUNCTION IF EXISTS execute_pivot_analysis(text, text[], text[], jsonb, jsonb);

-- 重新创建透视表执行函数
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
  v_filter jsonb;
  v_select_fields text := '';
  v_group_by text := '';
  v_where_clause text := '';
  v_aggregation text := '';
  v_join_clause text := '';
  v_filter_conditions text := '';
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
  
  -- 构建SELECT字段 - 行维度字段
  IF array_length(p_row_fields, 1) > 0 THEN
    FOREACH v_row_field IN ARRAY p_row_fields
    LOOP
      v_select_fields := v_select_fields || quote_ident(v_row_field) || ', ';
    END LOOP;
  END IF;
  
  -- 构建SELECT字段 - 列维度字段
  IF array_length(p_column_fields, 1) > 0 THEN
    FOREACH v_col_field IN ARRAY p_column_fields
    LOOP
      v_select_fields := v_select_fields || quote_ident(v_col_field) || ', ';
    END LOOP;
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
  
  -- 构建GROUP BY - 行维度字段
  IF array_length(p_row_fields, 1) > 0 OR array_length(p_column_fields, 1) > 0 THEN
    v_group_by := 'GROUP BY ';
    
    -- 添加行维度字段到GROUP BY
    IF array_length(p_row_fields, 1) > 0 THEN
      FOREACH v_row_field IN ARRAY p_row_fields
      LOOP
        v_group_by := v_group_by || quote_ident(v_row_field) || ', ';
      END LOOP;
    END IF;
    
    -- 添加列维度字段到GROUP BY
    IF array_length(p_column_fields, 1) > 0 THEN
      FOREACH v_col_field IN ARRAY p_column_fields
      LOOP
        v_group_by := v_group_by || quote_ident(v_col_field) || ', ';
      END LOOP;
    END IF;
    
    -- 移除最后的逗号
    v_group_by := trim(trailing ', ' from v_group_by);
  END IF;
  
  -- 构建WHERE子句 - 处理筛选条件
  IF p_filters != '{}' AND p_filters != '[]' THEN
    v_where_clause := 'WHERE 1=1';
    
    -- 遍历所有筛选条件
    FOR v_filter IN SELECT * FROM jsonb_array_elements(p_filters)
    LOOP
      -- 获取筛选条件信息
      DECLARE
        v_field text := v_filter->>'field';
        v_operator text := v_filter->>'operator';
        v_value text := v_filter->>'value';
        v_value2 text := v_filter->>'value2';
        v_condition text := '';
      BEGIN
        -- 根据操作符构建筛选条件
        CASE v_operator
          WHEN 'equals' THEN
            IF v_value IS NOT NULL AND v_value != '' THEN
              v_condition := quote_ident(v_field) || ' = ' || quote_literal(v_value);
            END IF;
            
          WHEN 'not_equals' THEN
            IF v_value IS NOT NULL AND v_value != '' THEN
              v_condition := quote_ident(v_field) || ' != ' || quote_literal(v_value);
            END IF;
            
          WHEN 'contains' THEN
            IF v_value IS NOT NULL AND v_value != '' THEN
              -- 处理多值包含（逗号分隔）
              IF position(',' in v_value) > 0 THEN
                v_condition := '(';
                DECLARE
                  v_values text[] := string_to_array(v_value, ',');
                  v_single_value text;
                  v_first boolean := true;
                BEGIN
                  FOREACH v_single_value IN ARRAY v_values
                  LOOP
                    IF NOT v_first THEN
                      v_condition := v_condition || ' OR ';
                    END IF;
                    v_condition := v_condition || quote_ident(v_field) || ' LIKE ' || quote_literal('%' || trim(v_single_value) || '%');
                    v_first := false;
                  END LOOP;
                  v_condition := v_condition || ')';
                END;
              ELSE
                v_condition := quote_ident(v_field) || ' LIKE ' || quote_literal('%' || v_value || '%');
              END IF;
            END IF;
            
          WHEN 'not_contains' THEN
            IF v_value IS NOT NULL AND v_value != '' THEN
              -- 处理多值不包含（逗号分隔）
              IF position(',' in v_value) > 0 THEN
                v_condition := '(';
                DECLARE
                  v_values text[] := string_to_array(v_value, ',');
                  v_single_value text;
                  v_first boolean := true;
                BEGIN
                  FOREACH v_single_value IN ARRAY v_values
                  LOOP
                    IF NOT v_first THEN
                      v_condition := v_condition || ' AND ';
                    END IF;
                    v_condition := v_condition || quote_ident(v_field) || ' NOT LIKE ' || quote_literal('%' || trim(v_single_value) || '%');
                    v_first := false;
                  END LOOP;
                  v_condition := v_condition || ')';
                END;
              ELSE
                v_condition := quote_ident(v_field) || ' NOT LIKE ' || quote_literal('%' || v_value || '%');
              END IF;
            END IF;
            
          WHEN 'greater_than' THEN
            IF v_value IS NOT NULL AND v_value != '' THEN
              v_condition := quote_ident(v_field) || ' > ' || quote_literal(v_value);
            END IF;
            
          WHEN 'less_than' THEN
            IF v_value IS NOT NULL AND v_value != '' THEN
              v_condition := quote_ident(v_field) || ' < ' || quote_literal(v_value);
            END IF;
            
          WHEN 'between' THEN
            IF v_value IS NOT NULL AND v_value != '' AND v_value2 IS NOT NULL AND v_value2 != '' THEN
              v_condition := quote_ident(v_field) || ' BETWEEN ' || quote_literal(v_value) || ' AND ' || quote_literal(v_value2);
            END IF;
            
          WHEN 'date_between' THEN
            IF v_value IS NOT NULL AND v_value != '' AND v_value2 IS NOT NULL AND v_value2 != '' THEN
              v_condition := quote_ident(v_field) || ' BETWEEN ' || quote_literal(v_value) || ' AND ' || quote_literal(v_value2);
            END IF;
            
          WHEN 'is_null' THEN
            v_condition := quote_ident(v_field) || ' IS NULL';
            
          WHEN 'is_not_null' THEN
            v_condition := quote_ident(v_field) || ' IS NOT NULL';
            
        END CASE;
        
        -- 添加筛选条件到WHERE子句
        IF v_condition != '' THEN
          v_where_clause := v_where_clause || ' AND ' || v_condition;
        END IF;
      END;
    END LOOP;
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

COMMENT ON FUNCTION execute_pivot_analysis IS '执行透视表分析，支持动态SQL构建和筛选条件处理 - 修复版本'; 