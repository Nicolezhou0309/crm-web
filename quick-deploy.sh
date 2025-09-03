#!/bin/bash

# 快速部署脚本 - 简化版本
# 使用方法: ./quick-deploy.sh your-bucket-name oss-cn-shanghai

set -e

BUCKET_NAME=${1:-"crm-web-frontend"}
OSS_REGION=${2:-"oss-cn-shanghai"}

echo "🚀 快速部署到阿里云OSS..."
echo "存储桶: $BUCKET_NAME"
echo "区域: $OSS_REGION"
echo ""

# 1. 构建项目
echo "📦 构建项目..."
npm run build

# 2. 检查阿里云CLI
if ! command -v aliyun &> /dev/null; then
    echo "❌ 请先安装阿里云CLI: https://help.aliyun.com/zh/cli/"
    exit 1
fi

# 3. 创建存储桶（如果不存在）
echo "🔍 检查存储桶..."
if ! aliyun oss ls oss://$BUCKET_NAME --region $OSS_REGION &> /dev/null; then
    echo "📦 创建存储桶..."
    aliyun oss mb oss://$BUCKET_NAME --region $OSS_REGION
fi

# 4. 上传文件
echo "☁️  上传文件..."
aliyun oss sync dist/ oss://$BUCKET_NAME/ \
    --region $OSS_REGION \
    --recursive \
    --delete

# 5. 配置静态网站
echo "🌐 配置静态网站..."
aliyun oss website oss://$BUCKET_NAME/ \
    --index-document index.html \
    --error-document index.html \
    --region $OSS_REGION

# 6. 设置权限
echo "🔐 设置权限..."
aliyun oss chmod oss://$BUCKET_NAME/ --recursive --acl public-read --region $OSS_REGION

echo ""
echo "✅ 部署完成！"
echo "🌐 访问地址: http://$BUCKET_NAME.$OSS_REGION.aliyuncs.com"
