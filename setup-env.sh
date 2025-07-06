#!/bin/bash

echo "🔧 设置环境变量"
echo ""

ENV_FILE=".env"

if [ -f "$ENV_FILE" ]; then
    echo "⚠️  .env文件已存在，是否覆盖？(y/N)"
    read -r response
    if [[ ! "$response" =~ ^[Yy]$ ]]; then
        echo "❌ 取消设置"
        exit 0
    fi
fi

echo "📝 创建 .env 文件..."

cat > "$ENV_FILE" << 'EOF'
# Supabase配置
VITE_SUPABASE_URL=https://wteqgprgiylmxzszcnws.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Ind0ZXFncHJnaXlsbXh6c3pjbndzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTExNzc5ODEsImV4cCI6MjA2Njc1Mzk4MX0.VpS4zrfPjA8e7xce7D_hVjn69um3UaSG05F79nJ8hxI
EOF

if [ $? -eq 0 ]; then
    echo "✅ .env文件创建成功！"
    echo ""
    echo "📋 环境变量配置完成："
    echo "  - VITE_SUPABASE_URL: https://wteqgprgiylmxzszcnws.supabase.co"
    echo "  - VITE_SUPABASE_ANON_KEY: 已配置"
    echo ""
    echo "🚀 现在可以运行应用了："
    echo "  npm run dev"
else
    echo "❌ 创建.env文件失败"
    exit 1
fi 