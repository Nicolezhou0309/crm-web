#!/bin/bash

# 部署直播数据筛选功能
echo "🚀 开始部署直播数据筛选功能..."

# 检查是否在正确的目录
if [ ! -f "create_live_stream_filter_function.sql" ]; then
    echo "❌ 错误：找不到 create_live_stream_filter_function.sql 文件"
    exit 1
fi

# 执行SQL文件
echo "📝 创建数据库筛选函数..."
psql $DATABASE_URL -f create_live_stream_filter_function.sql

if [ $? -eq 0 ]; then
    echo "✅ 数据库筛选函数创建成功"
else
    echo "❌ 数据库筛选函数创建失败"
    exit 1
fi

echo "🎉 直播数据筛选功能部署完成！"
echo ""
echo "📋 功能特性："
echo "  ✅ 支持多字段筛选"
echo "  ✅ 评分范围筛选"
echo "  ✅ 人员支持范围包含"
echo "  ✅ 日期范围筛选"
echo "  ✅ 表头筛选界面"
echo "  ✅ 后端优化查询"
echo "  ✅ 直播日期时间范围筛选（新增）"
echo "  ✅ 快捷日期选择功能"
echo ""
echo "🔧 使用方法："
echo "  1. 在直播管理页面点击表头筛选图标"
echo "  2. 选择相应的筛选条件"
echo "  3. 支持多选和范围筛选"
echo "  4. 实时更新筛选结果"
echo "  5. 日期筛选支持自定义范围和快捷选择"
echo ""
echo "📅 日期筛选功能："
echo "  - 支持精确的日期范围选择"
echo "  - 提供今天、一周、一月、三月、一年等快捷选项"
echo "  - 支持自定义开始和结束日期" 