-- 部署地铁站数据获取函数
-- 用于工作地点多级选择功能

-- 获取地铁站数据函数
CREATE OR REPLACE FUNCTION public.get_metrostations()
RETURNS TABLE(
  line text,
  name text
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    ms.line,
    ms.name
  FROM public.metrostations ms
  ORDER BY 
    -- 按线路名称的自然排序，确保1号线、2号线、3号线等按顺序
    CASE 
      WHEN ms.line ~ '^[0-9]+号线$' THEN 
        -- 提取数字部分进行排序
        (regexp_replace(ms.line, '[^0-9]', '', 'g'))::integer
      ELSE 
        -- 非数字线路排在后面
        999999
    END,
    ms.line,
    ms.name;
END;
$$; 