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
    "majorcategory": {"field": "majorcategory", "display": "majorcategory", "type": "string"},
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
      ORDER BY text
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
      ORDER BY text
    ', 
      field_name, field_name, field_name, field_name, field_name, field_name,
      field_name, field_name, field_name,
      field_name, field_name, field_name,
      field_name, field_name, field_name
    );
  ELSIF field_type = 'user' THEN
    -- 用户字段：显示用户名，值为用户ID，需要关联users_profile表
    sql_query := format('
      SELECT DISTINCT
        CASE 
          WHEN f.%I IS NULL OR f.%I = 0 THEN ''未分配''
          ELSE COALESCE(up.%I, f.%I::TEXT)
        END as text,
        CASE 
          WHEN f.%I IS NULL OR f.%I = 0 THEN NULL
          ELSE f.%I::TEXT
        END as value,
        CASE 
          WHEN f.%I IS NULL OR f.%I = 0 THEN NULL
          ELSE COALESCE(up.%I, f.%I::TEXT)
        END as search_text
      FROM followups f
      LEFT JOIN users_profile up ON f.%I = up.id
      WHERE 1=1
      ORDER BY text
    ', 
      field_name, field_name, display_name, field_name,
      field_name, field_name, field_name,
      field_name, field_name, display_name, field_name,
      field_name, field_name, field_name,
      display_name, field_name, field_name
    );
  ELSIF p_field_name = 'majorcategory' THEN
    -- 跟进结果字段：返回一级选项
    sql_query := '
      SELECT DISTINCT
        CASE 
          WHEN f.majorcategory IS NULL OR f.majorcategory = '''' THEN ''为空''
          ELSE 
            CASE 
              WHEN f.majorcategory IN (''已预约'') THEN ''已预约''
              WHEN f.majorcategory IN (''房子未到期，提前了解'', ''多房源对比'', ''未到上海'', ''工作地点不确定'', ''价格原因'', ''位置原因'', ''户型原因'', ''短租'', ''其他'') THEN ''观望中''
              WHEN f.majorcategory IN (''房间太贵'', ''面积太小'', ''通勤太远'', ''房间无厨房'', ''到地铁站太远'', ''重客已签约'', ''其他'') THEN ''已流失''
              WHEN f.majorcategory IN (''电话空号'', ''微信号搜索不到'', ''好友申请不通过'', ''消息未回复'', ''电话不接'') THEN ''未触达''
              ELSE f.majorcategory
            END
        END as text,
        CASE 
          WHEN f.majorcategory IS NULL OR f.majorcategory = '''' THEN NULL
          ELSE 
            CASE 
              WHEN f.majorcategory IN (''已预约'') THEN ''已预约''
              WHEN f.majorcategory IN (''房子未到期，提前了解'', ''多房源对比'', ''未到上海'', ''工作地点不确定'', ''价格原因'', ''位置原因'', ''户型原因'', ''短租'', ''其他'') THEN ''观望中''
              WHEN f.majorcategory IN (''房间太贵'', ''面积太小'', ''通勤太远'', ''房间无厨房'', ''到地铁站太远'', ''重客已签约'', ''其他'') THEN ''已流失''
              WHEN f.majorcategory IN (''电话空号'', ''微信号搜索不到'', ''好友申请不通过'', ''消息未回复'', ''电话不接'') THEN ''未触达''
              ELSE f.majorcategory
            END
        END as value,
        CASE 
          WHEN f.majorcategory IS NULL OR f.majorcategory = '''' THEN NULL
          ELSE 
            CASE 
              WHEN f.majorcategory IN (''已预约'') THEN ''已预约''
              WHEN f.majorcategory IN (''房子未到期，提前了解'', ''多房源对比'', ''未到上海'', ''工作地点不确定'', ''价格原因'', ''位置原因'', ''户型原因'', ''短租'', ''其他'') THEN ''观望中''
              WHEN f.majorcategory IN (''房间太贵'', ''面积太小'', ''通勤太远'', ''房间无厨房'', ''到地铁站太远'', ''重客已签约'', ''其他'') THEN ''已流失''
              WHEN f.majorcategory IN (''电话空号'', ''微信号搜索不到'', ''好友申请不通过'', ''消息未回复'', ''电话不接'') THEN ''未触达''
              ELSE f.majorcategory
            END
        END as search_text
      FROM followups f
      WHERE 1=1
      ORDER BY text
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
      ORDER BY text
    ', 
      field_name, field_name, field_name, field_name,
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