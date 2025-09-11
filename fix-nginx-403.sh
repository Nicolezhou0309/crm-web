#!/bin/bash

# 修复 nginx 403 Forbidden 错误的脚本

echo "=== 修复 nginx 403 Forbidden 错误 ==="

# 1. 备份当前配置
echo "1. 备份当前 nginx 配置..."
sudo cp /etc/nginx/conf.d/lead-service.conf /etc/nginx/conf.d/lead-service.conf.backup.$(date +%Y%m%d_%H%M%S)

# 2. 检查并创建静态文件目录
echo "2. 检查静态文件目录..."
if [ ! -d "/var/www/crm-web" ]; then
    echo "创建 /var/www/crm-web 目录..."
    sudo mkdir -p /var/www/crm-web
fi

# 3. 设置正确的权限
echo "3. 设置目录权限..."
sudo chown -R nginx:nginx /var/www/crm-web
sudo chmod -R 755 /var/www/crm-web

# 4. 检查前端文件是否存在
echo "4. 检查前端文件..."
if [ ! -f "/var/www/crm-web/index.html" ]; then
    echo "警告: /var/www/crm-web/index.html 不存在"
    echo "请确保前端文件已正确部署到 /var/www/crm-web/"
fi

# 5. 创建修复后的 nginx 配置
echo "5. 创建修复后的 nginx 配置..."
sudo tee /etc/nginx/conf.d/lead-service.conf > /dev/null << 'EOF'
server {
    listen 80;
    listen 443 ssl;
    server_name lead-service.vld.com.cn;
    
    # SSL 配置
    ssl_certificate /etc/letsencrypt/live/lead-service.vld.com.cn/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/lead-service.vld.com.cn/privkey.pem;
    include /etc/letsencrypt/options-ssl-nginx.conf;
    ssl_dhparam /etc/letsencrypt/ssl-dhparams.pem;
    
    # 静态资源缓存优化
    location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2|ttf|eot)$ {
        root /var/www/crm-web;
        expires 1y;
        add_header Cache-Control "public, immutable";
        add_header Vary "Accept-Encoding";
        try_files $uri =404;
    }

    # 企业微信API - 支持长轮询
    location /api/auth/wecom/ { 
        proxy_pass http://127.0.0.1:3001/api/auth/wecom/;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_connect_timeout 5s;
        proxy_send_timeout 5s;
        proxy_read_timeout 660s;
        proxy_buffering off;
        proxy_cache off;
        proxy_set_header Connection "";
        proxy_http_version 1.1;
        
        # CORS支持
        add_header Access-Control-Allow-Origin *;
        add_header Access-Control-Allow-Methods "GET, POST, OPTIONS";
        add_header Access-Control-Allow-Headers "Content-Type, Authorization";
        
        if ($request_method = OPTIONS) {
            add_header Access-Control-Allow-Origin *;
            add_header Access-Control-Allow-Methods "GET, POST, OPTIONS";
            add_header Access-Control-Allow-Headers "Content-Type, Authorization";
            add_header Content-Length 0;
            add_header Content-Type text/plain;
            return 200;
        }
    }

    # 健康检查API
    location /api/health {
        proxy_pass http://127.0.0.1:3001/api/health;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_connect_timeout 5s;
        proxy_send_timeout 5s;
        proxy_read_timeout 5s;
    }

    # 其他API（通用配置）
    location /api/ {
        proxy_pass http://127.0.0.1:3001/api/;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_connect_timeout 30s;
        proxy_send_timeout 30s;
        proxy_read_timeout 30s;
        proxy_buffering on;
        
        # CORS支持
        add_header Access-Control-Allow-Origin *;
        add_header Access-Control-Allow-Methods "GET, POST, PUT, DELETE, OPTIONS";
        add_header Access-Control-Allow-Headers "Content-Type, Authorization, X-Requested-With";
        
        if ($request_method = OPTIONS) {
            add_header Access-Control-Allow-Origin *;
            add_header Access-Control-Allow-Methods "GET, POST, PUT, DELETE, OPTIONS";
            add_header Access-Control-Allow-Headers "Content-Type, Authorization, X-Requested-With";
            add_header Content-Length 0;
            add_header Content-Type text/plain;
            return 200;
        }
    }   

    # Supabase API代理配置
    location /supabase/ {
        proxy_pass https://lead-service.vld.com.cn/supabase/;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        
        # 支持WebSocket
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_buffering off;
        proxy_cache off;
        proxy_read_timeout 86400;
        proxy_send_timeout 86400;
        
        # 超时设置
        proxy_connect_timeout 5s;
        
        # CORS头
        proxy_hide_header Access-Control-Allow-Origin;
        proxy_hide_header Access-Control-Allow-Methods;
        proxy_hide_header Access-Control-Allow-Headers;
        add_header Access-Control-Allow-Origin *;
        add_header Access-Control-Allow-Methods "GET, POST, PUT, DELETE, OPTIONS";
        add_header Access-Control-Allow-Headers "Content-Type, Authorization, X-Requested-With, apikey, x-client-info, x-supabase-api-version";
        
        # 处理OPTIONS请求
        if ($request_method = 'OPTIONS') {
            add_header Access-Control-Allow-Origin *;
            add_header Access-Control-Allow-Methods "GET, POST, PUT, DELETE, OPTIONS";
            add_header Access-Control-Allow-Headers "Content-Type, Authorization, X-Requested-With, apikey, x-client-info, x-supabase-api-version";
            add_header Access-Control-Max-Age 1728000;
            add_header Content-Type 'text/plain charset=UTF-8';
            add_header Content-Length 0;
            return 204;
        }
    }
    
    # 健康检查端点
    location /health {
        return 200 '{"status":"healthy","timestamp":"$time_iso8601","service":"crm-web","version":"1.0.0"}';
        add_header Content-Type application/json;
        access_log off;
    }

    # 静态文件服务（React应用）
    location / {
        root /var/www/crm-web;
        index index.html;
        try_files $uri $uri/ /index.html;
    }
}

# HTTP 到 HTTPS 重定向
server {
    listen 80;
    server_name lead-service.vld.com.cn;
    return 301 https://$host$request_uri;
}
EOF

# 6. 测试 nginx 配置
echo "6. 测试 nginx 配置..."
if sudo nginx -t; then
    echo "✅ nginx 配置测试通过"
    
    # 7. 重启 nginx
    echo "7. 重启 nginx 服务..."
    sudo systemctl reload nginx
    
    echo "✅ nginx 已重新加载"
    echo ""
    echo "=== 修复完成 ==="
    echo "请检查以下内容："
    echo "1. 确保前端文件已部署到 /var/www/crm-web/"
    echo "2. 检查文件权限：ls -la /var/www/crm-web/"
    echo "3. 测试网站：curl -I https://lead.vld.com.cn/"
else
    echo "❌ nginx 配置测试失败，请检查配置"
    exit 1
fi
