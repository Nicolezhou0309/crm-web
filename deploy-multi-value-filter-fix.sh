#!/bin/bash

# =============================================
# 部署多值筛选修复脚本
# 修复时间: 2025年1月15日
# 目的: 修复透视表函数的多值筛选问题，支持动态列生成
# =============================================

echo "🚀 开始部署多值筛选修复..."

# 检查是否在正确的目录
if [ ! -f "package.json" ]; then
    echo "❌ 错误: 请在项目根目录运行此脚本"
    exit 1
fi

# 检查 Supabase 配置
if [ ! -f "supabase/config.toml" ]; then
    echo "❌ 错误: 未找到 Supabase 配置文件"
    exit 1
fi

echo "📋 应用多值筛选修复..."

# 应用修复SQL
echo "🔧 执行修复SQL..."
psql $DATABASE_URL -f fix_multi_value_filter.sql

if [ $? -eq 0 ]; then
    echo "✅ 多值筛选修复部署成功！"
    echo ""
    echo "🎯 修复内容:"
    echo "   - 支持逗号分隔的多值筛选"
    echo "   - 当输入 '周玲馨,梁伟' 时，会查找包含 '周玲馨' 或 '梁伟' 的记录"
    echo "   - 使用 OR 逻辑而不是 AND 逻辑"
    echo "   - 为每个筛选值单独生成一列（如：周玲馨_filter, 梁伟_filter）"
    echo "   - 每列显示该筛选值是否匹配（1表示匹配，0表示不匹配）"
    echo ""
    echo "🧪 测试建议:"
    echo "   1. 在透视表中输入筛选条件: interviewsales_user_name 包含 '周玲馨,梁伟'"
    echo "   2. 应该能看到包含周玲馨或梁伟的所有记录"
    echo "   3. 结果中会包含额外的列：周玲馨_filter, 梁伟_filter"
    echo "   4. 这些列显示每条记录是否匹配对应的筛选值"
    echo "   5. 检查生成的SQL是否包含动态列生成"
else
    echo "❌ 多值筛选修复部署失败！"
    exit 1
fi

echo ""
echo "🎉 部署完成！现在可以测试多值筛选和动态列功能了。" 