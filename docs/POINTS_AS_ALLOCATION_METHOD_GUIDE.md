# 积分分配作为分配模式使用指南

## 设计理念

积分分配被设计为一种分配模式，与 `round_robin`（轮流分配）、`random`（随机分配）、`workload`（按工作量分配）并列，统一集成在 `allocate_from_users` 函数中。所有分配信息都统一记录在 `simple_allocation_logs` 表中。

## 架构优势

### 1. **统一的设计模式**
```sql
-- 所有分配模式都在同一个函数中处理
allocate_from_users(user_list, method, lead_info)
```

### 2. **统一的日志记录**
```sql
-- 所有分配信息都记录在 simple_allocation_logs 表中
-- 积分分配信息作为额外字段存储
SELECT * FROM simple_allocation_logs WHERE points_cost IS NOT NULL;
```

### 3. **简化的调用流程**
```sql
-- 不需要额外的积分处理函数
-- 直接在分配时处理积分扣除
SELECT allocate_lead_simple('LEAD001', '抖音', '意向客户', '浦江公园社区');
```

### 4. **灵活的配置方式**
```sql
-- 用户组可以配置不同的分配模式
UPDATE users_list SET allocation = 'points' WHERE groupname = '积分销售组';
UPDATE users_list SET allocation = 'round_robin' WHERE groupname = '基础销售组';
```

## 核心实现

### 1. **扩展分配方法枚举**
```sql
-- 添加 'points' 到 allocation_method 枚举
ALTER TYPE allocation_method ADD VALUE 'points';
```

### 2. **扩展现有日志表**
```sql
-- 为 simple_allocation_logs 表添加积分相关字段
ALTER TABLE public.simple_allocation_logs 
ADD COLUMN points_cost integer DEFAULT NULL,
ADD COLUMN user_balance_before integer DEFAULT NULL,
ADD COLUMN user_balance_after integer DEFAULT NULL,
ADD COLUMN points_transaction_id bigint DEFAULT NULL,
ADD COLUMN cost_rule_id uuid REFERENCES lead_points_cost(id);
```

### 3. **修改 allocate_from_users 函数**
```sql
CREATE OR REPLACE FUNCTION public.allocate_from_users(
    user_list bigint[],
    method allocation_method,
    p_leadid text DEFAULT NULL,
    p_source source DEFAULT NULL,
    p_leadtype text DEFAULT NULL,
    p_community community DEFAULT NULL
) RETURNS jsonb
```

### 4. **积分分配逻辑**
```sql
WHEN 'points' THEN
    -- 选择积分余额最高的用户
    SELECT user_id INTO target_user_id
    FROM unnest(user_list) AS user_id
    ORDER BY (
        SELECT COALESCE(total_points, 0) FROM user_points_wallet 
        WHERE user_id = user_id::bigint
    ) DESC, RANDOM()
    LIMIT 1;
    
    -- 计算积分成本并扣除
    IF target_user_id IS NOT NULL AND p_leadid IS NOT NULL THEN
        -- 积分处理逻辑
    END IF;
```

## 使用方式

### 1. **配置用户组分配模式**
```sql
-- 为特定用户组启用积分分配
UPDATE users_list 
SET allocation = 'points'::allocation_method 
WHERE groupname = '高级销售组';

-- 为其他用户组使用传统分配模式
UPDATE users_list 
SET allocation = 'round_robin'::allocation_method 
WHERE groupname = '新手销售组';
```

### 2. **创建积分成本规则**
```sql
-- 创建默认积分成本规则
SELECT create_lead_points_cost_rule(
    '默认线索成本',
    '所有线索的默认积分成本',
    30,  -- 基础成本
    '{}',  -- 无特殊条件
    '{}',  -- 无动态调整
    100   -- 优先级
);

-- 创建高价值线索成本规则
SELECT create_lead_points_cost_rule(
    '高价值线索成本',
    '高价值线索的积分成本',
    50,  -- 基础成本
    '{"lead_types": ["意向客户", "准客户"]}',  -- 条件
    '{"source_adjustments": {"抖音": 10, "微信": 5}}',  -- 动态调整
    200   -- 优先级
);
```

### 3. **分配流程**
```sql
-- 系统自动调用，无需额外处理
-- 1. 线索录入触发分配
-- 2. 根据用户组配置选择分配模式
-- 3. 如果是积分分配模式，自动处理积分扣除
-- 4. 统一记录到 simple_allocation_logs 表
```

## 分配模式对比

| 分配模式 | 选择逻辑 | 适用场景 |
|---------|---------|---------|
| `round_robin` | 今日分配数量最少 | 公平分配，避免过度集中 |
| `random` | 完全随机 | 简单快速分配 |
| `workload` | 7天工作量最少 | 长期工作量平衡 |
| `points` | 积分余额最高 | 激励用户获得积分 |

## 积分分配特点

### 1. **智能用户选择**
- 优先选择积分余额最高的用户
- 确保用户有足够积分进行分配
- 积分不足时自动跳过该用户

### 2. **动态成本计算**
- 根据线索属性动态计算积分成本
- 支持多维度条件配置
- 支持动态调整规则

### 3. **智能社区匹配**
- 支持从 `remark` 中提取社区信息：`[COMMUNITY:社区名]`
- 关键词匹配支持多种来源：广告信息、备注、提取的社区
- 灵活的社区匹配规则配置

### 4. **统一日志记录**
- 所有分配信息记录在同一张表中
- 积分信息作为额外字段存储
- 提供完整的审计日志

## 智能社区匹配机制

### 1. **社区信息提取**
系统支持从线索的 `remark` 字段中提取社区信息：
```sql
-- 示例：remark字段包含社区信息
-- "客户咨询 [COMMUNITY:浦江公园社区] 关于房价"
-- 系统会自动提取 "浦江公园社区" 作为社区信息
```

### 2. **关键词匹配优先级**
关键词匹配按以下优先级进行：
1. **广告信息匹配**：`campaignname`、`unitname` 字段
2. **备注信息匹配**：`remark` 字段
3. **提取的社区匹配**：从 `remark` 中提取的 `[COMMUNITY:社区名]`

### 3. **匹配示例**
```sql
-- 线索信息
-- campaignname: "浦江公园楼盘推广"
-- unitname: "阳光花园单元"
-- remark: "客户咨询 [COMMUNITY:浦江公园社区] 关于房价"

-- 关键词规则
-- keywords: ["浦江公园", "阳光花园"]
-- 匹配结果：同时匹配 "浦江公园" 和 "阳光花园"
-- 社区信息从remark中自动提取，无需单独传递
```

## 配置示例

### 1. **混合分配策略**
```sql
-- 高级销售组：积分分配
UPDATE users_list 
SET allocation = 'points', description = '高级销售组，使用积分分配'
WHERE groupname = '高级销售组';

-- 新手销售组：轮流分配
UPDATE users_list 
SET allocation = 'round_robin', description = '新手销售组，使用轮流分配'
WHERE groupname = '新手销售组';

-- 临时销售组：随机分配
UPDATE users_list 
SET allocation = 'random', description = '临时销售组，使用随机分配'
WHERE groupname = '临时销售组';
```

### 2. **积分成本规则配置**
```sql
-- 基础规则：所有线索30积分
SELECT create_lead_points_cost_rule('基础成本', '默认成本', 30);

-- 高价值规则：意向客户50积分
SELECT create_lead_points_cost_rule(
    '高价值成本', '意向客户成本', 50,
    '{"lead_types": ["意向客户"]}'
);

-- 来源调整规则：抖音+10积分
SELECT create_lead_points_cost_rule(
    '抖音成本', '抖音来源成本', 40,
    '{"sources": ["抖音"]}',
    '{"source_adjustments": {"抖音": 10}}'
);

-- 关键词规则：浦江公园社区+15积分（支持多种匹配方式）
SELECT create_lead_points_cost_rule(
    '浦江公园成本', '浦江公园社区成本', 45,
    '{"keywords": ["浦江公园"]}',
    '{"keyword_adjustments": {"浦江公园": 15}}'
);

-- 关键词规则：支持从remark中提取的社区信息
SELECT create_lead_points_cost_rule(
    '社区匹配成本', '社区关键词匹配成本', 40,
    '{"keywords": ["浦江公园", "阳光花园", "翠湖社区"]}',
    '{"keyword_adjustments": {"浦江公园": 10, "阳光花园": 8, "翠湖社区": 12}}'
);
```

## 监控和分析

### 1. **分配效果分析**
```sql
-- 查看各分配模式的使用情况
SELECT 
    allocation_method,
    COUNT(*) as usage_count,
    COUNT(*) FILTER (WHERE assigned_user_id IS NOT NULL) as success_count
FROM simple_allocation_logs
GROUP BY allocation_method;
```

### 2. **积分分配统计**
```sql
-- 查看积分分配记录
SELECT 
    assigned_user_id,
    COUNT(*) as allocation_count,
    SUM(points_cost) as total_points_cost,
    AVG(points_cost) as avg_points_cost
FROM simple_allocation_logs
WHERE points_cost IS NOT NULL
GROUP BY assigned_user_id;
```

### 3. **用户积分分析**
```sql
-- 查看用户积分使用情况
SELECT 
    up.name,
    upw.total_points,
    COUNT(sal.id) as allocation_count,
    SUM(sal.points_cost) as total_cost
FROM users_profile up
LEFT JOIN user_points_wallet upw ON up.id = upw.user_id
LEFT JOIN simple_allocation_logs sal ON up.id = sal.assigned_user_id 
    AND sal.points_cost IS NOT NULL
WHERE up.status = 'active'
GROUP BY up.id, up.name, upw.total_points;
```

### 4. **积分分配详情查询**
```sql
-- 查看积分分配的详细信息
SELECT 
    sal.leadid,
    sal.assigned_user_id,
    up.name as user_name,
    sal.points_cost,
    sal.user_balance_before,
    sal.user_balance_after,
    sal.allocation_method,
    sal.created_at
FROM simple_allocation_logs sal
JOIN users_profile up ON sal.assigned_user_id = up.id
WHERE sal.points_cost IS NOT NULL
ORDER BY sal.created_at DESC;
```

## 最佳实践

### 1. **用户组配置**
- 根据用户能力配置不同的分配模式
- 高级用户使用积分分配，激励获得积分
- 新手用户使用传统分配，确保公平性

### 2. **积分成本设置**
- 根据线索质量设置合理的基础成本
- 使用动态调整反映线索价值差异
- 定期调整成本规则以适应业务变化

### 3. **监控和优化**
- 定期分析各分配模式的效果
- 根据数据调整分配策略
- 监控用户积分使用情况

## 故障排除

### 1. **积分不足问题**
```sql
-- 检查用户积分余额
SELECT 
    up.name,
    upw.total_points,
    COUNT(sal.id) as failed_allocations
FROM users_profile up
LEFT JOIN user_points_wallet upw ON up.id = upw.user_id
LEFT JOIN simple_allocation_logs sal ON up.id = sal.assigned_user_id 
    AND sal.processing_details->>'points_details'->>'error' = '积分不足'
WHERE up.status = 'active'
GROUP BY up.id, up.name, upw.total_points;
```

### 2. **分配失败问题**
```sql
-- 检查分配失败原因
SELECT 
    leadid,
    processing_details
FROM simple_allocation_logs
WHERE assigned_user_id IS NULL
ORDER BY created_at DESC;
```

### 3. **成本计算问题**
```sql
-- 测试积分成本计算
SELECT calculate_lead_points_cost('抖音', '意向客户', '浦江公园社区');
```

## 部署步骤

### 1. **执行数据库脚本**
```bash
# 执行积分分配模式集成脚本
psql -d your_database -f sql-scripts/allocation/03_points_as_allocation_method.sql
```

### 2. **配置用户组分配模式**
```sql
-- 为需要积分分配的用户组设置模式
UPDATE users_list 
SET allocation = 'points'::allocation_method 
WHERE groupname IN ('高级销售组', 'VIP销售组');
```

### 3. **创建积分成本规则**
```sql
-- 创建基础积分成本规则
SELECT create_lead_points_cost_rule('默认成本', '基础成本', 30);
```

### 4. **为用户分配初始积分**
```sql
-- 为活跃用户分配初始积分
SELECT batch_update_user_points(
    ARRAY(SELECT id FROM users_profile WHERE status = 'active'),
    1000, '初始积分分配'
);
```

## 统一日志的优势

### 1. **数据一致性**
- 所有分配信息都在同一张表中
- 避免数据分散和同步问题
- 简化数据查询和分析

### 2. **简化维护**
- 只需要维护一套日志系统
- 减少数据库表的数量
- 降低系统复杂度

### 3. **统一查询接口**
```sql
-- 查询所有分配记录
SELECT * FROM simple_allocation_logs ORDER BY created_at DESC;

-- 查询积分分配记录
SELECT * FROM simple_allocation_logs WHERE points_cost IS NOT NULL;

-- 查询传统分配记录
SELECT * FROM simple_allocation_logs WHERE points_cost IS NULL;
```

### 4. **完整审计追踪**
- 所有分配操作都有统一格式的日志
- 积分信息作为额外字段，不影响现有功能
- 便于审计和问题排查

## 总结

这种设计将积分分配完全集成到现有的分配系统中，使其成为一种标准的分配模式，同时统一使用现有的日志系统。主要优势包括：

1. **统一性**：所有分配模式使用相同的接口和日志系统
2. **简洁性**：不需要额外的积分处理函数和日志表
3. **灵活性**：可以为不同用户组配置不同的分配模式
4. **可维护性**：代码结构清晰，数据管理简单
5. **一致性**：所有分配信息统一记录，便于查询和分析

这种设计更符合软件工程的最佳实践，将积分分配作为分配系统的一个自然扩展，同时保持系统的简洁性和一致性。 