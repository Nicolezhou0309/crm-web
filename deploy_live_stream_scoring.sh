#!/bin/bash

# 直播评分系统部署脚本
echo "开始部署直播评分系统..."

# 检查是否在正确的目录
if [ ! -f "create_live_stream_scoring_system.sql" ]; then
    echo "错误：找不到 create_live_stream_scoring_system.sql 文件"
    exit 1
fi

# 设置数据库连接参数（请根据实际情况修改）
DB_HOST="localhost"
DB_PORT="5432"
DB_NAME="your_database_name"
DB_USER="your_username"

echo "正在执行数据库迁移..."

# 执行SQL文件
psql -h $DB_HOST -p $DB_PORT -d $DB_NAME -U $DB_USER -f create_live_stream_scoring_system.sql

if [ $? -eq 0 ]; then
    echo "✅ 直播评分系统部署成功！"
    echo ""
    echo "部署内容包括："
    echo "1. 扩展 live_stream_schedules 表（添加评分字段）"
    echo "2. 创建评分维度表 (live_stream_scoring_dimensions)"
    echo "3. 创建评分选项表 (live_stream_scoring_options)"
    echo "4. 创建评分历史表 (live_stream_scoring_history)"
    echo "5. 插入默认评分维度和选项数据"
    echo "6. 创建评分计算函数和触发器"
    echo "7. 创建评分统计视图"
    echo ""
    echo "默认评分维度："
    echo "- 开播准备 (preparation)"
    echo "- 直播状态 (live_status)"
    echo "- 讲解话术 (presentation)"
    echo "- 出勤情况 (attendance)"
    echo "- 运镜技巧 (camera_skills)"
    echo ""
    echo "每个维度包含3个评分选项，分数范围0-10分"
else
    echo "❌ 部署失败，请检查数据库连接和权限"
    exit 1
fi 