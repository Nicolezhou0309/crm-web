-- =============================================
-- 测试联合分析函数功能
-- 测试时间: 2025年1月15日
-- 目的: 验证 filter_all_analysis_multi 函数的所有功能
-- =============================================

-- 1. 测试基本查询功能
SELECT '=== 测试1: 基本查询功能 ===' as test_name;
SELECT COUNT(*) as total_records FROM filter_all_analysis_multi();
SELECT COUNT(*) as valid_records FROM filter_all_analysis_multi() WHERE followup_id IS NOT NULL;

-- 2. 测试 leads 表筛选功能
SELECT '=== 测试2: leads 表筛选功能 ===' as test_name;
-- 测试手机号筛选
SELECT COUNT(*) as phone_filter_count FROM filter_all_analysis_multi(NULL, ARRAY['13800138001']);
-- 测试微信号筛选
SELECT COUNT(*) as wechat_filter_count FROM filter_all_analysis_multi(NULL, NULL, ARRAY['wx123456']);
-- 测试来源筛选
SELECT COUNT(*) as source_filter_count FROM filter_all_analysis_multi(NULL, NULL, NULL, ARRAY['抖音']);
-- 测试线索类型筛选
SELECT COUNT(*) as leadtype_filter_count FROM filter_all_analysis_multi(NULL, NULL, NULL, NULL, ARRAY['新客户']);
-- 测试线索状态筛选
SELECT COUNT(*) as leadstatus_filter_count FROM filter_all_analysis_multi(NULL, NULL, NULL, NULL, NULL, ARRAY['有效']);

-- 3. 测试 showings 表筛选功能
SELECT '=== 测试3: showings 表筛选功能 ===' as test_name;
-- 测试看房结果筛选
SELECT COUNT(*) as viewresult_filter_count FROM filter_all_analysis_multi(NULL, NULL, NULL, NULL, NULL, NULL, NULL, ARRAY['满意']);
-- 测试预算范围筛选
SELECT COUNT(*) as budget_range_count FROM filter_all_analysis_multi(NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 5000, 15000);
-- 测试预约时间范围筛选
SELECT COUNT(*) as scheduletime_range_count FROM filter_all_analysis_multi(
  NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL,
  '2024-01-01 09:00:00', '2024-12-31 18:00:00'
);

-- 4. 测试 deals 表筛选功能
SELECT '=== 测试4: deals 表筛选功能 ===' as test_name;
-- 测试签约日期范围筛选
SELECT COUNT(*) as contractdate_range_count FROM filter_all_analysis_multi(
  NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL,
  '2024-01-01', '2024-12-31'
);
-- 测试合同编号筛选
SELECT COUNT(*) as contractnumber_filter_count FROM filter_all_analysis_multi(
  NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL,
  ARRAY['CT001', 'CT002']
);
-- 测试房间号筛选
SELECT COUNT(*) as roomnumber_filter_count FROM filter_all_analysis_multi(
  NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL,
  ARRAY['A101', 'B202']
);
-- 测试成交社区筛选
SELECT COUNT(*) as deal_community_filter_count FROM filter_all_analysis_multi(
  NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL,
  ARRAY['浦江', '莘庄']
);

-- 5. 测试组合筛选功能
SELECT '=== 测试5: 组合筛选功能 ===' as test_name;
SELECT COUNT(*) as combined_filter_count FROM filter_all_analysis_multi(
  ARRAY['25J00001', '25J00002'],  -- 多个线索ID
  ARRAY['13800138001'],            -- 多个手机号
  ARRAY['wx123456'],               -- 多个微信号
  ARRAY['抖音', '小红书'],          -- 多个来源
  ARRAY['新客户'],                 -- 多个线索类型
  ARRAY['有效'],                   -- 多个线索状态
  ARRAY['浦江', '莘庄'],           -- 多个社区
  ARRAY['满意', '不满意'],         -- 多个看房结果
  ARRAY[1001, 1002],              -- 多个分配带看销售ID
  ARRAY[1003, 1004],              -- 多个实际带看销售ID
  5000,                           -- 预算最小值
  15000,                          -- 预算最大值
  '2024-01-01 09:00:00',         -- 预约开始时间
  '2024-12-31 18:00:00',         -- 预约结束时间
  '2024-01-01 10:00:00',         -- 到达开始时间
  '2024-12-31 19:00:00',         -- 到达结束时间
  '2024-01-01',                   -- 成交开始日期
  '2024-12-31',                   -- 成交结束日期
  ARRAY['CT001', 'CT002'],        -- 多个合同编号
  ARRAY['A101', 'B202'],          -- 多个房间号
  ARRAY['浦江', '莘庄']            -- 多个成交社区
);

-- 6. 测试数据完整性
SELECT '=== 测试6: 数据完整性 ===' as test_name;
-- 检查是否有无效记录
SELECT COUNT(*) as invalid_records FROM filter_all_analysis_multi() 
WHERE (followup_id IS NOT NULL AND invalid = true) 
   OR (showing_id IS NOT NULL AND invalid = true) 
   OR (deal_id IS NOT NULL AND invalid = true);

-- 检查字段映射完整性
SELECT 
  COUNT(*) as total_records,
  COUNT(followup_id) as followup_records,
  COUNT(leadid) as lead_records,
  COUNT(showing_id) as showing_records,
  COUNT(deal_id) as deal_records
FROM filter_all_analysis_multi();

-- 7. 测试透视表集成
SELECT '=== 测试7: 透视表集成 ===' as test_name;
-- 测试透视表函数是否能正确处理联合分析数据
SELECT execute_pivot_analysis(
  'joined_data',
  ARRAY['source'],
  ARRAY[],
  '[{"field": "leadid", "aggregation": "count"}]',
  '[]'
);

-- 8. 性能测试
SELECT '=== 测试8: 性能测试 ===' as test_name;
-- 测试查询性能
EXPLAIN (ANALYZE, BUFFERS) SELECT COUNT(*) FROM filter_all_analysis_multi();

-- 9. 字段验证
SELECT '=== 测试9: 字段验证 ===' as test_name;
-- 检查所有字段是否正确映射
SELECT 
  followup_id,
  leadid,
  followupstage,
  customerprofile,
  worklocation,
  userbudget,
  moveintime,
  userrating,
  majorcategory,
  followupresult,
  scheduledcommunity,
  interviewsales_user_id,
  interviewsales_user_name,
  followup_created_at,
  phone,
  wechat,
  qq,
  location,
  budget,
  remark,
  source,
  staffname,
  area,
  leadtype,
  leadstatus,
  lead_created_at,
  showing_id,
  showing_community,
  viewresult,
  arrivaltime,
  showingsales_user_name,
  trueshowingsales_nickname,
  showing_budget,
  showing_moveintime,
  showing_remark,
  renttime,
  showing_scheduletime,
  showing_created_at,
  deal_id,
  contractdate,
  deal_community,
  contractnumber,
  roomnumber,
  deal_created_at
FROM filter_all_analysis_multi() 
LIMIT 1;

SELECT '=== 所有测试完成 ===' as test_name; 