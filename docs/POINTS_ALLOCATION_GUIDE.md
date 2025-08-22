# 积分分配功能使用指南

## 概述

积分分配功能是一个创新的线索分配机制，通过积分系统来控制线索的分配。用户需要消耗积分来获得线索，不同来源、类型和社区的线索有不同的积分成本。

## 功能特点

### 1. 动态积分成本
- **基础成本**：每种线索类型都有基础积分成本
- **动态调整**：根据来源、类型、社区等条件动态调整成本
- **优先级规则**：支持多级规则，按优先级匹配

### 2. 智能分配机制
- **积分检查**：分配前检查用户积分余额
- **自动扣除**：成功分配后自动扣除对应积分
- **不足处理**：积分不足时记录但不阻止分配

### 3. 完整记录系统
- **分配记录**：记录每次分配的详细信息
- **积分流水**：完整的积分变动记录
- **统计分析**：多维度的分配效果分析

## 系统架构

### 数据库表结构

#### 1. 积分成本规则表 (`lead_points_cost`)
```sql
- id: 规则ID
- name: 规则名称
- base_points_cost: 基础积分成本
- conditions: 触发条件（JSON）
- dynamic_cost_config: 动态调整配置（JSON）
- priority: 优先级
- is_active: 是否启用
```

#### 2. 积分分配记录表 (`points_allocation_records`)
```sql
- id: 记录ID
- leadid: 线索ID
- assigned_user_id: 分配用户ID
- points_cost: 积分成本
- user_balance_before: 扣除前余额
- user_balance_after: 扣除后余额
- allocation_status: 分配状态
```

### 核心函数

#### 1. 积分成本计算
```sql
calculate_lead_points_cost(source, leadtype, community, ...)
```
根据线索属性计算所需积分成本。

#### 2. 积分余额检查
```sql
check_user_points_balance(user_id, required_points)
```
检查用户积分余额是否足够。

#### 3. 带积分的分配
```sql
allocate_lead_with_points(leadid, source, leadtype, community, ...)
```
执行带积分扣除的线索分配。

## 配置指南

### 1. 创建积分成本规则

#### 基础规则示例
```sql
-- 默认线索成本
SELECT create_lead_points_cost_rule(
    '默认线索成本',
    '所有线索的默认积分成本',
    30,  -- 基础成本
    '{}',  -- 无特殊条件
    '{}',  -- 无动态调整
    100   -- 优先级
);
```

#### 高级规则示例
```sql
-- 高价值线索成本
SELECT create_lead_points_cost_rule(
    '高价值线索成本',
    '高价值线索的积分成本',
    50,  -- 基础成本
    '{"lead_types": ["意向客户", "准客户"]}',  -- 条件
    '{"source_adjustments": {"抖音": 10, "微信": 5}}',  -- 动态调整
    200   -- 优先级
);
```

### 2. 动态调整配置

#### 来源调整
```json
{
  "source_adjustments": {
    "抖音": 10,
    "微信": 5,
    "电话": -5
  }
}
```

#### 线索类型调整
```json
{
  "leadtype_adjustments": {
    "意向客户": 10,
    "准客户": 15,
    "潜在客户": -5
  }
}
```

#### 社区调整
```json
{
  "community_adjustments": {
    "浦江公园社区": 5,
    "阳光花园社区": -5
  }
}
```

### 3. 条件配置

#### 来源条件
```json
{
  "sources": ["抖音", "微信", "电话"]
}
```

#### 线索类型条件
```json
{
  "lead_types": ["意向客户", "准客户"]
}
```

#### 社区条件
```json
{
  "communities": ["浦江公园社区", "阳光花园社区"]
}
```

## 使用流程

### 1. 系统初始化

#### 步骤1：部署数据库脚本
```bash
# 执行简化分配系统
psql -d your_database -f sql-scripts/allocation/00_simplified_allocation.sql

# 执行积分分配集成
psql -d your_database -f sql-scripts/allocation/01_points_allocation_integration.sql

# 执行完整部署
psql -d your_database -f sql-scripts/allocation/02_deploy_points_allocation.sql
```

#### 步骤2：配置积分成本规则
通过管理界面或SQL创建适合的积分成本规则。

#### 步骤3：为用户分配初始积分
```sql
-- 为所有活跃用户分配初始积分
SELECT batch_update_user_points(
    ARRAY(SELECT id FROM users_profile WHERE status = 'active'),
    1000,
    '初始积分分配'
);
```

### 2. 日常使用

#### 线索分配流程
1. **线索录入**：系统自动触发分配
2. **成本计算**：根据线索属性计算积分成本
3. **余额检查**：检查用户积分余额
4. **积分扣除**：成功分配后扣除积分
5. **记录保存**：保存分配和积分记录

#### 积分不足处理
- 记录分配失败原因
- 不影响线索分配
- 用户可通过获得积分后重新分配

### 3. 监控和管理

#### 查看分配统计
```sql
-- 查看积分分配统计
SELECT * FROM points_allocation_stats;

-- 查看用户分配概览
SELECT * FROM user_points_allocation_overview;

-- 查看规则效果统计
SELECT * FROM points_cost_rule_stats;
```

#### 管理积分成本规则
- 通过管理界面创建、编辑、删除规则
- 调整优先级和条件配置
- 启用/禁用规则

## 前端界面

### 1. 积分分配功能集成
- **位置**：`/allocation` 页面的"积分规则"标签页
- **功能**：
  - 积分成本规则管理
  - 分配记录查看
  - 统计数据分析

### 2. 积分看板增强
- **新增功能**：
  - 线索分配消耗统计
  - 分配成功率分析
  - 积分不足记录

## API接口

### 1. 积分成本规则管理
```typescript
// 获取规则列表
getPointsCostRules()

// 创建规则
createPointsCostRule(ruleData)

// 更新规则
updatePointsCostRule(ruleId, ruleData)

// 删除规则
deletePointsCostRule(ruleId)
```

### 2. 分配记录管理
```typescript
// 获取分配记录
getPointsAllocationRecords(filters)

// 获取分配统计
getPointsAllocationStats()

// 获取用户分配历史
getUserPointsAllocationHistory(userId, filters)
```

### 3. 分配功能
```typescript
// 计算积分成本
calculateLeadPointsCost(params)

// 检查用户余额
checkUserPointsBalance(userId, requiredPoints)

// 带积分的分配
allocateLeadWithPoints(params)
```

## 最佳实践

### 1. 积分成本设置
- **基础成本**：根据线索质量设置合理的基础成本
- **动态调整**：根据来源和类型设置调整值
- **优先级**：重要规则设置更高优先级

### 2. 用户积分管理
- **初始分配**：为新用户分配足够的初始积分
- **定期补充**：根据用户表现定期补充积分
- **激励机制**：通过积分奖励激励用户

### 3. 监控和优化
- **定期分析**：分析分配效果和用户行为
- **规则调整**：根据数据调整积分成本规则
- **系统优化**：优化分配算法和规则配置

## 故障排除

### 1. 常见问题

#### 问题：用户积分不足但线索仍被分配
**原因**：积分不足时系统仍会分配线索，但会记录失败状态
**解决**：检查分配记录中的状态，确保用户有足够积分

#### 问题：积分成本计算错误
**原因**：规则配置不正确或优先级设置有问题
**解决**：检查积分成本规则配置，确保条件正确

#### 问题：分配记录不完整
**原因**：触发器或函数执行失败
**解决**：检查数据库日志，确保所有函数正常工作

### 2. 调试方法

#### 查看分配日志
```sql
-- 查看最近的分配记录
SELECT * FROM points_allocation_records 
ORDER BY created_at DESC LIMIT 10;

-- 查看分配日志
SELECT * FROM simple_allocation_logs 
WHERE processing_details ? 'points_integration'
ORDER BY created_at DESC LIMIT 10;
```

#### 测试分配功能
```sql
-- 测试积分分配
SELECT test_points_allocation_system();
```

#### 验证系统状态
```sql
-- 验证系统完整性
SELECT validate_points_allocation_system();
```

## 更新日志

### v1.0.0 (2024-01-XX)
- 初始版本发布
- 支持动态积分成本配置
- 集成线索分配和积分扣除
- 提供完整的管理界面
- 支持统计分析和监控

## 技术支持

如有问题或建议，请联系开发团队或查看相关文档。

---

*本文档最后更新：2024年1月* 