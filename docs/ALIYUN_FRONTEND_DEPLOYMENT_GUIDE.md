# 阿里云前端部署指南

## 🎯 为什么选择阿里云部署？

### ✅ 完美解决混合内容问题
- 您的Supabase已在阿里云（`47.123.26.25:8000`）
- 前端同样部署到阿里云，同一网络环境
- **无需HTTPS代理**，直接使用HTTP连接
- **完全避免混合内容错误**

### 🚀 性能与成本优势
- 国内访问速度更快，用户体验更好
- 与Supabase同区域，延迟更低
- 成本比Vercel更优惠
- CDN加速覆盖全国

## 📋 部署方案选择

### 方案1：OSS静态托管 + CDN（推荐）
**适用场景**: 纯前端SPA应用
**优势**: 简单、便宜、性能好
**成本**: ~几元/月

### 方案2：函数计算托管
**适用场景**: 需要服务端渲染或API集成
**优势**: 与后端统一管理
**成本**: 按量计费

### 方案3：ECS服务器
**适用场景**: 复杂部署需求
**优势**: 最大灵活性
**成本**: ~几十元/月

## 🚀 方案1：OSS静态托管部署（推荐）

### 1. 准备阿里云资源

#### 创建OSS存储桶
```bash
# 登录阿里云控制台
# 对象存储OSS → 创建存储桶
# 区域：华东1（杭州）或华东2（上海）
# 存储桶名称：your-app-name-frontend
# 读写权限：公共读
```

#### 开通CDN服务
```bash
# CDN → 域名管理 → 添加域名
# 加速域名：your-domain.com
# 源站类型：OSS域名
# 源站域名：选择刚创建的OSS存储桶
```

### 2. 配置环境变量

创建 `.env.production` 文件：
```env
# Supabase配置（阿里云同区域，无混合内容问题）
VITE_SUPABASE_URL=http://47.123.26.25:8000
VITE_SUPABASE_ANON_KEY=eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJyb2xlIjoiYW5vbiIsInJlZiI6InNicC04b2gxOG0wM2hiYjA4N3RhIiwiaXNzIjoic3VwYWJhc2UiLCJpYXQiOjE3NTU0MjI4MjEsImV4cCI6MjA3MDk5ODgyMX0.TMNhVSwNgrJHxRKQnV-GVzX_EovIQ6EIg2vXdQEWRgE
VITE_SUPABASE_SERVICE_ROLE_KEY=eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJyb2xlIjoiYW5vbiIsInJlZiI6InNicC04b2gxOG0wM2hiYjA4N3RhIiwiaXNzIjoic3VwYWJhc2UiLCJpYXQiOjE3NTU0MjI4MjEsImV4cCI6MjA3MDk5ODgyMX0.TMNhVSwNgrJHxRKQnV-GVzX_EovIQ6EIg2vXdQEWRgE

# 企业微信配置
VITE_WECOM_CORP_ID=ww68a125fce698cb59
VITE_WECOM_AGENT_ID=1000002
VITE_WECOM_REDIRECT_URI=https://your-domain.com/auth/wecom/callback
```

### 3. 构建和部署

#### 自动部署脚本
```bash
#!/bin/bash
# deploy-to-aliyun.sh

echo "🚀 开始部署到阿里云OSS..."

# 1. 构建项目
echo "📦 构建项目..."
npm run build

# 2. 安装阿里云CLI（如果未安装）
if ! command -v aliyun &> /dev/null; then
    echo "⬇️ 安装阿里云CLI..."
    # macOS
    if [[ "$OSTYPE" == "darwin"* ]]; then
        brew install aliyun-cli
    else
        echo "请手动安装阿里云CLI: https://help.aliyun.com/zh/cli/"
        exit 1
    fi
fi

# 3. 配置OSS（如果未配置）
echo "⚙️ 配置OSS..."
read -p "请输入OSS存储桶名称: " BUCKET_NAME
read -p "请输入OSS区域（如：oss-cn-shanghai）: " OSS_REGION

# 4. 同步文件到OSS
echo "☁️ 上传文件到OSS..."
aliyun oss sync dist/ oss://$BUCKET_NAME/ \
  --region $OSS_REGION \
  --recursive \
  --delete

# 5. 设置静态网站托管
echo "🌐 配置静态网站托管..."
aliyun oss website oss://$BUCKET_NAME/ \
  --index-document index.html \
  --error-document index.html \
  --region $OSS_REGION

echo "✅ 部署完成！"
echo "📱 访问地址: http://$BUCKET_NAME.$OSS_REGION.aliyuncs.com"
```

#### 手动部署步骤
```bash
# 1. 构建项目
npm run build

# 2. 压缩dist文件夹
tar -czf dist.tar.gz dist/

# 3. 登录阿里云控制台
# 对象存储OSS → 选择存储桶 → 文件管理
# 上传 dist.tar.gz 并解压

# 4. 配置静态网站托管
# 存储桶 → 基础设置 → 静态页面
# 默认首页：index.html
# 默认404页：index.html（支持SPA路由）
```

### 4. 配置自定义域名

#### 域名解析
```bash
# 1. 在阿里云域名控制台添加CNAME记录
# 记录类型：CNAME
# 主机记录：www（或@）
# 记录值：your-bucket.oss-cn-shanghai.aliyuncs.com

# 2. 在OSS控制台绑定域名
# 存储桶 → 传输管理 → 域名管理 → 绑定域名
# 域名：www.your-domain.com
# HTTPS：可选（需要SSL证书）
```

#### SSL证书配置（可选）
```bash
# 1. 申请免费SSL证书
# 阿里云控制台 → SSL证书 → 免费证书

# 2. 在CDN中配置HTTPS
# CDN → 域名管理 → 选择域名 → HTTPS配置
# 上传SSL证书
# 强制HTTPS跳转：开启
```

## 🚀 方案2：函数计算托管

### 1. 创建函数计算应用

```bash
# 1. 创建应用目录
mkdir aliyun-fc-frontend
cd aliyun-fc-frontend

# 2. 创建package.json
cat > package.json << EOF
{
  "name": "crm-frontend",
  "version": "1.0.0",
  "scripts": {
    "build": "vite build",
    "deploy": "fun deploy"
  },
  "dependencies": {
    "express": "^4.18.0"
  }
}
EOF

# 3. 创建函数入口
cat > index.js << EOF
const express = require('express');
const path = require('path');

const app = express();

// 静态文件服务
app.use(express.static(path.join(__dirname, 'dist')));

// SPA路由支持
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'dist', 'index.html'));
});

module.exports.handler = app;
EOF
```

### 2. 配置template.yml

```yaml
ROSTemplateFormatVersion: '2015-09-01'
Transform: 'Aliyun::Serverless-2018-04-03'

Resources:
  frontend:
    Type: 'Aliyun::Serverless::Service'
    Properties:
      Description: 'CRM前端应用'
    
    frontend-app:
      Type: 'Aliyun::Serverless::Function'
      Properties:
        Description: 'CRM前端函数'
        CodeUri: './'
        Handler: index.handler
        Runtime: nodejs18
        MemorySize: 512
        Timeout: 30
      Events:
        http-trigger:
          Type: HTTP
          Properties:
            AuthType: ANONYMOUS
            Methods: ['GET', 'POST']
```

### 3. 部署函数

```bash
# 1. 安装Fun工具
npm install -g @alicloud/fun

# 2. 配置凭证
fun config

# 3. 复制构建文件
cp -r ../dist ./

# 4. 部署
fun deploy
```

## 🚀 方案3：ECS服务器部署

### 1. 创建ECS实例

```bash
# 阿里云控制台 → 云服务器ECS → 实例
# 规格：1核2GB（够用）
# 镜像：Ubuntu 22.04 LTS
# 网络：VPC网络
# 安全组：开放80、443、22端口
```

### 2. 服务器环境配置

```bash
# 1. 连接服务器
ssh root@your-server-ip

# 2. 安装Node.js
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs

# 3. 安装Nginx
sudo apt update
sudo apt install -y nginx

# 4. 安装PM2
npm install -g pm2
```

### 3. 部署应用

```bash
# 1. 克隆代码
git clone https://github.com/your-username/crm-web.git
cd crm-web

# 2. 安装依赖
npm install

# 3. 构建项目
npm run build

# 4. 配置Nginx
sudo cat > /etc/nginx/sites-available/crm-web << EOF
server {
    listen 80;
    server_name your-domain.com;
    root /path/to/crm-web/dist;
    index index.html;

    location / {
        try_files \$uri \$uri/ /index.html;
    }
}
EOF

# 5. 启用站点
sudo ln -s /etc/nginx/sites-available/crm-web /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx
```

## 📊 方案对比

| 特性 | OSS托管 | 函数计算 | ECS服务器 |
|------|---------|----------|-----------|
| 成本 | 极低 | 低 | 中等 |
| 性能 | 高 | 高 | 高 |
| 扩展性 | 自动 | 自动 | 手动 |
| 维护成本 | 极低 | 低 | 高 |
| 配置复杂度 | 简单 | 中等 | 复杂 |
| 推荐指数 | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐ | ⭐⭐⭐ |

## 🎯 推荐选择

对于您的CRM系统，我强烈推荐**方案1：OSS静态托管**，因为：

1. **完美解决混合内容问题** - 与Supabase同在阿里云
2. **成本最低** - 几元/月即可
3. **性能最好** - CDN加速，全国访问快速
4. **维护简单** - 几乎无需运维
5. **高可用** - 阿里云基础设施保障

## 🔄 自动化部署

创建 GitHub Actions 工作流：

```yaml
# .github/workflows/deploy-aliyun.yml
name: Deploy to Aliyun OSS

on:
  push:
    branches: [ main ]

jobs:
  deploy:
    runs-on: ubuntu-latest
    
    steps:
    - uses: actions/checkout@v3
    
    - name: Setup Node.js
      uses: actions/setup-node@v3
      with:
        node-version: '18'
        
    - name: Install dependencies
      run: npm ci
      
    - name: Build
      run: npm run build
      
    - name: Deploy to OSS
      uses: fangbinwei/aliyun-oss-website-action@v1
      with:
        accessKeyId: ${{ secrets.ACCESS_KEY_ID }}
        accessKeySecret: ${{ secrets.ACCESS_KEY_SECRET }}
        bucket: your-bucket-name
        endpoint: oss-cn-shanghai.aliyuncs.com
        folder: dist
```

这样您就可以实现推送代码后自动部署到阿里云了！
