-- 测试透视表函数
-- 测试筛选条件是否正确应用

-- 1. 测试无筛选条件
SELECT execute_pivot_analysis(
  'filter_followups',
  ARRAY['source'],
  ARRAY[],
  '[{"field": "leadid", "aggregation": "count"}]',
  '[]'
);

-- 2. 测试有筛选条件
SELECT execute_pivot_analysis(
  'filter_followups',
  ARRAY['source'],
  ARRAY[],
  '[{"field": "leadid", "aggregation": "count"}]',
  '[{"field": "source", "operator": "equals", "value": "抖音"}]'
);

-- 3. 测试空结果的情况
SELECT execute_pivot_analysis(
  'filter_followups',
  ARRAY['source'],
  ARRAY[],
  '[{"field": "leadid", "aggregation": "count"}]',
  '[{"field": "source", "operator": "equals", "value": "不存在的值"}]'
);

-- 4. 检查数据库中的实际数据
SELECT DISTINCT source FROM filter_followups() ORDER BY source;

-- 5. 检查抖音数据是否存在
SELECT COUNT(*) as 抖音数据数量 FROM filter_followups() WHERE source::text = '抖音'; 