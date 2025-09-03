#!/bin/bash

# 阿里云OSS部署脚本
# 使用方法: ./deploy-to-aliyun.sh

set -e  # 遇到错误立即退出

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# 打印带颜色的消息
print_message() {
    echo -e "${1}${2}${NC}"
}

print_message $BLUE "🚀 开始部署CRM系统到阿里云OSS..."
echo "=================================="

# 1. 检查环境
print_message $BLUE "📋 检查部署环境..."

# 检查Node.js
if ! command -v node &> /dev/null; then
    print_message $RED "❌ Node.js 未安装，请先安装 Node.js 18+"
    exit 1
fi

NODE_VERSION=$(node --version | cut -d'v' -f2 | cut -d'.' -f1)
if [ "$NODE_VERSION" -lt 18 ]; then
    print_message $RED "❌ Node.js 版本过低，需要 18+，当前版本: $(node --version)"
    exit 1
fi
print_message $GREEN "✅ Node.js 版本: $(node --version)"

# 检查npm
if ! command -v npm &> /dev/null; then
    print_message $RED "❌ npm 未安装"
    exit 1
fi
print_message $GREEN "✅ npm 版本: $(npm --version)"

# 2. 安装依赖
print_message $BLUE "📦 安装项目依赖..."
npm ci
print_message $GREEN "✅ 依赖安装完成"

# 3. 构建项目
print_message $BLUE "🔨 构建项目..."
npm run build
print_message $GREEN "✅ 项目构建完成"

# 4. 检查构建结果
if [ ! -d "dist" ]; then
    print_message $RED "❌ 构建失败，dist 目录不存在"
    exit 1
fi

print_message $GREEN "✅ 构建文件检查通过"
ls -la dist/

# 5. 检查阿里云CLI
print_message $BLUE "🔍 检查阿里云CLI..."

if ! command -v aliyun &> /dev/null; then
    print_message $YELLOW "⚠️  阿里云CLI未安装，正在安装..."
    
    # 检测操作系统
    if [[ "$OSTYPE" == "darwin"* ]]; then
        # macOS
        if command -v brew &> /dev/null; then
            brew install aliyun-cli
        else
            print_message $RED "❌ 请先安装 Homebrew 或手动安装阿里云CLI"
            print_message $YELLOW "手动安装: https://help.aliyun.com/zh/cli/"
            exit 1
        fi
    elif [[ "$OSTYPE" == "linux-gnu"* ]]; then
        # Linux
        curl -o aliyun-cli-linux-latest-amd64.tgz https://aliyuncli.alicdn.com/aliyun-cli-linux-latest-amd64.tgz
        tar -xzf aliyun-cli-linux-latest-amd64.tgz
        sudo mv aliyun /usr/local/bin/
        rm aliyun-cli-linux-latest-amd64.tgz
    else
        print_message $RED "❌ 不支持的操作系统，请手动安装阿里云CLI"
        exit 1
    fi
fi

print_message $GREEN "✅ 阿里云CLI已就绪"

# 6. 配置阿里云CLI（如果未配置）
print_message $BLUE "⚙️  检查阿里云CLI配置..."

if ! aliyun configure list &> /dev/null; then
    print_message $YELLOW "⚠️  阿里云CLI未配置，请配置访问凭证..."
    echo ""
    echo "请准备以下信息："
    echo "1. AccessKey ID"
    echo "2. AccessKey Secret"
    echo "3. 默认区域（推荐：cn-shanghai）"
    echo ""
    read -p "是否现在配置？(y/n): " configure_now
    
    if [ "$configure_now" = "y" ] || [ "$configure_now" = "Y" ]; then
        aliyun configure
    else
        print_message $RED "❌ 请先配置阿里云CLI: aliyun configure"
        exit 1
    fi
fi

print_message $GREEN "✅ 阿里云CLI配置完成"

# 7. 获取OSS配置信息
print_message $BLUE "📝 配置OSS部署参数..."

echo ""
echo "请输入OSS配置信息："
read -p "OSS存储桶名称: " BUCKET_NAME
read -p "OSS区域 (如: oss-cn-shanghai): " OSS_REGION
read -p "是否启用CDN加速？(y/n): " ENABLE_CDN

if [ -z "$BUCKET_NAME" ] || [ -z "$OSS_REGION" ]; then
    print_message $RED "❌ 存储桶名称和区域不能为空"
    exit 1
fi

# 8. 检查存储桶是否存在
print_message $BLUE "🔍 检查OSS存储桶..."
if ! aliyun oss ls oss://$BUCKET_NAME --region $OSS_REGION &> /dev/null; then
    print_message $YELLOW "⚠️  存储桶不存在，正在创建..."
    aliyun oss mb oss://$BUCKET_NAME --region $OSS_REGION
    print_message $GREEN "✅ 存储桶创建完成"
else
    print_message $GREEN "✅ 存储桶已存在"
fi

# 9. 上传文件到OSS
print_message $BLUE "☁️  上传文件到OSS..."
aliyun oss sync dist/ oss://$BUCKET_NAME/ \
    --region $OSS_REGION \
    --recursive \
    --delete \
    --force

print_message $GREEN "✅ 文件上传完成"

# 10. 配置静态网站托管
print_message $BLUE "🌐 配置静态网站托管..."
aliyun oss website oss://$BUCKET_NAME/ \
    --index-document index.html \
    --error-document index.html \
    --region $OSS_REGION

print_message $GREEN "✅ 静态网站托管配置完成"

# 11. 设置文件权限
print_message $BLUE "🔐 设置文件访问权限..."
aliyun oss chmod oss://$BUCKET_NAME/ --recursive --acl public-read --region $OSS_REGION

print_message $GREEN "✅ 文件权限设置完成"

# 12. 显示访问信息
print_message $GREEN "🎉 部署完成！"
echo "=================================="
echo ""
print_message $BLUE "📱 访问信息："
echo "OSS访问地址: http://$BUCKET_NAME.$OSS_REGION.aliyuncs.com"
echo "存储桶名称: $BUCKET_NAME"
echo "区域: $OSS_REGION"
echo ""

# 13. CDN配置提示
if [ "$ENABLE_CDN" = "y" ] || [ "$ENABLE_CDN" = "Y" ]; then
    print_message $YELLOW "💡 CDN配置建议："
    echo "1. 登录阿里云控制台 → CDN"
    echo "2. 添加域名: your-domain.com"
    echo "3. 源站类型: OSS域名"
    echo "4. 源站域名: $BUCKET_NAME.$OSS_REGION.aliyuncs.com"
    echo "5. 配置缓存规则和HTTPS"
    echo ""
fi

# 14. 后续配置建议
print_message $YELLOW "🔧 后续配置建议："
echo "1. 绑定自定义域名"
echo "2. 配置SSL证书（HTTPS）"
echo "3. 设置CDN加速"
echo "4. 配置缓存策略"
echo "5. 设置监控告警"
echo ""

print_message $GREEN "✅ 部署脚本执行完成！"
