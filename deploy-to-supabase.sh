#!/bin/bash

# Supabase部署脚本
echo "🚀 开始部署到Supabase..."

# 检查是否已安装supabase CLI
if ! command -v supabase &> /dev/null; then
    echo "❌ Supabase CLI未安装"
    echo "请先安装Supabase CLI:"
    echo "curl -fsSL https://supabase.com/install.sh | sh"
    exit 1
fi

# 构建项目
echo "📦 构建项目..."
npm run build

# 检查构建是否成功
if [ ! -d "dist" ]; then
    echo "❌ 构建失败，dist目录不存在"
    exit 1
fi

echo "✅ 构建成功"

# 检查是否已登录Supabase
echo "🔐 检查Supabase登录状态..."
supabase status

if [ $? -ne 0 ]; then
    echo "❌ 请先登录Supabase:"
    echo "supabase login"
    exit 1
fi

# 链接到Supabase项目（如果还没有链接）
echo "🔗 链接到Supabase项目..."
supabase link --project-ref $(grep -o 'wteqgprgiylmxzszcnws' .env.local 2>/dev/null || echo "YOUR_PROJECT_REF")

# 部署Edge Functions
echo "🚀 部署Edge Functions..."
supabase functions deploy invite-user
supabase functions deploy check-department-admin
supabase functions deploy email-management
supabase functions deploy manage-department-admins
supabase functions deploy role-permission-management

# 获取项目URL
PROJECT_REF=$(supabase projects list --json | jq -r '.[0].id' 2>/dev/null)
if [ -z "$PROJECT_REF" ]; then
    echo "⚠️  无法获取项目引用，请手动设置"
    PROJECT_REF="YOUR_PROJECT_REF"
fi

# 创建部署配置
echo "📝 创建部署配置..."
cat > supabase/deploy.toml << EOF
[build]
command = "npm run build"
output = "dist"

[deploy]
project_id = "$PROJECT_REF"
EOF

echo "✅ 部署配置已创建"

# 显示部署信息
echo ""
echo "🎉 部署完成！"
echo ""
echo "📋 下一步："
echo "1. 在Supabase控制台中设置环境变量"
echo "2. 配置重定向URL为您的生产域名"
echo "3. 测试邀请功能"
echo ""
echo "🔗 有用的链接："
echo "- Supabase控制台: https://supabase.com/dashboard/project/$PROJECT_REF"
echo "- Edge Functions: https://supabase.com/dashboard/project/$PROJECT_REF/functions"
echo "- 数据库: https://supabase.com/dashboard/project/$PROJECT_REF/editor"
echo ""
echo "📧 记得更新Edge Function中的重定向URL为您的生产域名！" 