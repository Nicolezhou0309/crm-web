-- =============================================
-- 检查枚举值是否正确
-- 创建时间: 2025年1月15日
-- =============================================

-- 1. 检查所有枚举类型
SELECT 
  t.typname as enum_name,
  e.enumlabel as enum_value,
  e.enumsortorder as sort_order
FROM pg_type t 
JOIN pg_enum e ON t.oid = e.enumtypid  
ORDER BY t.typname, e.enumsortorder;

-- 2. 检查特定枚举类型
-- source 枚举
SELECT 'source' as enum_type, unnest(enum_range(NULL::source)) as enum_values;

-- userrating 枚举  
SELECT 'userrating' as enum_type, unnest(enum_range(NULL::userrating)) as enum_values;

-- community 枚举
SELECT 'community' as enum_type, unnest(enum_range(NULL::community)) as enum_values;

-- customerprofile 枚举
SELECT 'customerprofile' as enum_type, unnest(enum_range(NULL::customerprofile)) as enum_values;

-- followupstage 枚举
SELECT 'followupstage' as enum_type, unnest(enum_range(NULL::followupstage)) as enum_values;

-- 3. 检查表中实际使用的枚举值
-- leads表中的source字段
SELECT DISTINCT source, COUNT(*) as count
FROM leads 
WHERE source IS NOT NULL
GROUP BY source
ORDER BY source;

-- followups表中的枚举字段
SELECT DISTINCT followupstage, COUNT(*) as count
FROM followups 
WHERE followupstage IS NOT NULL
GROUP BY followupstage
ORDER BY followupstage;

SELECT DISTINCT customerprofile, COUNT(*) as count
FROM followups 
WHERE customerprofile IS NOT NULL
GROUP BY customerprofile
ORDER BY customerprofile;

SELECT DISTINCT userrating, COUNT(*) as count
FROM followups 
WHERE userrating IS NOT NULL
GROUP BY userrating
ORDER BY userrating;

SELECT DISTINCT scheduledcommunity, COUNT(*) as count
FROM followups 
WHERE scheduledcommunity IS NOT NULL
GROUP BY scheduledcommunity
ORDER BY scheduledcommunity;

-- showings表中的community字段
SELECT DISTINCT community, COUNT(*) as count
FROM showings 
WHERE community IS NOT NULL
GROUP BY community
ORDER BY community;

-- deals表中的community字段
SELECT DISTINCT community, COUNT(*) as count
FROM deals 
WHERE community IS NOT NULL
GROUP BY community
ORDER BY community;

-- 4. 检查是否有数据与枚举定义不匹配
-- 检查leads表中是否有不在source枚举中的值
SELECT DISTINCT source
FROM leads 
WHERE source IS NOT NULL 
  AND source::text NOT IN (SELECT unnest(enum_range(NULL::source)));

-- 检查followups表中是否有不在followupstage枚举中的值
SELECT DISTINCT followupstage
FROM followups 
WHERE followupstage IS NOT NULL 
  AND followupstage::text NOT IN (SELECT unnest(enum_range(NULL::followupstage)));

-- 检查followups表中是否有不在customerprofile枚举中的值
SELECT DISTINCT customerprofile
FROM followups 
WHERE customerprofile IS NOT NULL 
  AND customerprofile::text NOT IN (SELECT unnest(enum_range(NULL::customerprofile)));

-- 检查followups表中是否有不在userrating枚举中的值
SELECT DISTINCT userrating
FROM followups 
WHERE userrating IS NOT NULL 
  AND userrating::text NOT IN (SELECT unnest(enum_range(NULL::userrating)));

-- 检查followups表中是否有不在scheduledcommunity枚举中的值
SELECT DISTINCT scheduledcommunity
FROM followups 
WHERE scheduledcommunity IS NOT NULL 
  AND scheduledcommunity::text NOT IN (SELECT unnest(enum_range(NULL::community)));

-- 检查showings表中是否有不在community枚举中的值
SELECT DISTINCT community
FROM showings 
WHERE community IS NOT NULL 
  AND community::text NOT IN (SELECT unnest(enum_range(NULL::community)));

-- 检查deals表中是否有不在community枚举中的值
SELECT DISTINCT community
FROM deals 
WHERE community IS NOT NULL 
  AND community::text NOT IN (SELECT unnest(enum_range(NULL::community))); 