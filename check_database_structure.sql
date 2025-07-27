-- 检查数据库表结构和 filter_followups 函数
-- 1. 检查各个表的 community 字段

-- 检查 leads 表的 community 字段
SELECT 
  column_name,
  data_type,
  is_nullable
FROM information_schema.columns 
WHERE table_name = 'leads' 
  AND column_name LIKE '%community%';

-- 检查 followups 表的 community 字段
SELECT 
  column_name,
  data_type,
  is_nullable
FROM information_schema.columns 
WHERE table_name = 'followups' 
  AND column_name LIKE '%community%';

-- 检查 showings 表的 community 字段
SELECT 
  column_name,
  data_type,
  is_nullable
FROM information_schema.columns 
WHERE table_name = 'showings' 
  AND column_name LIKE '%community%';

-- 检查 deals 表的 community 字段
SELECT 
  column_name,
  data_type,
  is_nullable
FROM information_schema.columns 
WHERE table_name = 'deals' 
  AND column_name LIKE '%community%';

-- 2. 检查 filter_followups 函数的定义
SELECT 
  routine_name,
  routine_definition
FROM information_schema.routines 
WHERE routine_name = 'filter_followups';

-- 3. 检查 filter_followups 函数返回的字段
SELECT * FROM filter_followups() LIMIT 1;

-- 4. 检查 filter_followups 函数返回的所有字段名
SELECT 
  column_name,
  data_type
FROM information_schema.columns 
WHERE table_name = 'filter_followups' 
ORDER BY ordinal_position;

-- 5. 检查是否有 community 相关字段
SELECT 
  column_name 
FROM information_schema.columns 
WHERE table_name = 'filter_followups' 
  AND column_name LIKE '%community%';

-- 6. 检查 showings 表的所有字段
SELECT 
  column_name,
  data_type
FROM information_schema.columns 
WHERE table_name = 'showings' 
ORDER BY ordinal_position; 