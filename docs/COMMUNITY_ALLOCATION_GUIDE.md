# 社区字段分配处理指南

## 概述

线索分配系统支持基于社区（community）字段进行智能分配，社区信息有三种来源：

1. **API广告计划匹配**：基于广告数据自动映射
2. **手动输入**：通过API参数直接指定
3. **为空**：无社区信息的线索

## 三种社区来源详解

### 1. API广告计划匹配（api_matched）

**原理**：系统自动分析线索的广告相关字段，通过预配置的映射规则匹配对应社区。

**涉及字段**：
- `campaignid` - 广告计划ID
- `campaignname` - 广告计划名称
- `unitid` - 广告单元ID  
- `unitname` - 广告单元名称
- `creativedid` - 创意ID
- `creativename` - 创意名称
- `area` - 地区
- `location` - 位置信息

**映射逻辑**：
```sql
-- 匹配优先级（分数越高优先级越高）
-- 广告计划ID精确匹配：100分
-- 广告单元ID精确匹配：90分
-- 广告计划名称模糊匹配：80分
-- 广告单元名称模糊匹配：70分
-- 创意ID精确匹配：60分
-- 创意名称模糊匹配：50分
-- 地区匹配：40分
-- 位置关键词匹配：30分
-- 最低匹配阈值：50分
```

**配置示例**：
```sql
-- 万科城市花园映射规则
INSERT INTO community_mapping_rules (
    name, target_community,
    campaign_ids, campaign_names,
    unit_names, areas, locations,
    priority, confidence_score
) VALUES (
    '万科城市花园广告映射', '万科城市花园',
    ARRAY['CAMP_VANKE_001', 'CAMP_VANKE_002'],
    ARRAY['万科', '城市花园', 'VANKE'],
    ARRAY['万科城市花园', '万科花园'],
    ARRAY['南山区', '深圳南山'],
    ARRAY['万科城市花园', '万科花园', '城市花园'],
    100, 95
);
```

### 2. 手动输入（manual_input）

**原理**：通过API参数直接指定社区，优先级高于自动匹配。

**传递方式**：

**方式1：通过remark字段**
```javascript
// API调用示例
{
  "lead_data": {
    "phone": "13800138000",
    "source": "抖音",
    "leadtype": "预约看房",
    "remark": "COMMUNITY:万科城市花园|客户备注信息"
  }
}
```

**方式2：通过leadtype字段**
```javascript
// API调用示例  
{
  "lead_data": {
    "phone": "13800138000",
    "source": "抖音", 
    "leadtype": "预约看房|COMMUNITY:万科城市花园"
  }
}
```

**方式3：通过专门的API参数**
```javascript
// Edge Function调用
{
  "action": "create-lead-with-assignment",
  "lead_data": { /* 线索数据 */ },
  "community": "万科城市花园",
  "assigned_user_id": 123
}
```

### 3. 为空（empty）

**原理**：无社区信息时，使用通用分配规则。

**处理逻辑**：
- 不基于社区条件匹配分配规则
- 使用来源（source）和线索类型（leadtype）进行匹配
- 最终回退到默认分配规则

## 分配优先级策略

系统按以下优先级进行分配：

### 1. 重复客户检测（最高优先级）
```sql
-- 7天内相同手机号或微信的线索分配给原销售
-- 优先级：无限高，覆盖所有其他规则
```

### 2. 手动指定销售（次高优先级）
```sql
-- 通过API参数指定的销售人员
-- 会被重复客户规则覆盖
```

### 3. 规则匹配分配（核心逻辑）
```sql
-- 按匹配精度排序：
-- 社区+来源+类型三重匹配：2000分
-- 社区+来源匹配：1800分  
-- 社区+类型匹配：1600分
-- 单独社区匹配：1000分
-- 来源+类型匹配：800分
-- 单独来源匹配：600分
-- 单独类型匹配：400分
-- 默认规则：0分
```

### 4. 默认分配（兜底机制）
```sql
-- 两层保障：
-- 1. 名为"默认分配规则"的规则
-- 2. 系统最早注册的活跃用户
```

## 使用示例

### 创建社区映射规则

```sql
-- 华润城映射规则
SELECT create_community_mapping_rule(
    p_name := '华润城广告映射',
    p_description := '基于广告计划匹配华润城社区',
    p_target_community := '华润城',
    p_campaign_names := ARRAY['华润', '华润城', 'CR LAND'],
    p_unit_names := ARRAY['华润城', '华润万象'],
    p_areas := ARRAY['福田区', '深圳福田'],
    p_locations := ARRAY['华润城', '华润万象', '万象城'],
    p_priority := 95,
    p_confidence_score := 90
);
```

### 测试社区映射

```sql
-- 测试华润相关广告
SELECT * FROM test_community_mapping(
    p_campaign_name := '华润城夏季活动',
    p_unit_id := 'UNIT_CR_001', 
    p_location := '福田CBD'
);
```

### 创建社区分配规则

```sql
-- 华润城专项分配规则
INSERT INTO allocation_rules (
    name, description, priority,
    community_types, target_type, 
    target_users, allocation_method
) VALUES (
    '华润城专项分配', '华润城社区线索专项处理',
    100, ARRAY['华润城'], 'user',
    ARRAY[销售人员ID], 'workload'
);
```

### API调用示例

```javascript
// 1. 带社区的线索创建
const response = await fetch('/api/allocation-management', {
  method: 'POST',
  headers: {
    'Authorization': 'Bearer ' + token,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    action: 'create-lead-with-assignment',
    lead_data: {
      phone: '13800138000',
      source: '抖音',
      leadtype: '预约看房',
      campaignname: '万科城市花园春季推广',
      area: '南山区'
    },
    community: '万科城市花园', // 手动指定社区
    assigned_user_id: 123      // 手动指定销售（可选）
  })
});

// 2. 基于社区重新分配
const reallocationResponse = await fetch('/api/allocation-management', {
  method: 'POST', 
  headers: {
    'Authorization': 'Bearer ' + token,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    action: 'community-reallocation',
    leadid: 'LEAD_ID',
    community: '华润城'
  })
});

// 3. 社区映射管理
const mappingResponse = await fetch('/api/allocation-management', {
  method: 'POST',
  headers: {
    'Authorization': 'Bearer ' + token,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    action: 'community-mapping',
    action: 'create',
    name: '龙湖天街映射',
    target_community: '龙湖天街',
    campaign_names: ['龙湖', '天街'],
    areas: ['宝安区']
  })
});
```

## 监控和调试

### 分配日志查询

```sql
-- 查看社区分配统计
SELECT 
    allocation_details->>'community_source' as community_source,
    allocation_details->>'target_community' as community,
    COUNT(*) as count
FROM allocation_logs 
WHERE created_at >= NOW() - INTERVAL '7 days'
  AND allocation_details ? 'community_source'
GROUP BY 
    allocation_details->>'community_source',
    allocation_details->>'target_community'
ORDER BY count DESC;
```

### 映射效果分析

```sql
-- 社区映射成功率
SELECT 
    COUNT(*) FILTER (WHERE allocation_details->>'community_source' = 'api_matched') as api_matched,
    COUNT(*) FILTER (WHERE allocation_details->>'community_source' = 'manual_input') as manual_input,
    COUNT(*) FILTER (WHERE allocation_details->>'community_source' = 'empty') as empty,
    COUNT(*) as total
FROM allocation_logs 
WHERE created_at >= NOW() - INTERVAL '7 days';
```

### 故障排除

```sql
-- 检查无效的社区映射规则
SELECT name, target_community 
FROM community_mapping_rules 
WHERE is_active = true 
  AND target_community NOT IN (
      SELECT unnest(enum_range(NULL::community))
  );

-- 检查社区分配规则覆盖
SELECT 
    target_community,
    COUNT(*) as rule_count
FROM community_mapping_rules 
WHERE is_active = true
GROUP BY target_community
HAVING COUNT(*) > 3;  -- 超过3个规则可能冲突
```

## 性能优化

### 推荐索引

```sql
-- 广告字段索引
CREATE INDEX idx_leads_campaign_created ON leads (campaignid, created_at);
CREATE INDEX idx_leads_campaign_name ON leads (campaignname) WHERE campaignname IS NOT NULL;

-- 分配日志索引  
CREATE INDEX idx_allocation_logs_community ON allocation_logs 
USING GIN ((allocation_details->'target_community'));
```

### 配置建议

1. **映射规则优先级**：设置合理的优先级避免冲突
2. **置信度阈值**：建议不低于70%
3. **匹配阈值**：建议不低于50分
4. **规则数量**：每个社区不超过5个映射规则

## 总结

社区字段的三种处理方式为线索分配提供了灵活性：

- **API匹配**：自动化程度高，适合大批量线索
- **手动输入**：精确度高，适合重要线索
- **为空处理**：兜底机制，确保所有线索都能分配

通过合理配置映射规则和分配规则，可以实现精准的社区化线索分配，提高销售效率。 