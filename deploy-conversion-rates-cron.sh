#!/bin/bash

# 社区转化率更新定时任务部署脚本
# 基于到店转化率（showings表viewresult字段）

set -e

echo "🚀 开始部署社区转化率更新定时任务..."

# 检查Supabase CLI是否安装
if ! command -v supabase &> /dev/null; then
    echo "❌ Supabase CLI未安装，请先安装：https://supabase.com/docs/reference/cli"
    exit 1
fi

# 检查是否在Supabase项目目录中
if [ ! -f "supabase/config.toml" ]; then
    echo "❌ 请在Supabase项目根目录中运行此脚本"
    exit 1
fi

echo "📁 部署Edge Function: update-conversion-rates"
supabase functions deploy update-conversion-rates

echo "✅ Edge Function部署完成"

echo ""
echo "📋 部署完成！接下来需要手动设置定时任务："
echo ""
echo "方法1: 使用Supabase Dashboard"
echo "1. 登录Supabase Dashboard"
echo "2. 进入你的项目"
echo "3. 在Database > Functions中找到 update_community_conversion_rates_daily"
echo "4. 设置定时任务（每天凌晨2点执行）"
echo ""
echo "方法2: 使用pg_cron扩展（需要数据库权限）"
echo "1. 在数据库中执行："
echo "   CREATE EXTENSION IF NOT EXISTS pg_cron;"
echo "2. 设置定时任务："
echo "   SELECT cron.schedule('update-community-conversion-rates', '0 2 * * *', 'SELECT public.update_community_conversion_rates_daily();');"
echo ""
echo "方法3: 手动触发测试"
echo "1. 调用Edge Function:"
echo "   curl -X POST https://your-project.supabase.co/functions/v1/update-conversion-rates"
echo "2. 或在数据库中直接执行："
echo "   SELECT public.update_community_conversion_rates_daily();"
echo ""
echo "🎯 转化率统计逻辑："
echo "- 基于showings表的viewresult字段"
echo "- 统计近30天的到店数据"
echo "- 转化率 = (直签 + 预定) / 总到店数"
echo "- 按客户画像分别统计"
echo "- 自动过滤无效记录（invalid = false）"
echo ""
echo "📊 数据格式示例："
echo '{
  "新来沪应届生": 75.5,
  "新来沪应届生_total_showings": 45,
  "新来沪应届生_converted_showings": 34,
  "新来沪应届生_last_updated": "2024-12-01T00:00:00Z"
}'
