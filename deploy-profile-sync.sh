#!/bin/bash

# ========================================
# users_profile 联动逻辑部署脚本
# ========================================

set -e

echo "🚀 开始部署 users_profile 联动逻辑..."

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# 函数：打印带颜色的消息
print_message() {
    local color=$1
    local message=$2
    echo -e "${color}${message}${NC}"
}

# 函数：检查文件是否存在
check_file() {
    local file=$1
    if [ ! -f "$file" ]; then
        print_message $RED "❌ 文件不存在: $file"
        exit 1
    fi
}

# 函数：执行SQL脚本
execute_sql() {
    local script=$1
    local description=$2
    
    print_message $BLUE "📋 执行: $description"
    print_message $YELLOW "脚本: $script"
    
    # 这里应该连接到Supabase并执行SQL
    # 由于这是本地脚本，我们只显示执行命令
    echo "请在 Supabase SQL 编辑器中执行以下脚本："
    echo "\\i $script"
    echo ""
}

# 函数：验证部署
verify_deployment() {
    print_message $BLUE "🔍 验证部署状态..."
    
    echo "请在 Supabase SQL 编辑器中执行以下验证查询："
    echo ""
    echo "-- 1. 检查函数是否存在"
    echo "SELECT proname FROM pg_proc WHERE proname IN ("
    echo "  'sync_user_profile_on_auth_insert',"
    echo "  'sync_user_profile_on_email_confirmed',"
    echo "  'sync_user_profile_on_metadata_update',"
    echo "  'manual_sync_all_users_profile',"
    echo "  'check_profile_sync_status'"
    echo ");"
    echo ""
    
    echo "-- 2. 检查触发器是否存在"
    echo "SELECT trigger_name FROM information_schema.triggers"
    echo "WHERE trigger_name LIKE 'sync_profile%';"
    echo ""
    
    echo "-- 3. 检查同步状态"
    echo "SELECT * FROM check_profile_sync_status() LIMIT 5;"
    echo ""
}

# 函数：显示使用说明
show_usage() {
    print_message $GREEN "📖 使用说明"
    echo ""
    echo "1. 在 Supabase SQL 编辑器中执行:"
    echo "   \\i sql-scripts/setup/create_profile_sync_function.sql"
    echo ""
    echo "2. 验证部署:"
    echo "   SELECT * FROM check_profile_sync_status();"
    echo ""
    echo "3. 手动同步现有数据（可选）:"
    echo "   SELECT manual_sync_all_users_profile();"
    echo ""
    echo "4. 测试功能:"
    echo "   SELECT * FROM check_profile_sync_status('user@example.com');"
    echo ""
}

# 主执行流程
main() {
    print_message $GREEN "========================================"
    print_message $GREEN "users_profile 联动逻辑部署脚本"
    print_message $GREEN "========================================"
    echo ""
    
    # 检查必要文件
    print_message $BLUE "🔍 检查必要文件..."
    check_file "sql-scripts/setup/create_profile_sync_function.sql"
    print_message $GREEN "✅ 所有必要文件存在"
    echo ""
    
    # 显示部署步骤
    print_message $YELLOW "📋 部署步骤:"
    echo "1. 执行 SQL 脚本"
    echo "2. 验证部署状态"
    echo "3. 测试功能"
    echo ""
    
    # 执行SQL脚本
    execute_sql "sql-scripts/setup/create_profile_sync_function.sql" "users_profile 联动逻辑"
    
    # 验证部署
    verify_deployment
    
    # 显示使用说明
    show_usage
    
    print_message $GREEN "🎉 部署脚本执行完成！"
    print_message $YELLOW "请按照上述步骤在 Supabase 中执行相应的 SQL 命令。"
    echo ""
    
    print_message $BLUE "📚 更多信息请查看:"
    echo "- docs/USERS_PROFILE_SYNC_GUIDE.md"
    echo "- sql-scripts/setup/create_profile_sync_function.sql"
    echo ""
}

# 检查参数
if [ "$1" = "--help" ] || [ "$1" = "-h" ]; then
    echo "用法: $0 [选项]"
    echo ""
    echo "选项:"
    echo "  --help, -h    显示帮助信息"
    echo "  --verify       仅验证部署状态"
    echo ""
    echo "示例:"
    echo "  $0             执行完整部署"
    echo "  $0 --verify    仅验证部署"
    exit 0
fi

if [ "$1" = "--verify" ]; then
    print_message $BLUE "🔍 验证模式"
    verify_deployment
    exit 0
fi

# 执行主流程
main "$@" 