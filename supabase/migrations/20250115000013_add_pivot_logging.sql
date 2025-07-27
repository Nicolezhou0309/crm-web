-- =============================================
-- 为透视表分析函数添加详细日志
-- 修复时间: 2025年1月15日
-- 目的: 调试结果格式问题
-- =============================================

-- 删除原函数
DROP FUNCTION IF EXISTS execute_pivot_analysis(text, text[], text[], jsonb, jsonb);

-- 重新创建透视表执行函数（带日志）
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
  v_count integer;
  v_result_array jsonb;
  v_debug_info jsonb;
BEGIN
  -- 记录输入参数
  RAISE NOTICE '=== 透视表函数开始执行 ===';
  RAISE NOTICE '数据源: %', p_data_source;
  RAISE NOTICE '行字段: %', p_row_fields;
  RAISE NOTICE '列字段: %', p_column_fields;
  RAISE NOTICE '值字段: %', p_value_fields;
  RAISE NOTICE '筛选条件: %', p_filters;
  
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
  
  RAISE NOTICE '基础SQL: %', v_sql;
  
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
  
  RAISE NOTICE 'SELECT字段: %', v_select_fields;
  
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
  
  RAISE NOTICE '聚合字段: %', v_aggregation;
  
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
  
  RAISE NOTICE 'GROUP BY: %', v_group_by;
  
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
        v_field_type text;
      BEGIN
        RAISE NOTICE '处理筛选条件: 字段=% 操作符=% 值=%', v_field, v_operator, v_value;
        
        -- 获取字段的数据类型
        BEGIN
          EXECUTE 'SELECT data_type FROM information_schema.columns WHERE table_name = ''leads'' AND column_name = $1' INTO v_field_type USING v_field;
        EXCEPTION
          WHEN OTHERS THEN
            v_field_type := 'text'; -- 默认类型
        END;
        
        RAISE NOTICE '字段类型: %', v_field_type;
        
        -- 根据操作符构建筛选条件
        CASE v_operator
          WHEN 'equals' THEN
            IF v_value IS NOT NULL AND v_value != '' THEN
              -- 对于枚举字段，需要特殊处理
              IF v_field_type = 'USER-DEFINED' OR v_field IN ('source', 'leadtype', 'leadstatus', 'area', 'userrating', 'community', 'customerprofile', 'followupstage') THEN
                v_condition := quote_ident(v_field) || '::text = ' || quote_literal(v_value);
              ELSE
                v_condition := quote_ident(v_field) || ' = ' || quote_literal(v_value);
              END IF;
            END IF;
            
          WHEN 'not_equals' THEN
            IF v_value IS NOT NULL AND v_value != '' THEN
              -- 对于枚举字段，需要特殊处理
              IF v_field_type = 'USER-DEFINED' OR v_field IN ('source', 'leadtype', 'leadstatus', 'area', 'userrating', 'community', 'customerprofile', 'followupstage') THEN
                v_condition := quote_ident(v_field) || '::text != ' || quote_literal(v_value);
              ELSE
                v_condition := quote_ident(v_field) || ' != ' || quote_literal(v_value);
              END IF;
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
                    -- 对于枚举字段，需要特殊处理
                    IF v_field_type = 'USER-DEFINED' OR v_field IN ('source', 'leadtype', 'leadstatus', 'area', 'userrating', 'community', 'customerprofile', 'followupstage') THEN
                      v_condition := v_condition || quote_ident(v_field) || '::text LIKE ' || quote_literal('%' || trim(v_single_value) || '%');
                    ELSE
                      v_condition := v_condition || quote_ident(v_field) || ' LIKE ' || quote_literal('%' || trim(v_single_value) || '%');
                    END IF;
                    v_first := false;
                  END LOOP;
                  v_condition := v_condition || ')';
                END;
              ELSE
                -- 对于枚举字段，需要特殊处理
                IF v_field_type = 'USER-DEFINED' OR v_field IN ('source', 'leadtype', 'leadstatus', 'area', 'userrating', 'community', 'customerprofile', 'followupstage') THEN
                  v_condition := quote_ident(v_field) || '::text LIKE ' || quote_literal('%' || v_value || '%');
                ELSE
                  v_condition := quote_ident(v_field) || ' LIKE ' || quote_literal('%' || v_value || '%');
                END IF;
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
                    -- 对于枚举字段，需要特殊处理
                    IF v_field_type = 'USER-DEFINED' OR v_field IN ('source', 'leadtype', 'leadstatus', 'area', 'userrating', 'community', 'customerprofile', 'followupstage') THEN
                      v_condition := v_condition || quote_ident(v_field) || '::text NOT LIKE ' || quote_literal('%' || trim(v_single_value) || '%');
                    ELSE
                      v_condition := v_condition || quote_ident(v_field) || ' NOT LIKE ' || quote_literal('%' || trim(v_single_value) || '%');
                    END IF;
                    v_first := false;
                  END LOOP;
                  v_condition := v_condition || ')';
                END;
              ELSE
                -- 对于枚举字段，需要特殊处理
                IF v_field_type = 'USER-DEFINED' OR v_field IN ('source', 'leadtype', 'leadstatus', 'area', 'userrating', 'community', 'customerprofile', 'followupstage') THEN
                  v_condition := quote_ident(v_field) || '::text NOT LIKE ' || quote_literal('%' || v_value || '%');
                ELSE
                  v_condition := quote_ident(v_field) || ' NOT LIKE ' || quote_literal('%' || v_value || '%');
                END IF;
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
        
        RAISE NOTICE '生成的筛选条件: %', v_condition;
        
        -- 添加筛选条件到WHERE子句
        IF v_condition != '' THEN
          v_where_clause := v_where_clause || ' AND ' || v_condition;
        END IF;
      END;
    END LOOP;
  END IF;
  
  RAISE NOTICE 'WHERE子句: %', v_where_clause;
  
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
  
  RAISE NOTICE '完整SQL: %', v_sql;
  
  -- 执行查询并返回结果
  BEGIN
    -- 先检查是否有结果
    RAISE NOTICE '开始执行查询...';
    
    -- 获取结果数量
    EXECUTE 'SELECT COUNT(*) FROM (' || v_sql || ') t' INTO v_count;
    RAISE NOTICE '查询结果数量: %', v_count;
    
    IF v_count > 0 THEN
      -- 有结果，返回完整结果
      RAISE NOTICE '有结果，构建完整结果...';
      EXECUTE 'SELECT jsonb_build_object(
        ''sql'', $1,
        ''result'', to_jsonb(t.*)
      ) FROM (' || v_sql || ') t' INTO v_result USING v_sql;
      
      RAISE NOTICE '完整结果类型: %', jsonb_typeof(v_result);
      RAISE NOTICE 'result字段类型: %', jsonb_typeof(v_result->'result');
      RAISE NOTICE 'result字段内容: %', v_result->'result';
    ELSE
      -- 无结果，返回空数组
      RAISE NOTICE '无结果，返回空数组...';
      v_result := jsonb_build_object(
        'sql', v_sql,
        'result', '[]'::jsonb
      );
    END IF;
    
    -- 确保 result 字段是数组格式
    IF v_result->'result' IS NULL OR v_result->'result' = 'null' THEN
      RAISE NOTICE 'result字段为空，设置为空数组...';
      v_result := jsonb_set(v_result, '{result}', '[]'::jsonb);
    END IF;
    
    RAISE NOTICE '最终结果类型: %', jsonb_typeof(v_result);
    RAISE NOTICE '最终result字段类型: %', jsonb_typeof(v_result->'result');
    RAISE NOTICE '=== 透视表函数执行完成 ===';
    
    RETURN v_result;
  EXCEPTION
    WHEN OTHERS THEN
      RAISE NOTICE '执行出错: %', SQLERRM;
      RETURN jsonb_build_object(
        'error', SQLERRM,
        'sql', v_sql,
        'result', '[]'::jsonb
      );
  END;
END;
$$;

COMMENT ON FUNCTION execute_pivot_analysis IS '执行透视表分析，支持动态SQL构建和枚举字段筛选条件处理 - 带日志版本'; 