-- 检查followupstage枚举的实际值
SELECT 
  unnest(enum_range(NULL::followupstage)) as enum_value;

-- 或者使用这个查询来获取所有可能的followupstage值
SELECT DISTINCT followupstage 
FROM followups 
WHERE followupstage IS NOT NULL 
ORDER BY followupstage;

-- 检查是否有"确认需求"相关的值
SELECT DISTINCT followupstage 
FROM followups 
WHERE followupstage::text LIKE '%确认%' 
   OR followupstage::text LIKE '%需求%'
ORDER BY followupstage; 