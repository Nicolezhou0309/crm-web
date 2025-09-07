#!/bin/bash

# 企业微信API服务环境变量热更新脚本

echo "=== 企业微信API环境变量热更新 ==="

# 检查PM2服务状态
echo "1. 检查当前服务状态..."
pm2 status crm-wecom-api

# 备份当前环境变量
echo "2. 备份当前环境变量..."
cp /opt/crm-wecom-api/.env /opt/crm-wecom-api/.env.backup.$(date +%Y%m%d_%H%M%S)

# 提示用户编辑环境变量
echo "3. 请编辑环境变量文件..."
echo "   文件位置: /opt/crm-wecom-api/.env"
echo "   编辑完成后按任意键继续..."
read -p "   按Enter键继续..."

# 验证环境变量文件
echo "4. 验证环境变量文件..."
if [ -f "/opt/crm-wecom-api/.env" ]; then
    echo "   ✅ 环境变量文件存在"
    echo "   当前配置:"
    grep -E "WECOM_|PORT|NODE_ENV" /opt/crm-wecom-api/.env
else
    echo "   ❌ 环境变量文件不存在"
    exit 1
fi

# 重新加载PM2服务
echo "5. 重新加载PM2服务..."
pm2 reload crm-wecom-api

# 检查服务状态
echo "6. 检查服务状态..."
sleep 2
pm2 status crm-wecom-api

# 测试API
echo "7. 测试API服务..."
curl -s https://lead-service.vld.com.cn/api/health

echo "=== 热更新完成 ==="
