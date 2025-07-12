# 积分分配系统测试指南

## 📋 测试概述

本指南帮助您验证积分分配系统是否正常工作，包括核心功能测试和边界情况测试。

## 🚀 快速开始

### 1. 执行快速测试
```sql
-- 在Supabase SQL编辑器中执行
\i quick_test_points.sql
```

### 2. 执行完整测试
```sql
-- 在Supabase SQL编辑器中执行
\i test_points_allocation.sql
```

## 🔍 测试项目清单

### ✅ 基础功能测试

#### 1. 系统组件检查
- [ ] 积分分配枚举 (`points`) 是否存在
- [ ] 积分成本表 (`lead_points_cost`) 是否存在
- [ ] 分配日志表积分字段是否存在
- [ ] 验证函数是否存在

#### 2. 积分成本计算测试
- [ ] 基础积分成本计算
- [ ] 动态成本调整（来源、类型、关键词）
- [ ] 成本规则匹配逻辑

#### 3. 积分分配逻辑测试
- [ ] 积分余额预检查
- [ ] 积分足够用户的选择
- [ ] 积分不足时的处理

#### 4. 完整分配流程测试
- [ ] 线索创建触发分配
- [ ] 积分扣除处理
- [ ] 分配日志记录
- [ ] Followups记录创建

### ✅ 边界情况测试

#### 1. 积分不足测试
- [ ] 用户积分余额为0
- [ ] 用户积分余额不足
- [ ] 所有用户积分都不足

#### 2. 成本计算边界测试
- [ ] 无匹配成本规则
- [ ] 成本计算结果为负数
- [ ] 动态调整叠加效果

#### 3. 分配逻辑边界测试
- [ ] 用户组为空
- [ ] 所有用户都被过滤掉
- [ ] 分配规则不匹配

## 📊 预期测试结果

### 1. 快速测试预期结果

#### 系统组件检查
```
✅ 积分分配枚举存在
✅ 积分成本表存在  
✅ 分配日志积分字段存在
```

#### 积分成本计算
```
✅ 基础积分成本计算正常
成本详情: {"success": true, "points_cost": 30, ...}
```

#### 积分分配逻辑
```
✅ 积分分配逻辑正常，选中用户ID: 1003
```

#### 测试线索分配
```
✅ 线索成功分配给用户
✅ 积分扣除成功
✅ Followups记录创建成功
```

### 2. 完整测试预期结果

#### 分配日志
```
leadid: TEST_HIGH_VALUE_xxx
assigned_user_id: 1003 (积分最多的用户)
allocation_method: points
points_cost: 75 (基础30 + 抖音10 + 意向客户15 + 高端20)
user_balance_before: 200
user_balance_after: 125
```

#### 积分交易记录
```
user_id: 1003
points_change: -75
balance_after: 125
transaction_type: DEDUCT
description: 线索分配扣除积分：TEST_HIGH_VALUE_xxx
```

#### Followups记录
```
leadid: TEST_HIGH_VALUE_xxx
leadtype: 意向客户
followupstage: 待接收
interviewsales_user_id: 1003
```

## 🛠️ 故障排除

### 常见问题及解决方案

#### 1. 积分分配失败
**问题**: 所有用户积分都不足
**解决**: 
```sql
-- 检查用户积分余额
SELECT user_id, total_points FROM user_points_wallet WHERE user_id IN (1001, 1002, 1003);

-- 增加用户积分
UPDATE user_points_wallet SET total_points = 200 WHERE user_id = 1001;
```

#### 2. 成本计算失败
**问题**: 成本规则不匹配
**解决**:
```sql
-- 检查成本规则
SELECT * FROM lead_points_cost WHERE is_active = true;

-- 创建默认规则
SELECT create_lead_points_cost_rule('默认规则', '默认积分成本', 30, '{}', '{}', 100);
```

#### 3. 分配规则不匹配
**问题**: 线索来源不在规则范围内
**解决**:
```sql
-- 检查分配规则
SELECT * FROM simple_allocation_rules WHERE is_active = true;

-- 修改规则条件
UPDATE simple_allocation_rules 
SET conditions = '{"sources": ["抖音", "微信", "百度", "其他"]}'
WHERE name = '积分分配测试规则';
```

#### 4. 触发器不工作
**问题**: 线索插入后没有触发分配
**解决**:
```sql
-- 检查触发器是否存在
SELECT * FROM information_schema.triggers WHERE trigger_name = 'trg_simple_lead_allocation';

-- 重新创建触发器
DROP TRIGGER IF EXISTS trg_simple_lead_allocation ON public.leads;
CREATE TRIGGER trg_simple_lead_allocation
AFTER INSERT ON public.leads
FOR EACH ROW
EXECUTE FUNCTION simple_lead_allocation_trigger();
```

## 📈 性能测试

### 1. 批量测试
```sql
-- 创建100个测试线索
DO $$
DECLARE
    i integer;
BEGIN
    FOR i IN 1..100 LOOP
        INSERT INTO leads (
            leadid, source, leadtype, campaignname, unitname, remark, 
            phone, wechat, created_at, updated_at
        ) VALUES (
            'BATCH_TEST_' || i || '_' || EXTRACT(EPOCH FROM NOW())::bigint,
            '抖音'::source,
            '意向客户',
            '批量测试广告',
            '测试单元',
            '批量测试[COMMUNITY:浦江公园社区]',
            '13900139' || LPAD(i::text, 3, '0'),
            'batch_test_' || i,
            NOW(),
            NOW()
        );
    END LOOP;
END $$;
```

### 2. 性能监控
```sql
-- 查看分配性能统计
SELECT 
    COUNT(*) as total_allocations,
    AVG(EXTRACT(EPOCH FROM created_at - LAG(created_at) OVER (ORDER BY created_at))) as avg_time_between_allocations,
    MIN(created_at) as first_allocation,
    MAX(created_at) as last_allocation
FROM simple_allocation_logs 
WHERE leadid LIKE 'BATCH_TEST_%';
```

## 🧹 清理测试数据

### 1. 清理测试线索
```sql
DELETE FROM leads WHERE leadid LIKE 'TEST_%';
DELETE FROM leads WHERE leadid LIKE 'QUICK_TEST_%';
DELETE FROM leads WHERE leadid LIKE 'BATCH_TEST_%';
```

### 2. 清理测试日志
```sql
DELETE FROM simple_allocation_logs WHERE leadid LIKE 'TEST_%';
DELETE FROM simple_allocation_logs WHERE leadid LIKE 'QUICK_TEST_%';
DELETE FROM simple_allocation_logs WHERE leadid LIKE 'BATCH_TEST_%';
```

### 3. 清理测试交易
```sql
DELETE FROM user_points_transactions WHERE description LIKE '%TEST_%';
```

### 4. 清理测试用户（谨慎操作）
```sql
-- 注意：这会删除测试用户及其所有数据
DELETE FROM users_profile WHERE id IN (1001, 1002, 1003);
DELETE FROM user_points_wallet WHERE user_id IN (1001, 1002, 1003);
```

## 📞 技术支持

如果在测试过程中遇到问题，请检查：

1. **数据库连接**: 确保Supabase连接正常
2. **权限设置**: 确保有足够的数据库权限
3. **函数存在**: 确保所有必要的函数都已创建
4. **数据完整性**: 确保相关表和数据都存在

## 🎯 测试成功标准

✅ **所有基础功能测试通过**
✅ **边界情况处理正确**  
✅ **积分计算准确**
✅ **分配逻辑正确**
✅ **数据一致性保持**
✅ **性能满足要求**

当所有测试项目都通过时，说明积分分配系统已经成功部署并正常工作！ 