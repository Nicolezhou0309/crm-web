#!/bin/bash

# 部署BI数据分析系统数据库表
echo "开始部署BI数据分析系统数据库表..."

# 检查是否在正确的目录
if [ ! -f "package.json" ]; then
    echo "错误：请在项目根目录运行此脚本"
    exit 1
fi

# 部署数据库表
echo "部署BI数据库表..."
psql "postgresql://postgres.wteqgprgiylmxzszcnws:[gAC5Yqi01wh3eISR]@aws-0-ap-southeast-1.pooler.supabase.com:5432/postgres" -f sql-scripts/setup/create_bi_tables.sql

if [ $? -eq 0 ]; then
    echo "✅ BI数据库表部署成功！"
    echo ""
    echo "已创建的表："
    echo "- bi_pivot_configs (透视表配置表)"
    echo "- bi_reports (报表表)"
    echo ""
    echo "已启用的功能："
    echo "- RLS行级安全策略"
    echo "- 透视表配置保存和加载"
    echo "- 报表管理功能"
    echo ""
    echo "接下来您可以："
    echo "1. 启动开发服务器：npm run dev"
    echo "2. 访问数据分析页面：http://localhost:5173/data-analysis"
    echo "3. 开始使用透视表功能"
else
    echo "❌ BI数据库表部署失败！"
    exit 1
fi 