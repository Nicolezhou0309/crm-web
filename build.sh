#!/bin/bash

# CRM Web 应用构建脚本
# 用于阿里云函数计算部署

set -e

echo "🚀 开始构建CRM Web应用..."

# 1. 检查Node.js版本
echo "📋 检查Node.js版本..."
node --version
npm --version

# 2. 安装所有依赖（包括开发依赖）
echo "📦 安装项目依赖..."
npm ci

# 3. 使用兼容的构建命令
echo "🔨 构建项目..."
# 跳过TypeScript编译，直接使用Vite构建
npx vite build

# 4. 验证构建结果
if [ ! -d "dist" ]; then
    echo "❌ 构建失败，dist目录不存在"
    exit 1
fi

echo "✅ 构建完成！"
echo "📁 构建文件："
ls -la dist/

echo "🎉 准备部署到阿里云函数计算..."
