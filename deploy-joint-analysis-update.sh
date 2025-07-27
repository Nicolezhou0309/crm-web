#!/bin/bash

# =============================================
# 部署联合分析函数更新
# 修复时间: 2025年1月15日
# 目的: 应用修复后的联合分析函数和透视表函数
# =============================================

echo "🚀 开始部署联合分析函数更新..."

# 设置颜色输出
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# 检查是否在正确的目录
if [ ! -f "package.json" ]; then
    echo -e "${RED}❌ 错误: 请在项目根目录运行此脚本${NC}"
    exit 1
fi

echo -e "${YELLOW}📋 检查当前目录: $(pwd)${NC}"

# 1. 应用联合分析函数更新
echo -e "${YELLOW}📝 步骤 1: 应用联合分析函数更新...${NC}"
if [ -f "sql-scripts/setup/filter_all_analysis_multi_backup.sql" ]; then
    echo -e "${GREEN}✅ 找到联合分析函数文件${NC}"
    
    # 检查数据库连接
    echo -e "${YELLOW}🔍 测试数据库连接...${NC}"
    if psql -h localhost -U postgres -d postgres -c "SELECT 1;" > /dev/null 2>&1; then
        echo -e "${GREEN}✅ 数据库连接成功${NC}"
        
        # 应用联合分析函数
        echo -e "${YELLOW}📤 应用联合分析函数...${NC}"
        if psql -h localhost -U postgres -d postgres -f sql-scripts/setup/filter_all_analysis_multi_backup.sql; then
            echo -e "${GREEN}✅ 联合分析函数更新成功${NC}"
        else
            echo -e "${RED}❌ 联合分析函数更新失败${NC}"
            exit 1
        fi
    else
        echo -e "${RED}❌ 数据库连接失败，请检查数据库配置${NC}"
        exit 1
    fi
else
    echo -e "${RED}❌ 未找到联合分析函数文件${NC}"
    exit 1
fi

# 2. 应用透视表函数更新
echo -e "${YELLOW}📝 步骤 2: 应用透视表函数更新...${NC}"
if [ -f "supabase/migrations/20250115000015_update_pivot_for_filter_all_analysis_multi.sql" ]; then
    echo -e "${GREEN}✅ 找到透视表函数更新文件${NC}"
    
    # 应用透视表函数更新
    echo -e "${YELLOW}📤 应用透视表函数更新...${NC}"
    if psql -h localhost -U postgres -d postgres -f supabase/migrations/20250115000015_update_pivot_for_filter_all_analysis_multi.sql; then
        echo -e "${GREEN}✅ 透视表函数更新成功${NC}"
    else
        echo -e "${RED}❌ 透视表函数更新失败${NC}"
        exit 1
    fi
else
    echo -e "${RED}❌ 未找到透视表函数更新文件${NC}"
    exit 1
fi

# 3. 测试联合分析函数
echo -e "${YELLOW}📝 步骤 3: 测试联合分析函数...${NC}"
echo -e "${YELLOW}🔍 测试 filter_all_analysis_multi 函数...${NC}"
if psql -h localhost -U postgres -d postgres -c "SELECT COUNT(*) FROM filter_all_analysis_multi() LIMIT 1;" > /dev/null 2>&1; then
    echo -e "${GREEN}✅ 联合分析函数测试成功${NC}"
else
    echo -e "${RED}❌ 联合分析函数测试失败${NC}"
    exit 1
fi

# 4. 测试透视表函数
echo -e "${YELLOW}📝 步骤 4: 测试透视表函数...${NC}"
echo -e "${YELLOW}🔍 测试 execute_pivot_analysis 函数...${NC}"
if psql -h localhost -U postgres -d postgres -c "SELECT execute_pivot_analysis('joined_data', ARRAY['source'], ARRAY[], '[{\"field\": \"leadid\", \"aggregation\": \"count\"}]', '[]');" > /dev/null 2>&1; then
    echo -e "${GREEN}✅ 透视表函数测试成功${NC}"
else
    echo -e "${RED}❌ 透视表函数测试失败${NC}"
    exit 1
fi

# 5. 验证前端字段更新
echo -e "${YELLOW}📝 步骤 5: 验证前端字段更新...${NC}"
if [ -f "src/pages/DataAnalysis.tsx" ]; then
    echo -e "${GREEN}✅ 找到前端数据分析页面${NC}"
    
    # 检查是否包含新的字段定义
    if grep -q "followup_id" src/pages/DataAnalysis.tsx && grep -q "showing_id" src/pages/DataAnalysis.tsx && grep -q "deal_id" src/pages/DataAnalysis.tsx; then
        echo -e "${GREEN}✅ 前端字段更新验证成功${NC}"
    else
        echo -e "${RED}❌ 前端字段更新验证失败${NC}"
        exit 1
    fi
else
    echo -e "${RED}❌ 未找到前端数据分析页面${NC}"
    exit 1
fi

echo -e "${GREEN}🎉 联合分析函数更新部署完成！${NC}"
echo -e "${YELLOW}📋 更新内容总结:${NC}"
echo -e "${YELLOW}   ✅ 修复了联合分析函数的参数重复问题${NC}"
echo -e "${YELLOW}   ✅ 添加了 deals 表的完整筛选支持${NC}"
echo -e "${YELLOW}   ✅ 更新了透视表函数以支持新的联合分析函数${NC}"
echo -e "${YELLOW}   ✅ 更新了前端字段定义以匹配联合分析函数${NC}"
echo -e "${YELLOW}   ✅ 所有函数都通过了测试验证${NC}"

echo -e "${GREEN}🚀 现在可以在前端使用 'joined_data' 数据源进行透视表分析了！${NC}" 