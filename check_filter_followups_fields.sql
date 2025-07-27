-- 检查 filter_followups() 函数返回的字段
SELECT 
  column_name,
  data_type,
  is_nullable
FROM information_schema.columns 
WHERE table_name = 'filter_followups' 
ORDER BY ordinal_position;

-- 或者直接查询函数返回的数据结构
SELECT * FROM filter_followups() LIMIT 1;

-- 检查是否有 community 相关字段
SELECT 
  column_name 
FROM information_schema.columns 
WHERE table_name = 'filter_followups' 
  AND column_name LIKE '%community%';

-- 检查 showings 表的字段
SELECT 
  column_name,
  data_type
FROM information_schema.columns 
WHERE table_name = 'showings' 
  AND column_name LIKE '%community%'; 