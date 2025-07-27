-- 检查数据库中的实际数据
-- 1. 检查 filter_followups() 函数返回的数据
SELECT DISTINCT source FROM filter_followups() ORDER BY source;

-- 2. 检查 leads 表中的渠道数据
SELECT DISTINCT source FROM leads ORDER BY source;

-- 3. 检查是否有"抖音"相关的数据（修复类型问题）
SELECT source, COUNT(*) as count 
FROM filter_followups() 
WHERE CAST(source AS text) LIKE '%抖音%' 
GROUP BY source;

-- 4. 检查筛选条件是否正确应用
SELECT source, COUNT(leadid) as leadid_count 
FROM filter_followups() 
WHERE CAST(source AS text) = '抖音' 
GROUP BY source;

-- 5. 检查所有可能的渠道值
SELECT source, COUNT(*) as count 
FROM filter_followups() 
GROUP BY source 
ORDER BY count DESC;

-- 6. 检查 source 字段的数据类型
SELECT column_name, data_type, is_nullable
FROM information_schema.columns 
WHERE table_name = 'leads' AND column_name = 'source';

-- 7. 检查 filter_followups 函数返回的数据类型
SELECT source, pg_typeof(source) as source_type
FROM filter_followups() 
LIMIT 5; 