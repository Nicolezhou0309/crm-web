#!/bin/bash

# 部署带看分配并发竞争修复
echo "开始部署带看分配并发竞争修复..."

# 设置颜色输出
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# 检查是否在正确的目录
if [ ! -f "fix_direct_queue_consumption.sql" ]; then
    echo -e "${RED}错误: 找不到 fix_direct_queue_consumption.sql 文件${NC}"
    exit 1
fi

# 1. 备份当前函数
echo -e "${YELLOW}步骤 1: 备份当前函数...${NC}"
psql -h db.supabase.co -p 5432 -d postgres -U postgres -c "
-- 备份当前函数定义
SELECT pg_get_functiondef(oid) as function_definition
FROM pg_proc 
WHERE proname = 'assign_showings_user'
AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public');
" > assign_showings_user_backup_$(date +%Y%m%d_%H%M%S).sql

if [ $? -eq 0 ]; then
    echo -e "${GREEN}✓ 函数备份成功${NC}"
else
    echo -e "${YELLOW}⚠ 函数备份失败，但继续执行${NC}"
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

# 检查函数是否存在
FUNCTION_EXISTS=$(psql -h db.supabase.co -p 5432 -d postgres -U postgres -t -c "SELECT EXISTS (SELECT FROM pg_proc WHERE proname = 'assign_showings_user');")

if [ "$FUNCTION_EXISTS" = " t" ]; then
    echo -e "${GREEN}✓ 带看分配函数验证成功${NC}"
else
    echo -e "${RED}✗ 带看分配函数验证失败${NC}"
    exit 1
fi

# 4. 检查函数注释
COMMENT_CHECK=$(psql -h db.supabase.co -p 5432 -d postgres -U postgres -t -c "SELECT obj_description(oid) FROM pg_proc WHERE proname = 'assign_showings_user';")

if [[ "$COMMENT_CHECK" == *"FOR UPDATE SKIP LOCKED"* ]]; then
    echo -e "${GREEN}✓ 函数注释验证成功，包含并发竞争修复说明${NC}"
else
    echo -e "${YELLOW}⚠ 函数注释验证失败，但函数可能已正确更新${NC}"
fi

echo -e "${GREEN}🎉 带看分配并发竞争修复部署完成！${NC}"
echo ""
echo "修复说明："
echo "- 使用 FOR UPDATE SKIP LOCKED 锁定机制避免并发竞争"
echo "- 将同时消耗轮空卡和直通卡改为依次消耗"
echo "- 改进了错误处理和日志记录"
echo "- 修复了'直通队列轮空卡和直通卡消耗失败'问题"
echo ""
echo "主要改进："
echo "1. 轮空卡和直通卡依次获取和消耗，避免并发竞争"
echo "2. 使用 FOR UPDATE SKIP LOCKED 确保记录不被其他进程同时修改"
echo "3. 改进了错误信息，区分'记录不存在'和'已被锁定'"
echo "4. 增强了日志记录，便于问题诊断"
echo ""
echo "测试建议："
echo "- 在高并发环境下测试带看分配功能"
echo "- 检查日志中是否还有'消耗失败'的记录"
echo "- 验证轮空卡和直通卡的消耗是否正常" 