#!/bin/bash

# CRM Web 生产环境部署脚本
echo "🚀 开始部署 CRM Web 到生产环境..."

# 进入临时目录
cd /tmp

# 检查压缩包文件
echo "📋 检查压缩包文件..."
ls -la *.tar.gz

# 解压前端文件
echo "📦 解压前端文件..."
if [ -f "crm-web-frontend-*.tar.gz" ]; then
    tar -xzf crm-web-frontend-*.tar.gz
    echo "✅ 前端文件解压完成"
else
    echo "❌ 未找到前端压缩包"
    exit 1
fi

# 解压后端文件
echo "📦 解压后端文件..."
if [ -f "crm-web-backend-clean-*.tar.gz" ]; then
    tar -xzf crm-web-backend-clean-*.tar.gz
    echo "✅ 后端文件解压完成"
else
    echo "❌ 未找到后端压缩包"
    exit 1
fi

# 备份现有服务
echo "💾 备份现有服务..."
if [ -d "/opt/crm-wecom-api" ]; then
    mkdir -p /opt/backups/crm-wecom-api
    backup_name="backup-$(date +%Y%m%d-%H%M%S)"
    cp -r /opt/crm-wecom-api /opt/backups/crm-wecom-api/$backup_name
    echo "✅ 现有服务已备份到: /opt/backups/crm-wecom-api/$backup_name"
else
    echo "ℹ️ 未找到现有服务，跳过备份"
fi

# 停止现有服务
echo "⏹️ 停止现有服务..."
pm2 delete crm-wecom-api 2>/dev/null || echo "⚠️ 服务未运行"

# 清空目标目录
echo "🧹 清空目标目录..."
sudo rm -rf /opt/crm-wecom-api/*

# 部署后端文件
echo "📁 部署后端文件..."
sudo cp -r backend/* /opt/crm-wecom-api/
echo "✅ 后端文件部署完成"

# 部署前端文件
echo "📁 部署前端文件..."
sudo mkdir -p /opt/crm-wecom-api/public
sudo cp -r index.html assets fonts *.svg *.json *.wav /opt/crm-wecom-api/public/
echo "✅ 前端文件部署完成"

# 设置权限
echo "🔐 设置权限..."
sudo chown -R www-data:www-data /opt/crm-wecom-api/
sudo chmod -R 755 /opt/crm-wecom-api/

# 进入应用目录
cd /opt/crm-wecom-api

# 检查环境变量文件
echo "🔧 检查环境变量配置..."
if [ ! -f ".env" ]; then
    if [ -f ".env.example" ]; then
        echo "⚠️ 未找到 .env 文件，复制示例文件..."
        cp .env.example .env
        echo "📝 请编辑 .env 文件配置正确的环境变量"
        echo "   nano .env"
    else
        echo "❌ 未找到环境变量示例文件"
        exit 1
    fi
fi

# 安装依赖
echo "📦 安装依赖..."
npm install

# 检查是否安装了 jsonwebtoken
if ! npm list jsonwebtoken >/dev/null 2>&1; then
    echo "📦 安装 jsonwebtoken 依赖..."
    npm install jsonwebtoken
fi

# 启动服务
echo "🔄 启动服务..."
pm2 start server.js --name crm-wecom-api
pm2 save

# 检查服务状态
echo "📊 检查服务状态..."
pm2 status

# 检查服务日志
echo "📋 检查服务日志..."
pm2 logs crm-wecom-api --lines 10

echo ""
echo "🎉 部署完成！"
echo ""
echo "📋 部署信息："
echo "- 后端服务: /opt/crm-wecom-api/"
echo "- 前端文件: /opt/crm-wecom-api/public/"
echo "- 服务状态: pm2 status"
echo "- 服务日志: pm2 logs crm-wecom-api"
echo ""
echo "🔧 下一步："
echo "1. 检查服务状态: pm2 status"
echo "2. 查看服务日志: pm2 logs crm-wecom-api"
echo "3. 测试企业微信登录功能"
echo "4. 配置 Nginx 反向代理（如需要）"
echo ""
echo "📖 详细说明请查看部署文档"
