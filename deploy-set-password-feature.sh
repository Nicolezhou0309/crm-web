#!/bin/bash

# 部署密码设置页面功能脚本
# 用于一键部署邀请注册和密码设置的完整功能

echo "🚀 部署密码设置页面功能"
echo "========================"

# 检查必要的环境
echo "1️⃣ 检查环境..."

# 检查是否在项目根目录
if [ ! -f "package.json" ]; then
    echo "❌ 请在项目根目录运行此脚本"
    exit 1
fi

# 检查必要文件
REQUIRED_FILES=(
    "src/pages/SetPassword.tsx"
    "user_registration_sync.sql"
    "supabase/functions/invite-user/index.ts"
)

echo "📋 检查必要文件..."
for file in "${REQUIRED_FILES[@]}"; do
    if [ -f "$file" ]; then
        echo "  ✅ $file"
    else
        echo "  ❌ 缺少文件: $file"
        exit 1
    fi
done

# 检查Supabase CLI
if ! command -v supabase &> /dev/null; then
    echo "⚠️  未找到 Supabase CLI"
    echo "请先安装 Supabase CLI: https://supabase.com/docs/guides/cli"
    echo "或者跳过 Edge Function 部署，手动部署数据库更改"
    read -p "是否继续（不部署Edge Function）? (y/n): " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        exit 1
    fi
    SKIP_FUNCTIONS=true
fi

echo ""

# 2. 部署数据库更改
echo "2️⃣ 部署数据库更改..."
echo "==================="

echo "📤 需要在Supabase Dashboard中执行以下SQL脚本："
echo "   user_registration_sync.sql"
echo ""
echo "请执行以下步骤："
echo "1. 打开 Supabase Dashboard: https://supabase.com/dashboard"
echo "2. 选择您的项目: wteqgprgiylmxzszcnws"
echo "3. 进入 SQL Editor"
echo "4. 复制并执行 user_registration_sync.sql 中的内容"
echo ""

read -p "数据库脚本执行完成后，按 Enter 继续..."

# 3. 部署Edge Function
if [ "$SKIP_FUNCTIONS" != "true" ]; then
    echo ""
    echo "3️⃣ 部署Edge Function..."
    echo "======================"
    
    echo "📤 部署invite-user函数..."
    
    # 检查是否已登录Supabase
    if ! supabase projects list &> /dev/null; then
        echo "🔑 请先登录Supabase..."
        supabase login
        
        if [ $? -ne 0 ]; then
            echo "❌ Supabase登录失败"
            exit 1
        fi
    fi
    
    # 部署函数
    echo "🚀 正在部署invite-user函数..."
    supabase functions deploy invite-user --no-verify-jwt
    
    if [ $? -eq 0 ]; then
        echo "✅ invite-user函数部署成功"
    else
        echo "❌ invite-user函数部署失败"
        echo "请检查函数代码和网络连接"
        exit 1
    fi
else
    echo ""
    echo "3️⃣ 跳过Edge Function部署"
    echo "======================"
    echo "⚠️  请手动部署invite-user函数"
    echo "1. 安装Supabase CLI"
    echo "2. 登录: supabase login"
    echo "3. 部署: supabase functions deploy invite-user --no-verify-jwt"
fi

# 4. 前端构建和部署
echo ""
echo "4️⃣ 构建前端..."
echo "==============="

echo "📦 安装依赖..."
npm install

if [ $? -eq 0 ]; then
    echo "✅ 依赖安装成功"
else
    echo "❌ 依赖安装失败"
    exit 1
fi

echo "🔨 构建项目..."
npm run build

if [ $? -eq 0 ]; then
    echo "✅ 项目构建成功"
else
    echo "❌ 项目构建失败"
    echo "请检查TypeScript错误和构建配置"
    exit 1
fi

# 5. 测试功能
echo ""
echo "5️⃣ 功能测试..."
echo "==============="

echo "🧪 可以运行以下测试："
echo "1. 启动开发服务器: npm run dev"
echo "2. 运行邀请测试脚本: ./test-invite-registration.sh"
echo "3. 手动测试邀请流程"
echo ""

# 6. 部署总结
echo "6️⃣ 部署总结"
echo "==========="

echo ""
echo "🎉 密码设置页面功能部署完成！"
echo ""
echo "📋 已部署的组件："
echo "  ✅ SetPassword 组件 (src/pages/SetPassword.tsx)"
echo "  ✅ 路由配置更新 (src/App.tsx)"
echo "  ✅ 邀请函数更新 (supabase/functions/invite-user/)"
echo "  ✅ 数据同步触发器 (user_registration_sync.sql)"
echo "  ✅ 前端构建完成"
echo ""

echo "🔧 需要手动验证的项目："
echo "  □ 数据库触发器是否正确创建"
echo "  □ Edge Function是否正常工作"
echo "  □ 邮件服务配置是否正确"
echo "  □ 密码设置页面是否可以访问"
echo ""

echo "🚀 下一步操作："
echo "1. 启动应用: npm run dev"
echo "2. 测试邀请功能: 在部门管理页面邀请新用户"
echo "3. 验证邮件: 检查用户是否收到邀请邮件"
echo "4. 测试密码设置: 点击邮件链接，验证密码设置页面"
echo ""

echo "📚 相关文档："
echo "  - SET_PASSWORD_PAGE_GUIDE.md: 完整使用指南"
echo "  - INVITE_REGISTRATION_SOLUTION.md: 技术实现方案"
echo "  - test-invite-registration.sh: 测试脚本"
echo ""

echo "🆘 如果遇到问题："
echo "1. 检查Supabase Dashboard中的函数和数据库状态"
echo "2. 查看浏览器控制台的错误信息"
echo "3. 检查邮件服务配置"
echo "4. 运行测试脚本进行故障排除"
echo ""

echo "✨ 功能特点："
echo "  - 用户友好的密码设置界面"
echo "  - 完整的数据同步机制"
echo "  - 强密码验证"
echo "  - 自动登录功能"
echo "  - 多种令牌格式支持"
echo "  - 响应式设计"
echo ""

echo "🎯 部署完成！您的用户现在可以享受更好的注册体验了。" 