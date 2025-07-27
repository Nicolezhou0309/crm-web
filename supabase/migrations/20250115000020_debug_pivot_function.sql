-- =============================================
-- 透视表函数详细调试版本
-- 修复时间: 2025年1月15日
-- 目的: 添加详细日志来排查问题
-- =============================================

-- 删除原函数
DROP FUNCTION IF EXISTS execute_pivot_analysis(text, text[], text[], jsonb, jsonb);

-- 重新创建透视表执行函数，添加详细调试信息
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
  v_count integer;
  v_result_sql text;
  v_debug_info jsonb;
BEGIN
  RAISE NOTICE '=== 开始执行透视表分析 ===';
  RAISE NOTICE '数据源: %', p_data_source;
  RAISE NOTICE '行字段: %', p_row_fields;
  RAISE NOTICE '列字段: %', p_column_fields;
  RAISE NOTICE '值字段: %', p_value_fields;
  RAISE NOTICE '筛选条件: %', p_filters;
  
  -- 根据数据源构建基础SQL
  CASE p_data_source
    WHEN 'filter_followups' THEN
      v_sql := 'SELECT * FROM filter_followups()';
      
    WHEN 'filter_leads' THEN
      v_sql := 'SELECT * FROM filter_leads()';
      
    WHEN 'filter_showings' THEN
      v_sql := 'SELECT * FROM filter_showings()';
      
    WHEN 'filter_deals' THEN
      v_sql := 'SELECT * FROM filter_deals()';
      
    WHEN 'joined_data' THEN
      -- 使用新的联合分析函数
      v_sql := 'SELECT * FROM filter_all_analysis_multi()';
      RAISE NOTICE '使用联合分析函数作为数据源';
      
    WHEN 'deals_with_relations' THEN
      v_sql := 'SELECT 
        d.*,
        l.phone,
        l.wechat,
        l.source,
        l.leadtype,
        l.leadstatus,
        f.followupstage,
        f.customerprofile,
        f.worklocation,
        f.userbudget,
        f.userrating,
        f.majorcategory,
        f.followupresult,
        f.scheduledcommunity,
        up_interview.nickname as interviewsales_user_name
      FROM deals d
      LEFT JOIN leads l ON d.leadid = l.leadid
      LEFT JOIN followups f ON d.leadid = f.leadid
      LEFT JOIN users_profile up_interview ON f.interviewsales_user_id = up_interview.id';
      
    ELSE
      v_sql := 'SELECT * FROM ' || p_data_source;
  END CASE;
  
  RAISE NOTICE '基础SQL: %', v_sql;
  
  -- 测试基础数据源是否可用
  BEGIN
    EXECUTE 'SELECT COUNT(*) FROM (' || v_sql || ') t' INTO v_count;
    RAISE NOTICE '基础数据源记录数: %', v_count;
    
    -- 测试联合分析函数的字段
    IF p_data_source = 'joined_data' THEN
      EXECUTE 'SELECT leadid, source, lead_created_at FROM filter_all_analysis_multi() LIMIT 1' INTO v_debug_info;
      RAISE NOTICE '联合分析函数测试成功，示例数据: %', v_debug_info;
    END IF;
  EXCEPTION
    WHEN OTHERS THEN
      RAISE NOTICE '基础数据源测试失败: %', SQLERRM;
  END;
  
  -- 构建SELECT字段 - 行维度字段
  IF array_length(p_row_fields, 1) > 0 THEN
    FOREACH v_row_field IN ARRAY p_row_fields
    LOOP
      v_select_fields := v_select_fields || quote_ident(v_row_field) || ', ';
      RAISE NOTICE '添加行维度字段: %', v_row_field;
    END LOOP;
  END IF;
  
  -- 构建SELECT字段 - 列维度字段
  IF array_length(p_column_fields, 1) > 0 THEN
    FOREACH v_col_field IN ARRAY p_column_fields
    LOOP
      v_select_fields := v_select_fields || quote_ident(v_col_field) || ', ';
      RAISE NOTICE '添加列维度字段: %', v_col_field;
    END LOOP;
  END IF;
  
  RAISE NOTICE 'SELECT字段: %', v_select_fields;
  
  -- 构建聚合字段
  FOR v_value_field IN SELECT * FROM jsonb_array_elements(p_value_fields)
  LOOP
    RAISE NOTICE '处理聚合字段: %', v_value_field;
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
      BEGIN
        RAISE NOTICE '处理筛选条件: 字段=% 操作符=% 值=%', v_field, v_operator, v_value;
        
        -- 根据操作符构建条件
        CASE v_operator
          WHEN 'equals' THEN
            IF v_value IS NOT NULL AND v_value != '' THEN
              -- 处理数组值（多选）
              IF v_value LIKE '[%]' THEN
                -- 解析数组值
                DECLARE
                  v_array_values text[];
                BEGIN
                  -- 简单的数组解析（假设格式为 [value1,value2]）
                  v_array_values := string_to_array(trim(both '[]' from v_value), ',');
                  v_condition := quote_ident(v_field) || ' = ANY(ARRAY[' || 
                    array_to_string(array(
                      SELECT quote_literal(trim(both ' ' from unnest))
                      FROM unnest(v_array_values)
                    ), ',') || '])';
                END;
              ELSE
                v_condition := quote_ident(v_field) || ' = ' || quote_literal(v_value);
              END IF;
            END IF;
            
          WHEN 'not_equals' THEN
            IF v_value IS NOT NULL AND v_value != '' THEN
              v_condition := quote_ident(v_field) || ' != ' || quote_literal(v_value);
            END IF;
            
          WHEN 'contains' THEN
            IF v_value IS NOT NULL AND v_value != '' THEN
              v_condition := quote_ident(v_field) || ' ILIKE ' || quote_literal('%' || v_value || '%');
            END IF;
            
          WHEN 'not_contains' THEN
            IF v_value IS NOT NULL AND v_value != '' THEN
              v_condition := quote_ident(v_field) || ' NOT ILIKE ' || quote_literal('%' || v_value || '%');
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
  
  RAISE NOTICE 'WHERE子句: %', v_where_clause;
  
  -- 构建完整SQL
  v_result_sql := 'SELECT ' || 
    CASE 
      WHEN length(v_select_fields) > 0 THEN trim(trailing ', ' from v_select_fields) || ', '
      ELSE ''
    END ||
    v_aggregation ||
    ' FROM (' || v_sql || ') t ' ||
    v_where_clause || ' ' ||
    v_group_by;
  
  RAISE NOTICE '完整SQL: %', v_result_sql;
  
  -- 测试生成的SQL是否有效
  BEGIN
    RAISE NOTICE '开始测试生成的SQL...';
    
    -- 先测试基础查询
    EXECUTE 'SELECT COUNT(*) FROM (' || v_result_sql || ') t' INTO v_count;
    RAISE NOTICE '查询结果数量: %', v_count;
    
    -- 测试具体字段
    IF v_count > 0 THEN
      EXECUTE 'SELECT * FROM (' || v_result_sql || ') t LIMIT 1' INTO v_debug_info;
      RAISE NOTICE '查询结果示例: %', v_debug_info;
    END IF;
    
  EXCEPTION
    WHEN OTHERS THEN
      RAISE NOTICE 'SQL测试失败: %', SQLERRM;
      RETURN jsonb_build_object(
        'error', 'SQL测试失败: ' || SQLERRM,
        'sql', v_result_sql,
        'result', '[]'::jsonb
      );
  END;
  
  -- 执行查询并返回结果
  BEGIN
    RAISE NOTICE '开始执行最终查询...';
    
    IF v_count > 0 THEN
      -- 有结果，返回完整结果
      RAISE NOTICE '有结果，构建完整结果...';
      
      -- 使用更安全的方式构建结果
      EXECUTE 'SELECT jsonb_build_object(
        ''sql'', $1,
        ''result'', to_jsonb(array_agg(row_to_json(t)))
      ) FROM (' || v_result_sql || ') t' INTO v_result USING v_result_sql;
      
      RAISE NOTICE '完整结果类型: %', jsonb_typeof(v_result);
      RAISE NOTICE 'result字段类型: %', jsonb_typeof(v_result->'result');
      RAISE NOTICE 'result字段内容: %', v_result->'result';
    ELSE
      -- 无结果，返回空数组
      RAISE NOTICE '无结果，返回空数组...';
      v_result := jsonb_build_object(
        'sql', v_result_sql,
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
        'sql', v_result_sql,
        'result', '[]'::jsonb
      );
  END;
END;
$$;

COMMENT ON FUNCTION execute_pivot_analysis IS '执行透视表分析，支持动态SQL构建和枚举字段筛选条件处理 - 详细调试版本'; 