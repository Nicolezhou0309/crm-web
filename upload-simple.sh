#!/bin/bash

echo "🚀 开始上传CRM Web应用到阿里云..."

# 检查是否安装了阿里云CLI
if ! command -v aliyun &> /dev/null; then
    echo "❌ 阿里云CLI未安装，请先安装："
    echo "npm install -g @alicloud/cli"
    exit 1
fi

# 压缩文件
echo "📦 压缩文件..."
tar -czf crm-web.tar.gz -C dist .

# 上传到OSS（需要您配置bucket名称）
echo "📤 上传到阿里云OSS..."
aliyun oss cp crm-web.tar.gz oss://your-bucket-name/crm-web.tar.gz

# 解压到服务器（需要SSH访问）
echo "🔧 解压到服务器..."
ssh root@8.159.132.181 "cd /var/www/crm-web && wget https://your-bucket-name.oss-cn-shanghai.aliyuncs.com/crm-web.tar.gz && tar -xzf crm-web.tar.gz && rm crm-web.tar.gz"

echo "✅ 上传完成！"
