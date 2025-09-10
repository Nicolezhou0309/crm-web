#!/bin/bash

# 诊断 nginx 403 Forbidden 错误的脚本

echo "=== 诊断 nginx 403 Forbidden 错误 ==="

# 1. 检查 nginx 状态
echo "1. 检查 nginx 服务状态..."
sudo systemctl status nginx --no-pager

echo ""
echo "2. 检查 nginx 配置语法..."
sudo nginx -t

echo ""
echo "3. 检查静态文件目录..."
if [ -d "/var/www/crm-web" ]; then
    echo "✅ /var/www/crm-web 目录存在"
    echo "目录内容："
    ls -la /var/www/crm-web/
    
    if [ -f "/var/www/crm-web/index.html" ]; then
        echo "✅ index.html 文件存在"
    else
        echo "❌ index.html 文件不存在"
    fi
else
    echo "❌ /var/www/crm-web 目录不存在"
fi

echo ""
echo "4. 检查目录权限..."
if [ -d "/var/www/crm-web" ]; then
    echo "目录权限："
    ls -ld /var/www/crm-web/
    echo "文件权限："
    ls -la /var/www/crm-web/ | head -10
fi

echo ""
echo "5. 检查 nginx 错误日志..."
echo "最近的错误日志："
sudo tail -20 /var/log/nginx/error.log

echo ""
echo "6. 检查 nginx 访问日志..."
echo "最近的访问日志："
sudo tail -10 /var/log/nginx/access.log

echo ""
echo "7. 测试本地连接..."
echo "测试本地 80 端口："
curl -I http://localhost/ 2>/dev/null || echo "无法连接到本地 nginx"

echo ""
echo "8. 检查端口监听..."
echo "nginx 监听的端口："
sudo netstat -tlnp | grep nginx

echo ""
echo "9. 检查防火墙状态..."
sudo systemctl status firewalld --no-pager 2>/dev/null || echo "firewalld 未运行"

echo ""
echo "=== 诊断完成 ==="
echo ""
echo "常见解决方案："
echo "1. 如果 /var/www/crm-web 不存在，请部署前端文件"
echo "2. 如果权限不正确，运行：sudo chown -R nginx:nginx /var/www/crm-web"
echo "3. 如果 nginx 配置有问题，运行修复脚本：./fix-nginx-403.sh"
