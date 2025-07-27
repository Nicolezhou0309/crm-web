-- 检查成交记录数量
SELECT 
  '总成交记录数' as description,
  COUNT(*) as count
FROM deals 
WHERE invalid IS NULL OR invalid = false

UNION ALL

-- 检查每个leadid的成交记录数
SELECT 
  '有成交记录的线索数' as description,
  COUNT(DISTINCT leadid) as count
FROM deals 
WHERE invalid IS NULL OR invalid = false

UNION ALL

-- 检查成交记录的社区分布
SELECT 
  '成交记录社区分布' as description,
  COUNT(*) as count
FROM deals 
WHERE invalid IS NULL OR invalid = false
GROUP BY community
ORDER BY count DESC;

-- 检查具体的成交记录
SELECT 
  leadid,
  community as deal_community,
  contractdate,
  contractnumber,
  roomnumber,
  created_at
FROM deals 
WHERE invalid IS NULL OR invalid = false
ORDER BY created_at DESC
LIMIT 20; 