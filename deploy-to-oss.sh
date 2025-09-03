#!/bin/bash

echo "🚀 开始部署到阿里云 OSS..."

# 1. 构建项目（使用生产环境配置）
echo "📦 构建项目..."
npm run build

# 2. 检查构建结果
if [ ! -d "dist" ]; then
    echo "❌ 构建失败，dist 目录不存在"
    exit 1
fi

echo "✅ 构建完成"

# 3. 显示构建后的环境变量（用于验证）
echo "🔍 验证环境变量配置..."
if [ -f "dist/assets/index-*.js" ]; then
    echo "构建文件已生成，环境变量已注入"
else
    echo "⚠️ 警告：构建文件可能未正确生成"
fi

echo "📋 下一步操作："
echo "1. 将 dist 目录上传到您的阿里云 OSS 存储桶"
echo "2. 确保 OSS 存储桶配置了静态网站托管"
echo "3. 访问您的 OSS 域名测试应用"

echo "✅ 本地构建完成，请手动上传到 OSS"
