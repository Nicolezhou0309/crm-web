#!/bin/bash

# HTTPS混合内容修复部署脚本
echo "🚀 开始部署HTTPS混合内容修复版本..."

# 检查是否在正确的目录
if [ ! -f "package.json" ]; then
    echo "❌ 错误：请在项目根目录运行此脚本"
    exit 1
fi

# 构建应用
echo "📦 构建应用..."
npm run build

if [ $? -ne 0 ]; then
    echo "❌ 构建失败"
    exit 1
fi

echo "✅ 构建成功"

# 检查dist目录
if [ ! -d "dist" ]; then
    echo "❌ 错误：dist目录不存在"
    exit 1
fi

echo "📁 构建文件："
ls -la dist/

echo ""
echo "🔧 修复内容："
echo "1. ✅ 添加了HTTPS环境检测"
echo "2. ✅ 在HTTPS环境下使用代理地址"
echo "3. ✅ 临时禁用了realtime功能以避免混合内容错误"
echo "4. ✅ 添加了调试信息输出"

echo ""
echo "📋 部署说明："
echo "1. 将dist/目录内容上传到阿里云函数计算"
echo "2. 配置API网关代理（推荐）："
echo "   - 创建API网关服务"
echo "   - 配置HTTPS监听器"
echo "   - 设置代理规则：/supabase/* -> http://47.123.26.25:8000"
echo "3. 或者设置环境变量："
echo "   VITE_SUPABASE_URL=https://your-api-gateway-domain/supabase"

echo ""
echo "🧪 测试方法："
echo "1. 打开浏览器开发者工具"
echo "2. 查看控制台输出，应该看到："
echo "   🔧 Supabase配置信息: { isHTTPS: true, ... }"
echo "3. 检查是否还有混合内容错误"

echo ""
echo "✅ 部署准备完成！"
