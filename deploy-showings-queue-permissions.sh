 #!/bin/bash

# 部署带看队列记录权限管理
echo "🚀 开始部署带看队列记录权限管理..."

# 设置数据库连接参数
DB_URL="postgresql://postgres.wteqgprgiylmxzszcnws:VLINKER2025@aws-0-ap-southeast-1.pooler.supabase.com:6543/postgres"

# 执行SQL脚本
echo "📝 执行权限管理SQL脚本..."
psql "$DB_URL" -f sql-scripts/setup/showings_queue_record_permissions.sql

if [ $? -eq 0 ]; then
    echo "✅ 带看队列记录权限管理部署成功！"
    echo ""
    echo "📋 部署内容："
    echo "   - 为 showings_queue_record 表启用 RLS"
    echo "   - 创建基于 allocation_manage 权限的访问策略"
    echo "   - 创建权限验证函数 test_showings_queue_record_permissions"
    echo "   - 创建权限管理函数 grant_allocation_manage_permission"
    echo "   - 创建权限移除函数 revoke_allocation_manage_permission"
    echo ""
    echo "🔐 权限规则："
    echo "   - SELECT: 用户可查看自己的记录，有 allocation_manage 权限可查看所有"
    echo "   - INSERT: 仅 allocation_manage 权限"
    echo "   - UPDATE: 仅 allocation_manage 权限"
    echo "   - DELETE: 仅 allocation_manage 权限"
    echo ""
    echo "💡 使用说明："
    echo "   - 检查权限：SELECT * FROM test_showings_queue_record_permissions();"
    echo "   - 授予权限：SELECT grant_allocation_manage_permission('用户UUID');"
    echo "   - 移除权限：SELECT revoke_allocation_manage_permission('用户UUID');"
else
    echo "❌ 部署失败！"
    exit 1
fi