#!/bin/bash

echo "🚀 开始部署增强版透视表功能..."

# 1. 部署修正的filter_all_analysis_multi函数
echo "📝 部署修正的filter_all_analysis_multi函数..."
supabase db remote sql < sql-scripts/setup/filter_all_analysis_multi_backup.sql

# 2. 部署增强版透视表函数
echo "📊 部署增强版透视表分析函数..."
supabase db push --include-all

echo "✅ 部署完成！"

echo ""
echo "🧪 测试增强版透视表功能..."
echo "测试1: 多值处理（每个来源单独显示）"
supabase db remote psql -c "
SELECT execute_enhanced_pivot_analysis(
  'joined_data',
  ARRAY['source'],
  NULL,
  '[{\"field\": \"leadid\", \"aggregation\": \"count\", \"alias\": \"lead_count\"}]'::jsonb,
  '[{\"field\": \"source\", \"operator\": \"in\", \"value\": [\"抖音\", \"微信\", \"小红书\"]}]'::jsonb
);
"

echo ""
echo "测试2: 父子关系（按时间维度）"
supabase db remote psql -c "
SELECT execute_enhanced_pivot_analysis(
  'joined_data',
  ARRAY['EXTRACT(YEAR FROM lead_created_at)', 'EXTRACT(MONTH FROM lead_created_at)'],
  ARRAY['source'],
  '[{\"field\": \"leadid\", \"aggregation\": \"count\", \"alias\": \"lead_count\"}]'::jsonb,
  NULL,
  true,  -- 显示总计
  true   -- 显示小计
);
"

echo ""
echo "🎉 测试完成！增强版透视表功能已部署。"
echo ""
echo "📋 功能特性："
echo "✅ 多值处理：每个筛选值单独显示在表格中"
echo "✅ 父子关系：支持多行/多列的层级结构"
echo "✅ 小计总计：类似Excel透视表的汇总功能"
echo "✅ 时间格式化：所有日期时间字段已调整为北京时间date格式" 