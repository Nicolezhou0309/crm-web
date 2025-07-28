#!/bin/bash

# 部署审批表RLS权限脚本
# 创建时间: 2025年1月
# 说明: 为审批相关表设置RLS权限控制

echo "🚀 开始部署审批表RLS权限..."

# 检查是否在正确的目录
if [ ! -f "supabase/config.toml" ]; then
    echo "❌ 错误: 请在项目根目录执行此脚本"
    exit 1
fi

# 检查Supabase CLI是否安装
if ! command -v supabase &> /dev/null; then
    echo "❌ 错误: 请先安装Supabase CLI"
    echo "安装命令: npm install -g supabase"
    exit 1
fi

# 检查是否已登录Supabase
if ! supabase status &> /dev/null; then
    echo "❌ 错误: 请先登录Supabase"
    echo "登录命令: supabase login"
    exit 1
fi

echo "📋 执行审批表RLS权限设置..."

# 执行SQL脚本
echo "🔧 执行RLS权限设置..."
supabase db execute --file sql-scripts/setup/approval_flows_rls.sql

if [ $? -eq 0 ]; then
    echo "✅ 审批表RLS权限设置成功！"
    
    echo ""
    echo "📊 权限设置详情:"
    echo "   - approval_flows: 审批流模板表"
    echo "   - approval_instances: 审批实例表" 
    echo "   - approval_steps: 审批步骤表"
    echo ""
    echo "🔐 权限规则:"
    echo "   1. approval_manage权限拥有所有权限"
    echo "   2. 用户只拥有自己记录的增删改查权限"
    echo "   3. 审批步骤只有管理权限可以创建/删除"
    echo ""
    echo "🧪 验证命令:"
    echo "   - 检查RLS状态: SELECT tablename, rowsecurity FROM pg_tables WHERE tablename LIKE 'approval_%';"
    echo "   - 检查策略: SELECT tablename, policyname FROM pg_policies WHERE tablename LIKE 'approval_%';"
    echo "   - 测试权限: SELECT * FROM test_approval_permissions();"
    echo ""
    echo "👥 权限管理:"
    echo "   - 授予权限: SELECT grant_approval_manage_permission('用户UUID');"
    echo "   - 移除权限: SELECT revoke_approval_manage_permission('用户UUID');"
    
else
    echo "❌ 审批表RLS权限设置失败！"
    echo "请检查SQL脚本语法和数据库连接"
    exit 1
fi

echo ""
echo "🎉 部署完成！" 