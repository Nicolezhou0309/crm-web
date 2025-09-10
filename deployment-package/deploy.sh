#!/bin/bash

# CRM Web 部署脚本
echo "🚀 开始部署 CRM Web 应用..."

# 检查 Node.js 版本
echo "📋 检查 Node.js 版本..."
node --version
npm --version

# 进入后端目录
cd backend

# 安装后端依赖
echo "📦 安装后端依赖..."
npm install

# 检查环境变量文件
if [ ! -f ".env" ]; then
    echo "⚠️  未找到 .env 文件，请复制 .env.example 并配置环境变量"
    echo "   cp .env.example .env"
    echo "   然后编辑 .env 文件配置正确的环境变量"
    exit 1
fi

# 启动后端服务
echo "🔄 启动后端服务..."
if command -v pm2 &> /dev/null; then
    echo "使用 PM2 启动服务..."
    pm2 start server.js --name crm-wecom-api
    pm2 save
    echo "✅ 后端服务已启动 (PM2)"
else
    echo "使用 Node.js 直接启动服务..."
    nohup node server.js > server.log 2>&1 &
    echo "✅ 后端服务已启动 (Node.js)"
fi

echo "🎉 部署完成！"
echo ""
echo "📋 部署信息："
echo "- 前端文件: 已构建并准备部署到静态服务器"
echo "- 后端服务: 已启动"
echo "- 端口: 3001 (默认)"
echo ""
echo "🔧 下一步："
echo "1. 将前端文件部署到 Web 服务器"
echo "2. 配置 Nginx 反向代理（如需要）"
echo "3. 测试企业微信登录功能"
echo ""
echo "📖 详细说明请查看 DEPLOYMENT_README.md"
