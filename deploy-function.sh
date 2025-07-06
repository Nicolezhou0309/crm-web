#!/bin/bash

echo "准备部署 email-management Edge Function..."

# 检查是否已登录
echo "检查Supabase登录状态..."
if ! npx supabase projects list >/dev/null 2>&1; then
    echo "需要先登录Supabase"
    echo "请运行: npx supabase login"
    exit 1
fi

# 部署函数
echo "开始部署 email-management 函数..."
npx supabase functions deploy email-management --project-ref wteqgprgiylmxzszcnws

if [ $? -eq 0 ]; then
    echo "✅ Edge Function 部署成功!"
    echo "🔗 函数URL: https://wteqgprgiylmxzszcnws.supabase.co/functions/v1/email-management"
else
    echo "❌ 部署失败，请检查错误信息"
    exit 1
fi 