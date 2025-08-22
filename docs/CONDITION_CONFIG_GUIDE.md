# 线索分配条件配置指南

## 概述

条件配置是线索分配规则的核心部分，用于定义何时触发分配规则。系统支持多种条件类型，可以灵活组合使用。

## 条件类型详解

### 1. 渠道条件 (Channel Condition)

**用途**：根据线索来源渠道进行分配

**配置选项**：
- **操作符**：等于、包含、不包含
- **渠道选择**：抖音、小红书、微信、QQ、电话、官网、其他

**配置示例**：
```json
{
  "type": "channel",
  "operator": "in",
  "value": ["douyin", "xiaohongshu"],
  "enabled": true
}
```

**使用场景**：
- 抖音和小红书渠道的线索分配给专门的销售团队
- 电话渠道的线索优先分配给经验丰富的销售
- 官网渠道的线索分配给客服团队

### 2. 社区条件 (Community Condition)

**用途**：根据目标社区进行分配

**配置选项**：
- **操作符**：等于、包含、不包含
- **社区选择**：北虹桥、南虹桥、东虹桥、西虹桥

**配置示例**：
```json
{
  "type": "community",
  "operator": "equals",
  "value": ["北虹桥"],
  "enabled": true
}
```

**使用场景**：
- 北虹桥社区的线索分配给专门的北虹桥销售团队
- 南虹桥社区的线索分配给南虹桥销售团队
- 跨社区线索分配给综合销售团队

### 3. 时间条件 (Time Condition)

**用途**：根据时间范围进行分配

**配置选项**：
- **时间类型**：工作时间、自定义时间、工作日、周末
- **时间范围**：开始时间、结束时间
- **星期选择**：周一至周日

**配置示例**：
```json
{
  "type": "time",
  "timeType": "work_hours",
  "startTime": "09:00",
  "endTime": "18:00",
  "weekdays": [1, 2, 3, 4, 5],
  "enabled": true
}
```

**使用场景**：
- 工作时间内分配给在线销售
- 非工作时间分配给值班客服
- 周末线索分配给周末值班团队

### 4. 用户条件 (User Condition)

**用途**：根据用户属性进行分配

**配置选项**：
- **用户属性**：用户角色、所属部门、工作经验、业绩表现
- **操作符**：等于、不等于、包含、不包含
- **属性值**：具体的属性值

**配置示例**：
```json
{
  "type": "user",
  "attribute": "role",
  "operator": "equals",
  "value": "sales",
  "enabled": true
}
```

**使用场景**：
- 高价值线索分配给高级销售
- 新客户线索分配给新手销售进行培训
- 投诉线索分配给经验丰富的客服

### 5. 预算条件 (Budget Condition)

**用途**：根据客户预算进行分配

**配置选项**：
- **预算范围**：低预算、中等预算、高预算
- **最小预算**：具体数值
- **最大预算**：具体数值

**配置示例**：
```json
{
  "type": "budget",
  "budgetRange": "high",
  "minBudget": 10000,
  "maxBudget": 50000,
  "enabled": true
}
```

**使用场景**：
- 高预算客户分配给高级销售
- 低预算客户分配给新手销售
- 中等预算客户按负载均衡分配

## 条件组合逻辑

### AND 逻辑（默认）
所有条件都必须满足才执行分配规则。

**示例**：
```json
{
  "conditions": [
    {
      "type": "channel",
      "operator": "in",
      "value": ["douyin"],
      "enabled": true
    },
    {
      "type": "community",
      "operator": "equals",
      "value": ["北虹桥"],
      "enabled": true
    },
    {
      "type": "time",
      "timeType": "work_hours",
      "startTime": "09:00",
      "endTime": "18:00",
      "enabled": true
    }
  ],
  "logic": "AND"
}
```

**解释**：只有同时满足以下条件的线索才会被分配：
1. 来源渠道是抖音
2. 目标社区是北虹桥
3. 在工作时间内（9:00-18:00）

### OR 逻辑（计划中）
任一条件满足即可执行分配规则。

## 条件优先级

当多个规则的条件都满足时，系统按以下优先级执行：

1. **规则优先级**：数字越小优先级越高
2. **策略优先级**：策略的优先级设置
3. **创建时间**：较早创建的规则优先

## 配置最佳实践

### 1. 条件设计原则

**明确性**：条件应该明确具体，避免模糊不清
```json
// 好的配置
{
  "type": "channel",
  "operator": "in",
  "value": ["douyin", "xiaohongshu"]
}

// 避免的配置
{
  "type": "channel",
  "operator": "in",
  "value": ["douyin", "xiaohongshu", "other"] // 过于宽泛
}
```

**可维护性**：条件应该易于理解和维护
```json
// 好的配置 - 使用有意义的名称
{
  "type": "time",
  "timeType": "work_hours",
  "startTime": "09:00",
  "endTime": "18:00"
}

// 避免的配置 - 使用魔法数字
{
  "type": "time",
  "timeType": "custom",
  "startTime": "09:00",
  "endTime": "18:00"
}
```

### 2. 性能考虑

**条件数量**：避免过多的条件组合，影响性能
```json
// 建议：3-5个条件
{
  "conditions": [
    { "type": "channel", "value": ["douyin"] },
    { "type": "community", "value": ["北虹桥"] },
    { "type": "time", "timeType": "work_hours" }
  ]
}

// 避免：过多条件
{
  "conditions": [
    { "type": "channel", "value": ["douyin"] },
    { "type": "community", "value": ["北虹桥"] },
    { "type": "time", "timeType": "work_hours" },
    { "type": "budget", "budgetRange": "high" },
    { "type": "user", "attribute": "role", "value": "sales" },
    { "type": "user", "attribute": "experience", "value": "senior" }
  ]
}
```

### 3. 测试建议

**单元测试**：为每个条件类型编写测试用例
```javascript
// 测试渠道条件
const testChannelCondition = {
  type: 'channel',
  operator: 'in',
  value: ['douyin']
};

// 测试时间条件
const testTimeCondition = {
  type: 'time',
  timeType: 'work_hours',
  startTime: '09:00',
  endTime: '18:00'
};
```

**集成测试**：测试条件组合的效果
```javascript
// 测试条件组合
const testConditionGroup = {
  conditions: [
    testChannelCondition,
    testTimeCondition
  ],
  logic: 'AND'
};
```

## 常见问题

### Q1: 如何配置"非工作时间"的条件？

**A1**: 使用时间条件的反向逻辑
```json
{
  "type": "time",
  "timeType": "custom",
  "startTime": "18:00",
  "endTime": "09:00",
  "enabled": true
}
```

### Q2: 如何配置"除了抖音之外的所有渠道"？

**A2**: 使用渠道条件的"不包含"操作符
```json
{
  "type": "channel",
  "operator": "not_in",
  "value": ["douyin"],
  "enabled": true
}
```

### Q3: 如何配置"高预算且来自抖音"的组合条件？

**A3**: 使用AND逻辑组合多个条件
```json
{
  "conditions": [
    {
      "type": "channel",
      "operator": "equals",
      "value": ["douyin"],
      "enabled": true
    },
    {
      "type": "budget",
      "budgetRange": "high",
      "enabled": true
    }
  ],
  "logic": "AND"
}
```

## 扩展功能（计划中）

### 1. 自定义条件
- 支持用户自定义条件类型
- 支持复杂的业务逻辑

### 2. 条件模板
- 提供常用的条件模板
- 支持条件模板的导入导出

### 3. 条件验证
- 实时验证条件配置的正确性
- 提供条件冲突检测

### 4. 条件分析
- 分析条件的使用频率
- 提供条件优化建议

## 总结

条件配置是线索分配系统的核心功能，通过合理配置条件可以实现精确的线索分配。建议根据实际业务需求，设计清晰、可维护的条件配置，并定期进行测试和优化。 