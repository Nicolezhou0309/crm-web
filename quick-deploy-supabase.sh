#!/bin/bash

echo "🚀 快速部署到Supabase..."

# 项目信息
PROJECT_REF="wteqgprgiylmxzszcnws"
SUPABASE_URL="https://wteqgprgiylmxzszcnws.supabase.co"

echo "📋 项目信息："
echo "  - 项目引用: $PROJECT_REF"
echo "  - Supabase URL: $SUPABASE_URL"

# 构建项目
echo "📦 构建项目..."
npm run build

if [ $? -eq 0 ]; then
    echo "✅ 构建成功"
else
    echo "❌ 构建失败"
    exit 1
fi

# 检查Supabase CLI
if ! command -v supabase &> /dev/null; then
    echo "❌ Supabase CLI未安装"
    echo "请运行: curl -fsSL https://supabase.com/install.sh | sh"
    exit 1
fi

# 登录检查
echo "🔐 检查Supabase登录状态..."
supabase status > /dev/null 2>&1
if [ $? -ne 0 ]; then
    echo "❌ 请先登录Supabase:"
    echo "supabase login"
    exit 1
fi

# 链接项目
echo "🔗 链接到Supabase项目..."
supabase link --project-ref $PROJECT_REF

# 部署Edge Functions
echo "🚀 部署Edge Functions..."

echo "  - 部署 invite-user..."
supabase functions deploy invite-user

echo "  - 部署 check-department-admin..."
supabase functions deploy check-department-admin

echo "  - 部署 email-management..."
supabase functions deploy email-management

echo "  - 部署 manage-department-admins..."
supabase functions deploy manage-department-admins

echo "  - 部署 role-permission-management..."
supabase functions deploy role-permission-management

echo ""
echo "🎉 部署完成！"
echo ""
echo "📋 下一步："
echo "1. 在Supabase控制台中配置重定向URL"
echo "2. 测试邀请功能"
echo "3. 验证邮件重定向"
echo ""
echo "🔗 有用的链接："
echo "- Supabase控制台: https://supabase.com/dashboard/project/$PROJECT_REF"
echo "- Edge Functions: https://supabase.com/dashboard/project/$PROJECT_REF/functions"
echo "- 数据库: https://supabase.com/dashboard/project/$PROJECT_REF/editor"
echo "- 认证设置: https://supabase.com/dashboard/project/$PROJECT_REF/auth/url-configuration"
echo ""
echo "📧 重定向URL已设置为: https://$PROJECT_REF.supabase.co/set-password"
echo ""
echo "💡 提示："
echo "- 如果使用自定义域名，请更新Edge Function中的重定向URL"
echo "- 确保在Supabase控制台中添加了正确的重定向URL"
echo "- 测试邀请功能以确保邮件链接正常工作" 