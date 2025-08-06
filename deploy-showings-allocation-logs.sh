#!/bin/bash

# 部署带看分配日志系统
echo "开始部署带看分配日志系统..."

# 设置颜色输出
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# 检查是否在正确的目录
if [ ! -f "create_showings_allocation_logs.sql" ]; then
    echo -e "${RED}错误: 找不到 create_showings_allocation_logs.sql 文件${NC}"
    exit 1
fi

if [ ! -f "fix_direct_queue_consumption.sql" ]; then
    echo -e "${RED}错误: 找不到 fix_direct_queue_consumption.sql 文件${NC}"
    exit 1
fi

# 1. 创建带看分配日志表
echo -e "${YELLOW}步骤 1: 创建带看分配日志表...${NC}"
psql -h db.supabase.co -p 5432 -d postgres -U postgres -f create_showings_allocation_logs.sql

if [ $? -eq 0 ]; then
    echo -e "${GREEN}✓ 带看分配日志表创建成功${NC}"
else
    echo -e "${RED}✗ 带看分配日志表创建失败${NC}"
    exit 1
fi

# 2. 更新带看分配函数
echo -e "${YELLOW}步骤 2: 更新带看分配函数...${NC}"
psql -h db.supabase.co -p 5432 -d postgres -U postgres -f fix_direct_queue_consumption.sql

if [ $? -eq 0 ]; then
    echo -e "${GREEN}✓ 带看分配函数更新成功${NC}"
else
    echo -e "${RED}✗ 带看分配函数更新失败${NC}"
    exit 1
fi

# 3. 验证部署
echo -e "${YELLOW}步骤 3: 验证部署...${NC}"

# 检查表是否存在
TABLE_EXISTS=$(psql -h db.supabase.co -p 5432 -d postgres -U postgres -t -c "SELECT EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'showings_allocation_logs');")

if [ "$TABLE_EXISTS" = " t" ]; then
    echo -e "${GREEN}✓ 带看分配日志表验证成功${NC}"
else
    echo -e "${RED}✗ 带看分配日志表验证失败${NC}"
    exit 1
fi

# 检查函数是否存在
FUNCTION_EXISTS=$(psql -h db.supabase.co -p 5432 -d postgres -U postgres -t -c "SELECT EXISTS (SELECT FROM pg_proc WHERE proname = 'assign_showings_user');")

if [ "$FUNCTION_EXISTS" = " t" ]; then
    echo -e "${GREEN}✓ 带看分配函数验证成功${NC}"
else
    echo -e "${RED}✗ 带看分配函数验证失败${NC}"
    exit 1
fi

echo -e "${GREEN}🎉 带看分配日志系统部署完成！${NC}"
echo ""
echo "功能说明："
echo "- 创建了 showings_allocation_logs 表用于记录带看分配日志"
echo "- 更新了 assign_showings_user 函数，在分配过程中记录详细日志"
echo "- 支持记录分配方法、队列类型、卡片消耗情况、质量控制结果等"
echo "- 提供了完整的索引支持，便于查询和分析"
echo ""
echo "日志表字段说明："
echo "- allocation_method: 分配方法 (assigned/direct/basic)"
echo "- queue_type: 队列类型 (direct/skip/basic)"
echo "- skip_card_consumed: 是否消耗了轮空卡"
echo "- direct_card_consumed: 是否消耗了直通卡"
echo "- quality_check_passed: 质量控制是否通过"
echo "- processing_details: 处理详情JSON"
echo "- remark: 备注信息" 