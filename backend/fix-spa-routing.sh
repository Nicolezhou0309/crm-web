#!/bin/bash

# 修复SPA路由问题的部署脚本
# 解决 /login 路由刷新时出现500错误的问题

set -e

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}🔧 开始修复SPA路由问题...${NC}"

# 第一步：检查当前状态
echo -e "${YELLOW}📋 检查当前服务状态...${NC}"
pm2 status
systemctl status nginx --no-pager -l

# 第二步：备份当前Nginx配置
echo -e "${YELLOW}💾 备份当前Nginx配置...${NC}"
if [ -f "/etc/nginx/conf.d/crm-wecom-api.conf" ]; then
    cp /etc/nginx/conf.d/crm-wecom-api.conf /etc/nginx/conf.d/crm-wecom-api.conf.backup.$(date +%Y%m%d_%H%M%S)
    echo -e "${GREEN}✅ 配置已备份${NC}"
else
    echo -e "${YELLOW}⚠️  未找到现有配置文件${NC}"
fi

# 第三步：检查前端构建文件是否存在
echo -e "${YELLOW}📁 检查前端构建文件...${NC}"
if [ ! -d "/var/www/html" ]; then
    echo -e "${YELLOW}📁 创建前端文件目录...${NC}"
    sudo mkdir -p /var/www/html
    sudo chown -R www-data:www-data /var/www/html
fi

# 检查是否有index.html文件
if [ ! -f "/var/www/html/index.html" ]; then
    echo -e "${RED}❌ 未找到前端构建文件 index.html${NC}"
    echo -e "${YELLOW}请确保前端已正确构建并部署到 /var/www/html/ 目录${NC}"
    echo -e "${YELLOW}或者从本地构建目录复制文件：${NC}"
    echo -e "${BLUE}  sudo cp -r /path/to/your/dist/* /var/www/html/${NC}"
    read -p "是否继续配置Nginx？(y/N): " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        echo -e "${RED}❌ 用户取消操作${NC}"
        exit 1
    fi
fi

# 第四步：应用新的Nginx配置
echo -e "${YELLOW}⚙️  应用新的Nginx配置...${NC}"
cat > /etc/nginx/conf.d/crm-wecom-api.conf << 'EOF'
# 企业微信认证API + 前端SPA支持
# 修复SPA路由问题，支持前端路由刷新

events {
    worker_connections 1024;
}

http {
    include       /etc/nginx/mime.types;
    default_type  application/octet-stream;
    
    # 日志格式
    log_format main '$remote_addr - $remote_user [$time_local] "$request" '
                    '$status $body_bytes_sent "$http_referer" '
                    '"$http_user_agent" "$http_x_forwarded_for"';
    
    access_log /var/log/nginx/access.log main;
    error_log /var/log/nginx/error.log;
    
    # 基本设置
    sendfile on;
    tcp_nopush on;
    tcp_nodelay on;
    keepalive_timeout 65;
    types_hash_max_size 2048;
    
    # Gzip压缩
    gzip on;
    gzip_vary on;
    gzip_min_length 1024;
    gzip_types text/plain text/css application/json application/javascript text/xml application/xml application/xml+rss text/javascript;
    
    # 速率限制
    limit_req_zone $binary_remote_addr zone=api:10m rate=10r/s;
    
    # 上游服务器
    upstream wecom_api {
        server 127.0.0.1:3001;
    }
    
    # HTTP重定向到HTTPS
    server {
        listen 80;
        server_name lead-service.vld.com.cn;
        return 301 https://$server_name$request_uri;
    }
    
    # HTTPS服务器
    server {
        listen 443 ssl http2;
        server_name lead-service.vld.com.cn;
        
        # SSL配置
        ssl_certificate /etc/ssl/certs/ssl-cert-snakeoil.pem;
        ssl_certificate_key /etc/ssl/private/ssl-cert-snakeoil.key;
        ssl_protocols TLSv1.2 TLSv1.3;
        ssl_ciphers ECDHE-RSA-AES128-GCM-SHA256:ECDHE-RSA-AES256-GCM-SHA384;
        ssl_prefer_server_ciphers off;
        
        # 安全头
        add_header X-Frame-Options DENY;
        add_header X-Content-Type-Options nosniff;
        add_header X-XSS-Protection "1; mode=block";
        add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;
        
        # 静态文件根目录（前端构建文件）
        root /var/www/html;
        index index.html;
        
        # API代理 - 企业微信认证
        location /api/auth/wecom/ {
            limit_req zone=api burst=20 nodelay;
            
            proxy_pass http://wecom_api/api/auth/wecom/;
            proxy_set_header Host $host;
            proxy_set_header X-Real-IP $remote_addr;
            proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
            proxy_set_header X-Forwarded-Proto $scheme;
            
            # 超时设置
            proxy_connect_timeout 30s;
            proxy_send_timeout 30s;
            proxy_read_timeout 30s;
            
            # 缓冲设置
            proxy_buffering on;
            proxy_buffer_size 4k;
            proxy_buffers 8 4k;
        }
        
        # 健康检查
        location /api/health {
            proxy_pass http://wecom_api/api/health;
            proxy_set_header Host $host;
            proxy_set_header X-Real-IP $remote_addr;
            proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
            proxy_set_header X-Forwarded-Proto $scheme;
        }
        
        # 静态资源文件（CSS, JS, 图片等）
        location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2|ttf|eot)$ {
            expires 1y;
            add_header Cache-Control "public, immutable";
            try_files $uri =404;
        }
        
        # 前端路由支持 - 所有其他请求都返回index.html
        location / {
            try_files $uri $uri/ /index.html;
            
            # 防止缓存index.html
            location = /index.html {
                add_header Cache-Control "no-cache, no-store, must-revalidate";
                add_header Pragma "no-cache";
                add_header Expires "0";
            }
        }
        
        # 错误页面
        error_page 404 /index.html;
        error_page 500 502 503 504 /index.html;
    }
}
EOF

# 第五步：测试Nginx配置
echo -e "${YELLOW}🧪 测试Nginx配置...${NC}"
nginx -t
if [ $? -eq 0 ]; then
    echo -e "${GREEN}✅ Nginx配置测试通过${NC}"
else
    echo -e "${RED}❌ Nginx配置有误，请检查${NC}"
    exit 1
fi

# 第六步：重载Nginx配置
echo -e "${YELLOW}🔄 重载Nginx配置...${NC}"
systemctl reload nginx
if [ $? -eq 0 ]; then
    echo -e "${GREEN}✅ Nginx配置重载成功${NC}"
else
    echo -e "${RED}❌ Nginx配置重载失败${NC}"
    exit 1
fi

# 第七步：测试修复效果
echo -e "${YELLOW}🧪 测试修复效果...${NC}"
echo -e "${BLUE}测试API健康检查...${NC}"
curl -s https://lead-service.vld.com.cn/api/health | head -1

echo -e "${BLUE}测试前端页面...${NC}"
curl -s -w "HTTP状态码: %{http_code}\n" https://lead-service.vld.com.cn/ -o /dev/null

echo -e "${BLUE}测试登录页面...${NC}"
curl -s -w "HTTP状态码: %{http_code}\n" https://lead-service.vld.com.cn/login -o /dev/null

# 第八步：显示修复结果
echo ""
echo -e "${GREEN}🎉 SPA路由问题修复完成！${NC}"
echo ""
echo -e "${BLUE}📋 修复内容:${NC}"
echo "  ✅ 配置了前端静态文件服务"
echo "  ✅ 添加了SPA路由支持 (try_files)"
echo "  ✅ 优化了静态资源缓存"
echo "  ✅ 配置了错误页面重定向"
echo ""
echo -e "${BLUE}🔧 配置说明:${NC}"
echo "  - 所有非API请求都会返回 index.html"
echo "  - 前端路由现在可以正常刷新"
echo "  - 静态资源有适当的缓存策略"
echo "  - API请求继续正常代理到后端"
echo ""
echo -e "${YELLOW}🧪 测试建议:${NC}"
echo "  1. 访问 https://lead-service.vld.com.cn/login"
echo "  2. 刷新页面，应该不再出现500错误"
echo "  3. 测试其他前端路由的刷新功能"
echo ""
echo -e "${GREEN}✅ 修复完成！现在可以正常刷新前端路由了${NC}"
