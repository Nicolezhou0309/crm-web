#!/bin/bash

# 企业微信API修复部署脚本
echo "🚀 开始部署企业微信API修复..."

# 1. 停止当前服务
echo "⏹️ 停止当前服务..."
pm2 stop crm-wecom-api

# 2. 备份当前代码（如果还没有备份）
echo "📦 备份当前代码..."
if [ ! -d "/opt/crm-wecom-api-backup-$(date +%Y%m%d_%H%M%S)" ]; then
    cp -r /opt/crm-wecom-api /opt/crm-wecom-api-backup-$(date +%Y%m%d_%H%M%S)
    echo "✅ 当前代码已备份"
fi

# 3. 覆盖代码
echo "🔄 覆盖代码到 crm-wecom-api 目录..."
cp -r /opt/crm-wecom-api-backup-20250909_152349/* /opt/crm-wecom-api/

# 4. 确保权限正确
echo "🔐 设置文件权限..."
chown -R root:root /opt/crm-wecom-api
chmod +x /opt/crm-wecom-api/server.js

# 5. 安装依赖（如果需要）
echo "📦 检查并安装依赖..."
cd /opt/crm-wecom-api
if [ ! -d "node_modules" ]; then
    echo "安装依赖..."
    npm install
else
    echo "依赖已存在，跳过安装"
fi

# 6. 重启服务
echo "🔄 重启服务..."
pm2 start server.js --name "crm-wecom-api"

# 7. 检查服务状态
echo "📊 检查服务状态..."
pm2 status

# 8. 显示日志
echo "📋 显示最新日志..."
pm2 logs crm-wecom-api --lines 10

echo "✅ 部署完成！"
echo "🔍 请检查服务状态和日志确认修复是否成功"
