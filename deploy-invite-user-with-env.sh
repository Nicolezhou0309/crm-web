#!/bin/bash

# 设置前端URL环境变量并部署invite-user函数

# 默认前端URL（可以通过参数传入）
FRONTEND_URL=${1:-"https://crm-web-two.vercel.app"}

echo "🚀 部署 invite-user 函数..."
echo "📍 前端URL: $FRONTEND_URL"

# 设置环境变量并部署
FRONTEND_URL=$FRONTEND_URL supabase functions deploy invite-user --no-verify-jwt

echo "✅ 部署完成！"
echo ""
echo "💡 使用方法："
echo "   ./deploy-invite-user-with-env.sh                                    # 使用默认URL"
echo "   ./deploy-invite-user-with-env.sh https://your-custom-domain.com     # 使用自定义URL"
echo ""
echo "🔧 在Supabase控制台设置环境变量："
echo "   1. 打开 https://supabase.com/dashboard/project/wteqgprgiylmxzszcnws/functions"
echo "   2. 点击 invite-user 函数"
echo "   3. 在 Environment Variables 中添加："
echo "      Key: FRONTEND_URL"
echo "      Value: $FRONTEND_URL" 