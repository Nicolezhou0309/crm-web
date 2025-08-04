#!/bin/bash

# 部署测试直播数据脚本
# 用于测试直播报名&评分功能

echo "🚀 开始部署测试直播数据..."

# 检查是否在正确的目录
if [ ! -f "test_live_stream_data.sql" ]; then
    echo "❌ 错误：找不到 test_live_stream_data.sql 文件"
    exit 1
fi

# 执行SQL脚本
echo "📝 执行测试数据插入..."
psql "$DATABASE_URL" -f test_live_stream_data.sql

if [ $? -eq 0 ]; then
    echo "✅ 测试数据插入成功！"
    echo ""
    echo "📊 测试数据包括："
    echo "  - 今天上午：已报名，未评分"
    echo "  - 今天下午：已完成，已评分 (8.5分)"
    echo "  - 明天上午：可报名"
    echo "  - 明天下午：已锁定"
    echo "  - 后天上午：评分中"
    echo "  - 后天下午：已确认 (9.2分)"
    echo "  - 大后天上午：已取消"
    echo "  - 大后天下午：编辑中"
    echo ""
    echo "🎯 现在可以在直播管理页面查看这些测试数据了！"
else
    echo "❌ 测试数据插入失败"
    exit 1
fi 