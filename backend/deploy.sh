#!/bin/bash

# 企业微信登录API部署脚本
# 使用方法: ./deploy.sh

set -e  # 遇到错误立即退出

echo "🚀 开始部署企业微信登录API..."

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# 配置变量
API_DIR="/opt/crm-wecom-api"
SERVICE_NAME="crm-wecom-api"
NGINX_CONF="/etc/nginx/sites-available/crm-wecom-api"

echo -e "${YELLOW}📋 部署配置:${NC}"
echo "  API目录: $API_DIR"
echo "  服务名称: $SERVICE_NAME"
echo "  Nginx配置: $NGINX_CONF"
echo ""

# 检查Node.js
echo -e "${YELLOW}🔍 检查Node.js环境...${NC}"
if ! command -v node &> /dev/null; then
    echo -e "${RED}❌ Node.js未安装，请先安装Node.js 16+${NC}"
    exit 1
fi

NODE_VERSION=$(node --version)
echo -e "${GREEN}✅ Node.js版本: $NODE_VERSION${NC}"

# 检查PM2
echo -e "${YELLOW}🔍 检查PM2...${NC}"
if ! command -v pm2 &> /dev/null; then
    echo -e "${YELLOW}⚠️  PM2未安装，正在安装...${NC}"
    npm install -g pm2
fi

echo -e "${GREEN}✅ PM2已就绪${NC}"

# 创建API目录
echo -e "${YELLOW}📁 创建API目录...${NC}"
sudo mkdir -p $API_DIR
sudo chown -R $USER:$USER $API_DIR

# 复制文件
echo -e "${YELLOW}📋 复制文件...${NC}"
cp -r . $API_DIR/
cd $API_DIR

# 安装依赖
echo -e "${YELLOW}📦 安装依赖...${NC}"
npm install --production

# 设置环境变量
echo -e "${YELLOW}⚙️  配置环境变量...${NC}"
if [ ! -f .env ]; then
    echo -e "${YELLOW}⚠️  未找到.env文件，请手动配置环境变量${NC}"
    echo "请复制 env.example 到 .env 并配置相关参数"
    cp env.example .env
    echo -e "${RED}❌ 请先配置.env文件后再运行部署脚本${NC}"
    exit 1
fi

# 创建PM2配置文件
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
    time: true
  }]
};
EOF

# 启动服务
echo -e "${YELLOW}🚀 启动API服务...${NC}"
pm2 delete $SERVICE_NAME 2>/dev/null || true
pm2 start ecosystem.config.js
pm2 save

echo -e "${GREEN}✅ API服务启动成功${NC}"

# 配置Nginx
echo -e "${YELLOW}🌐 配置Nginx...${NC}"
sudo tee $NGINX_CONF > /dev/null << EOF
server {
    listen 80;
    server_name api.yourdomain.com;  # 替换为您的域名
    
    location /api/auth/wecom/ {
        proxy_pass http://localhost:3001/api/auth/wecom/;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        
        # 超时设置
        proxy_connect_timeout 30s;
        proxy_send_timeout 30s;
        proxy_read_timeout 30s;
    }
    
    location /api/health {
        proxy_pass http://localhost:3001/api/health;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
    }
}
EOF

# 启用Nginx配置
sudo ln -sf $NGINX_CONF /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx

echo -e "${GREEN}✅ Nginx配置完成${NC}"

# 设置开机自启
echo -e "${YELLOW}🔄 设置开机自启...${NC}"
pm2 startup
sudo systemctl enable nginx

echo -e "${GREEN}✅ 开机自启设置完成${NC}"

# 显示服务状态
echo -e "${YELLOW}📊 服务状态:${NC}"
pm2 status

echo ""
echo -e "${GREEN}🎉 企业微信登录API部署完成！${NC}"
echo ""
echo -e "${YELLOW}📋 后续步骤:${NC}"
echo "1. 配置SSL证书（推荐使用Let's Encrypt）"
echo "2. 更新前端API地址为: https://api.yourdomain.com"
echo "3. 测试API接口: curl https://api.yourdomain.com/api/health"
echo "4. 查看日志: pm2 logs $SERVICE_NAME"
echo ""
echo -e "${YELLOW}🔧 管理命令:${NC}"
echo "  启动服务: pm2 start $SERVICE_NAME"
echo "  停止服务: pm2 stop $SERVICE_NAME"
echo "  重启服务: pm2 restart $SERVICE_NAME"
echo "  查看日志: pm2 logs $SERVICE_NAME"
echo "  查看状态: pm2 status"
