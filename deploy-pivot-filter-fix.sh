#!/bin/bash

echo "🔧 开始修复透视表函数筛选条件处理问题..."

# 部署修复后的透视表函数
echo "📦 部署修复后的多层级透视表函数..."
supabase db push

echo "✅ 透视表函数筛选条件修复完成！"
echo ""
echo "🎯 修复内容："
echo "- 添加了对 'contains' 操作符的支持（使用 ILIKE）"
echo "- 添加了对 'not_contains' 操作符的支持"
echo "- 添加了对 'not_equals' 操作符的支持"
echo "- 添加了对 'greater_than' 和 'less_than' 操作符的支持"
echo "- 添加了对 'is_null' 和 'is_not_null' 操作符的支持"
echo "- 修复了 'between' 和 'date_between' 操作符的处理"
echo ""
echo "💡 现在人员名称筛选应该可以正常工作了！"
echo "   使用 'contains' 操作符时，SQL 会使用 ILIKE 进行模糊匹配" 