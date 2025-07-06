#!/bin/bash

# 邀请注册流程测试脚本
# 用于验证整个邀请-注册-同步流程是否正常工作

echo "🧪 邀请注册流程测试"
echo "===================="

# 配置
SUPABASE_URL="https://wteqgprgiylmxzszcnws.supabase.co"
SUPABASE_ANON_KEY="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Ind0ZXFncHJnaXlsbXh6c3pjbndzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3MzI3NzQ1OTAsImV4cCI6MjA0ODM1MDU5MH0.SQOmGgMZNNhXCcpZGAKOBQAYOH2FbAaKvKWyqFrHcFk"

# 测试邮箱
TEST_EMAIL="test-invite-$(date +%s)@example.com"
TEST_NAME="测试用户"
TEST_ORG_ID="550e8400-e29b-41d4-a716-446655440000"  # 需要替换为实际的组织ID

echo "📧 测试邮箱: $TEST_EMAIL"
echo "👤 测试姓名: $TEST_NAME"
echo "🏢 测试组织: $TEST_ORG_ID"
echo ""

# 1. 测试邀请函数
echo "1️⃣ 测试邀请函数"
echo "----------------"

# 获取用户访问令牌 (需要先登录)
echo "请先在浏览器中登录系统，然后从开发者工具中获取Authorization头..."
echo "或者运行debug-auth.html来获取token"
echo ""

read -p "请输入您的访问令牌（Bearer token）: " USER_TOKEN

if [[ -z "$USER_TOKEN" ]]; then
    echo "❌ 未提供访问令牌，无法测试邀请功能"
    exit 1
fi

# 发送邀请请求
echo "📤 发送邀请请求..."
INVITE_RESPONSE=$(curl -s -X POST \
  "$SUPABASE_URL/functions/v1/invite-user" \
  -H "Authorization: Bearer $USER_TOKEN" \
  -H "Content-Type: application/json" \
  -d "{
    \"email\": \"$TEST_EMAIL\",
    \"name\": \"$TEST_NAME\",
    \"organizationId\": \"$TEST_ORG_ID\"
  }")

echo "📥 邀请响应: $INVITE_RESPONSE"
echo ""

# 检查响应
if echo "$INVITE_RESPONSE" | grep -q '"success":true'; then
    echo "✅ 邀请发送成功！"
else
    echo "❌ 邀请发送失败"
    echo "请检查："
    echo "- 访问令牌是否正确"
    echo "- 组织ID是否存在"
    echo "- 是否有管理该组织的权限"
    exit 1
fi

# 2. 检查users_profile表
echo "2️⃣ 检查用户资料记录"
echo "-------------------"

echo "📋 检查用户资料是否创建..."
echo "请在数据库中执行以下查询："
echo "SELECT * FROM users_profile WHERE email = '$TEST_EMAIL';"
echo ""
echo "应该看到："
echo "- status: 'invited'"
echo "- nickname: '$TEST_NAME'"
echo "- organization_id: '$TEST_ORG_ID'"
echo "- user_id: null (邀请状态)"
echo ""

# 3. 模拟用户注册完成
echo "3️⃣ 模拟用户注册完成"
echo "-------------------"

echo "📝 在实际场景中，用户会："
echo "1. 收到邀请邮件"
echo "2. 点击邮件中的链接"
echo "3. 设置密码完成注册"
echo "4. 系统自动触发同步"
echo ""

echo "🔧 模拟触发器执行..."
echo "请在数据库中执行以下查询来检查触发器状态："
echo ""
echo "-- 检查触发器是否存在"
echo "SELECT * FROM information_schema.triggers WHERE trigger_name = 'sync_user_metadata_trigger';"
echo ""
echo "-- 检查同步函数是否存在"
echo "SELECT * FROM information_schema.routines WHERE routine_name = 'sync_user_metadata_to_profile';"
echo ""

# 4. 测试工具函数
echo "4️⃣ 测试工具函数"
echo "---------------"

echo "🔍 检查用户注册状态函数："
echo "SELECT * FROM check_user_registration_status('$TEST_EMAIL');"
echo ""

echo "🔄 手动同步函数："
echo "SELECT manual_sync_user_metadata();"
echo ""

# 5. 清理测试数据
echo "5️⃣ 清理测试数据"
echo "---------------"

echo "🧹 清理测试数据..."
echo "请在数据库中执行以下查询："
echo "DELETE FROM users_profile WHERE email = '$TEST_EMAIL';"
echo ""

echo "🎉 测试完成！"
echo "============="
echo ""
echo "📋 测试检查清单："
echo "□ 邀请函数正常工作"
echo "□ users_profile记录正确创建"
echo "□ 触发器正确安装"
echo "□ 同步函数可以执行"
echo "□ 测试数据已清理"
echo ""
echo "如果所有检查都通过，说明邀请注册流程配置正确！"

# 6. 故障排除提示
echo "🔧 故障排除提示"
echo "==============="
echo ""
echo "如果遇到问题，请检查："
echo ""
echo "1. 数据库配置："
echo "   - 触发器是否正确创建"
echo "   - users_profile表结构是否正确"
echo "   - 权限设置是否正确"
echo ""
echo "2. Edge Function配置："
echo "   - 函数是否正确部署"
echo "   - 环境变量是否设置"
echo "   - 权限验证是否正确"
echo ""
echo "3. 前端配置："
echo "   - 字段名称是否统一"
echo "   - 请求格式是否正确"
echo "   - 错误处理是否完善"
echo ""
echo "4. 邮件服务："
echo "   - Supabase邮件服务是否启用"
echo "   - 邮件模板是否正确"
echo "   - 域名设置是否正确" 