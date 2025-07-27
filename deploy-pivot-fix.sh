#!/bin/bash

# =============================================
# 部署透视表函数修复
# 修复时间: 2025年1月15日
# 目的: 应用透视表函数的字段验证修复
# =============================================

echo "=== 开始部署透视表函数修复 ==="

# 检查文件是否存在
if [ ! -f "supabase/migrations/20250115000016_fix_pivot_field_validation.sql" ]; then
    echo "错误: 迁移文件不存在"
    exit 1
fi

echo "1. 应用透视表函数修复..."
supabase db push

echo "2. 验证函数是否创建成功..."
supabase db remote sql "SELECT routine_name FROM information_schema.routines WHERE routine_name = 'execute_pivot_analysis';"

echo "3. 测试透视表函数基本功能..."
supabase db remote sql "
SELECT 
  jsonb_typeof(
    execute_pivot_analysis(
      'joined_data',
      ARRAY['source'],
      ARRAY[],
      '[{\"field\": \"leadid\", \"aggregation\": \"count\"}]'::jsonb,
      '[]'::jsonb
    )
  ) as result_type;
"

echo "4. 检查联合分析函数字段..."
supabase db remote sql "
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'filter_all_analysis_multi' 
ORDER BY ordinal_position;
"

echo "5. 测试联合分析函数..."
supabase db remote sql "
SELECT leadid, source, lead_created_at 
FROM filter_all_analysis_multi() 
LIMIT 3;
"

echo "=== 部署完成 ==="
echo "现在可以测试前端透视表功能了" 