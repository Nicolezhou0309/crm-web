#!/bin/bash

# 重新构建和部署脚本
# 解决SPA路由刷新500错误问题

set -e

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}🚀 开始重新构建和部署...${NC}"

# 第一步：检查环境
echo -e "${YELLOW}📋 检查构建环境...${NC}"
if [ ! -f "package.json" ]; then
    echo -e "${RED}❌ 未找到package.json，请确保在项目根目录执行${NC}"
    exit 1
fi

# 第二步：安装依赖
echo -e "${YELLOW}📦 安装/更新依赖...${NC}"
npm install

# 第三步：构建前端项目
echo -e "${YELLOW}🔨 构建前端项目...${NC}"
npm run build

if [ ! -d "dist" ]; then
    echo -e "${RED}❌ 构建失败，未找到dist目录${NC}"
    exit 1
fi

echo -e "${GREEN}✅ 前端构建完成${NC}"

# 第四步：创建部署包
echo -e "${YELLOW}📦 创建部署包...${NC}"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
DEPLOY_PACKAGE="crm-web-spa-fix-${TIMESTAMP}.tar.gz"

# 创建临时目录
TEMP_DIR="/tmp/crm-deploy-${TIMESTAMP}"
mkdir -p "$TEMP_DIR"

# 复制前端构建文件
cp -r dist/* "$TEMP_DIR/"

# 复制Nginx配置
cp backend/nginx-spa-fix.conf "$TEMP_DIR/nginx.conf"

# 创建部署说明
cat > "$TEMP_DIR/DEPLOY_README.md" << EOF
# SPA路由修复部署包

## 部署内容
- 前端构建文件 (dist/)
- 修复后的Nginx配置 (nginx.conf)
- 部署说明文档

## 部署步骤
1. 解压部署包到服务器
2. 复制前端文件到 /var/www/html/
3. 更新Nginx配置
4. 重载Nginx服务

## 修复内容
- 支持SPA路由刷新
- 优化静态资源缓存
- 配置错误页面重定向
EOF

# 创建部署脚本
cat > "$TEMP_DIR/deploy.sh" << 'EOF'
#!/bin/bash
set -e

echo "🚀 开始部署SPA路由修复..."

# 备份现有文件
if [ -d "/var/www/html" ]; then
    echo "💾 备份现有前端文件..."
    sudo cp -r /var/www/html /var/www/html.backup.$(date +%Y%m%d_%H%M%S)
fi

# 部署前端文件
echo "📁 部署前端文件..."
sudo mkdir -p /var/www/html
sudo cp -r * /var/www/html/
sudo chown -R www-data:www-data /var/www/html

# 更新Nginx配置
echo "⚙️ 更新Nginx配置..."
sudo cp nginx.conf /etc/nginx/conf.d/crm-wecom-api.conf

# 测试配置
echo "🧪 测试Nginx配置..."
sudo nginx -t

if [ $? -eq 0 ]; then
    echo "✅ 配置测试通过，重载Nginx..."
    sudo systemctl reload nginx
    echo "🎉 部署完成！"
else
    echo "❌ 配置测试失败，请检查配置"
    exit 1
fi

echo "🧪 测试部署结果..."
curl -s -w "HTTP状态码: %{http_code}\n" https://lead-service.vld.com.cn/ -o /dev/null
curl -s -w "HTTP状态码: %{http_code}\n" https://lead-service.vld.com.cn/login -o /dev/null

echo "✅ 部署验证完成！"
EOF

chmod +x "$TEMP_DIR/deploy.sh"

# 打包
cd /tmp
tar -czf "$DEPLOY_PACKAGE" -C "$TEMP_DIR" .
cd - > /dev/null

# 移动到项目目录
mv "/tmp/$DEPLOY_PACKAGE" .

# 清理临时目录
rm -rf "$TEMP_DIR"

echo -e "${GREEN}✅ 部署包创建完成: $DEPLOY_PACKAGE${NC}"

# 第五步：显示部署说明
echo ""
echo -e "${BLUE}📋 部署说明:${NC}"
echo ""
echo -e "${YELLOW}1. 上传部署包到服务器:${NC}"
echo -e "   scp $DEPLOY_PACKAGE root@your-server:/tmp/"
echo ""
echo -e "${YELLOW}2. 在服务器上解压并部署:${NC}"
echo -e "   ssh root@your-server"
echo -e "   cd /tmp"
echo -e "   tar -xzf $DEPLOY_PACKAGE"
echo -e "   sudo ./deploy.sh"
echo ""
echo -e "${YELLOW}3. 验证修复效果:${NC}"
echo -e "   - 访问 https://lead-service.vld.com.cn/login"
echo -e "   - 刷新页面，应该不再出现500错误"
echo -e "   - 测试其他前端路由的刷新功能"
echo ""
echo -e "${GREEN}🎉 重新构建完成！现在可以部署到服务器了${NC}"
