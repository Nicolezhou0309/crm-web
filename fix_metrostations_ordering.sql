-- 修复地铁站排序问题，确保站点按照地理顺序排列
-- 执行此脚本后，工作地点级联选择器中的站点将保持原有顺序

-- 删除旧的函数
DROP FUNCTION IF EXISTS public.get_metrostations();

-- 重新创建函数，确保站点按照地理顺序排列
CREATE OR REPLACE FUNCTION public.get_metrostations()
RETURNS TABLE("line" text, "name" text)
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
    -- 保持站点在数据库中的原有顺序（地理顺序），不按字母排序
    ms.id;
END;
$$;

-- 设置函数所有者
ALTER FUNCTION public.get_metrostations() OWNER TO postgres;

-- 授予权限
GRANT EXECUTE ON FUNCTION public.get_metrostations() TO anon;
GRANT EXECUTE ON FUNCTION public.get_metrostations() TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_metrostations() TO service_role;

-- 验证函数是否正常工作
SELECT * FROM public.get_metrostations() LIMIT 10;

-- 显示更新后的排序结果
SELECT 
  line,
  string_agg(name, ' -> ' ORDER BY id) as station_sequence
FROM public.metrostations 
GROUP BY line 
ORDER BY 
  CASE 
    WHEN line ~ '^[0-9]+号线$' THEN 
      (regexp_replace(line, '[^0-9]', '', 'g'))::integer
    ELSE 
      999999
  END,
  line;
