-- 创建获取筛选选项的后端函数
CREATE OR REPLACE FUNCTION public.get_filter_options(
  p_field_name TEXT,
  p_filters JSONB DEFAULT '{}'::JSONB
)
RETURNS TABLE(
  text TEXT,
  value TEXT,
  search_text TEXT
) 
LANGUAGE plpgsql
AS $$
DECLARE
  sql_query TEXT;
  where_clause TEXT := '';
  field_mapping JSONB := '{
    "leadid": {"field": "leadid", "display": "leadid", "type": "string"},
    "phone": {"field": "phone", "display": "phone", "type": "phone"},
    "wechat": {"field": "wechat", "display": "wechat", "type": "wechat"},
    "interviewsales_user_id": {"field": "interviewsales_user_id", "display": "interviewsales_user_name", "type": "user"},
    "remark": {"field": "remark", "display": "remark", "type": "string"},
    "worklocation": {"field": "worklocation", "display": "worklocation", "type": "string"},
    "userbudget": {"field": "userbudget", "display": "userbudget", "type": "string"},
    "followupresult": {"field": "followupresult", "display": "followupresult", "type": "string"},
    "leadtype": {"field": "leadtype", "display": "leadtype", "type": "string"}
  }'::JSONB;
  field_config JSONB;
  field_name TEXT;
  display_name TEXT;
  field_type TEXT;
BEGIN
  -- 获取字段配置
  field_config := field_mapping->p_field_name;
  IF field_config IS NULL THEN
    RAISE EXCEPTION '不支持的字段: %', p_field_name;
  END IF;
  
  field_name := field_config->>'field';
  display_name := field_config->>'display';
  field_type := field_config->>'type';
  
  -- 构建WHERE子句（基于传入的筛选条件）
  IF p_filters IS NOT NULL AND p_filters != '{}'::JSONB THEN
    -- 这里可以添加基于当前筛选条件的逻辑
    -- 例如：如果已经筛选了某个用户，那么其他字段的选项应该基于这个筛选结果
  END IF;
  
  -- 根据字段类型构建不同的查询
  IF field_type = 'phone' THEN
    -- 手机号字段：显示脱敏版本，但保留原始值用于搜索
    sql_query := format('
      SELECT DISTINCT
        CASE 
          WHEN %I IS NULL OR %I = '''' THEN ''为空''
          ELSE 
            CASE 
              WHEN LENGTH(%I) = 11 THEN 
                LEFT(%I, 3) || ''****'' || RIGHT(%I, 4)
              ELSE %I
            END
        END as text,
        CASE 
          WHEN %I IS NULL OR %I = '''' THEN NULL
          ELSE %I::TEXT
        END as value,
        CASE 
          WHEN %I IS NULL OR %I = '''' THEN NULL
          ELSE %I::TEXT
        END as search_text
      FROM followups
      WHERE 1=1
      ORDER BY 
        CASE WHEN %I IS NULL OR %I = '''' THEN 1 ELSE 0 END,
        COALESCE(%I::TEXT, '''')
    ', 
      field_name, field_name, field_name, field_name, field_name, field_name,
      field_name, field_name, field_name,
      field_name, field_name, field_name,
      field_name, field_name, field_name
    );
  ELSIF field_type = 'wechat' THEN
    -- 微信号字段：显示脱敏版本
    sql_query := format('
      SELECT DISTINCT
        CASE 
          WHEN %I IS NULL OR %I = '''' THEN ''为空''
          ELSE 
            CASE 
              WHEN LENGTH(%I) > 3 THEN 
                LEFT(%I, 2) || ''***'' || RIGHT(%I, 2)
              ELSE %I
            END
        END as text,
        CASE 
          WHEN %I IS NULL OR %I = '''' THEN NULL
          ELSE %I::TEXT
        END as value,
        CASE 
          WHEN %I IS NULL OR %I = '''' THEN NULL
          ELSE %I::TEXT
        END as search_text
      FROM followups
      WHERE 1=1
      ORDER BY 
        CASE WHEN %I IS NULL OR %I = '''' THEN 1 ELSE 0 END,
        COALESCE(%I::TEXT, '''')
    ', 
      field_name, field_name, field_name, field_name, field_name, field_name,
      field_name, field_name, field_name,
      field_name, field_name, field_name,
      field_name, field_name, field_name
    );
  ELSIF field_type = 'user' THEN
    -- 用户字段：显示用户名，值为用户ID
    sql_query := format('
      SELECT DISTINCT
        CASE 
          WHEN %I IS NULL OR %I = 0 THEN ''未分配''
          ELSE COALESCE(%I::TEXT, %I::TEXT)
        END as text,
        CASE 
          WHEN %I IS NULL OR %I = 0 THEN NULL
          ELSE %I::TEXT
        END as value,
        CASE 
          WHEN %I IS NULL OR %I = 0 THEN NULL
          ELSE %I::TEXT
        END as search_text
      FROM followups
      WHERE 1=1
      ORDER BY 
        CASE WHEN %I IS NULL OR %I = 0 THEN 1 ELSE 0 END,
        COALESCE(%I::TEXT, '''')
    ', 
      field_name, field_name, display_name, field_name,
      field_name, field_name, field_name,
      field_name, field_name, field_name,
      field_name, field_name, field_name
    );
  ELSE
    -- 普通字符串字段
    sql_query := format('
      SELECT DISTINCT
        CASE 
          WHEN %I IS NULL OR %I = '''' THEN ''为空''
          ELSE COALESCE(%I::TEXT, %I::TEXT)
        END as text,
        CASE 
          WHEN %I IS NULL OR %I = '''' THEN NULL
          ELSE %I::TEXT
        END as value,
        CASE 
          WHEN %I IS NULL OR %I = '''' THEN NULL
          ELSE %I::TEXT
        END as search_text
      FROM followups
      WHERE 1=1
      ORDER BY 
        CASE WHEN %I IS NULL OR %I = '''' THEN 1 ELSE 0 END,
        COALESCE(%I::TEXT, '''')
    ', 
      field_name, field_name, display_name, field_name,
      field_name, field_name, field_name,
      field_name, field_name, field_name,
      field_name, field_name, field_name
    );
  END IF;
  
  -- 执行查询
  RETURN QUERY EXECUTE sql_query;
  
EXCEPTION
  WHEN OTHERS THEN
    RAISE EXCEPTION '获取筛选选项失败: %', SQLERRM;
END;
$$; 