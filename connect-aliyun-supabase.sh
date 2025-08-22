#!/bin/bash

# 阿里云Supabase连接脚本
# 项目ID: 1865238354801584
# 区域: cn-shanghai

echo "🔧 连接阿里云Supabase..."
echo "📍 项目ID: 1865238354801584"
echo "🌍 区域: cn-shanghai"
echo ""

# 检查阿里云CLI是否安装
if ! command -v aliyun &> /dev/null; then
    echo "❌ 错误: 未安装阿里云CLI"
    echo "📥 请先安装: https://help.aliyun.com/zh/cli/"
    exit 1
fi

# 检查是否已配置
if ! aliyun configure list &> /dev/null; then
    echo "⚠️  警告: 阿里云CLI未配置"
    echo "🔑 请运行: aliyun configure"
    echo "📝 输入AccessKey ID、Secret、默认区域(cn-shanghai)"
    exit 1
fi

echo "✅ 阿里云CLI已配置"
echo ""

# 获取项目信息
echo "📊 获取项目信息..."
PROJECT_ID="1865238354801584"
REGION="cn-shanghai"

# 检查项目状态
echo "🔍 检查项目状态..."
if aliyun fc list-services --region $REGION | grep -q "supabase"; then
    echo "✅ 找到Supabase服务"
else
    echo "❌ 未找到Supabase服务"
    echo "💡 请确保项目已正确部署"
fi

echo ""
echo "🚀 启动MCP服务器..."

# 启动MCP服务器
npx -y @aliyun-supabase/mcp-server-supabase@latest \
    --features=aliyun \
    --read-only \
    --region=$REGION \
    --project-id=$PROJECT_ID

echo ""
echo "✅ MCP服务器已启动"
echo "💡 现在您可以在Cursor中使用MCP工具连接阿里云Supabase"
echo "🔧 工具名称: aliyun-supabase"
