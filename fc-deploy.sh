#!/bin/bash

# CRM前端应用 - 函数计算部署脚本
# 使用方法：./fc-deploy.sh [dev|prod]

set -e

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# 日志函数
log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

log_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# 检查参数
ENVIRONMENT=${1:-dev}
if [[ "$ENVIRONMENT" != "dev" && "$ENVIRONMENT" != "prod" ]]; then
    log_error "环境参数错误，请使用 'dev' 或 'prod'"
    echo "使用方法: $0 [dev|prod]"
    exit 1
fi

log_info "开始部署到函数计算 - 环境: $ENVIRONMENT"

# 设置PATH
export PATH="$HOME/bin:$PATH"

# 检查必要工具
check_tools() {
    log_info "检查必要工具..."
    
    if ! command -v aliyun &> /dev/null; then
        log_error "阿里云CLI未找到，请先安装"
        exit 1
    fi
    
    if ! command -v fun &> /dev/null; then
        log_error "Fun工具未找到，请先安装: npm install -g @alicloud/fun"
        exit 1
    fi
    
    if ! command -v npm &> /dev/null; then
        log_error "npm未找到，请先安装Node.js"
        exit 1
    fi
    
    log_success "工具检查完成"
}

# 检查构建文件
check_build() {
    log_info "检查构建文件..."
    
    if [ ! -d "dist" ]; then
        log_warning "dist目录不存在，开始构建前端项目..."
        npm run build
    fi
    
    if [ ! -f "dist/index.html" ]; then
        log_error "构建文件不完整，请检查构建过程"
        exit 1
    fi
    
    log_success "构建文件检查完成"
}

# 创建函数计算项目结构
create_fc_structure() {
    log_info "创建函数计算项目结构..."
    
    # 创建函数计算目录
    FC_DIR="fc-app"
    if [ -d "$FC_DIR" ]; then
        log_warning "清理旧的函数计算目录..."
        rm -rf "$FC_DIR"
    fi
    
    mkdir -p "$FC_DIR"
    cd "$FC_DIR"
    
    # 复制配置文件
    cp ../fc-package.json ./package.json
    cp ../fc-index.js ./index.js
    
    # 根据环境选择模板
    if [ "$ENVIRONMENT" = "prod" ]; then
        cp ../template-prod.yml ./template.yml
        log_info "使用生产环境模板"
    else
        cp ../template-dev.yml ./template.yml
        log_info "使用开发环境模板"
    fi
    
    # 复制构建文件
    cp -r ../dist ./
    
    log_success "函数计算项目结构创建完成"
}

# 安装依赖
install_dependencies() {
    log_info "安装函数计算依赖..."
    
    npm install
    
    if [ $? -ne 0 ]; then
        log_error "依赖安装失败"
        exit 1
    fi
    
    log_success "依赖安装完成"
}

# 配置Fun工具
configure_fun() {
    log_info "配置Fun工具..."
    
    # 检查是否已配置
    if ! fun config get aliyun_access_key_id &> /dev/null; then
        log_warning "Fun工具未配置，请手动配置："
        echo "运行: fun config"
        echo "然后输入您的阿里云凭证信息"
        read -p "按回车键继续..."
    fi
    
    log_success "Fun工具配置检查完成"
}

# 部署函数
deploy_function() {
    log_info "开始部署函数到阿里云..."
    
    # 部署函数
    fun deploy --use-ros
    
    if [ $? -ne 0 ]; then
        log_error "函数部署失败"
        exit 1
    fi
    
    log_success "函数部署完成"
}

# 获取部署信息
get_deployment_info() {
    log_info "获取部署信息..."
    
    # 获取服务信息
    SERVICE_NAME=$(fun config get aliyun_account_id 2>/dev/null | xargs -I {} echo "crm-frontend-$ENVIRONMENT" || echo "crm-frontend-$ENVIRONMENT")
    FUNCTION_NAME="crm-frontend-app-$ENVIRONMENT"
    
    log_success "部署信息："
    echo "  环境: $ENVIRONMENT"
    echo "  服务名: $SERVICE_NAME"
    echo "  函数名: $FUNCTION_NAME"
    echo ""
    echo "📋 下一步："
    echo "1. 在阿里云控制台查看函数计算服务"
    echo "2. 获取HTTP触发器的访问地址"
    echo "3. 测试应用功能"
    echo "4. 配置自定义域名（可选）"
    echo ""
    echo "🔧 管理功能："
    echo "- 查看日志: fun logs"
    echo "- 更新环境变量: 在控制台修改"
    echo "- 监控性能: 在控制台查看指标"
}

# 主函数
main() {
    log_info "🚀 CRM前端应用 - 函数计算部署开始"
    echo "=================================="
    
    check_tools
    check_build
    create_fc_structure
    install_dependencies
    configure_fun
    deploy_function
    get_deployment_info
    
    echo "=================================="
    log_success "🎉 部署完成！"
    
    # 返回原目录
    cd ..
}

# 执行主函数
main "$@"
