#!/bin/bash

# CRM前端应用 - Serverless Devs 部署脚本
# 适用于阿里云函数计算

set -e

echo "🚀 开始部署CRM前端应用到阿里云函数计算..."

# 检查必要的工具
check_tools() {
    echo "📋 检查部署工具..."
    
    if ! command -v s &> /dev/null; then
        echo "❌ Serverless Devs (s) 未安装"
        echo "请运行: npm install -g @serverless-devs/s"
        exit 1
    fi
    
    echo "✅ Serverless Devs 已安装"
}

# 构建前端项目
build_frontend() {
    echo "🔨 构建前端项目..."
    
    # 安装依赖
    npm install
    
    # 构建项目
    npm run build
    
    # 复制构建文件到fc-app目录
    echo "📁 复制构建文件到函数计算目录..."
    cp -r dist/* fc-app/dist/
    
    echo "✅ 前端构建完成"
}

# 部署到函数计算
deploy_to_fc() {
    echo "☁️ 部署到阿里云函数计算..."
    
    # 使用Serverless Devs部署
    s deploy
    
    echo "✅ 部署完成！"
}

# 显示部署信息
show_deployment_info() {
    echo ""
    echo "🎉 部署成功！"
    echo ""
    echo "📊 部署信息："
    echo "├── 服务名称: crm-frontend"
    echo "├── 函数名称: crm-frontend-app"
    echo "├── 运行时: Node.js 18"
    echo "├── 内存: 1024MB"
    echo "├── 超时: 60秒"
    echo "└── 区域: cn-shanghai"
    echo ""
    echo "🌐 访问地址："
    echo "├── HTTP触发器: 部署完成后会显示"
    echo "├── API端点: /api/health, /api/config"
    echo "└── 静态文件: 自动服务"
    echo ""
    echo "📝 管理命令："
    echo "├── 查看日志: s logs -f"
    echo "├── 查看函数: s info"
    echo "├── 删除服务: s remove"
    echo "└── 重新部署: s deploy"
}

# 主函数
main() {
    echo "🎯 CRM前端应用 - Serverless Devs 部署"
    echo "=================================="
    
    check_tools
    build_frontend
    deploy_to_fc
    show_deployment_info
}

# 执行主函数
main "$@"
