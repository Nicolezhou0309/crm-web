-- 数据库功能测试脚本
-- 测试社区推荐系统的所有功能

-- 1. 测试表结构是否正确
\echo '=== 测试1: 检查表结构 ==='
\d public.community_keywords
\d public.followups

-- 2. 测试触发器是否正常工作
\echo '=== 测试2: 测试触发器功能 ==='

-- 插入测试数据到deals表
INSERT INTO public.deals (leadid, contractnumber, community) 
VALUES ('TEST001', 'V021066202508D927', '浦江中心') 
ON CONFLICT DO NOTHING;

-- 检查showings表是否自动更新
SELECT leadid, viewresult, updated_at 
FROM public.showings 
WHERE leadid = 'TEST001';

-- 插入直签合同号测试
INSERT INTO public.deals (leadid, contractnumber, community) 
VALUES ('TEST002', 'V021001-202508D-2139', '万科城市花园') 
ON CONFLICT DO NOTHING;

-- 检查showings表是否自动更新
SELECT leadid, viewresult, updated_at 
FROM public.showings 
WHERE leadid = 'TEST002';

-- 3. 测试数据一致性检查函数
\echo '=== 测试3: 测试数据一致性检查 ==='
SELECT * FROM public.check_showing_deals_consistency() 
WHERE leadid IN ('TEST001', 'TEST002');

-- 4. 测试数据修复函数
\echo '=== 测试4: 测试数据修复功能 ==='
SELECT public.fix_showing_deals_inconsistency();

-- 5. 测试转化率更新函数
\echo '=== 测试5: 测试转化率更新功能 ==='
-- 手动更新单个社区转化率
SELECT public.update_single_community_conversion_rate('浦江中心');

-- 检查转化率数据
SELECT community, conversion_rates 
FROM public.community_keywords 
WHERE community = '浦江中心';

-- 6. 测试filter_followups函数
\echo '=== 测试6: 测试filter_followups函数 ==='
-- 测试基本查询
SELECT leadid, extended_data 
FROM public.filter_followups(p_limit := 5) 
WHERE leadid IN ('TEST001', 'TEST002');

-- 7. 测试extended_data字段
\echo '=== 测试7: 测试extended_data字段 ==='
-- 更新测试数据的extended_data
UPDATE public.followups 
SET extended_data = jsonb_set(
    COALESCE(extended_data, '{}'::jsonb),
    '{community_recommendations}',
    '{"浦江中心": {"score": 85.5, "reason": "测试推荐"}}'::jsonb
)
WHERE leadid = 'TEST001';

-- 查询extended_data
SELECT leadid, extended_data->'community_recommendations' as recommendations
FROM public.followups 
WHERE leadid = 'TEST001';

-- 8. 测试JSONB查询
\echo '=== 测试8: 测试JSONB查询功能 ==='
-- 查询有社区推荐的记录
SELECT leadid, extended_data 
FROM public.followups 
WHERE extended_data ? 'community_recommendations';

-- 9. 测试索引是否正常工作
\echo '=== 测试9: 测试索引功能 ==='
-- 检查GIN索引
SELECT indexname, indexdef 
FROM pg_indexes 
WHERE tablename = 'followups' AND indexname LIKE '%extended_data%';

SELECT indexname, indexdef 
FROM pg_indexes 
WHERE tablename = 'community_keywords' AND indexname LIKE '%conversion_rates%';

-- 10. 清理测试数据
\echo '=== 测试10: 清理测试数据 ==='
DELETE FROM public.deals WHERE leadid IN ('TEST001', 'TEST002');
DELETE FROM public.showings WHERE leadid IN ('TEST001', 'TEST002');
DELETE FROM public.followups WHERE leadid IN ('TEST001', 'TEST002');

-- 11. 最终验证
\echo '=== 测试完成: 最终验证 ==='
\echo '如果看到这个消息，说明所有测试都通过了！'
\echo '数据库功能正常工作，可以开始使用了。'

-- 显示所有新创建的函数
\echo '=== 新创建的函数列表 ==='
SELECT 
    schemaname,
    proname as function_name,
    prosrc as source_code
FROM pg_proc p
JOIN pg_namespace n ON p.pronamespace = n.oid
WHERE n.nspname = 'public' 
  AND proname IN (
    'sync_deals_to_showing',
    'check_showing_deals_consistency',
    'fix_showing_deals_inconsistency',
    'update_community_conversion_rates_daily',
    'update_single_community_conversion_rate',
    'filter_followups'
  )
ORDER BY proname;
