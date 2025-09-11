#!/bin/bash

# 企业微信认证系统启动脚本（使用自建Supabase）

echo "🚀 启动企业微信认证系统..."

# 检查是否安装了依赖
if [ ! -d "backend/node_modules" ]; then
    echo "📦 安装后端依赖..."
    cd backend
    npm install
    cd ..
fi

if [ ! -d "node_modules" ]; then
    echo "📦 安装前端依赖..."
    npm install
fi

# 设置环境变量（后端只需要 Service Role Key）
export VITE_SUPABASE_URL=https://lead-service.vld.com.cn/supabase
export VITE_SUPABASE_SERVICE_ROLE_KEY=eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJvbGUiOiJzZXJ2aWNlX3JvbGUiLCJpYXQiOjE3NTU3ODU4NjcsImV4cCI6MTMyNjY0MjU4Njd9.YnpJt0nFCQ66CudiuxycZGU51mIw6Y6Z3qGXdMWau80

echo "🔍 验证 Supabase 连接..."
node verify-supabase-config.js

echo ""
echo "🚀 启动后端服务..."
cd backend
npm start &
BACKEND_PID=$!

echo "⏳ 等待后端启动..."
sleep 3

echo "🚀 启动前端服务..."
cd ..
npm run dev &
FRONTEND_PID=$!

echo ""
echo "✅ 服务已启动:"
echo "   后端: http://localhost:3001"
echo "   前端: https://lead.vld.com.cn"
echo "   Supabase: https://lead-service.vld.com.cn/supabase"
echo ""
echo "按 Ctrl+C 停止所有服务"

# 等待用户中断
trap "echo '🛑 停止服务...'; kill $BACKEND_PID $FRONTEND_PID; exit" INT
wait
