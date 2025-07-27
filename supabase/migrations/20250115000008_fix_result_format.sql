-- =============================================
-- 修复透视表结果格式
-- 修复时间: 2025年1月15日
-- 问题: 返回单个对象而不是数组
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
  v_select_fields text := '';
  v_group_by text := '';
  v_where_clause text := '';
  v_aggregation text := '';
  v_join_clause text := '';
  v_final_sql text := '';
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
  
  -- 构建WHERE子句（简化版）
  IF p_filters != '{}' THEN
    v_where_clause := 'WHERE 1=1'; -- 简化处理，实际可以根据filters构建复杂条件
  END IF;
  
  -- 构建完整SQL - 修复语法错误
  v_final_sql := 'SELECT ';
  
  -- 添加SELECT字段
  IF length(v_select_fields) > 0 THEN
    v_final_sql := v_final_sql || trim(trailing ', ' from v_select_fields);
  END IF;
  
  -- 添加聚合字段
  IF length(v_aggregation) > 0 THEN
    IF length(v_select_fields) > 0 THEN
      v_final_sql := v_final_sql || ', ';
    END IF;
    v_final_sql := v_final_sql || v_aggregation;
  END IF;
  
  -- 如果没有SELECT字段也没有聚合字段，添加默认的COUNT(*)
  IF length(v_select_fields) = 0 AND length(v_aggregation) = 0 THEN
    v_final_sql := v_final_sql || 'COUNT(*) as total_count';
  END IF;
  
  -- 添加FROM子句和其他部分
  v_final_sql := v_final_sql || ' FROM (' || v_sql || ') t ' || v_where_clause || ' ' || v_group_by;
  
  -- 执行查询并返回结果 - 修复返回格式
  BEGIN
    -- 使用 to_jsonb 确保返回数组格式
    EXECUTE 'SELECT jsonb_build_object(
      ''sql'', $1,
      ''result'', to_jsonb(array_agg(t.*))
    ) FROM (' || v_final_sql || ') t' INTO v_result USING v_final_sql;
    
    RETURN v_result;
  EXCEPTION
    WHEN OTHERS THEN
      RETURN jsonb_build_object(
        'error', SQLERRM,
        'sql', v_final_sql,
        'result', '[]'::jsonb
      );
  END;
END;
$$;

COMMENT ON FUNCTION execute_pivot_analysis IS '执行透视表分析，支持动态SQL构建 - 修复结果格式版本'; 