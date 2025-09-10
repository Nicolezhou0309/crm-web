#!/bin/bash

# PM2服务部署检查脚本
# 用于检查PM2服务状态和Nginx配置

echo "🔍 PM2服务部署检查开始..."

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# 检查PM2是否安装
echo -e "${BLUE}📋 检查PM2安装状态...${NC}"
if command -v pm2 &> /dev/null; then
    echo -e "${GREEN}✅ PM2已安装${NC}"
    pm2 --version
else
    echo -e "${RED}❌ PM2未安装，请先安装PM2${NC}"
    echo "安装命令: npm install -g pm2"
    exit 1
fi

# 检查PM2服务状态
echo -e "\n${BLUE}📋 检查PM2服务状态...${NC}"
pm2 list

# 检查API服务是否运行在3001端口
echo -e "\n${BLUE}📋 检查端口3001占用情况...${NC}"
if netstat -tlnp | grep :3001 > /dev/null; then
    echo -e "${GREEN}✅ 端口3001已被占用${NC}"
    netstat -tlnp | grep :3001
else
    echo -e "${RED}❌ 端口3001未被占用，API服务可能未启动${NC}"
fi

# 检查API服务健康状态
echo -e "\n${BLUE}📋 检查API服务健康状态...${NC}"
if curl -s https://lead.vld.com.cn/api/health > /dev/null; then
    echo -e "${GREEN}✅ API服务健康检查通过${NC}"
    curl -s https://lead.vld.com.cn/api/health | jq .
else
    echo -e "${RED}❌ API服务健康检查失败${NC}"
    echo "请检查API服务是否正常运行"
fi

# 检查域名解析
echo -e "\n${BLUE}📋 检查域名解析...${NC}"
if nslookup lead-service.vld.com.cn > /dev/null 2>&1; then
    echo -e "${GREEN}✅ 域名解析正常${NC}"
    nslookup lead-service.vld.com.cn
else
    echo -e "${RED}❌ 域名解析失败${NC}"
    echo "请检查域名配置"
fi

# 检查防火墙设置
echo -e "\n${BLUE}📋 检查防火墙设置...${NC}"
if command -v ufw &> /dev/null; then
    echo "UFW防火墙状态:"
    ufw status
elif command -v firewall-cmd &> /dev/null; then
    echo "FirewallD状态:"
    firewall-cmd --list-all
else
    echo -e "${YELLOW}⚠️  未检测到防火墙管理工具${NC}"
fi

# 检查日志文件
echo -e "\n${BLUE}📋 检查相关日志文件...${NC}"
echo "PM2日志:"
pm2 logs --lines 10

echo -e "\nPM2错误日志 (最近10行):"
pm2 logs --err --lines 10

# 测试API端点
echo -e "\n${BLUE}📋 测试API端点...${NC}"
echo "测试健康检查端点:"
curl -s https://lead.vld.com.cn/api/health || echo -e "${RED}❌ 健康检查失败${NC}"

echo -e "\n测试企业微信二维码生成:"
curl -s -X GET "https://lead.vld.com.cn/api/auth/wecom/qrcode" | jq . || echo -e "${RED}❌ 二维码生成失败${NC}"

# 提供修复建议
echo -e "\n${BLUE}📋 修复建议:${NC}"
echo "1. 如果PM2服务未运行，使用以下命令启动:"
echo "   cd /path/to/your/backend"
echo "   pm2 start server.js --name crm-api"
echo "   pm2 save"
echo "   pm2 startup"

echo -e "\n2. 如果API无法访问，检查以下配置:"
echo "   - 确保域名解析正确: nslookup lead-service.vld.com.cn"
echo "   - 确保端口已开放: sudo ufw allow [PORT]"
echo "   - 确保服务正在运行: pm2 list"

echo -e "\n3. 检查环境变量配置:"
echo "   确保.env文件包含所有必要的环境变量"

echo -e "\n${GREEN}🎉 PM2服务部署检查完成！${NC}"
