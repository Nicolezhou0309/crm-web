-- 创建获取枚举值的通用函数

CREATE OR REPLACE FUNCTION public.get_enum_values(enum_name text)
RETURNS text[]
LANGUAGE plpgsql
AS $function$
DECLARE
  values text[];
BEGIN
  EXECUTE format(
    'SELECT array_agg(enumlabel ORDER BY enumsortorder) FROM pg_enum WHERE enumtypid = %L::regtype',
    enum_name
  ) INTO values;
  
  RETURN values;
END;
$function$; 