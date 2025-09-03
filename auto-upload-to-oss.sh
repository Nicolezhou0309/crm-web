#!/bin/bash

# 阿里云 OSS 自动上传脚本
# 使用方法：./auto-upload-to-oss.sh

echo "🚀 开始自动上传到阿里云 OSS..."

# 设置PATH
export PATH="$HOME/bin:$PATH"

# 检查阿里云CLI是否可用
if ! command -v aliyun &> /dev/null; then
    echo "❌ 阿里云CLI未找到，请先安装"
    exit 1
fi

# 检查构建文件是否存在
if [ ! -d "dist" ]; then
    echo "❌ dist目录不存在，请先运行 npm run build"
    exit 1
fi

echo "✅ 构建文件检查完成"

# 配置信息（请填入您的信息）
echo "📋 请提供以下配置信息："
read -p "请输入您的 Access Key ID: " ACCESS_KEY_ID
read -p "请输入您的 Access Key Secret: " ACCESS_KEY_SECRET
read -p "请输入OSS存储桶名称: " BUCKET_NAME
read -p "请输入OSS区域 (如: oss-cn-shanghai): " OSS_REGION

# 验证输入
if [ -z "$ACCESS_KEY_ID" ] || [ -z "$ACCESS_KEY_SECRET" ] || [ -z "$BUCKET_NAME" ] || [ -z "$OSS_REGION" ]; then
    echo "❌ 配置信息不完整，请重新运行脚本"
    exit 1
fi

echo "🔧 配置阿里云CLI..."
# 配置阿里云CLI
aliyun configure set \
    --profile default \
    --mode AK \
    --access-key-id "$ACCESS_KEY_ID" \
    --access-key-secret "$ACCESS_KEY_SECRET" \
    --region "$OSS_REGION" \
    --language zh

if [ $? -ne 0 ]; then
    echo "❌ 阿里云CLI配置失败"
    exit 1
fi

echo "✅ 阿里云CLI配置完成"

# 测试连接
echo "🔍 测试OSS连接..."
aliyun oss ls oss://$BUCKET_NAME/ --region $OSS_REGION > /dev/null 2>&1

if [ $? -ne 0 ]; then
    echo "❌ OSS连接失败，请检查存储桶名称和权限"
    exit 1
fi

echo "✅ OSS连接测试成功"

# 上传文件
echo "📤 开始上传文件到OSS..."
aliyun oss sync dist/ oss://$BUCKET_NAME/ \
    --region $OSS_REGION \
    --recursive \
    --delete \
    --force

if [ $? -ne 0 ]; then
    echo "❌ 文件上传失败"
    exit 1
fi

echo "✅ 文件上传完成"

# 配置静态网站托管
echo "🌐 配置静态网站托管..."
aliyun oss website oss://$BUCKET_NAME/ \
    --index-document index.html \
    --error-document index.html \
    --region $OSS_REGION

if [ $? -ne 0 ]; then
    echo "⚠️ 静态网站托管配置失败，请手动在控制台配置"
else
    echo "✅ 静态网站托管配置完成"
fi

# 获取访问地址
echo "🎉 部署完成！"
echo "📱 访问地址: http://$BUCKET_NAME.$OSS_REGION.aliyuncs.com"
echo ""
echo "📋 下一步："
echo "1. 访问上述地址测试应用"
echo "2. 测试登录功能是否正常"
echo "3. 如有问题，请检查浏览器控制台错误信息"
echo ""
echo "🔧 如需配置自定义域名，请在阿里云控制台进行设置"
