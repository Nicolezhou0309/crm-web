#!/bin/bash

# 企业微信认证同步函数部署脚本（简化版）
# 提供手动执行的SQL命令

echo "🚀 企业微信认证同步函数部署指南"
echo "=================================="
echo ""

echo "📝 请按照以下步骤在 Supabase SQL 编辑器中执行："
echo ""

echo "1️⃣ 复制以下SQL脚本到 Supabase SQL 编辑器："
echo "----------------------------------------"
echo ""

# 读取SQL文件内容
if [ -f "sql-scripts/setup/create_profile_sync_function.sql" ]; then
    cat sql-scripts/setup/create_profile_sync_function.sql
else
    echo "❌ 错误: 找不到 SQL 脚本文件"
    echo "请确保 sql-scripts/setup/create_profile_sync_function.sql 文件存在"
    exit 1
fi

echo ""
echo "----------------------------------------"
echo ""

echo "2️⃣ 在 Supabase SQL 编辑器中执行上述脚本"
echo ""

echo "3️⃣ 验证函数部署状态，执行以下查询："
echo ""

echo "🔍 检查同步函数是否存在："
echo "SELECT proname, prosrc FROM pg_proc WHERE proname IN ("
echo "  'sync_user_profile_on_auth_insert',"
echo "  'sync_user_profile_on_email_confirmed',"
echo "  'sync_user_profile_on_metadata_update',"
echo "  'manual_sync_all_users_profile',"
echo "  'check_profile_sync_status',"
echo "  'sync_wechat_work_users'"
echo ");"

echo ""
echo "🔍 检查触发器是否创建成功："
echo "SELECT trigger_name, event_manipulation, event_object_table, action_statement"
echo "FROM information_schema.triggers"
echo "WHERE trigger_name LIKE 'sync_profile_%';"

echo ""
echo "🔍 测试企业微信用户同步："
echo "SELECT sync_wechat_work_users();"

echo ""
echo "🔍 检查同步状态："
echo "SELECT * FROM check_profile_sync_status();"

echo ""
echo "🎉 部署完成后的验证步骤："
echo ""

echo "4️⃣ 测试企业微信登录流程："
echo "   - 访问企业微信登录页面"
echo "   - 完成扫码登录"
echo "   - 检查是否在 auth.users 表中创建了记录"
echo "   - 检查是否在 users_profile 表中同步了数据"

echo ""
echo "5️⃣ 检查数据同步："
echo "   - 确认 auth.users 表中有企业微信用户记录"
echo "   - 确认 users_profile 表中有对应的用户档案"
echo "   - 确认企业微信相关字段正确填充"

echo ""
echo "💡 注意事项："
echo "   - 确保使用 service_role 密钥执行SQL脚本"
echo "   - 如果遇到权限问题，检查RLS策略设置"
echo "   - 建议先在测试环境验证功能"

echo ""
echo "📚 相关文档："
echo "   - 企业微信登录集成说明: aliyun-sp-wecom-auth/myapp/docs/SUPABASE_INTEGRATION.md"
echo "   - 用户管理分析: ALIYUN_SUPABASE_USER_MANAGEMENT_ANALYSIS.md"
echo ""

echo "✅ 脚本执行完成！请按照上述步骤进行部署。"
