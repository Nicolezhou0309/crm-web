#!/bin/bash

# 兑换商品系统部署脚本
# 执行时间: 2025年1月

echo "🚀 开始部署兑换商品系统..."

# 设置颜色输出
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# 检查是否在正确的目录
if [ ! -f "supabase/config.toml" ]; then
    echo -e "${RED}❌ 错误: 请在项目根目录执行此脚本${NC}"
    exit 1
fi

# 检查Supabase CLI是否安装
if ! command -v supabase &> /dev/null; then
    echo -e "${RED}❌ 错误: 未找到Supabase CLI，请先安装${NC}"
    exit 1
fi

echo -e "${YELLOW}📋 检查当前Supabase状态...${NC}"

# 检查Supabase项目状态
if ! supabase status &> /dev/null; then
    echo -e "${RED}❌ 错误: Supabase项目未启动，请先运行 'supabase start'${NC}"
    exit 1
fi

echo -e "${GREEN}✅ Supabase项目已启动${NC}"

# 创建迁移文件
echo -e "${YELLOW}📝 创建兑换商品系统迁移文件...${NC}"

# 复制SQL脚本到migrations目录
cp sql-scripts/setup/create_exchange_goods.sql supabase/migrations/$(date +%Y%m%d%H%M%S)_create_exchange_goods.sql

if [ $? -eq 0 ]; then
    echo -e "${GREEN}✅ 迁移文件创建成功${NC}"
else
    echo -e "${RED}❌ 迁移文件创建失败${NC}"
    exit 1
fi

# 应用迁移
echo -e "${YELLOW}🔄 应用数据库迁移...${NC}"

if supabase db reset; then
    echo -e "${GREEN}✅ 数据库迁移应用成功${NC}"
else
    echo -e "${RED}❌ 数据库迁移应用失败${NC}"
    exit 1
fi

# 验证表结构
echo -e "${YELLOW}🔍 验证兑换商品表结构...${NC}"

# 检查表是否存在
if supabase db diff --schema public | grep -q "exchange_goods"; then
    echo -e "${GREEN}✅ 兑换商品表创建成功${NC}"
else
    echo -e "${YELLOW}⚠️  兑换商品表可能未正确创建，请检查迁移文件${NC}"
fi

# 检查函数是否存在
if supabase db diff --schema public | grep -q "get_exchange_goods"; then
    echo -e "${GREEN}✅ 兑换商品函数创建成功${NC}"
else
    echo -e "${YELLOW}⚠️  兑换商品函数可能未正确创建，请检查迁移文件${NC}"
fi

# 验证示例数据
echo -e "${YELLOW}🔍 验证示例数据...${NC}"

# 检查是否有示例数据
GOODS_COUNT=$(supabase db query "SELECT COUNT(*) FROM exchange_goods;" --quiet | tail -n 1 | tr -d ' ')
if [ "$GOODS_COUNT" -gt 0 ]; then
    echo -e "${GREEN}✅ 示例数据插入成功，共 $GOODS_COUNT 个商品${NC}"
else
    echo -e "${YELLOW}⚠️  示例数据可能未正确插入${NC}"
fi

echo -e "${GREEN}🎉 兑换商品系统部署完成！${NC}"
echo ""
echo -e "${YELLOW}📋 部署内容总结:${NC}"
echo "  ✅ 创建兑换商品表 (exchange_goods)"
echo "  ✅ 创建兑换记录表 (points_exchange_records)"
echo "  ✅ 创建兑换限制表 (user_exchange_limits)"
echo "  ✅ 创建获取商品函数 (get_exchange_goods)"
echo "  ✅ 创建兑换商品函数 (exchange_goods_item)"
echo "  ✅ 设置RLS权限策略"
echo "  ✅ 插入示例商品数据"
echo ""
echo -e "${YELLOW}🔗 前端集成:${NC}"
echo "  ✅ 更新积分API (pointsApi.ts)"
echo "  ✅ 更新兑换页面 (PointsExchange.tsx)"
echo ""
echo -e "${YELLOW}📝 下一步操作:${NC}"
echo "  1. 重启前端应用以加载新的API"
echo "  2. 测试兑换功能"
echo "  3. 根据需要添加更多商品"
echo ""
echo -e "${GREEN}✨ 兑换商品系统已成功集成到CRM系统中！${NC}" 