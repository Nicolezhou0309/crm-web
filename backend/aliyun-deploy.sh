#!/bin/bash

# 阿里云服务器企业微信登录API部署脚本
# 使用方法: ./aliyun-deploy.sh

set -e  # 遇到错误立即退出

echo "🚀 开始部署企业微信登录API到阿里云服务器..."

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# 阿里云配置变量
API_DIR="/opt/crm-wecom-api"
SERVICE_NAME="crm-wecom-api"
NGINX_CONF="/etc/nginx/sites-available/crm-wecom-api"
DOMAIN="api.lead-service.vld.com.cn"  # 您的API域名
FRONTEND_DOMAIN="lead-service.vld.com.cn"  # 您的前端域名

echo -e "${BLUE}📋 阿里云部署配置:${NC}"
echo "  API目录: $API_DIR"
echo "  服务名称: $SERVICE_NAME"
echo "  API域名: $DOMAIN"
echo "  前端域名: $FRONTEND_DOMAIN"
echo ""

# 检查是否为root用户
if [ "$EUID" -ne 0 ]; then
    echo -e "${RED}❌ 请使用root用户运行此脚本${NC}"
    echo "使用命令: sudo ./aliyun-deploy.sh"
    exit 1
fi

# 第一步：更新系统
echo -e "${YELLOW}🔄 更新系统包...${NC}"
apt update && apt upgrade -y

# 第二步：安装Node.js
echo -e "${YELLOW}📦 安装Node.js...${NC}"
if ! command -v node &> /dev/null; then
    curl -fsSL https://deb.nodesource.com/setup_18.x | bash -
    apt-get install -y nodejs
fi

NODE_VERSION=$(node --version)
echo -e "${GREEN}✅ Node.js版本: $NODE_VERSION${NC}"

# 第三步：安装PM2
echo -e "${YELLOW}📦 安装PM2...${NC}"
if ! command -v pm2 &> /dev/null; then
    npm install -g pm2
fi
echo -e "${GREEN}✅ PM2安装完成${NC}"

# 第四步：安装Nginx
echo -e "${YELLOW}🌐 安装Nginx...${NC}"
if ! command -v nginx &> /dev/null; then
    apt install -y nginx
fi
echo -e "${GREEN}✅ Nginx安装完成${NC}"

# 第五步：安装SSL证书工具
echo -e "${YELLOW}🔒 安装Certbot...${NC}"
if ! command -v certbot &> /dev/null; then
    apt install -y certbot python3-certbot-nginx
fi
echo -e "${GREEN}✅ Certbot安装完成${NC}"

# 第六步：创建API目录
echo -e "${YELLOW}📁 创建API目录...${NC}"
mkdir -p $API_DIR
cd $API_DIR

# 第七步：复制项目文件
echo -e "${YELLOW}📋 复制项目文件...${NC}"
# 这里假设您已经将backend目录上传到服务器
# 或者通过git clone获取代码
if [ ! -f "package.json" ]; then
    echo -e "${RED}❌ 未找到package.json文件${NC}"
    echo "请确保backend目录已上传到服务器，或使用git clone获取代码"
    exit 1
fi

# 第八步：安装依赖
echo -e "${YELLOW}📦 安装项目依赖...${NC}"
npm install --production

# 第九步：配置环境变量
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

# 第十步：创建PM2配置文件
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

# 第十一步：启动API服务
echo -e "${YELLOW}🚀 启动API服务...${NC}"
pm2 delete $SERVICE_NAME 2>/dev/null || true
pm2 start ecosystem.config.js
pm2 save

echo -e "${GREEN}✅ API服务启动成功${NC}"

# 第十二步：配置Nginx
echo -e "${YELLOW}🌐 配置Nginx...${NC}"
cat > $NGINX_CONF << EOF
# 上游服务器
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
    
    # SSL配置（稍后通过certbot配置）
    # ssl_certificate /etc/letsencrypt/live/$DOMAIN/fullchain.pem;
    # ssl_certificate_key /etc/letsencrypt/live/$DOMAIN/privkey.pem;
    
    # 临时SSL配置（自签名证书）
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

# 启用Nginx配置
ln -sf $NGINX_CONF /etc/nginx/sites-enabled/
nginx -t
systemctl reload nginx

echo -e "${GREEN}✅ Nginx配置完成${NC}"

# 第十三步：配置防火墙
echo -e "${YELLOW}🔥 配置防火墙...${NC}"
ufw allow 22
ufw allow 80
ufw allow 443
ufw --force enable

echo -e "${GREEN}✅ 防火墙配置完成${NC}"

# 第十四步：设置开机自启
echo -e "${YELLOW}🔄 设置开机自启...${NC}"
pm2 startup
systemctl enable nginx

echo -e "${GREEN}✅ 开机自启设置完成${NC}"

# 第十五步：配置SSL证书
echo -e "${YELLOW}🔒 配置SSL证书...${NC}"
echo -e "${BLUE}请手动执行以下命令配置SSL证书：${NC}"
echo "certbot --nginx -d $DOMAIN"
echo ""
echo -e "${YELLOW}或者使用阿里云SSL证书：${NC}"
echo "1. 在阿里云控制台申请SSL证书"
echo "2. 下载证书文件"
echo "3. 上传到服务器 /etc/ssl/certs/ 和 /etc/ssl/private/"
echo "4. 更新Nginx配置中的证书路径"

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
echo "1. 请及时配置SSL证书"
echo "2. 定期备份.env文件"
echo "3. 监控服务运行状态"
echo "4. 定期更新依赖包"
