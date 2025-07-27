-- 简单测试透视表函数
SELECT execute_pivot_analysis('joined_data', ARRAY['source'], ARRAY['lead_created_at'], '[{"field": "leadid", "aggregation": "count"}]'::jsonb, '[]'::jsonb); 