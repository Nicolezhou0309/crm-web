#!/bin/bash

# 修复兑换记录表缺少description列的问题
# 部署时间: 2025年1月

echo "🔧 开始修复兑换记录表..."

# 连接到Supabase并执行修复SQL
supabase db push --include-all

echo "✅ 修复完成！"

# 验证修复结果
echo "🔍 验证修复结果..."
supabase db diff --schema public 