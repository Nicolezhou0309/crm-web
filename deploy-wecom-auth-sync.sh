#!/bin/bash

# 企业微信认证同步函数部署脚本
# 更新 create_profile_sync_function.sql 并部署到 Supabase

set -e

echo "🚀 开始部署企业微信认证同步函数..."

# 检查环境变量
if [ -z "$SUPABASE_URL" ] || [ -z "$SUPABASE_SERVICE_ROLE_KEY" ]; then
    echo "❌ 错误: 请设置 SUPABASE_URL 和 SUPABASE_SERVICE_ROLE_KEY 环境变量"
    echo "请运行: source env.aliyun.supabase"
    exit 1
fi

echo "✅ 环境变量检查通过"
echo "📡 Supabase URL: $SUPABASE_URL"

# 执行同步函数SQL脚本
echo "📝 执行企业微信认证同步函数..."

# 使用 curl 执行 SQL 脚本
curl -X POST "$SUPABASE_URL/rest/v1/rpc/exec_sql" \
  -H "apikey: $SUPABASE_SERVICE_ROLE_KEY" \
  -H "Authorization: Bearer $SUPABASE_SERVICE_ROLE_KEY" \
  -H "Content-Type: application/json" \
  -H "Prefer: return=minimal" \
  -d "{
    \"sql\": \"$(cat sql-scripts/setup/create_profile_sync_function.sql | sed 's/\"/\\\"/g' | tr '\n' ' ')\"
  }"

if [ $? -eq 0 ]; then
    echo "✅ 企业微信认证同步函数部署成功！"
else
    echo "❌ 部署失败，请检查错误信息"
    exit 1
fi

echo ""
echo "🔧 验证函数部署状态..."
echo "请手动执行以下SQL查询来验证函数是否创建成功："

echo ""
echo "1. 检查同步函数是否存在："
echo "SELECT proname, prosrc FROM pg_proc WHERE proname IN ("
echo "  'sync_user_profile_on_auth_insert',"
echo "  'sync_user_profile_on_email_confirmed',"
echo "  'sync_user_profile_on_metadata_update',"
echo "  'manual_sync_all_users_profile',"
echo "  'check_profile_sync_status',"
echo "  'sync_wechat_work_users'"
echo ");"

echo ""
echo "2. 检查触发器是否创建成功："
echo "SELECT trigger_name, event_manipulation, event_object_table, action_statement"
echo "FROM information_schema.triggers"
echo "WHERE trigger_name LIKE 'sync_profile_%';"

echo ""
echo "3. 测试企业微信用户同步："
echo "SELECT sync_wechat_work_users();"

echo ""
echo "4. 检查同步状态："
echo "SELECT * FROM check_profile_sync_status();"

echo ""
echo "🎉 部署完成！"
echo ""
echo "📋 下一步操作："
echo "1. 在 Supabase SQL 编辑器中执行上述验证查询"
echo "2. 测试企业微信登录流程"
echo "3. 验证用户数据是否正确同步到 auth.users 和 users_profile 表"
echo ""
echo "💡 提示：如果遇到权限问题，请确保使用 service_role 密钥"
