-- 部署最终简化版本的 get_filter_options 函数
-- 完全避免复杂的 format 参数

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
    "interviewsales_user_id": {"field": "interviewsales_user_id", "display": "nickname", "type": "user"},
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
          WHEN l.%I IS NULL OR l.%I = '''' THEN ''为空''
          ELSE 
            CASE 
              WHEN LENGTH(l.%I) = 11 THEN 
                LEFT(l.%I, 3) || ''****'' || RIGHT(l.%I, 4)
              ELSE l.%I
            END
        END as text,
        CASE 
          WHEN l.%I IS NULL OR l.%I = '''' THEN NULL
          ELSE l.%I::TEXT
        END as value,
        CASE 
          WHEN l.%I IS NULL OR l.%I = '''' THEN NULL
          ELSE l.%I::TEXT
        END as search_text
      FROM followups f
      LEFT JOIN leads l ON f.leadid = l.leadid
      WHERE 1=1
      ORDER BY 
        CASE WHEN l.%I IS NULL OR l.%I = '''' THEN 1 ELSE 0 END,
        COALESCE(l.%I::TEXT, '''')
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
          WHEN l.%I IS NULL OR l.%I = '''' THEN ''为空''
          ELSE 
            CASE 
              WHEN LENGTH(l.%I) > 3 THEN 
                LEFT(l.%I, 2) || ''***'' || RIGHT(l.%I, 2)
              ELSE l.%I
            END
        END as text,
        CASE 
          WHEN l.%I IS NULL OR l.%I = '''' THEN NULL
          ELSE l.%I::TEXT
        END as value,
        CASE 
          WHEN l.%I IS NULL OR l.%I = '''' THEN NULL
          ELSE l.%I::TEXT
        END as search_text
      FROM followups f
      LEFT JOIN leads l ON f.leadid = l.leadid
      WHERE 1=1
      ORDER BY 
        CASE WHEN l.%I IS NULL OR l.%I = '''' THEN 1 ELSE 0 END,
        COALESCE(l.%I::TEXT, '''')
    ', 
      field_name, field_name, field_name, field_name, field_name, field_name,
      field_name, field_name, field_name,
      field_name, field_name, field_name,
      field_name, field_name, field_name
    );
  ELSIF field_type = 'user' THEN
    -- 用户字段：显示用户名，值为用户ID，需要关联users_profile表
    -- 使用硬编码的字段名避免复杂的format参数
    sql_query := '
      SELECT DISTINCT
        CASE 
          WHEN f.interviewsales_user_id IS NULL OR f.interviewsales_user_id = 0 THEN ''未分配''
          ELSE COALESCE(up.nickname, f.interviewsales_user_id::TEXT)
        END as text,
        CASE 
          WHEN f.interviewsales_user_id IS NULL OR f.interviewsales_user_id = 0 THEN NULL
          ELSE f.interviewsales_user_id::TEXT
        END as value,
        CASE 
          WHEN f.interviewsales_user_id IS NULL OR f.interviewsales_user_id = 0 THEN NULL
          ELSE COALESCE(up.nickname, f.interviewsales_user_id::TEXT)
        END as search_text
      FROM followups f
      LEFT JOIN users_profile up ON f.interviewsales_user_id = up.id
      WHERE 1=1
      ORDER BY 
        CASE WHEN f.interviewsales_user_id IS NULL OR f.interviewsales_user_id = 0 THEN 1 ELSE 0 END,
        f.interviewsales_user_id
    ';
  ELSE
    -- 普通字符串字段
    sql_query := format('
      SELECT DISTINCT
        CASE 
          WHEN f.%I IS NULL OR f.%I = '''' THEN ''为空''
          ELSE COALESCE(f.%I::TEXT, f.%I::TEXT)
        END as text,
        CASE 
          WHEN f.%I IS NULL OR f.%I = '''' THEN NULL
          ELSE f.%I::TEXT
        END as value,
        CASE 
          WHEN f.%I IS NULL OR f.%I = '''' THEN NULL
          ELSE f.%I::TEXT
        END as search_text
      FROM followups f
      WHERE 1=1
      ORDER BY 
        CASE WHEN f.%I IS NULL OR f.%I = '''' THEN 1 ELSE 0 END,
        COALESCE(f.%I::TEXT, '''')
    ', 
      field_name, field_name, field_name, field_name,
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