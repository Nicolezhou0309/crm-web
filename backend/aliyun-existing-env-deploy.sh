#!/bin/bash

# 基于现有环境的阿里云服务器企业微信登录API部署脚本
# 适用于：Alibaba Cloud Linux 3 + 现有Nginx + 现有Node.js

set -e  # 遇到错误立即退出

echo "🚀 开始部署企业微信登录API到现有环境..."

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# 配置变量
TEMP_DIR="/tmp"
API_DIR="/opt/crm-wecom-api"
SERVICE_NAME="crm-wecom-api"
DOMAIN="api.lead-service.vld.com.cn"
FRONTEND_DOMAIN="lead-service.vld.com.cn"

echo -e "${BLUE}📋 部署配置:${NC}"
echo "  临时目录: $TEMP_DIR"
echo "  API目录: $API_DIR"
echo "  API域名: $DOMAIN"
echo "  前端域名: $FRONTEND_DOMAIN"
echo "  现有Nginx: $(nginx -v 2>&1)"
echo "  现有Node.js: $(node --version)"
echo ""

# 检查是否为root用户
if [ "$EUID" -ne 0 ]; then
    echo -e "${RED}❌ 请使用root用户运行此脚本${NC}"
    exit 1
fi

# 第一步：安装PM2
echo -e "${YELLOW}📦 安装PM2进程管理器...${NC}"
if ! command -v pm2 &> /dev/null; then
    npm install -g pm2
    echo -e "${GREEN}✅ PM2安装完成${NC}"
else
    echo -e "${GREEN}✅ PM2已安装: $(pm2 --version)${NC}"
fi

# 第二步：检查当前目录或临时目录中的部署文件
echo -e "${YELLOW}🔍 检查部署文件...${NC}"

# 检查当前目录是否已经是解压后的backend目录
if [ -f "package.json" ] && [ -f "server.js" ]; then
    echo -e "${GREEN}✅ 检测到已解压的项目文件，直接使用当前目录${NC}"
    CURRENT_DIR=$(pwd)
    echo -e "${GREEN}✅ 当前工作目录: $CURRENT_DIR${NC}"
else
    # 检查临时目录中的压缩包
    cd $TEMP_DIR
    DEPLOY_FILE=$(ls crm-wecom-api-existing-env-*.tar.gz 2>/dev/null | head -1)
    
    if [ -z "$DEPLOY_FILE" ]; then
        echo -e "${RED}❌ 未找到部署压缩包，请先上传并解压 crm-wecom-api-existing-env-*.tar.gz${NC}"
        echo -e "${YELLOW}📋 解压命令: tar -xzf crm-wecom-api-existing-env-*.tar.gz${NC}"
        exit 1
    fi
    
    echo -e "${GREEN}✅ 找到部署文件: $DEPLOY_FILE${NC}"
    
    # 第三步：创建API目录
    echo -e "${YELLOW}📁 创建API目录...${NC}"
    mkdir -p $API_DIR
    
    # 第四步：解压部署文件
    echo -e "${YELLOW}📦 解压部署文件...${NC}"
    tar -xzf $DEPLOY_FILE -C $API_DIR
    cd $API_DIR
fi

# 第五步：检查项目文件
echo -e "${YELLOW}📋 检查项目文件...${NC}"
if [ ! -f "package.json" ]; then
    echo -e "${RED}❌ 未找到package.json文件${NC}"
    echo "部署文件解压失败"
    exit 1
fi

# 第六步：安装依赖
echo -e "${YELLOW}📦 安装项目依赖...${NC}"
npm install --production

# 第七步：配置环境变量
echo -e "${YELLOW}⚙️  配置环境变量...${NC}"
if [ ! -f ".env" ]; then
    echo -e "${RED}❌ 未找到.env文件${NC}"
    echo "请确保.env文件已配置"
    exit 1
fi

# 更新.env文件中的域名
sed -i "s|FRONTEND_URL=.*|FRONTEND_URL=https://$FRONTEND_DOMAIN|g" .env
sed -i "s|WECOM_REDIRECT_URI=.*|WECOM_REDIRECT_URI=https://$FRONTEND_DOMAIN/auth/wecom/callback|g" .env

echo -e "${GREEN}✅ 环境变量配置完成${NC}"

# 第六步：创建PM2配置文件
echo -e "${YELLOW}📝 创建PM2配置...${NC}"
cat > ecosystem.config.js << EOF
module.exports = {
  apps: [{
    name: '$SERVICE_NAME',
    script: 'server.js',
    instances: 1,
    exec_mode: 'fork',
    env: {
      NODE_ENV: 'production',
      PORT: 3001
    },
    error_file: '/var/log/pm2/$SERVICE_NAME-error.log',
    out_file: '/var/log/pm2/$SERVICE_NAME-out.log',
    log_file: '/var/log/pm2/$SERVICE_NAME.log',
    time: true,
    max_memory_restart: '1G',
    node_args: '--max-old-space-size=1024'
  }]
};
EOF

# 第七步：启动API服务
echo -e "${YELLOW}🚀 启动API服务...${NC}"
pm2 delete $SERVICE_NAME 2>/dev/null || true
pm2 start ecosystem.config.js
pm2 save

echo -e "${GREEN}✅ API服务启动成功${NC}"

# 第八步：配置Nginx（基于现有结构）
echo -e "${YELLOW}🌐 配置Nginx...${NC}"

# 备份现有nginx配置
cp /etc/nginx/nginx.conf /etc/nginx/nginx.conf.backup.$(date +%Y%m%d_%H%M%S)

# 创建API服务的nginx配置
cat > /etc/nginx/conf.d/crm-wecom-api.conf << EOF
# 企业微信登录API配置
upstream wecom_api {
    server 127.0.0.1:3001;
}

# HTTP重定向到HTTPS
server {
    listen 80;
    server_name $DOMAIN;
    return 301 https://\$server_name\$request_uri;
}

# HTTPS服务器
server {
    listen 443 ssl http2;
    server_name $DOMAIN;
    
    # SSL配置（使用现有证书或自签名）
    ssl_certificate /etc/ssl/certs/ssl-cert-snakeoil.pem;
    ssl_certificate_key /etc/ssl/private/ssl-cert-snakeoil.key;
    
    # 安全头
    add_header X-Frame-Options DENY;
    add_header X-Content-Type-Options nosniff;
    add_header X-XSS-Protection "1; mode=block";
    add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;
    
    # API代理
    location /api/auth/wecom/ {
        proxy_pass http://wecom_api/api/auth/wecom/;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        
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
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
    }
    
    # 其他请求返回404
    location / {
        return 404;
    }
}
EOF

# 测试nginx配置
nginx -t
if [ $? -eq 0 ]; then
    systemctl reload nginx
    echo -e "${GREEN}✅ Nginx配置完成并重载成功${NC}"
else
    echo -e "${RED}❌ Nginx配置有误，请检查${NC}"
    exit 1
fi

# 第九步：配置防火墙（如果需要）
echo -e "${YELLOW}🔥 检查防火墙配置...${NC}"
# 检查3001端口是否开放
if ! netstat -tlnp | grep -q ":3001"; then
    echo -e "${YELLOW}⚠️  端口3001未监听，但这是正常的（只允许本地访问）${NC}"
fi

# 第十步：设置开机自启
echo -e "${YELLOW}🔄 设置开机自启...${NC}"
pm2 startup
systemctl enable nginx

echo -e "${GREEN}✅ 开机自启设置完成${NC}"

# 显示服务状态
echo -e "${YELLOW}📊 服务状态:${NC}"
pm2 status

echo ""
echo -e "${GREEN}🎉 企业微信登录API部署完成！${NC}"
echo ""
echo -e "${BLUE}📋 部署信息:${NC}"
echo "  API服务地址: https://$DOMAIN"
echo "  健康检查: https://$DOMAIN/api/health"
echo "  服务目录: $API_DIR"
echo "  日志目录: /var/log/pm2/"
echo "  Nginx配置: /etc/nginx/conf.d/crm-wecom-api.conf"
echo ""
echo -e "${YELLOW}🔧 管理命令:${NC}"
echo "  查看状态: pm2 status"
echo "  查看日志: pm2 logs $SERVICE_NAME"
echo "  重启服务: pm2 restart $SERVICE_NAME"
echo "  停止服务: pm2 stop $SERVICE_NAME"
echo ""
echo -e "${YELLOW}📝 后续步骤:${NC}"
echo "1. 配置SSL证书（推荐使用Let's Encrypt）"
echo "2. 更新前端API地址为: https://$DOMAIN"
echo "3. 测试API接口"
echo "4. 配置监控和日志收集"
echo ""
echo -e "${RED}⚠️  重要提醒:${NC}"
echo "1. 当前使用自签名SSL证书，请配置正式证书"
echo "2. 确保域名 $DOMAIN 已解析到服务器IP"
echo "3. 定期备份.env文件和PM2配置"
echo "4. 监控服务运行状态"
