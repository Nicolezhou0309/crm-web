#!/bin/bash

# 快速部署脚本 - 企业微信API后端服务
# 使用方法: ./quick-deploy.sh

set -e  # 遇到错误立即退出

echo "🚀 开始部署企业微信API后端服务..."
echo "=============================="

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# 检查是否为root用户
if [ "$EUID" -ne 0 ]; then
    echo -e "${RED}❌ 请使用root用户运行此脚本${NC}"
    exit 1
fi

# 1. 检查并安装Node.js
echo -e "${BLUE}📦 检查Node.js安装...${NC}"
if ! command -v node &> /dev/null; then
    echo -e "${YELLOW}⚠️  Node.js未安装，正在安装...${NC}"
    curl -fsSL https://deb.nodesource.com/setup_18.x | bash -
    apt-get install -y nodejs
else
    echo -e "${GREEN}✅ Node.js已安装: $(node --version)${NC}"
fi

# 2. 检查并安装PM2
echo -e "${BLUE}📦 检查PM2安装...${NC}"
if ! command -v pm2 &> /dev/null; then
    echo -e "${YELLOW}⚠️  PM2未安装，正在安装...${NC}"
    npm install -g pm2
else
    echo -e "${GREEN}✅ PM2已安装: $(pm2 --version)${NC}"
fi

# 3. 创建应用目录
echo -e "${BLUE}📁 创建应用目录...${NC}"
APP_DIR="/opt/crm-wecom-api"
mkdir -p $APP_DIR
cd $APP_DIR

# 4. 检查部署包是否存在
echo -e "${BLUE}📦 检查部署包...${NC}"
DEPLOY_PACKAGE="crm-wecom-api-20250907-204221.tar.gz"
if [ ! -f "/opt/$DEPLOY_PACKAGE" ]; then
    echo -e "${RED}❌ 部署包不存在: /opt/$DEPLOY_PACKAGE${NC}"
    echo -e "${YELLOW}请先上传部署包到 /opt/ 目录${NC}"
    exit 1
fi

# 5. 解压部署包
echo -e "${BLUE}📦 解压部署包...${NC}"
tar -xzf "/opt/$DEPLOY_PACKAGE" -C $APP_DIR

# 6. 安装依赖
echo -e "${BLUE}📦 安装项目依赖...${NC}"
npm install --production

# 7. 配置环境变量
echo -e "${BLUE}⚙️  配置环境变量...${NC}"
if [ ! -f ".env" ]; then
    if [ -f "env.example" ]; then
        cp env.example .env
        echo -e "${YELLOW}⚠️  已创建 .env 文件，请编辑配置：${NC}"
        echo -e "${YELLOW}   nano .env${NC}"
        echo ""
        echo -e "${YELLOW}📋 需要配置的环境变量：${NC}"
        echo "   WECOM_CORP_ID=ww68a125fce698cb59"
        echo "   WECOM_AGENT_ID=1000002"
        echo "   WECOM_SECRET=your_actual_secret_here"
        echo "   WECOM_REDIRECT_URI=https://lead.vld.com.cn/api/auth/wecom/callback"
        echo "   PORT=3001"
        echo "   FRONTEND_URL=https://lead.vld.com.cn"
        echo "   NODE_ENV=production"
        echo ""
        read -p "按Enter键继续，或Ctrl+C退出编辑配置..."
    else
        echo -e "${RED}❌ 环境变量模板文件不存在${NC}"
        exit 1
    fi
else
    echo -e "${GREEN}✅ 环境变量文件已存在${NC}"
fi

# 8. 停止现有服务（如果存在）
echo -e "${BLUE}🛑 停止现有服务...${NC}"
pm2 delete crm-wecom-api 2>/dev/null || true

# 9. 启动服务
echo -e "${BLUE}🚀 启动服务...${NC}"
pm2 start server.js --name crm-wecom-api

# 10. 设置PM2开机自启
echo -e "${BLUE}⚙️  设置开机自启...${NC}"
pm2 startup | grep -E '^sudo' | bash || true
pm2 save

# 11. 检查服务状态
echo -e "${BLUE}🔍 检查服务状态...${NC}"
sleep 3
pm2 status

# 12. 测试API
echo -e "${BLUE}🧪 测试API接口...${NC}"
sleep 2
if curl -s https://lead.vld.com.cn/api/health | grep -q "success"; then
    echo -e "${GREEN}✅ API服务运行正常${NC}"
else
    echo -e "${YELLOW}⚠️  API服务可能未正常启动，请检查日志：${NC}"
    echo -e "${YELLOW}   pm2 logs crm-wecom-api${NC}"
fi

# 13. 显示部署信息
echo ""
echo -e "${GREEN}🎉 部署完成！${NC}"
echo "=============================="
echo -e "${BLUE}📋 服务信息：${NC}"
echo "   应用目录: $APP_DIR"
echo "   服务名称: crm-wecom-api"
echo "   端口: 3001"
echo "   进程管理: PM2"
echo ""
echo -e "${BLUE}🔧 常用命令：${NC}"
echo "   查看状态: pm2 status"
echo "   查看日志: pm2 logs crm-wecom-api"
echo "   重启服务: pm2 restart crm-wecom-api"
echo "   停止服务: pm2 stop crm-wecom-api"
echo ""
echo -e "${BLUE}🌐 测试地址：${NC}"
echo "   健康检查: https://lead.vld.com.cn/api/health"
echo "   二维码API: https://lead.vld.com.cn/api/auth/wecom/qrcode"
echo ""
echo -e "${YELLOW}⚠️  下一步：${NC}"
echo "   1. 配置SSL证书（如果需要）"
echo "   3. 测试企业微信回调"
echo "   4. 配置防火墙规则"
echo ""
echo -e "${GREEN}✅ 部署脚本执行完成！${NC}"