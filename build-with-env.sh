#!/bin/bash

# CRM Web 生产环境构建脚本
# 用于烘焙环境变量并构建项目

set -e  # 遇到错误立即退出

echo "🚀 开始构建 CRM Web 生产版本..."

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# 检查环境变量文件
if [ ! -f ".env" ]; then
    echo -e "${YELLOW}⚠️  未找到 .env 文件${NC}"
    echo -e "${YELLOW}📋 请先创建 .env 文件并配置环境变量${NC}"
    exit 1
fi

echo -e "${GREEN}✅ 找到环境变量文件: .env${NC}"

# 显示环境变量（隐藏敏感信息）
echo -e "${YELLOW}📋 环境变量配置:${NC}"
echo "  VITE_SUPABASE_URL: $(grep VITE_SUPABASE_URL .env | cut -d'=' -f2 | sed 's/.*/***/')"
echo "  VITE_WECOM_CORP_ID: $(grep VITE_WECOM_CORP_ID .env | cut -d'=' -f2 | sed 's/.*/***/')"
echo "  NODE_ENV: production"
echo ""

# 清理之前的构建
echo -e "${YELLOW}🧹 清理之前的构建...${NC}"
rm -rf dist/

# 使用生产环境变量构建
echo -e "${YELLOW}🔨 开始构建项目...${NC}"
NODE_ENV=production npm run build

# 检查构建结果
if [ -d "dist" ] && [ -f "dist/index.html" ]; then
    echo -e "${GREEN}✅ 构建成功！${NC}"
    echo ""
    echo -e "${GREEN}📊 构建统计:${NC}"
    echo "  总文件数: $(find dist -type f | wc -l)"
    echo "  总大小: $(du -sh dist | cut -f1)"
    echo "  HTML文件: $(ls -la dist/*.html 2>/dev/null | wc -l)"
    echo "  JS文件: $(ls -la dist/assets/js/*.js 2>/dev/null | wc -l)"
    echo "  CSS文件: $(ls -la dist/assets/css/*.css 2>/dev/null | wc -l)"
    echo ""
    
    # 创建压缩包
    TIMESTAMP=$(date +%Y%m%d-%H%M%S)
    ARCHIVE_NAME="crm-web-server-env-${TIMESTAMP}.tar.gz"
    
    echo -e "${YELLOW}📦 创建服务器压缩包...${NC}"
    tar -czf $ARCHIVE_NAME dist/ package.json server-deploy.sh nginx-cache.conf .env
    
    echo -e "${GREEN}✅ 压缩包创建完成: $ARCHIVE_NAME${NC}"
    echo -e "${GREEN}📁 文件大小: $(du -sh $ARCHIVE_NAME | cut -f1)${NC}"
    echo ""
    echo -e "${GREEN}🎉 构建完成！${NC}"
    echo -e "${YELLOW}📋 下一步:${NC}"
    echo "  1. 上传 $ARCHIVE_NAME 到服务器"
    echo "  2. 解压并运行 ./server-deploy.sh 部署"
    echo "  3. 环境变量已烘焙到构建文件中"
    
else
    echo -e "${RED}❌ 构建失败！${NC}"
    exit 1
fi
