#!/bin/bash

echo "�� 开始部署更新的invite-user Edge Function..."

# 检查Supabase CLI是否安装
if ! command -v supabase &> /dev/null; then
    echo "❌ Supabase CLI未安装，请先安装Supabase CLI"
    echo "安装命令: npm install -g supabase"
    exit 1
fi

# 检查是否在项目根目录
if [ ! -f "supabase/functions/invite-user/index.ts" ]; then
    echo "❌ 请在项目根目录运行此脚本"
    exit 1
fi

echo "📦 部署invite-user函数..."
supabase functions deploy invite-user

if [ $? -eq 0 ]; then
    echo "✅ invite-user函数部署成功！"
    
    echo ""
    echo "�� 配置说明:"
    echo "1. Supabase内置邀请功能已启用"
    echo "2. 备用Resend自定义邀请功能已配置"
    echo "3. 支持动态域名配置"
    echo "4. 包含完整的token验证"
    
    echo ""
    echo "�� 邀请流程:"
    echo "1. 优先使用Supabase内置邀请（包含标准token）"
    echo "2. 如果失败，使用Resend自定义邀请（包含自定义token）"
    echo "3. 用户点击链接后正确重定向到set-password页面"
    echo "4. 支持多种token格式验证"
    
    echo ""
    echo "�� 测试建议:"
    echo "1. 发送邀请邮件给测试用户"
    echo "2. 检查邮件中的链接是否包含token"
    echo "3. 点击链接验证重定向是否正确"
    echo "4. 测试密码设置流程"
    
else
    echo "❌ invite-user函数部署失败"
    exit 1
fi

echo ""
echo "🎉 部署完成！邀请功能已更新。" 