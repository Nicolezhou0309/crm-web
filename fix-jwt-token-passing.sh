#!/bin/bash

echo "🔧 修复JWT令牌传递问题..."

# 备份当前配置
cp /etc/nginx/conf.d/lead-service.conf /etc/nginx/conf.d/lead-service.conf.backup.$(date +%Y%m%d_%H%M%S)

# 复制新配置
cp nginx-lead-service.conf /etc/nginx/conf.d/lead-service.conf

# 测试nginx配置
echo "🧪 测试nginx配置..."
nginx -t

if [ $? -eq 0 ]; then
    echo "✅ nginx配置测试通过"
    
    # 重新加载nginx
    echo "🔄 重新加载nginx..."
    systemctl reload nginx
    
    if [ $? -eq 0 ]; then
        echo "✅ nginx重新加载成功"
        echo "🎉 JWT令牌传递问题已修复！"
        echo ""
        echo "修复说明："
        echo "- 移除了硬编码的匿名用户JWT令牌"
        echo "- 现在nginx会传递前端发送的真实JWT令牌"
        echo "- 登录用户现在可以正常获取profile信息"
    else
        echo "❌ nginx重新加载失败"
        exit 1
    fi
else
    echo "❌ nginx配置测试失败"
    exit 1
fi
