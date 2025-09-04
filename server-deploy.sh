#!/bin/bash

# CRM Web 服务器部署脚本
# 使用方法: ./server-deploy.sh

set -e  # 遇到错误立即退出

echo "🚀 开始部署 CRM Web 应用..."

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# 配置变量
WEB_ROOT="/var/www/html"
BACKUP_DIR="/var/www/backup"
TEMP_DIR="/tmp"

echo -e "${YELLOW}📋 部署配置:${NC}"
echo "  Web 根目录: $WEB_ROOT"
echo "  备份目录: $BACKUP_DIR"
echo "  临时目录: $TEMP_DIR"
echo ""

# 第一步：检查压缩包
echo -e "${YELLOW}🔍 检查部署文件...${NC}"
cd $TEMP_DIR
DIST_FILE=$(ls crm-web-dist-*.tar.gz 2>/dev/null | head -1)

if [ -z "$DIST_FILE" ]; then
    echo -e "${RED}❌ 未找到部署压缩包，请先上传 crm-web-dist-*.tar.gz 到 $TEMP_DIR${NC}"
    exit 1
fi

echo -e "${GREEN}✅ 找到部署文件: $DIST_FILE${NC}"

# 第二步：备份现有网站
echo -e "${YELLOW}💾 备份现有网站...${NC}"
if [ -d "$WEB_ROOT" ] && [ "$(ls -A $WEB_ROOT)" ]; then
    BACKUP_NAME="html-backup-$(date +%Y%m%d-%H%M%S)"
    sudo mkdir -p $BACKUP_DIR
    sudo cp -r $WEB_ROOT $BACKUP_DIR/$BACKUP_NAME
    echo -e "${GREEN}✅ 现有网站已备份到: $BACKUP_DIR/$BACKUP_NAME${NC}"
else
    echo -e "${YELLOW}⚠️  没有现有网站需要备份${NC}"
fi

# 第三步：解压新文件
echo -e "${YELLOW}📦 解压部署文件...${NC}"
tar -xzf $DIST_FILE
echo -e "${GREEN}✅ 文件解压完成${NC}"

# 第四步：部署到网站目录
echo -e "${YELLOW}🚀 部署到网站目录...${NC}"
sudo mkdir -p $WEB_ROOT
sudo cp -r ./* $WEB_ROOT/
echo -e "${GREEN}✅ 文件部署完成${NC}"

# 第五步：设置权限
echo -e "${YELLOW}🔐 设置文件权限...${NC}"
sudo chown -R www-data:www-data $WEB_ROOT
sudo chmod -R 755 $WEB_ROOT
echo -e "${GREEN}✅ 权限设置完成${NC}"

# 第六步：配置 Nginx（如果存在）
echo -e "${YELLOW}⚙️  配置 Web 服务器...${NC}"
if command -v nginx &> /dev/null; then
    echo "检测到 Nginx，配置 SPA 路由..."
    
    # 创建 Nginx 配置
    sudo tee /etc/nginx/sites-available/crm-web > /dev/null <<EOF
server {
    listen 80;
    server_name _;
    
    root $WEB_ROOT;
    index index.html;
    
    # 处理 SPA 路由
    location / {
        try_files \$uri \$uri/ /index.html;
    }
    
    # 静态资源缓存
    location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2|ttf|eot)$ {
        expires 1y;
        add_header Cache-Control "public, immutable";
    }
    
    # Gzip 压缩
    gzip on;
    gzip_vary on;
    gzip_min_length 1024;
    gzip_types text/plain text/css text/xml text/javascript application/javascript application/xml+rss application/json;
}
EOF
    
    # 启用站点
    sudo ln -sf /etc/nginx/sites-available/crm-web /etc/nginx/sites-enabled/
    sudo rm -f /etc/nginx/sites-enabled/default
    
    # 测试配置
    sudo nginx -t
    if [ $? -eq 0 ]; then
        sudo systemctl restart nginx
        echo -e "${GREEN}✅ Nginx 配置并重启成功${NC}"
    else
        echo -e "${RED}❌ Nginx 配置测试失败${NC}"
        exit 1
    fi
    
elif command -v apache2 &> /dev/null; then
    echo "检测到 Apache，配置 SPA 路由..."
    
    # 创建 .htaccess 文件
    sudo tee $WEB_ROOT/.htaccess > /dev/null <<EOF
RewriteEngine On
RewriteBase /

# 处理 SPA 路由
RewriteCond %{REQUEST_FILENAME} !-f
RewriteCond %{REQUEST_FILENAME} !-d
RewriteRule . /index.html [L]

# 静态资源缓存
<FilesMatch "\.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2|ttf|eot)$">
    ExpiresActive On
    ExpiresDefault "access plus 1 year"
    Header set Cache-Control "public, immutable"
</FilesMatch>
EOF
    
    sudo systemctl restart apache2
    echo -e "${GREEN}✅ Apache 配置并重启成功${NC}"
else
    echo -e "${YELLOW}⚠️  未检测到 Nginx 或 Apache，请手动配置 Web 服务器${NC}"
fi

# 第七步：清理临时文件
echo -e "${YELLOW}🧹 清理临时文件...${NC}"
rm -rf $TEMP_DIR/crm-web-dist-*
rm -rf $TEMP_DIR/assets
rm -rf $TEMP_DIR/*.svg
rm -rf $TEMP_DIR/*.json
rm -rf $TEMP_DIR/*.wav
rm -rf $TEMP_DIR/*.html
echo -e "${GREEN}✅ 临时文件清理完成${NC}"

# 第八步：验证部署
echo -e "${YELLOW}🔍 验证部署结果...${NC}"
if [ -f "$WEB_ROOT/index.html" ]; then
    echo -e "${GREEN}✅ 部署成功！网站文件已就位${NC}"
    echo ""
    echo -e "${GREEN}📊 部署信息:${NC}"
    echo "  网站目录: $WEB_ROOT"
    echo "  主页面: $WEB_ROOT/index.html"
    echo "  文件数量: $(find $WEB_ROOT -type f | wc -l)"
    echo "  总大小: $(du -sh $WEB_ROOT | cut -f1)"
    echo ""
    echo -e "${GREEN}🌐 访问地址:${NC}"
    echo "  http://$(curl -s ifconfig.me 2>/dev/null || echo 'your-server-ip')"
    echo ""
    echo -e "${GREEN}🎉 部署完成！${NC}"
else
    echo -e "${RED}❌ 部署失败，index.html 文件不存在${NC}"
    exit 1
fi
